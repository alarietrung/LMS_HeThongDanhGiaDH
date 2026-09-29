import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Req,
  Res,
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
  can,
  date,
  hash,
  notify,
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
const assignmentInput = z.object({
  title,
  description: text,
  due_at: date,
  available_at: date.optional(),
  closes_at: date.nullable().optional(),
  points: z.number().positive().max(1000).default(10),
  max_attempts: z.number().int().min(1).max(20).default(3),
  late_allowed: z.boolean().default(true),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  rubric_id: uuid.nullable().optional(),
});
@Controller("api/v1")
export class AssessmentController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("courses/:sid/assignments") async assignments(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    const s = await access(this.db, r, sid),
      p = paging(r);
    return ok(
      await this.db.q(
        `SELECT a.*, (SELECT count(*) FROM submissions sub WHERE sub.assignment_id=a.id AND sub.user_id=$2) attempts,(SELECT max(created_at) FROM submissions sub WHERE sub.assignment_id=a.id AND sub.user_id=$2) submitted_at,ru.title rubric_title,ru.criteria rubric FROM assignments a LEFT JOIN rubrics ru ON ru.id=a.rubric_id WHERE a.section_id=$1 AND a.deleted_at IS NULL AND ($3 OR a.status='PUBLISHED') ORDER BY a.due_at LIMIT $4 OFFSET $5`,
        [sid, user(r).id, s.manage, p.limit, p.offset],
      ),
      p,
    );
  }
  @Post("courses/:sid/assignments") async createAssignment(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "assignment.manage", true);
    const b = parse(assignmentInput, r.body);
    if (b.closes_at && new Date(b.closes_at) < new Date(b.due_at))
      throw new BadRequestException("Ngày đóng phải sau hạn nộp.");
    if (b.rubric_id) {
      const ru = await owned(this.db, "rubrics", b.rubric_id);
      if (
        ru.section_id !== sid ||
        Math.abs(
          ru.criteria.reduce((s: number, c: Row) => s + c.max, 0) - b.points,
        ) > 0.001
      )
        throw new BadRequestException(
          "Rubric phải thuộc lớp và có tổng điểm bằng điểm bài tập.",
        );
    }
    return ok(
      await this.db.tx(async (tx) => {
        const a = await tx.one(
          "INSERT INTO assignments(section_id,title,description,due_at,available_at,closes_at,points,max_attempts,late_allowed,status,rubric_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
          [
            sid,
            b.title,
            b.description,
            b.due_at,
            b.available_at || new Date(),
            b.closes_at || null,
            b.points,
            b.max_attempts,
            b.late_allowed,
            b.status,
            b.rubric_id || null,
          ],
        );
        if (b.status === "PUBLISHED")
          await notifySection(
            tx,
            sid,
            "Bài tập mới",
            b.title,
            `/courses/${sid}?tab=assignments`,
          );
        await audit(tx, r, "ASSIGNMENT_CREATED", "assignment", a!.id, null, b);
        return a;
      }),
    );
  }
  @Get("assignments/:id/submissions") async history(
    @Req() r: any,
    @Param("id") aid: string,
  ) {
    const a = await owned(this.db, "assignments", aid),
      s = await access(this.db, r, a.section_id);
    const p = paging(r);
    return ok(
      await this.db.q(
        "SELECT sub.*,u.name student,u.student_code FROM submissions sub JOIN users u ON u.id=sub.user_id WHERE sub.assignment_id=$1 AND ($2 OR sub.user_id=$3) ORDER BY sub.created_at DESC LIMIT $4 OFFSET $5",
        [
          aid,
          s.manage && can(r, "assignment.grade"),
          user(r).id,
          p.limit,
          p.offset,
        ],
      ),
      p,
    );
  }
  @Post("assignments/:id/submissions") async submit(
    @Req() r: any,
    @Param("id") aid: string,
  ) {
    const a = await owned(this.db, "assignments", aid);
    await access(this.db, r, a.section_id, "submission.create", true);
    const b = parse(
      z.object({
        text: z.string().max(50000).default(""),
        url: url.optional(),
        files: z.array(uuid).max(10).default([]),
      }),
      r.body,
    );
    if (!b.text.trim() && !b.url && !b.files.length)
      throw new BadRequestException(
        "Cần có nội dung, tệp hoặc liên kết bài nộp.",
      );
    const key = parse(z.string().min(8).max(100), r.headers["idempotency-key"]);
    return ok(
      await this.db.tx(async (tx) => {
        const current = (await tx.one(
          "SELECT * FROM assignments WHERE id=$1 FOR UPDATE",
          [aid],
        ))!;
        const existing = await tx.one(
          "SELECT * FROM submissions WHERE assignment_id=$1 AND user_id=$2 AND idempotency_key=$3",
          [aid, user(r).id, key],
        );
        if (existing) return existing;
        const now = new Date();
        if (
          current.status !== "PUBLISHED" ||
          current.deleted_at ||
          new Date(current.available_at) > now ||
          (current.closes_at && new Date(current.closes_at) < now)
        )
          throw new ForbiddenException("Bài tập chưa mở hoặc đã đóng.");
        const late = new Date(current.due_at) < now;
        if (late && !current.late_allowed)
          throw new BadRequestException("Bài tập không nhận bài trễ.");
        const n =
          Number(
            (await tx.one(
              "SELECT count(*) n FROM submissions WHERE assignment_id=$1 AND user_id=$2",
              [aid, user(r).id],
            ))!.n,
          ) + 1;
        if (n > current.max_attempts)
          throw new BadRequestException("Bạn đã dùng hết số lần nộp.");
        for (const fid of b.files) {
          const f = await owned(tx, "file_assets", fid);
          if (
            f.owner_id !== user(r).id ||
            f.section_id !== a.section_id ||
            f.status !== "READY"
          )
            throw new ForbiddenException("Tệp không hợp lệ.");
        }
        const sub = await tx.one(
          "INSERT INTO submissions(assignment_id,user_id,attempt,text,url,files,status,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [
            aid,
            user(r).id,
            n,
            b.text,
            b.url || null,
            JSON.stringify(b.files),
            late ? "LATE" : n > 1 ? "RESUBMITTED" : "SUBMITTED",
            key,
          ],
        );
        await audit(tx, r, "SUBMISSION_CREATED", "submission", sub!.id, null, {
          attempt: n,
          late,
        });
        return sub;
      }),
    );
  }
  @Post("submissions/:id/grade") async grade(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const sub = await owned(this.db, "submissions", id),
      a = await owned(this.db, "assignments", sub.assignment_id);
    await access(this.db, r, a.section_id, "assignment.grade", true);
    const b = parse(
      z.object({
        score: z.number().min(0),
        feedback: z.string().max(10000).default(""),
        rubric_scores: z.record(z.string(), z.number()).default({}),
      }),
      r.body,
    );
    if (b.score > Number(a.points))
      throw new BadRequestException("Điểm vượt quá thang điểm.");
    if (a.rubric_id) {
      const rubric = await owned(this.db, "rubrics", a.rubric_id);
      if (Object.keys(b.rubric_scores).length) {
        for (const c of rubric.criteria) {
          if (
            b.rubric_scores[c.id] === undefined ||
            b.rubric_scores[c.id] < 0 ||
            b.rubric_scores[c.id] > c.max
          )
            throw new BadRequestException("Điểm rubric chưa hợp lệ.");
        }
        if (
          Math.abs(
            Object.values(b.rubric_scores).reduce((x, y) => x + y, 0) - b.score,
          ) > 0.001
        )
          throw new BadRequestException("Điểm tổng không khớp rubric.");
      }
    }
    return ok(
      await this.db.tx(async (tx) => {
        const g = await tx.one(
          `INSERT INTO grades(section_id,user_id,source_type,source_id,title,category,score,max_score,feedback,rubric_scores,graded_by,status) VALUES($1,$2,'ASSIGNMENT',$3,$4,$5,$6,$7,$8,$9,$10,'DRAFT') ON CONFLICT(user_id,source_type,source_id) DO UPDATE SET score=excluded.score,feedback=excluded.feedback,rubric_scores=excluded.rubric_scores,graded_by=excluded.graded_by,status='DRAFT',updated_at=now() RETURNING *`,
          [
            a.section_id,
            sub.user_id,
            a.id,
            a.title,
            a.category,
            b.score,
            a.points,
            b.feedback,
            JSON.stringify(b.rubric_scores),
            user(r).id,
          ],
        );
        await tx.q("UPDATE submissions SET status='GRADED' WHERE id=$1", [id]);
        await audit(tx, r, "SUBMISSION_GRADED", "grade", g!.id, null, b);
        return g;
      }),
    );
  }
  @Get("courses/:sid/gradebook") async grades(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    permission(r, "gradebook.view");
    const s = await access(this.db, r, sid),
      p = paging(r);
    const manage = s.manage && can(r, "gradebook.manage");
    const rows = await this.db.q(
      "SELECT g.*,u.name student,u.student_code FROM grades g JOIN users u ON u.id=g.user_id WHERE section_id=$1 AND ($2 OR (user_id=$3 AND status='RELEASED')) ORDER BY u.name,u.id,g.title,g.id LIMIT $4 OFFSET $5",
      [sid, manage, user(r).id, p.limit, p.offset],
    );
    const categories = await this.db.q(
      "SELECT * FROM grade_categories WHERE section_id=$1",
      [sid],
    );
    const totals = await this.db.q(
      `SELECT u.id user_id,u.name,sum(g.ratio*c.weight/10) weighted,sum(c.weight) "availableWeight" FROM (SELECT user_id,category,avg(score/max_score) ratio FROM grades WHERE section_id=$1 AND status='RELEASED' AND ($2 OR user_id=$3) GROUP BY user_id,category) g JOIN grade_categories c ON c.section_id=$1 AND c.name=g.category JOIN users u ON u.id=g.user_id GROUP BY u.id,u.name ORDER BY u.name`,
      [sid, manage, user(r).id],
    );
    return ok(
      {
        grades: rows,
        categories,
        totals: totals.map((t) => ({
          ...t,
          weighted: Number(t.weighted),
          availableWeight: Number(t.availableWeight),
        })),
        manage,
      },
      p,
    );
  }
  @Get("courses/:sid/gradebook/export") async exportGrades(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    permission(r, "gradebook.view");
    const s = await access(this.db, r, sid),
      manage = s.manage && can(r, "gradebook.manage");
    const rows = await this.db.q(
      "SELECT g.title,g.category,g.score,g.max_score,g.status,g.feedback,u.name student,u.student_code FROM grades g JOIN users u ON u.id=g.user_id WHERE section_id=$1 AND ($2 OR (user_id=$3 AND status='RELEASED')) ORDER BY u.name,u.id,g.title,g.id LIMIT 10001",
      [sid, manage, user(r).id],
    );
    if (rows.length > 10000)
      throw new BadRequestException(
        "Sổ điểm vượt giới hạn xuất 10.000 dòng. Vui lòng liên hệ quản trị.",
      );
    await audit(this.db, r, "GRADEBOOK_EXPORTED", "section", sid, null, {
      rows: rows.length,
    });
    return ok(rows);
  }
  @Patch("grades/:id") async changeGrade(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const old = await owned(this.db, "grades", id);
    await access(this.db, r, old.section_id, "gradebook.manage", true);
    const b = parse(
      z.object({
        score: z.number().min(0).optional(),
        feedback: z.string().max(10000).optional(),
        status: z.enum(["DRAFT", "RELEASED", "HIDDEN", "EXCUSED"]).optional(),
      }),
      r.body,
    );
    if (b.score !== undefined && b.score > Number(old.max_score))
      throw new BadRequestException("Điểm không hợp lệ.");
    return ok(
      await this.db.tx(async (tx) => {
        const next = await tx.one(
          "UPDATE grades SET score=coalesce($2,score),feedback=coalesce($3,feedback),status=coalesce($4,status),graded_by=$5,updated_at=now() WHERE id=$1 RETURNING *",
          [id, b.score, b.feedback, b.status, user(r).id],
        );
        if (b.status === "RELEASED")
          await notify(
            tx,
            old.user_id,
            "Điểm vừa công bố",
            old.title,
            `/courses/${old.section_id}?tab=grades`,
          );
        await audit(tx, r, "GRADE_UPDATED", "grade", id, old, next);
        return next;
      }),
    );
  }
  @Post("courses/:sid/grade-categories") async weights(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "gradebook.manage", true);
    const b = parse(
      z
        .array(z.object({ name: title, weight: z.number().min(0).max(100) }))
        .min(1)
        .max(20),
      r.body,
    );
    if (
      new Set(b.map((x) => x.name)).size !== b.length ||
      Math.abs(b.reduce((s, x) => s + x.weight, 0) - 100) > 0.001
    )
      throw new BadRequestException(
        "Các nhóm điểm phải khác tên và có tổng trọng số 100%.",
      );
    await this.db.tx(async (tx) => {
      await tx.q("DELETE FROM grade_categories WHERE section_id=$1", [sid]);
      for (const c of b)
        await tx.q("INSERT INTO grade_categories VALUES($1,$2,$3)", [
          sid,
          c.name,
          c.weight,
        ]);
      await audit(tx, r, "GRADE_WEIGHTS_UPDATED", "section", sid, null, b);
    });
    return ok(b);
  }
  @Get("courses/:sid/rubrics") async rubrics(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid);
    return ok(
      await this.db.q(
        "SELECT * FROM rubrics WHERE section_id=$1 ORDER BY created_at",
        [sid],
      ),
    );
  }
  @Post("courses/:sid/rubrics") async createRubric(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "assignment.manage", true);
    const b = parse(
      z.object({
        title,
        criteria: z
          .array(
            z.object({
              id: title,
              title,
              max: z.number().positive(),
              levels: z
                .array(z.object({ label: title, score: z.number().min(0) }))
                .default([]),
            }),
          )
          .min(1)
          .max(30),
      }),
      r.body,
    );
    if (
      new Set(b.criteria.map((c) => c.id)).size !== b.criteria.length ||
      b.criteria.some((c) => c.levels.some((l) => l.score > c.max))
    )
      throw new BadRequestException("Rubric không hợp lệ.");
    return ok(
      await this.db.one(
        "INSERT INTO rubrics(section_id,title,criteria) VALUES($1,$2,$3) RETURNING *",
        [sid, b.title, JSON.stringify(b.criteria)],
      ),
    );
  }
  @Get("courses/:sid/attendance") async attendance(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    const s = await access(this.db, r, sid);
    const sessions = await this.db.q(
      "SELECT id,section_id,title,starts_at,ends_at,status FROM attendance_sessions WHERE section_id=$1 ORDER BY starts_at DESC LIMIT 100",
      [sid],
    );
    const records = await this.db.q(
      "SELECT ar.*,u.name FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.session_id JOIN users u ON u.id=ar.user_id WHERE a.section_id=$1 AND ($2 OR ar.user_id=$3)",
      [sid, s.manage && can(r, "attendance.manage"), user(r).id],
    );
    return ok({ sessions, records });
  }
  @Post("courses/:sid/attendance") async createAttendance(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "attendance.manage", true);
    const b = parse(
      z.object({
        title,
        starts_at: date,
        ends_at: date,
        code: z.string().regex(/^\d{6}$/),
      }),
      r.body,
    );
    if (new Date(b.ends_at) <= new Date(b.starts_at))
      throw new BadRequestException("Thời gian không hợp lệ.");
    const row = await this.db.one(
      "INSERT INTO attendance_sessions(section_id,title,starts_at,ends_at,code_hash,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,title,starts_at,ends_at",
      [sid, b.title, b.starts_at, b.ends_at, hash(b.code), user(r).id],
    );
    await audit(
      this.db,
      r,
      "ATTENDANCE_SESSION_CREATED",
      "attendance",
      row!.id,
    );
    return ok(row);
  }
  @Post("attendance/:id/check-in") async checkIn(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const a = await owned(this.db, "attendance_sessions", id);
    await access(this.db, r, a.section_id, "course.view", true);
    const b = parse(z.object({ code: z.string().regex(/^\d{6}$/) }), r.body);
    const now = Date.now();
    if (
      a.status !== "OPEN" ||
      now < new Date(a.starts_at).getTime() ||
      now > new Date(a.ends_at).getTime() ||
      hash(b.code) !== a.code_hash
    )
      throw new BadRequestException(
        "Mã điểm danh sai hoặc ngoài thời gian cho phép.",
      );
    const status =
      now > new Date(a.starts_at).getTime() + 15 * 60000 ? "LATE" : "PRESENT";
    await this.db.q(
      "INSERT INTO attendance_records VALUES($1,$2,$3,now()) ON CONFLICT DO NOTHING",
      [id, user(r).id, status],
    );
    return ok({ status });
  }
  @Post("attendance/:id/records") async attendanceRecord(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const a = await owned(this.db, "attendance_sessions", id);
    await access(this.db, r, a.section_id, "attendance.manage", true);
    const b = parse(
      z.object({
        user_id: uuid,
        status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]),
      }),
      r.body,
    );
    if (
      !(await this.db.one(
        "SELECT 1 FROM enrollments WHERE section_id=$1 AND user_id=$2 AND kind='STUDENT' AND active",
        [a.section_id, b.user_id],
      ))
    )
      throw new BadRequestException();
    await this.db.tx(async (tx) => {
      await tx.q(
        "INSERT INTO attendance_records VALUES($1,$2,$3,now()) ON CONFLICT(session_id,user_id) DO UPDATE SET status=excluded.status,recorded_at=now()",
        [id, b.user_id, b.status],
      );
      await audit(tx, r, "ATTENDANCE_UPDATED", "attendance", id, null, b);
    });
    return ok(b);
  }
}
@Module({ controllers: [AssessmentController] })
export class AssessmentModule {}
