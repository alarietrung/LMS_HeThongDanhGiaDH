import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { Db, Query, Row } from "./db/db";
export const uuid = z.string().uuid();
export const text = z.string().trim().min(1).max(20000);
export const title = z.string().trim().min(1).max(240);
export const date = z.string().datetime({ offset: true });
export const url = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//.test(v), "Chỉ chấp nhận liên kết HTTP/HTTPS");
export const id = () => randomUUID();
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export const ok = (data: any, meta: Row = {}) => ({ data, meta });
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success)
    throw new BadRequestException({
      code: "VALIDATION",
      message: "Thông tin chưa hợp lệ.",
      details: r.error.flatten(),
    });
  return r.data;
}
export function user(req: any) {
  if (!req.user) throw new UnauthorizedException("Vui lòng đăng nhập.");
  return req.user as Row;
}
export function can(req: any, p: string) {
  return !!req.user?.permissions?.includes(p);
}
export function permission(req: any, p: string) {
  user(req);
  if (!can(req, p))
    throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này.");
}
export async function access(
  db: Query,
  req: any,
  sectionId: string,
  p = "course.view",
  write = false,
) {
  parse(uuid, sectionId);
  permission(req, p);
  const section = await db.one(
    "SELECT s.*,s.name AS section,c.name,c.code,c.image,c.description,c.institution_id,t.name term,t.academic_year FROM sections s JOIN course_offerings o ON o.id=s.offering_id JOIN courses c ON c.id=o.course_id JOIN terms t ON t.id=o.term_id WHERE s.id=$1",
    [sectionId],
  );
  if (!section) throw new NotFoundException("Không tìm thấy học phần.");
  if (section.institution_id !== req.user.institution_id)
    throw new ForbiddenException();
  const enrollment = await db.one(
    "SELECT kind FROM enrollments WHERE section_id=$1 AND user_id=$2 AND active=true",
    [sectionId, req.user.id],
  );
  const admin = can(req, "system.manage");
  if (
    !admin &&
    (!enrollment ||
      (p !== "course.view" &&
        p !== "submission.create" &&
        p !== "quiz.attempt" &&
        p !== "discussion.create" &&
        enrollment.kind === "STUDENT"))
  )
    throw new ForbiddenException("Bạn không có quyền truy cập nội dung này.");
  if (write && section.status !== "ACTIVE")
    throw new ForbiddenException("Học phần đã đóng và chỉ cho phép xem.");
  return {
    ...section,
    kind: enrollment?.kind,
    manage:
      admin || ["LECTURER", "ASSISTANT", "GRADER"].includes(enrollment?.kind),
  };
}
export async function audit(
  db: Query,
  req: any,
  action: string,
  resource: string,
  rid?: string,
  old: any = null,
  next: any = null,
) {
  await db.q(
    "INSERT INTO audit_logs(actor_id,action,resource,resource_id,old_value,new_value,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      req.user?.id || null,
      action,
      resource,
      rid || null,
      old ? JSON.stringify(old) : null,
      next ? JSON.stringify(next) : null,
      req.ip || "",
      String(req.headers?.["user-agent"] || "").slice(0, 300),
    ],
  );
}
export async function notify(
  db: Query,
  userId: string,
  title: string,
  content: string,
  href: string,
) {
  await db.q(
    "INSERT INTO notifications(user_id,title,content,href) VALUES($1,$2,$3,$4)",
    [userId, title, content, href],
  );
}
export async function notifySection(
  db: Query,
  sectionId: string,
  title: string,
  content: string,
  href: string,
) {
  await db.q(
    "INSERT INTO notifications(user_id,title,content,href) SELECT user_id,$2,$3,$4 FROM enrollments WHERE section_id=$1 AND active=true",
    [sectionId, title, content, href],
  );
}
export function paging(req: any) {
  const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
  return { page, limit, offset: (page - 1) * limit };
}
export async function owned(db: Query, table: string, rid: string) {
  parse(uuid, rid);
  const row = await db.one(`SELECT * FROM ${table} WHERE id=$1`, [rid]);
  if (!row) throw new NotFoundException("Không tìm thấy dữ liệu.");
  return row;
}
