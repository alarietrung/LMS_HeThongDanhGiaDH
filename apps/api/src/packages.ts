import {
  Controller,
  Get,
  Post,
  Req,
  Param,
  Inject,
  Module,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { z } from "zod";
import { Db, Row } from "./db/db";
import { access, audit, ok, owned, parse, title, url, user } from "./common";
import { cleanContent } from "./content";
import { questionSchema, validateQuestion } from "./learning/question-schema";
const itemSchema = z.object({
  title,
  type: z
    .enum(["PAGE", "FILE", "URL", "VIDEO", "PDF", "AUDIO"])
    .default("PAGE"),
  content: z.string().max(100000).default(""),
  content_format: z.enum(["TEXT", "HTML"]).default("TEXT"),
  url: url.nullable().default(null),
});
const packageSchema = z.object({
  format: z.literal("MITUNI_LEARNING_PACKAGE"),
  version: z.literal(1),
  modules: z
    .array(z.object({ title, items: z.array(itemSchema).max(50) }))
    .max(30)
    .default([]),
  questions: z.array(questionSchema).max(200).default([]),
});
@Controller("api/v1")
class PackageController {
  constructor(@Inject(Db) private db: Db) {}
  async allowed(r: any, sid: string, write = false) {
    await access(this.db, r, sid, "module.manage", write);
    await access(this.db, r, sid, "quiz.manage", write);
  }
  @Get("courses/:sid/package") async export(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await this.allowed(r, sid);
    const modules = await this.db.q(
      "SELECT id,title FROM modules WHERE section_id=$1 AND deleted_at IS NULL ORDER BY position,created_at",
      [sid],
    );
    for (const m of modules) {
      m.items = await this.db.q(
        "SELECT title,type,content,content_format,url FROM module_items WHERE module_id=$1 AND deleted_at IS NULL ORDER BY position,created_at",
        [m.id],
      );
      delete m.id;
    }
    const questions = await this.db.q(
      "SELECT q.type,q.prompt,q.options,q.answer,q.points,q.explanation,q.tags FROM questions q JOIN question_banks b ON b.id=q.bank_id WHERE b.section_id=$1 ORDER BY q.created_at",
      [sid],
    );
    const payload = {
      format: "MITUNI_LEARNING_PACKAGE",
      version: 1,
      modules,
      questions: questions.map((q) => ({ ...q, points: Number(q.points) })),
    };
    parse(packageSchema, payload);
    if (Buffer.byteLength(JSON.stringify(payload)) > 900000)
      throw new BadRequestException(
        "Gói vượt giới hạn 900 KB. Cần tách nội dung trước khi xuất.",
      );
    await audit(this.db, r, "LEARNING_PACKAGE_EXPORTED", "section", sid);
    return ok(payload);
  }
  @Post("courses/:sid/package/preview") async preview(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await this.allowed(r, sid, true);
    const payload = parse(packageSchema, r.body);
    if (!payload.modules.length && !payload.questions.length)
      throw new BadRequestException("Gói chưa có nội dung.");
    for (const m of payload.modules)
      for (const i of m.items)
        i.content = cleanContent(i.content, i.content_format);
    payload.questions = payload.questions.map(validateQuestion);
    const summary = {
      modules: payload.modules.length,
      items: payload.modules.reduce((n, m) => n + m.items.length, 0),
      questions: payload.questions.length,
      titles: payload.modules.map((m) => m.title),
    };
    const row = await this.db.one(
      "INSERT INTO learning_imports(section_id,actor_id,payload,summary) VALUES($1,$2,$3,$4) RETURNING id,summary,status",
      [sid, user(r).id, JSON.stringify(payload), JSON.stringify(summary)],
    );
    await audit(
      this.db,
      r,
      "LEARNING_PACKAGE_PREVIEWED",
      "learning_import",
      row!.id,
    );
    return ok(row);
  }
  @Post("package-imports/:id/execute") async execute(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const imported = await owned(this.db, "learning_imports", id);
    if (imported.actor_id !== user(r).id) throw new ForbiddenException();
    await this.allowed(r, imported.section_id, true);
    return ok(
      await this.db.tx(async (tx) => {
        const job = (await tx.one(
          "SELECT * FROM learning_imports WHERE id=$1 FOR UPDATE",
          [id],
        ))!;
        if (job.status === "COMPLETED")
          return { id, status: job.status, summary: job.summary };
        if (Date.now() - new Date(job.created_at).getTime() > 86400000)
          throw new BadRequestException(
            "Bản xem trước hết hạn sau 24 giờ. Vui lòng nhập lại.",
          );
        const payload = parse(packageSchema, job.payload);
        const offset = Number(
          (await tx.one(
            "SELECT coalesce(max(position),-1)+1 position FROM modules WHERE section_id=$1",
            [job.section_id],
          ))!.position,
        );
        for (const [index, m] of payload.modules.entries()) {
          const made = await tx.one(
            "INSERT INTO modules(section_id,title,position,status) VALUES($1,$2,$3,'DRAFT') RETURNING id",
            [job.section_id, m.title, offset + index],
          );
          for (const [pos, i] of m.items.entries())
            await tx.q(
              "INSERT INTO module_items(module_id,title,type,content,content_format,url,position,status) VALUES($1,$2,$3,$4,$5,$6,$7,'DRAFT')",
              [
                made!.id,
                i.title,
                i.type,
                cleanContent(i.content, i.content_format),
                i.content_format,
                i.url,
                pos,
              ],
            );
        }
        if (payload.questions.length) {
          const bank = await tx.one(
            "INSERT INTO question_banks(section_id,title) VALUES($1,$2) RETURNING id",
            [job.section_id, "Ngân hàng nhập từ gói học liệu"],
          );
          for (const raw of payload.questions) {
            const q = validateQuestion(raw);
            await tx.q(
              "INSERT INTO questions(bank_id,type,prompt,options,answer,points,explanation,tags) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
              [
                bank!.id,
                q.type,
                q.prompt,
                JSON.stringify(q.options),
                JSON.stringify(q.answer),
                q.points,
                q.explanation,
                JSON.stringify(q.tags),
              ],
            );
          }
        }
        await tx.q(
          "UPDATE learning_imports SET status='COMPLETED',finished_at=now() WHERE id=$1",
          [id],
        );
        await audit(
          tx,
          r,
          "LEARNING_PACKAGE_IMPORTED",
          "learning_import",
          id,
          null,
          job.summary,
        );
        return { id, status: "COMPLETED", summary: job.summary };
      }),
    );
  }
}
@Module({ controllers: [PackageController] })
export class PackageModule {}
