import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Req,
  Inject,
  Module,
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { Db, Query } from "../db/db";
import {
  audit,
  ok,
  owned,
  paging,
  parse,
  permission,
  title,
  user,
  uuid,
} from "../common";
import { configured, demo } from "../auth/auth";
const external = z.string().min(1).max(100);
const sis = z.object({
  faculties: z
    .array(z.object({ external_id: external, name: title }))
    .max(100)
    .default([]),
  terms: z
    .array(
      z.object({
        external_id: external,
        name: title,
        academic_year: title,
        starts_at: z.string().datetime({ offset: true }),
        ends_at: z.string().datetime({ offset: true }),
      }),
    )
    .max(100)
    .default([]),
  users: z
    .array(
      z.object({
        external_id: external,
        name: title,
        email: z.string().email(),
        student_code: z.string().max(60),
        microsoft_id: uuid.optional(),
      }),
    )
    .max(1000)
    .default([]),
  courses: z
    .array(
      z.object({
        external_id: external,
        code: title,
        name: title,
        credits: z.number().int().min(0).max(30),
      }),
    )
    .max(1000)
    .default([]),
  sections: z
    .array(
      z.object({
        external_id: external,
        name: title,
        course_external_id: external,
        term_external_id: external,
      }),
    )
    .max(1000)
    .default([]),
  enrollments: z
    .array(
      z.object({
        section_external_id: external,
        user_external_id: external,
        kind: z.enum(["STUDENT", "LECTURER", "ASSISTANT", "GRADER", "AUDITOR"]),
        active: z.boolean().default(true),
      }),
    )
    .max(5000)
    .default([]),
});
async function sync(tx: Query, p: z.infer<typeof sis>, institution: string) {
  for (const f of p.faculties)
    await tx.q(
      "INSERT INTO faculties(institution_id,name,external_id) VALUES($1,$2,$3) ON CONFLICT(external_id) DO UPDATE SET name=excluded.name WHERE faculties.institution_id=excluded.institution_id",
      [institution, f.name, f.external_id],
    );
  for (const t of p.terms) {
    if (new Date(t.ends_at) <= new Date(t.starts_at))
      throw new BadRequestException("Học kỳ có thời gian không hợp lệ.");
    await tx.q(
      "INSERT INTO terms(institution_id,name,academic_year,starts_at,ends_at,external_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(external_id) DO UPDATE SET name=excluded.name,academic_year=excluded.academic_year,starts_at=excluded.starts_at,ends_at=excluded.ends_at WHERE terms.institution_id=excluded.institution_id",
      [
        institution,
        t.name,
        t.academic_year,
        t.starts_at,
        t.ends_at,
        t.external_id,
      ],
    );
  }
  for (const u of p.users)
    await tx.q(
      "INSERT INTO users(institution_id,name,email,student_code,microsoft_id,external_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(external_id) DO UPDATE SET name=excluded.name,email=excluded.email,student_code=excluded.student_code,microsoft_id=coalesce(excluded.microsoft_id,users.microsoft_id) WHERE users.institution_id=excluded.institution_id",
      [
        institution,
        u.name,
        u.email,
        u.student_code,
        u.microsoft_id || null,
        u.external_id,
      ],
    );
  for (const c of p.courses)
    await tx.q(
      "INSERT INTO courses(institution_id,code,name,credits,external_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(external_id) DO UPDATE SET code=excluded.code,name=excluded.name,credits=excluded.credits WHERE courses.institution_id=excluded.institution_id",
      [institution, c.code, c.name, c.credits, c.external_id],
    );
  for (const s of p.sections) {
    const c = await tx.one(
      "SELECT id FROM courses WHERE external_id=$1 AND institution_id=$2",
      [s.course_external_id, institution],
    );
    const t = await tx.one(
      "SELECT id FROM terms WHERE external_id=$1 AND institution_id=$2",
      [s.term_external_id, institution],
    );
    if (!c || !t)
      throw new BadRequestException(
        `Lớp ${s.external_id} tham chiếu môn học/học kỳ chưa tồn tại.`,
      );
    const o = await tx.one(
      "INSERT INTO course_offerings(course_id,term_id) VALUES($1,$2) ON CONFLICT(course_id,term_id) DO UPDATE SET course_id=excluded.course_id RETURNING id",
      [c.id, t.id],
    );
    await tx.q(
      "INSERT INTO sections(offering_id,name,external_id) VALUES($1,$2,$3) ON CONFLICT(external_id) DO UPDATE SET offering_id=excluded.offering_id,name=excluded.name",
      [o!.id, s.name, s.external_id],
    );
  }
  for (const e of p.enrollments) {
    const s = await tx.one(
      "SELECT s.id FROM sections s JOIN course_offerings o ON o.id=s.offering_id JOIN courses c ON c.id=o.course_id WHERE s.external_id=$1 AND c.institution_id=$2",
      [e.section_external_id, institution],
    );
    const u = await tx.one(
      "SELECT id FROM users WHERE external_id=$1 AND institution_id=$2",
      [e.user_external_id, institution],
    );
    if (!s || !u)
      throw new BadRequestException(
        "Enrollment tham chiếu người dùng hoặc lớp chưa tồn tại.",
      );
    await tx.q(
      "INSERT INTO enrollments VALUES($1,$2,$3,$4) ON CONFLICT(section_id,user_id) DO UPDATE SET kind=excluded.kind,active=excluded.active",
      [s.id, u.id, e.kind, e.active],
    );
    const role = {
      STUDENT: "student",
      LECTURER: "lecturer",
      ASSISTANT: "teaching_assistant",
      GRADER: "grader",
      AUDITOR: "auditor",
    }[e.kind];
    await tx.q("INSERT INTO user_roles VALUES($1,$2) ON CONFLICT DO NOTHING", [
      u.id,
      role,
    ]);
  }
}
@Controller("api/v1/admin")
export class AdminController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("overview") async overview(@Req() r: any) {
    permission(r, "system.manage");
    return ok({
      counts: await this.db.one(
        "SELECT (SELECT count(*) FROM users WHERE active) users,(SELECT count(*) FROM sections) courses,(SELECT count(*) FROM submissions) submissions,(SELECT coalesce(sum(size),0) FROM file_assets) storage,(SELECT count(*) FROM audit_logs) audits",
      ),
      integrations: {
        microsoft: configured(),
        sis: !!process.env.SIS_BASE_URL,
        redis: !!process.env.REDIS_URL,
        storage: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
        database: process.env.DATABASE_URL ? "PostgreSQL" : "PostgreSQL nhúng",
        demo: demo(),
      },
    });
  }
  @Get("users") async users(@Req() r: any) {
    permission(r, "user.manage");
    const p = paging(r);
    return ok(
      await this.db.q(
        `SELECT u.*,(SELECT jsonb_agg(role_id) FROM user_roles WHERE user_id=u.id) roles FROM users u WHERE institution_id=$1 AND (name ILIKE $2 OR email ILIKE $2) ORDER BY name LIMIT $3 OFFSET $4`,
        [
          user(r).institution_id,
          `%${String(r.query.q || "")}%`,
          p.limit,
          p.offset,
        ],
      ),
      p,
    );
  }
  @Get("roles") async roles(@Req() r: any) {
    permission(r, "user.manage");
    return ok(await this.db.q("SELECT * FROM roles ORDER BY name"));
  }
  @Patch("roles/:id") async updateRole(@Req() r: any, @Param("id") id: string) {
    permission(r, "system.manage");
    if (
      id === "super_admin" ||
      user(r).roles.some((role: any) => role.id === id)
    )
      throw new BadRequestException(
        "Không thể sửa vai trò hệ thống hoặc vai trò đang dùng của chính mình.",
      );
    const b = parse(
      z.object({ permissions: z.array(z.string().max(60)).max(40) }),
      r.body,
    );
    const allowed = (await this.db.one(
      "SELECT permissions FROM roles WHERE id='super_admin'",
    ))!.permissions;
    if (b.permissions.some((p) => !allowed.includes(p)))
      throw new BadRequestException("Có quyền chưa được hỗ trợ.");
    const old = await this.db.one("SELECT * FROM roles WHERE id=$1", [id]);
    if (!old) throw new BadRequestException("Vai trò không tồn tại.");
    await this.db.tx(async (tx) => {
      await tx.q("UPDATE roles SET permissions=$2 WHERE id=$1", [
        id,
        JSON.stringify([...new Set(b.permissions)]),
      ]);
      await audit(tx, r, "ROLE_PERMISSIONS_UPDATED", "role", undefined, old, b);
    });
    return ok({ updated: true });
  }
  @Patch("users/:id") async updateUser(@Req() r: any, @Param("id") id: string) {
    permission(r, "user.manage");
    const target = await owned(this.db, "users", id);
    if (target.institution_id !== user(r).institution_id)
      throw new BadRequestException();
    const b = parse(
      z.object({
        active: z.boolean().optional(),
        role: z.string().max(50).optional(),
        revoke: z.boolean().optional(),
      }),
      r.body,
    );
    if (id === user(r).id && (b.active === false || b.role))
      throw new BadRequestException(
        "Không thể tự thu hồi quyền hoặc vô hiệu hóa chính mình.",
      );
    await this.db.tx(async (tx) => {
      if (b.role) {
        if (!(await tx.one("SELECT 1 FROM roles WHERE id=$1", [b.role])))
          throw new BadRequestException("Vai trò không tồn tại.");
        await tx.q("DELETE FROM user_roles WHERE user_id=$1", [id]);
        await tx.q("INSERT INTO user_roles VALUES($1,$2)", [id, b.role]);
      }
      if (b.active !== undefined)
        await tx.q("UPDATE users SET active=$2 WHERE id=$1", [id, b.active]);
      if (b.revoke || b.active === false || b.role)
        await tx.q("DELETE FROM sessions WHERE user_id=$1", [id]);
      await audit(
        tx,
        r,
        "USER_ACCESS_UPDATED",
        "user",
        id,
        { active: target.active },
        b,
      );
    });
    return ok({ updated: true });
  }
  @Get("structure") async structure(@Req() r: any) {
    permission(r, "system.manage");
    const institution = user(r).institution_id;
    return ok({
      faculties: await this.db.q(
        "SELECT * FROM faculties WHERE institution_id=$1",
        [institution],
      ),
      departments: await this.db.q(
        "SELECT d.* FROM departments d JOIN faculties f ON f.id=d.faculty_id WHERE f.institution_id=$1",
        [institution],
      ),
      programs: await this.db.q(
        "SELECT p.* FROM programs p JOIN faculties f ON f.id=p.faculty_id WHERE f.institution_id=$1",
        [institution],
      ),
      terms: await this.db.q("SELECT * FROM terms WHERE institution_id=$1", [
        institution,
      ]),
      courses: await this.db.q(
        "SELECT * FROM courses WHERE institution_id=$1 LIMIT 100",
        [institution],
      ),
    });
  }
  @Get("audit") async auditLog(@Req() r: any) {
    permission(r, "audit.view");
    const p = paging(r);
    return ok(
      await this.db.q(
        "SELECT a.*,u.name actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE u.institution_id=$1 OR a.actor_id IS NULL ORDER BY a.created_at DESC LIMIT $2 OFFSET $3",
        [user(r).institution_id, p.limit, p.offset],
      ),
      p,
    );
  }
  @Get("sis") async jobs(@Req() r: any) {
    permission(r, "sis.manage");
    return ok(
      await this.db.q(
        "SELECT id,status,summary,created_at,finished_at FROM sis_sync_jobs WHERE actor_id IN(SELECT id FROM users WHERE institution_id=$1) ORDER BY created_at DESC LIMIT 50",
        [user(r).institution_id],
      ),
    );
  }
  @Post("sis/preview") async preview(@Req() r: any) {
    permission(r, "sis.manage");
    const payload = parse(sis, r.body);
    for (const key of [
      "users",
      "courses",
      "sections",
      "terms",
      "faculties",
    ] as const) {
      const ids = payload[key].map((x) => x.external_id);
      if (new Set(ids).size !== ids.length)
        throw new BadRequestException(`Trùng mã nguồn trong ${key}.`);
    }
    const summary = Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [k, v.length]),
    );
    return ok(
      await this.db.one(
        "INSERT INTO sis_sync_jobs(actor_id,payload,summary) VALUES($1,$2,$3) RETURNING id,status,summary",
        [user(r).id, JSON.stringify(payload), JSON.stringify(summary)],
      ),
    );
  }
  @Post("sis/:id/execute") async execute(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    permission(r, "sis.manage");
    return ok(
      await this.db.tx(async (tx) => {
        const job = await tx.one(
          "SELECT * FROM sis_sync_jobs WHERE id=$1 AND actor_id=$2 FOR UPDATE",
          [parse(uuid, id), user(r).id],
        );
        if (!job) throw new BadRequestException("Không tìm thấy lần đồng bộ.");
        if (job.status === "COMPLETED")
          return { id, status: job.status, summary: job.summary };
        if (job.status !== "PREVIEW")
          throw new BadRequestException("Trạng thái đồng bộ không hợp lệ.");
        await sync(tx, parse(sis, job.payload), user(r).institution_id);
        await tx.q(
          "UPDATE sis_sync_jobs SET status='COMPLETED',finished_at=now() WHERE id=$1",
          [id],
        );
        await audit(
          tx,
          r,
          "SIS_SYNC_COMPLETED",
          "sis_sync",
          id,
          null,
          job.summary,
        );
        return { id, status: "COMPLETED", summary: job.summary };
      }),
    );
  }
  @Patch("sections/:id") async archive(@Req() r: any, @Param("id") id: string) {
    permission(r, "system.manage");
    const b = parse(
      z.object({ status: z.enum(["ACTIVE", "READ_ONLY", "ARCHIVED"]) }),
      r.body,
    );
    await this.db.q(
      "UPDATE sections SET status=$2 WHERE id=$1 AND offering_id IN(SELECT o.id FROM course_offerings o JOIN courses c ON c.id=o.course_id WHERE c.institution_id=$3)",
      [parse(uuid, id), b.status, user(r).institution_id],
    );
    await audit(this.db, r, "SECTION_STATUS_UPDATED", "section", id, null, b);
    return ok(b);
  }
}
@Module({ controllers: [AdminController] })
export class AdminModule {}
