import {
  Controller,
  Get,
  Post,
  Patch,
  Req,
  Param,
  Inject,
  Module,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { Db, Query } from "./db/db";
import {
  access,
  audit,
  can,
  notify,
  ok,
  owned,
  paging,
  parse,
  permission,
  text,
  user,
  uuid,
} from "./common";
export async function groupAccess(
  db: Query,
  r: any,
  gid: string,
  write = false,
) {
  const group = await owned(db, "study_groups", gid),
    s = await access(db, r, group.section_id, "course.view", write);
  if (
    !s.manage &&
    !(await db.one(
      "SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2",
      [gid, user(r).id],
    ))
  )
    throw new ForbiddenException("Bạn không thuộc nhóm học tập này.");
  return group;
}
@Controller("api/v1")
export class WorkspaceController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("groups/:id/workspace") async group(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const g = await groupAccess(this.db, r, id),
      p = paging(r);
    return ok(
      {
        group: g,
        posts: await this.db.q(
          "SELECT p.*,u.name author FROM group_posts p JOIN users u ON u.id=p.author_id WHERE group_id=$1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3",
          [id, p.limit, p.offset],
        ),
        files: await this.db.q(
          "SELECT id,name,mime,size,created_at FROM file_assets WHERE group_id=$1 AND visibility='GROUP' AND status='READY' ORDER BY created_at DESC LIMIT 100",
          [id],
        ),
      },
      p,
    );
  }
  @Post("groups/:id/posts") async post(@Req() r: any, @Param("id") id: string) {
    const g = await groupAccess(this.db, r, id, true);
    permission(r, "discussion.create");
    const b = parse(
      z.object({ content: text, file_ids: z.array(uuid).max(5).default([]) }),
      r.body,
    );
    for (const fid of b.file_ids) {
      const f = await owned(this.db, "file_assets", fid);
      if (
        f.section_id !== g.section_id ||
        f.group_id !== id ||
        f.visibility !== "GROUP" ||
        f.status !== "READY"
      )
        throw new ForbiddenException("Tệp chưa được chia sẻ cho nhóm này.");
    }
    const post = await this.db.one(
      "INSERT INTO group_posts(group_id,author_id,content,file_ids) VALUES($1,$2,$3,$4) RETURNING *",
      [id, user(r).id, b.content, JSON.stringify(b.file_ids)],
    );
    await audit(this.db, r, "GROUP_POST_CREATED", "group_post", post!.id);
    return ok(post);
  }
  @Get("teaching/queue") async queue(@Req() r: any) {
    permission(r, "assignment.grade");
    const p = paging(r);
    return ok(
      await this.db.q(
        `SELECT sub.id,sub.assignment_id source_id,sub.created_at,a.section_id,a.title,u.name student,c.name course,'ASSIGNMENT' kind FROM submissions sub JOIN assignments a ON a.id=sub.assignment_id JOIN users u ON u.id=sub.user_id JOIN sections s ON s.id=a.section_id JOIN course_offerings o ON o.id=s.offering_id JOIN courses c ON c.id=o.course_id WHERE c.institution_id=$1 AND a.deleted_at IS NULL AND sub.status<>'GRADED' AND sub.attempt=(SELECT max(ss.attempt) FROM submissions ss WHERE ss.assignment_id=a.id AND ss.user_id=sub.user_id) AND ($3 OR EXISTS(SELECT 1 FROM enrollments e WHERE e.section_id=s.id AND e.user_id=$2 AND e.active AND e.kind IN ('LECTURER','GRADER'))) UNION ALL SELECT qa.id,qa.quiz_id,qa.submitted_at,q.section_id,q.title,u.name,c.name,'QUIZ' FROM quiz_attempts qa JOIN quizzes q ON q.id=qa.quiz_id JOIN users u ON u.id=qa.user_id JOIN sections s ON s.id=q.section_id JOIN course_offerings o ON o.id=s.offering_id JOIN courses c ON c.id=o.course_id WHERE c.institution_id=$1 AND q.deleted_at IS NULL AND qa.status='PENDING_REVIEW' AND ($3 OR EXISTS(SELECT 1 FROM enrollments e WHERE e.section_id=s.id AND e.user_id=$2 AND e.active AND e.kind IN ('LECTURER','GRADER'))) ORDER BY created_at LIMIT $4 OFFSET $5`,
        [
          user(r).institution_id,
          user(r).id,
          can(r, "system.manage"),
          p.limit,
          p.offset,
        ],
      ),
      p,
    );
  }
  @Get("admin/sections") async sections(@Req() r: any) {
    permission(r, "system.manage");
    const p = paging(r);
    return ok(
      await this.db.q(
        "SELECT s.*,c.name course,c.code,t.name term,t.academic_year,(SELECT count(*) FROM enrollments e WHERE e.section_id=s.id AND e.active) members FROM sections s JOIN course_offerings o ON o.id=s.offering_id JOIN courses c ON c.id=o.course_id JOIN terms t ON t.id=o.term_id WHERE c.institution_id=$1 AND (s.name ILIKE $2 OR c.name ILIKE $2) ORDER BY t.starts_at DESC,c.name,s.name LIMIT $3 OFFSET $4",
        [
          user(r).institution_id,
          `%${String(r.query.q || "").slice(0, 100)}%`,
          p.limit,
          p.offset,
        ],
      ),
      p,
    );
  }
  @Get("admin/support") async support(@Req() r: any) {
    permission(r, "system.manage");
    const p = paging(r),
      status = parse(
        z.enum(["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"]).default("ALL"),
        r.query.status,
      );
    return ok(
      await this.db.q(
        "SELECT t.*,u.name student,u.email FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE u.institution_id=$1 AND ($2='ALL' OR t.status=$2) ORDER BY t.updated_at DESC LIMIT $3 OFFSET $4",
        [user(r).institution_id, status, p.limit, p.offset],
      ),
      p,
    );
  }
  @Get("support/:id") async ticket(@Req() r: any, @Param("id") id: string) {
    const t = await owned(this.db, "support_tickets", id),
      owner = await owned(this.db, "users", t.user_id);
    if (
      owner.institution_id !== user(r).institution_id ||
      (t.user_id !== user(r).id && !can(r, "system.manage"))
    )
      throw new ForbiddenException();
    return ok({
      ticket: t,
      replies: await this.db.q(
        "SELECT p.*,u.name author FROM support_replies p JOIN users u ON u.id=p.author_id WHERE ticket_id=$1 ORDER BY p.created_at LIMIT 100",
        [id],
      ),
    });
  }
  @Post("support/:id/replies") async reply(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const t = await owned(this.db, "support_tickets", id),
      owner = await owned(this.db, "users", t.user_id),
      staff = can(r, "system.manage");
    if (
      owner.institution_id !== user(r).institution_id ||
      (t.user_id !== user(r).id && !staff)
    )
      throw new ForbiddenException();
    const b = parse(
      z.object({
        content: text,
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
      }),
      r.body,
    );
    if (b.status && !staff) throw new ForbiddenException();
    return ok(
      await this.db.tx(async (tx) => {
        const reply = await tx.one(
          "INSERT INTO support_replies(ticket_id,author_id,content) VALUES($1,$2,$3) RETURNING *",
          [id, user(r).id, b.content],
        );
        await tx.q(
          "UPDATE support_tickets SET status=coalesce($2,status),updated_at=now() WHERE id=$1",
          [id, b.status],
        );
        if (staff && t.user_id !== user(r).id)
          await notify(
            tx,
            t.user_id,
            "Phản hồi yêu cầu hỗ trợ",
            t.title,
            "/help",
          );
        await audit(tx, r, "SUPPORT_REPLIED", "support_ticket", id, null, {
          status: b.status,
        });
        return reply;
      }),
    );
  }
  @Get("courses/:sid/outcome-report") async outcomeReport(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "analytics.view");
    return ok(
      await this.db.q(
        `SELECT lo.id,lo.code,lo.description,lo.plo,lo.threshold,u.id user_id,u.name student,coalesce(sum(g.score/g.max_score*om.weight),0) attainment,coalesce(sum(om.weight) FILTER(WHERE g.id IS NOT NULL),0) assessed_weight FROM learning_outcomes lo JOIN enrollments e ON e.section_id=lo.section_id AND e.kind='STUDENT' AND e.active JOIN users u ON u.id=e.user_id LEFT JOIN outcome_mappings om ON om.outcome_id=lo.id LEFT JOIN grades g ON g.source_id=om.assignment_id AND g.source_type='ASSIGNMENT' AND g.user_id=u.id AND g.status='RELEASED' WHERE lo.section_id=$1 GROUP BY lo.id,u.id ORDER BY lo.code,u.name LIMIT 1000`,
        [sid],
      ),
    );
  }
}
@Module({ controllers: [WorkspaceController] })
export class WorkspaceModule {}
