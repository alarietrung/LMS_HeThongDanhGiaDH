import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Req,
  Inject,
  Module,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { z } from "zod";
import { Db, Query, Row } from "../db/db";
import {
  access,
  audit,
  date,
  notify,
  ok,
  owned,
  paging,
  parse,
  text,
  title,
  user,
  uuid,
} from "../common";
import { TYPES, validateQuestion } from "./question-schema";
export { TYPES } from "./question-schema";
const normalize = (a: any) =>
  String(a ?? "")
    .trim()
    .toLocaleLowerCase("vi-VN");
export function scoreQuestion(q: Row, a: any): number | null {
  if (["ESSAY", "FILE_UPLOAD"].includes(q.type)) return null;
  if (a === undefined || a === null || a === "") return 0;
  let correct = false;
  if (q.type === "NUMERIC") {
    const answer =
      typeof q.answer === "object"
        ? q.answer
        : { value: q.answer, tolerance: 0 };
    correct =
      Number.isFinite(Number(a)) &&
      Math.abs(Number(a) - Number(answer.value)) <=
        Number(answer.tolerance || 0);
  } else if (q.type === "MULTIPLE_CHOICE")
    correct =
      Array.isArray(a) &&
      JSON.stringify([...new Set(a)].sort()) ===
        JSON.stringify([...q.answer].sort());
  else if (["MATCHING", "ORDERING", "FILL_BLANK"].includes(q.type))
    correct =
      Array.isArray(a) &&
      JSON.stringify(a.map(normalize)) ===
        JSON.stringify(q.answer.map(normalize));
  else correct = normalize(a) === normalize(q.answer);
  return correct ? Number(q.points) : 0;
}
export async function finalize(tx: Query, attempt: Row) {
  if (attempt.status !== "IN_PROGRESS") return attempt;
  const qz = await owned(tx, "quizzes", attempt.quiz_id);
  let score = 0,
    max = 0,
    manual = false;
  for (const q of attempt.questions) {
    max += Number(q.points);
    const v = scoreQuestion(q, attempt.answers[q.id]);
    if (v === null) manual = true;
    else score += v;
  }
  const status = manual ? "PENDING_REVIEW" : "SUBMITTED";
  const saved = await tx.one(
    "UPDATE quiz_attempts SET score=$2,max_score=$3,status=$4,submitted_at=now() WHERE id=$1 RETURNING *",
    [attempt.id, score, max, status],
  );
  await tx.q(
    `INSERT INTO grades(section_id,user_id,source_type,source_id,title,category,score,max_score,status) VALUES($1,$2,'QUIZ',$3,$4,'Quiz',$5,$6,'DRAFT') ON CONFLICT(user_id,source_type,source_id) DO UPDATE SET score=excluded.score,max_score=excluded.max_score,status='DRAFT',updated_at=now()`,
    [
      qz.section_id,
      attempt.user_id,
      attempt.quiz_id,
      qz.title,
      score,
      max || 1,
    ],
  );
  await notify(
    tx,
    attempt.user_id,
    "Đã nộp bài kiểm tra",
    qz.title,
    `/courses/${qz.section_id}?tab=quizzes`,
  );
  return saved!;
}
function publicAttempt(a: Row, q: Row) {
  const review =
    a.status !== "IN_PROGRESS" &&
    (q.review_policy === "IMMEDIATE" || new Date(q.closes_at) < new Date());
  return {
    ...a,
    section_id: q.section_id,
    score: review ? a.score : null,
    manual_scores: review ? a.manual_scores : {},
    review_feedback: review ? a.review_feedback : "",
    questions: a.questions.map((x: Row) => {
      const { answer, explanation, ...rest } = x;
      return review ? x : rest;
    }),
    review,
  };
}
export async function expireAttempts(db: Db) {
  const list = await db.q(
    "SELECT id FROM quiz_attempts WHERE status='IN_PROGRESS' AND expires_at<=now() LIMIT 100",
  );
  for (const a of list)
    await db.tx(async (tx) => {
      const attempt = await tx.one(
        "SELECT * FROM quiz_attempts WHERE id=$1 FOR UPDATE",
        [a.id],
      );
      if (attempt) await finalize(tx, attempt);
    });
}
@Controller("api/v1")
export class QuizController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("courses/:sid/quizzes") async list(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    const s = await access(this.db, r, sid);
    await expireAttempts(this.db);
    return ok(
      await this.db.q(
        `SELECT q.*,(SELECT count(*) FROM quiz_questions WHERE quiz_id=q.id) question_count,(SELECT count(*) FROM quiz_attempts WHERE quiz_id=q.id AND user_id=$2) attempts,(SELECT id FROM quiz_attempts WHERE quiz_id=q.id AND user_id=$2 ORDER BY started_at DESC LIMIT 1) latest_attempt FROM quizzes q WHERE section_id=$1 AND deleted_at IS NULL AND ($3 OR status='PUBLISHED') ORDER BY opens_at LIMIT 100`,
        [sid, user(r).id, s.manage],
      ),
    );
  }
  @Post("courses/:sid/quizzes") async create(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "quiz.manage", true);
    const b = parse(
      z.object({
        title,
        description: z.string().max(10000).default(""),
        duration_minutes: z.number().int().min(1).max(300),
        opens_at: date,
        closes_at: date,
        max_attempts: z.number().int().min(1).max(20).default(2),
        shuffle: z.boolean().default(true),
        status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
        review_policy: z
          .enum(["IMMEDIATE", "AFTER_CLOSE"])
          .default("AFTER_CLOSE"),
        question_ids: z.array(uuid).min(1).max(200),
      }),
      r.body,
    );
    if (
      new Date(b.closes_at) <= new Date(b.opens_at) ||
      new Set(b.question_ids).size !== b.question_ids.length
    )
      throw new BadRequestException(
        "Thời gian hoặc danh sách câu hỏi không hợp lệ.",
      );
    return ok(
      await this.db.tx(async (tx) => {
        for (const qid of b.question_ids) {
          const row = await tx.one(
            "SELECT b.section_id FROM questions q JOIN question_banks b ON b.id=q.bank_id WHERE q.id=$1",
            [qid],
          );
          if (row?.section_id !== sid)
            throw new ForbiddenException("Câu hỏi không thuộc học phần.");
        }
        const q = await tx.one(
          "INSERT INTO quizzes(section_id,title,description,duration_minutes,opens_at,closes_at,max_attempts,shuffle,status,review_policy) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
          [
            sid,
            b.title,
            b.description,
            b.duration_minutes,
            b.opens_at,
            b.closes_at,
            b.max_attempts,
            b.shuffle,
            b.status,
            b.review_policy,
          ],
        );
        for (const [pos, qid] of b.question_ids.entries())
          await tx.q("INSERT INTO quiz_questions VALUES($1,$2,$3)", [
            q!.id,
            qid,
            pos,
          ]);
        await audit(tx, r, "QUIZ_CREATED", "quiz", q!.id);
        return q;
      }),
    );
  }
  @Get("courses/:sid/questions") async questions(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "quiz.manage");
    const p = paging(r);
    return ok(
      await this.db.q(
        "SELECT q.*,b.title bank FROM questions q JOIN question_banks b ON b.id=q.bank_id WHERE b.section_id=$1 ORDER BY q.created_at DESC LIMIT $2 OFFSET $3",
        [sid, p.limit, p.offset],
      ),
      p,
    );
  }
  @Post("courses/:sid/questions") async question(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "quiz.manage", true);
    const b = validateQuestion(r.body);
    const bank =
      (await this.db.one(
        "SELECT id FROM question_banks WHERE section_id=$1 LIMIT 1",
        [sid],
      )) ||
      (await this.db.one(
        "INSERT INTO question_banks(section_id,title) VALUES($1,$2) RETURNING id",
        [sid, "Ngân hàng câu hỏi"],
      ));
    const q = await this.db.one(
      "INSERT INTO questions(bank_id,type,prompt,options,answer,points,explanation,tags) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [
        bank!.id,
        b.type,
        b.prompt,
        JSON.stringify(b.options),
        JSON.stringify(b.answer ?? null),
        b.points,
        b.explanation,
        JSON.stringify(b.tags),
      ],
    );
    await audit(this.db, r, "QUESTION_CREATED", "question", q!.id);
    return ok(q);
  }
  @Post("quizzes/:id/attempts") async start(
    @Req() r: any,
    @Param("id") qid: string,
  ) {
    const q = await owned(this.db, "quizzes", qid);
    await access(this.db, r, q.section_id, "quiz.attempt", true);
    return ok(
      await this.db.tx(async (tx) => {
        await tx.q("SELECT id FROM quizzes WHERE id=$1 FOR UPDATE", [qid]);
        const existing = await tx.one(
          "SELECT * FROM quiz_attempts WHERE quiz_id=$1 AND user_id=$2 AND status='IN_PROGRESS'",
          [qid, user(r).id],
        );
        if (existing) {
          if (new Date(existing.expires_at) <= new Date())
            return publicAttempt(await finalize(tx, existing), q);
          return publicAttempt(existing, q);
        }
        const now = new Date();
        if (
          q.status !== "PUBLISHED" ||
          q.deleted_at ||
          now < new Date(q.opens_at) ||
          now >= new Date(q.closes_at)
        )
          throw new ForbiddenException(
            "Bài kiểm tra chưa mở hoặc đã kết thúc.",
          );
        const count = Number(
          (await tx.one(
            "SELECT count(*) n FROM quiz_attempts WHERE quiz_id=$1 AND user_id=$2",
            [qid, user(r).id],
          ))!.n,
        );
        if (count >= q.max_attempts)
          throw new BadRequestException("Đã hết số lần làm bài.");
        const questions = await tx.q(
          "SELECT q.* FROM questions q JOIN quiz_questions qq ON qq.question_id=q.id WHERE qq.quiz_id=$1 ORDER BY qq.position",
          [qid],
        );
        if (!questions.length)
          throw new BadRequestException("Bài kiểm tra chưa có câu hỏi.");
        if (q.shuffle) {
          for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
          }
        }
        const expires = new Date(
          Math.min(
            Date.now() + q.duration_minutes * 60000,
            new Date(q.closes_at).getTime(),
          ),
        );
        const a = await tx.one(
          "INSERT INTO quiz_attempts(quiz_id,user_id,attempt,questions,expires_at,device) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [
            qid,
            user(r).id,
            count + 1,
            JSON.stringify(questions),
            expires,
            String(r.headers["user-agent"] || "").slice(0, 200),
          ],
        );
        await audit(tx, r, "QUIZ_STARTED", "quiz_attempt", a!.id);
        return publicAttempt(a!, q);
      }),
    );
  }
  @Get("quizzes/:id/review") async reviewList(
    @Req() r: any,
    @Param("id") qid: string,
  ) {
    const q = await owned(this.db, "quizzes", qid);
    await access(this.db, r, q.section_id, "gradebook.manage");
    const p = paging(r);
    return ok(
      await this.db.q(
        "SELECT a.*,u.name student,u.student_code FROM quiz_attempts a JOIN users u ON u.id=a.user_id WHERE a.quiz_id=$1 AND a.status<>'IN_PROGRESS' ORDER BY a.submitted_at DESC LIMIT $2 OFFSET $3",
        [qid, p.limit, p.offset],
      ),
      p,
    );
  }
  @Post("attempts/:id/review") async review(
    @Req() r: any,
    @Param("id") aid: string,
  ) {
    const a = await owned(this.db, "quiz_attempts", aid),
      q = await owned(this.db, "quizzes", a.quiz_id);
    await access(this.db, r, q.section_id, "gradebook.manage", true);
    const b = parse(
      z.object({
        scores: z.record(uuid, z.number().min(0)),
        feedback: z.string().max(10000).default(""),
      }),
      r.body,
    );
    return ok(
      await this.db.tx(async (tx) => {
        const current = (await tx.one(
          "SELECT * FROM quiz_attempts WHERE id=$1 FOR UPDATE",
          [aid],
        ))!;
        if (current.status === "IN_PROGRESS")
          throw new BadRequestException("Bài làm chưa nộp.");
        const manual = current.questions.filter((x: Row) =>
          ["ESSAY", "FILE_UPLOAD"].includes(x.type),
        );
        if (
          Object.keys(b.scores).length !== manual.length ||
          manual.some(
            (x: Row) =>
              b.scores[x.id] === undefined || b.scores[x.id] > Number(x.points),
          )
        )
          throw new BadRequestException(
            "Cần nhập điểm hợp lệ cho từng câu tự luận hoặc tệp.",
          );
        let score = 0;
        for (const question of current.questions)
          score +=
            scoreQuestion(question, current.answers[question.id]) ??
            b.scores[question.id];
        const saved = await tx.one(
          "UPDATE quiz_attempts SET score=$2,status='GRADED',review_feedback=$3,manual_scores=$4 WHERE id=$1 RETURNING *",
          [aid, score, b.feedback, JSON.stringify(b.scores)],
        );
        const latest = await tx.one(
          "SELECT id FROM quiz_attempts WHERE quiz_id=$1 AND user_id=$2 AND status<>'IN_PROGRESS' ORDER BY attempt DESC LIMIT 1",
          [a.quiz_id, a.user_id],
        );
        if (latest?.id === aid)
          await tx.q(
            "UPDATE grades SET score=$3,feedback=$4,graded_by=$5,status='DRAFT',updated_at=now() WHERE source_type='QUIZ' AND source_id=$1 AND user_id=$2",
            [a.quiz_id, a.user_id, score, b.feedback, user(r).id],
          );
        await audit(
          tx,
          r,
          "QUIZ_REVIEWED",
          "quiz_attempt",
          aid,
          { score: current.score },
          { score },
        );
        return saved;
      }),
    );
  }
  @Get("attempts/:id") async get(@Req() r: any, @Param("id") id: string) {
    let a = await owned(this.db, "quiz_attempts", id);
    if (a.user_id !== user(r).id) throw new ForbiddenException();
    const q = await owned(this.db, "quizzes", a.quiz_id);
    await access(this.db, r, q.section_id);
    if (a.status === "IN_PROGRESS" && new Date(a.expires_at) <= new Date())
      a = await this.db.tx(async (tx) =>
        finalize(
          tx,
          (await tx.one("SELECT * FROM quiz_attempts WHERE id=$1 FOR UPDATE", [
            id,
          ]))!,
        ),
      );
    return ok(publicAttempt(a, q));
  }
  @Put("attempts/:id/answers") async save(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    return this.saveAttempt(r, id, false);
  }
  @Post("attempts/:id/submit") async submit(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    return this.saveAttempt(r, id, true);
  }
  private async saveAttempt(r: any, id: string, submit: boolean) {
    parse(uuid, id);
    const b = parse(
      z.object({ answers: z.record(z.string().uuid(), z.any()) }),
      r.body,
    );
    return ok(
      await this.db.tx(async (tx) => {
        const a = await tx.one(
          "SELECT * FROM quiz_attempts WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (!a || a.user_id !== user(r).id) throw new ForbiddenException();
        const q = await owned(tx, "quizzes", a.quiz_id);
        await access(tx, r, q.section_id);
        if (a.status !== "IN_PROGRESS") return publicAttempt(a, q);
        if (new Date(a.expires_at) <= new Date())
          return publicAttempt(await finalize(tx, a), q);
        if (
          Object.keys(b.answers).some(
            (k) => !a.questions.some((q: Row) => q.id === k),
          ) ||
          JSON.stringify(b.answers).length > 100000
        )
          throw new BadRequestException("Câu trả lời không hợp lệ.");
        for (const question of a.questions) {
          const answer = b.answers[question.id];
          if (
            question.type === "FILE_UPLOAD" &&
            answer !== undefined &&
            answer !== null
          ) {
            const fid = parse(uuid, answer?.file_id);
            const file = await tx.one(
              "SELECT id FROM file_assets WHERE id=$1 AND owner_id=$2 AND section_id=$3 AND status='READY'",
              [fid, user(r).id, q.section_id],
            );
            if (!file)
              throw new ForbiddenException(
                "Tệp bài làm không thuộc bạn hoặc chưa tải xong.",
              );
            b.answers[question.id] = { file_id: fid };
          }
        }
        await tx.q("UPDATE quiz_attempts SET answers=$2 WHERE id=$1", [
          id,
          JSON.stringify(b.answers),
        ]);
        a.answers = b.answers;
        if (submit) {
          const done = await finalize(tx, a);
          await audit(tx, r, "QUIZ_SUBMITTED", "quiz_attempt", id);
          return publicAttempt(done, q);
        }
        return publicAttempt(a, q);
      }),
    );
  }
}
@Module({ controllers: [QuizController] })
export class QuizModule {}
