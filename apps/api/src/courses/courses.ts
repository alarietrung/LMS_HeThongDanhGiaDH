import { cleanContent, saveItem } from "../content";
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Req,
  Inject,
  Module,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { Db, Row } from "../db/db";
import {
  access,
  audit,
  can,
  date,
  id,
  notifySection,
  ok,
  owned,
  paging,
  parse,
  permission,
  text,
  title,
  url,
  user,
  uuid,
} from "../common";
@Controller("api/v1")
export class CourseController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("courses") async list(@Req() req: any) {
    const u = user(req),
      p = paging(req);
    const q = String(req.query.q || "");
    const rows = await this.db.q(
      `SELECT s.id,s.name section,s.status,c.code,c.name,c.description,c.image,t.name term,t.academic_year,
    (SELECT string_agg(u.name,', ') FROM enrollments e JOIN users u ON u.id=e.user_id WHERE e.section_id=s.id AND e.kind='LECTURER' AND e.active) lecturer,
    (SELECT count(*) FROM module_items mi JOIN modules m ON m.id=mi.module_id WHERE m.section_id=s.id AND mi.status='PUBLISHED' AND m.status='PUBLISHED' AND mi.deleted_at IS NULL AND m.deleted_at IS NULL) items,
    (SELECT count(*) FROM item_progress ip JOIN module_items mi ON mi.id=ip.item_id JOIN modules m ON m.id=mi.module_id WHERE m.section_id=s.id AND ip.user_id=$1 AND mi.deleted_at IS NULL AND m.deleted_at IS NULL AND mi.status='PUBLISHED' AND m.status='PUBLISHED') completed,
    (SELECT count(*) FROM assignments a WHERE a.section_id=s.id AND a.status='PUBLISHED' AND a.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM submissions sub WHERE sub.assignment_id=a.id AND sub.user_id=$1)) pending
    FROM sections s JOIN course_offerings o ON o.id=s.offering_id JOIN courses c ON c.id=o.course_id JOIN terms t ON t.id=o.term_id
    WHERE c.institution_id=$2 AND ($3 OR EXISTS(SELECT 1 FROM enrollments e WHERE e.section_id=s.id AND e.user_id=$1 AND e.active)) AND (c.name ILIKE $4 OR c.code ILIKE $4) ORDER BY c.name LIMIT $5 OFFSET $6`,
      [
        u.id,
        u.institution_id,
        can(req, "system.manage"),
        `%${q}%`,
        p.limit,
        p.offset,
      ],
    );
    return ok(rows, p);
  }
  @Get("courses/:sid") async detail(
    @Req() req: any,
    @Param("sid") sid: string,
  ) {
    const section = await access(this.db, req, sid);
    const members = await this.db.q(
      "SELECT u.id,u.name,e.kind FROM enrollments e JOIN users u ON u.id=e.user_id WHERE e.section_id=$1 AND e.active ORDER BY e.kind,u.name LIMIT 100",
      [sid],
    );
    return ok({ ...section, members });
  }
  @Get("courses/:sid/modules") async modules(
    @Req() req: any,
    @Param("sid") sid: string,
  ) {
    const s = await access(this.db, req, sid);
    const modules = await this.db.q(
      `SELECT * FROM modules WHERE section_id=$1 AND deleted_at IS NULL AND ($2 OR status='PUBLISHED') ORDER BY position,id`,
      [sid, s.manage],
    );
    const items = await this.db.q(
      `SELECT mi.*,ip.completed_at,pr.completed_at prerequisite_completed FROM module_items mi JOIN modules m ON m.id=mi.module_id LEFT JOIN item_progress ip ON ip.item_id=mi.id AND ip.user_id=$2 LEFT JOIN item_progress pr ON pr.item_id=mi.prerequisite_id AND pr.user_id=$2 WHERE m.section_id=$1 AND mi.deleted_at IS NULL AND ($3 OR mi.status IN ('PUBLISHED','SCHEDULED')) ORDER BY mi.position,mi.id`,
      [sid, user(req).id, s.manage],
    );
    return ok(
      modules.map((m) => ({
        ...m,
        items: items
          .filter((i) => i.module_id === m.id)
          .map((i) => {
            const locked =
              !s.manage &&
              ((i.available_at && new Date(i.available_at) > new Date()) ||
                (i.prerequisite_id && !i.prerequisite_completed));
            return {
              ...i,
              locked,
              content: locked ? "" : i.content,
              url: locked ? null : i.url,
            };
          }),
      })),
    );
  }
  @Post("courses/:sid/modules") async createModule(
    @Req() req: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, req, sid, "module.manage", true);
    const b = parse(
      z.object({
        title,
        status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
      }),
      req.body,
    );
    const m = await this.db.one(
      "INSERT INTO modules(section_id,title,status,position) VALUES($1,$2,$3,(SELECT coalesce(max(position),-1)+1 FROM modules WHERE section_id=$1)) RETURNING *",
      [sid, b.title, b.status],
    );
    await audit(this.db, req, "MODULE_CREATED", "module", m!.id, null, b);
    return ok(m);
  }
  @Patch("modules/:id") async updateModule(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const m = await owned(this.db, "modules", id);
    await access(this.db, req, m.section_id, "module.manage", true);
    const b = parse(
      z.object({
        title: title.optional(),
        status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]).optional(),
        position: z.number().int().min(0).optional(),
      }),
      req.body,
    );
    const r = await this.db.one(
      "UPDATE modules SET title=coalesce($2,title),status=coalesce($3,status),position=coalesce($4,position) WHERE id=$1 RETURNING *",
      [id, b.title, b.status, b.position],
    );
    await audit(this.db, req, "MODULE_UPDATED", "module", id, m, b);
    return ok(r);
  }
  @Post("modules/:id/items") async createItem(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const m = await owned(this.db, "modules", id);
    await access(this.db, req, m.section_id, "module.manage", true);
    const b = parse(
      z.object({
        title,
        type: z
          .enum(["PAGE", "URL", "VIDEO", "FILE", "PDF", "AUDIO"])
          .default("PAGE"),
        content: z.string().max(100000).default(""),
        content_format: z.enum(["TEXT", "HTML"]).default("TEXT"),
        url: url.optional(),
        status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]).default("DRAFT"),
        available_at: date.nullable().optional(),
        prerequisite_id: uuid.nullable().optional(),
      }),
      req.body,
    );
    if (b.status === "SCHEDULED" && !b.available_at)
      throw new BadRequestException("Nội dung lên lịch cần thời gian mở.");
    if (b.prerequisite_id) {
      const p = await this.db.one(
        "SELECT m.section_id FROM module_items i JOIN modules m ON m.id=i.module_id WHERE i.id=$1",
        [b.prerequisite_id],
      );
      if (p?.section_id !== m.section_id)
        throw new BadRequestException(
          "Điều kiện mở khóa phải thuộc cùng học phần.",
        );
    }
    const row = await this.db.one(
      "INSERT INTO module_items(module_id,title,type,content,url,status,available_at,prerequisite_id,content_format,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,(SELECT coalesce(max(position),-1)+1 FROM module_items WHERE module_id=$1)) RETURNING *",
      [
        id,
        b.title,
        b.type,
        cleanContent(b.content, b.content_format),
        b.url || null,
        b.status,
        b.available_at || null,
        b.prerequisite_id || null,
        b.content_format,
      ],
    );
    await audit(this.db, req, "ITEM_CREATED", "module_item", row!.id);
    return ok(row);
  }
  @Patch("items/:id") async updateItem(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const item = await owned(this.db, "module_items", id),
      m = await owned(this.db, "modules", item.module_id);
    await access(this.db, req, m.section_id, "module.manage", true);
    const b = parse(
      z.object({
        title: title.optional(),
        content: z.string().max(100000).optional(),
        content_format: z.enum(["TEXT", "HTML"]).optional(),
        base_revision: z.number().int().positive().optional(),
        url: url.nullable().optional(),
        status: z
          .enum(["DRAFT", "PUBLISHED", "HIDDEN", "SCHEDULED"])
          .optional(),
        position: z.number().int().min(0).optional(),
        available_at: date.nullable().optional(),
      }),
      req.body,
    );
    return ok(await this.db.tx((tx) => saveItem(tx, req, id, b)));
  }
  @Delete("items/:id") async deleteItem(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const i = await owned(this.db, "module_items", id),
      m = await owned(this.db, "modules", i.module_id);
    await access(this.db, req, m.section_id, "module.manage", true);
    await this.db.q("UPDATE module_items SET deleted_at=now() WHERE id=$1", [
      id,
    ]);
    await audit(this.db, req, "ITEM_ARCHIVED", "module_item", id);
    return ok({ archived: true });
  }
  @Post("items/:id/complete") async complete(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const i = await owned(this.db, "module_items", id),
      m = await owned(this.db, "modules", i.module_id);
    await access(this.db, req, m.section_id, "course.view", true);
    if (
      i.status !== "PUBLISHED" ||
      m.status !== "PUBLISHED" ||
      i.deleted_at ||
      m.deleted_at ||
      (i.available_at && new Date(i.available_at) > new Date())
    )
      throw new ForbiddenException("Nội dung chưa được mở.");
    if (
      i.prerequisite_id &&
      !(await this.db.one(
        "SELECT 1 FROM item_progress WHERE user_id=$1 AND item_id=$2",
        [user(req).id, i.prerequisite_id],
      ))
    )
      throw new ForbiddenException("Cần hoàn thành nội dung trước.");
    await this.db.q(
      "INSERT INTO item_progress(user_id,item_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [user(req).id, id],
    );
    return ok({ completed: true });
  }
  @Get("courses/:sid/announcements") async announcements(
    @Req() req: any,
    @Param("sid") sid: string,
  ) {
    const s = await access(this.db, req, sid),
      p = paging(req);
    return ok(
      await this.db.q(
        "SELECT a.*,u.name author FROM announcements a JOIN users u ON u.id=a.author_id WHERE section_id=$1 AND ($2 OR (publish_at<=now() AND (expires_at IS NULL OR expires_at>now()))) ORDER BY pinned DESC,created_at DESC LIMIT $3 OFFSET $4",
        [sid, s.manage, p.limit, p.offset],
      ),
      p,
    );
  }
  @Post("courses/:sid/announcements") async postAnnouncement(
    @Req() req: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, req, sid, "announcement.manage", true);
    const b = parse(
      z.object({
        title,
        content: text,
        pinned: z.boolean().default(false),
        publish_at: date.optional(),
      }),
      req.body,
    );
    const row = await this.db.tx(async (tx) => {
      const a = await tx.one(
        "INSERT INTO announcements(section_id,title,content,pinned,publish_at,author_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          sid,
          b.title,
          b.content,
          b.pinned,
          b.publish_at || new Date(),
          user(req).id,
        ],
      );
      if (!b.publish_at || new Date(b.publish_at) <= new Date()) {
        await notifySection(
          tx,
          sid,
          b.title,
          b.content.slice(0, 200),
          `/courses/${sid}?tab=announcements`,
        );
        await tx.q("UPDATE announcements SET notified_at=now() WHERE id=$1", [
          a!.id,
        ]);
      }
      await audit(tx, req, "ANNOUNCEMENT_CREATED", "announcement", a!.id);
      return a;
    });
    return ok(row);
  }
  @Get("courses/:sid/groups") async groups(
    @Req() req: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, req, sid);
    return ok(
      await this.db.q(
        "SELECT g.*,coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.name)) FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=g.id),'[]'::jsonb) members FROM study_groups g WHERE section_id=$1",
        [sid],
      ),
    );
  }
  @Post("courses/:sid/groups") async createGroup(
    @Req() req: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, req, sid, "course.manage", true);
    const b = parse(
      z.object({
        name: title,
        description: z.string().max(4000).default(""),
        members: z.array(uuid).max(100),
      }),
      req.body,
    );
    const row = await this.db.tx(async (tx) => {
      for (const uid of b.members)
        if (
          !(await tx.one(
            "SELECT 1 FROM enrollments WHERE section_id=$1 AND user_id=$2 AND active=true",
            [sid, uid],
          ))
        )
          throw new BadRequestException("Thành viên không thuộc lớp.");
      const g = await tx.one(
        "INSERT INTO study_groups(section_id,name,description,leader_id) VALUES($1,$2,$3,$4) RETURNING *",
        [sid, b.name, b.description, b.members[0] || null],
      );
      for (const uid of new Set(b.members))
        await tx.q("INSERT INTO group_members VALUES($1,$2)", [g!.id, uid]);
      await audit(tx, req, "GROUP_CREATED", "group", g!.id);
      return g;
    });
    return ok(row);
  }
  @Get("courses/:sid/outcomes") async outcomes(
    @Req() req: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, req, sid);
    return ok(
      await this.db.q(
        `SELECT lo.*, (SELECT sum(g.score/g.max_score*100*om.weight/100) FROM outcome_mappings om JOIN grades g ON g.source_id=om.assignment_id AND g.source_type='ASSIGNMENT' AND g.user_id=$2 AND g.status='RELEASED' WHERE om.outcome_id=lo.id) attainment FROM learning_outcomes lo WHERE lo.section_id=$1`,
        [sid, user(req).id],
      ),
    );
  }
  @Post("courses/:sid/outcomes") async createOutcome(
    @Req() req: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, req, sid, "course.manage", true);
    const b = parse(
      z.object({
        code: title,
        description: text,
        plo: z.string().max(100),
        mappings: z
          .array(
            z.object({
              assignment_id: uuid,
              weight: z.number().positive().max(100),
            }),
          )
          .min(1),
      }),
      req.body,
    );
    if (Math.abs(b.mappings.reduce((a, m) => a + m.weight, 0) - 100) > 0.001)
      throw new BadRequestException("Tổng trọng số phải bằng 100%.");
    return ok(
      await this.db.tx(async (tx) => {
        for (const m of b.mappings)
          if (
            (await owned(tx, "assignments", m.assignment_id)).section_id !== sid
          )
            throw new BadRequestException();
        const o = await tx.one(
          "INSERT INTO learning_outcomes(section_id,code,description,plo) VALUES($1,$2,$3,$4) RETURNING *",
          [sid, b.code, b.description, b.plo],
        );
        for (const m of b.mappings)
          await tx.q("INSERT INTO outcome_mappings VALUES($1,$2,$3)", [
            o!.id,
            m.assignment_id,
            m.weight,
          ]);
        return o;
      }),
    );
  }
}
@Module({ controllers: [CourseController] })
export class CourseModule {}
