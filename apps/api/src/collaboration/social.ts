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
  ForbiddenException,
} from "@nestjs/common";
import { z } from "zod";
import { Db } from "../db/db";
import {
  access,
  audit,
  can,
  date,
  notify,
  notifySection,
  ok,
  owned,
  paging,
  parse,
  text,
  title,
  user,
  uuid,
} from "../common";
@Controller("api/v1")
export class SocialController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("courses/:sid/discussions") async discussions(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid);
    const p = paging(r);
    return ok(
      await this.db.q(
        "SELECT d.*,u.name author,(SELECT count(*) FROM discussion_posts WHERE discussion_id=d.id) replies FROM discussions d JOIN users u ON u.id=d.author_id WHERE d.section_id=$1 ORDER BY d.pinned DESC,d.created_at DESC LIMIT $2 OFFSET $3",
        [sid, p.limit, p.offset],
      ),
      p,
    );
  }
  @Post("courses/:sid/discussions") async createDiscussion(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "discussion.create", true);
    const b = parse(z.object({ title, content: text }), r.body);
    return ok(
      await this.db.tx(async (tx) => {
        const d = await tx.one(
          "INSERT INTO discussions(section_id,title,author_id) VALUES($1,$2,$3) RETURNING *",
          [sid, b.title, user(r).id],
        );
        await tx.q(
          "INSERT INTO discussion_posts(discussion_id,author_id,content) VALUES($1,$2,$3)",
          [d!.id, user(r).id, b.content],
        );
        await audit(tx, r, "DISCUSSION_CREATED", "discussion", d!.id);
        return d;
      }),
    );
  }
  @Get("discussions/:id/posts") async posts(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const d = await owned(this.db, "discussions", id);
    await access(this.db, r, d.section_id);
    const p = paging(r);
    return ok(
      {
        discussion: d,
        posts: await this.db.q(
          "SELECT p.*,u.name author FROM discussion_posts p JOIN users u ON u.id=p.author_id WHERE discussion_id=$1 ORDER BY p.created_at LIMIT $2 OFFSET $3",
          [id, p.limit, p.offset],
        ),
      },
      p,
    );
  }
  @Post("discussions/:id/posts") async reply(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const d = await owned(this.db, "discussions", id);
    await access(this.db, r, d.section_id, "discussion.create", true);
    if (d.locked) throw new ForbiddenException("Thảo luận đã khóa.");
    const b = parse(
      z.object({ content: text, parent_id: uuid.nullable().optional() }),
      r.body,
    );
    if (
      b.parent_id &&
      (await owned(this.db, "discussion_posts", b.parent_id)).discussion_id !==
        id
    )
      throw new BadRequestException();
    const p = await this.db.one(
      "INSERT INTO discussion_posts(discussion_id,author_id,parent_id,content) VALUES($1,$2,$3,$4) RETURNING *",
      [id, user(r).id, b.parent_id || null, b.content],
    );
    if (d.author_id !== user(r).id)
      await notify(
        this.db,
        d.author_id,
        "Phản hồi mới",
        d.title,
        `/courses/${d.section_id}?tab=discussions`,
      );
    return ok(p);
  }
  @Patch("discussions/:id") async moderate(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const d = await owned(this.db, "discussions", id);
    await access(this.db, r, d.section_id, "course.manage", true);
    const b = parse(
      z.object({ locked: z.boolean(), pinned: z.boolean() }),
      r.body,
    );
    await this.db.q("UPDATE discussions SET locked=$2,pinned=$3 WHERE id=$1", [
      id,
      b.locked,
      b.pinned,
    ]);
    return ok(b);
  }
  @Get("notifications") async notifications(@Req() r: any) {
    const p = paging(r);
    return ok(
      await this.db.q(
        "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        [user(r).id, p.limit, p.offset],
      ),
      p,
    );
  }
  @Post("notifications/read") async read(@Req() r: any) {
    const b = parse(z.object({ id: uuid.optional() }), r.body);
    await this.db.q(
      "UPDATE notifications SET read_at=now() WHERE user_id=$1 AND ($2::uuid IS NULL OR id=$2)",
      [user(r).id, b.id || null],
    );
    return ok({ read: true });
  }
  @Get("notification-preferences") async prefs(@Req() r: any) {
    return ok(
      (
        await this.db.one(
          "SELECT preferences FROM notification_preferences WHERE user_id=$1",
          [user(r).id],
        )
      )?.preferences || {},
    );
  }
  @Post("notification-preferences") async savePrefs(@Req() r: any) {
    const b = parse(
      z.object({
        assignment_email: z.boolean(),
        announcement_email: z.boolean(),
        grade_email: z.boolean(),
      }),
      r.body,
    );
    await this.db.q(
      "INSERT INTO notification_preferences VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET preferences=excluded.preferences",
      [user(r).id, JSON.stringify(b)],
    );
    return ok(b);
  }
  @Get("contacts") async contacts(@Req() r: any) {
    return ok(
      await this.db.q(
        "SELECT DISTINCT u.id,u.name FROM users u JOIN enrollments e ON e.user_id=u.id JOIN enrollments me ON me.section_id=e.section_id WHERE me.user_id=$1 AND e.active AND me.active AND u.id<>$1 ORDER BY u.name LIMIT 100",
        [user(r).id],
      ),
    );
  }
  @Get("messages") async messages(@Req() r: any) {
    const p = paging(r);
    const uid = user(r).id;
    return ok(
      await this.db.q(
        "SELECT m.*,s.name sender,t.name recipient FROM messages m JOIN users s ON s.id=m.sender_id JOIN users t ON t.id=m.recipient_id WHERE sender_id=$1 OR recipient_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        [uid, p.limit, p.offset],
      ),
      p,
    );
  }
  @Post("messages") async send(@Req() r: any) {
    const b = parse(z.object({ recipient_id: uuid, content: text }), r.body);
    const shared = await this.db.one(
      "SELECT 1 FROM enrollments a JOIN enrollments b ON a.section_id=b.section_id WHERE a.user_id=$1 AND b.user_id=$2 AND a.active AND b.active LIMIT 1",
      [user(r).id, b.recipient_id],
    );
    if (!shared)
      throw new ForbiddenException("Người nhận không thuộc lớp học chung.");
    return ok(
      await this.db.one(
        "INSERT INTO messages(sender_id,recipient_id,content) VALUES($1,$2,$3) RETURNING *",
        [user(r).id, b.recipient_id, b.content],
      ),
    );
  }
  @Get("calendar") async calendar(@Req() r: any) {
    const uid = user(r).id;
    const from = r.query.from
        ? parse(date, r.query.from)
        : new Date(Date.now() - 30 * 86400000).toISOString(),
      to = r.query.to
        ? parse(date, r.query.to)
        : new Date(Date.now() + 60 * 86400000).toISOString();
    return ok(
      await this.db.q(
        `SELECT e.*,s.name section,t.join_url,t.sync_status FROM calendar_events e LEFT JOIN sections s ON s.id=e.section_id LEFT JOIN teams_meetings t ON t.event_id=e.id WHERE e.starts_at BETWEEN $2 AND $3 AND (e.owner_id=$1 OR EXISTS(SELECT 1 FROM enrollments en WHERE en.section_id=e.section_id AND en.user_id=$1 AND en.active) OR $4) UNION ALL SELECT a.id,a.section_id,NULL,a.title,'ASSIGNMENT',a.due_at,a.due_at+interval '1 hour','',a.created_at,s.name,NULL,NULL FROM assignments a JOIN sections s ON s.id=a.section_id WHERE a.due_at BETWEEN $2 AND $3 AND a.status='PUBLISHED' AND a.deleted_at IS NULL AND (EXISTS(SELECT 1 FROM enrollments en WHERE en.section_id=a.section_id AND en.user_id=$1 AND en.active) OR $4) ORDER BY starts_at LIMIT 200`,
        [uid, from, to, can(r, "system.manage")],
      ),
    );
  }
  @Post("calendar") async reminder(@Req() r: any) {
    const b = parse(
      z.object({ title, starts_at: date, ends_at: date }),
      r.body,
    );
    if (new Date(b.ends_at) <= new Date(b.starts_at))
      throw new BadRequestException("Giờ kết thúc phải sau giờ bắt đầu.");
    return ok(
      await this.db.one(
        "INSERT INTO calendar_events(owner_id,title,kind,starts_at,ends_at) VALUES($1,$2,'REMINDER',$3,$4) RETURNING *",
        [user(r).id, b.title, b.starts_at, b.ends_at],
      ),
    );
  }
  @Get("tasks") async tasks(@Req() r: any) {
    return ok(
      await this.db.q(
        `SELECT a.id,a.section_id,a.title,a.due_at,s.name section,c.name course,(SELECT max(created_at) FROM submissions WHERE assignment_id=a.id AND user_id=$1) submitted_at FROM assignments a JOIN sections s ON s.id=a.section_id JOIN course_offerings o ON o.id=s.offering_id JOIN courses c ON c.id=o.course_id JOIN enrollments e ON e.section_id=s.id WHERE e.user_id=$1 AND e.active AND a.status='PUBLISHED' AND a.deleted_at IS NULL ORDER BY a.due_at LIMIT 100`,
        [user(r).id],
      ),
    );
  }
  @Get("search") async search(@Req() r: any) {
    const term = parse(z.string().trim().min(2).max(100), r.query.q),
      p = paging(r);
    const rows = await this.db.q(
      `SELECT i.id,i.title,'Học liệu' type,m.section_id,c.name course FROM module_items i JOIN modules m ON m.id=i.module_id JOIN sections s ON s.id=m.section_id JOIN course_offerings o ON o.id=s.offering_id JOIN courses c ON c.id=o.course_id WHERE i.deleted_at IS NULL AND m.deleted_at IS NULL AND i.status='PUBLISHED' AND m.status='PUBLISHED' AND (i.available_at IS NULL OR i.available_at<=now()) AND (i.title ILIKE $2 OR to_tsvector('simple',i.content) @@ plainto_tsquery('simple',$3)) AND EXISTS(SELECT 1 FROM enrollments e WHERE e.user_id=$1 AND e.section_id=m.section_id AND e.active) UNION ALL SELECT a.id,a.title,'Bài tập',a.section_id,c.name FROM assignments a JOIN sections s ON s.id=a.section_id JOIN course_offerings o ON o.id=s.offering_id JOIN courses c ON c.id=o.course_id WHERE a.title ILIKE $2 AND a.status='PUBLISHED' AND a.deleted_at IS NULL AND EXISTS(SELECT 1 FROM enrollments e WHERE e.user_id=$1 AND e.section_id=a.section_id AND e.active) LIMIT $4 OFFSET $5`,
      [user(r).id, `%${term}%`, term, p.limit, p.offset],
    );
    return ok(rows, p);
  }
  @Post("support") async ticket(@Req() r: any) {
    const b = parse(z.object({ title, content: text }), r.body);
    return ok(
      await this.db.one(
        "INSERT INTO support_tickets(user_id,title,content) VALUES($1,$2,$3) RETURNING *",
        [user(r).id, b.title, b.content],
      ),
    );
  }
  @Get("support") async tickets(@Req() r: any) {
    return ok(
      await this.db.q(
        "SELECT * FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
        [user(r).id],
      ),
    );
  }
  @Get("courses/:sid/analytics") async analytics(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "analytics.view");
    return ok(
      await this.db.q(
        `SELECT u.id,u.name,u.student_code,
 (SELECT count(*) FROM assignments a WHERE a.section_id=$1 AND a.status='PUBLISHED' AND a.deleted_at IS NULL AND a.due_at<now() AND NOT EXISTS(SELECT 1 FROM submissions sub WHERE sub.assignment_id=a.id AND sub.user_id=u.id)) missing,
 (SELECT round(avg(score/max_score*100),1) FROM grades WHERE section_id=$1 AND user_id=u.id AND status='RELEASED') average,
 (SELECT round(100.0*count(*) FILTER(WHERE ar.status IN ('PRESENT','LATE'))/nullif(count(*),0),1) FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.session_id WHERE a.section_id=$1 AND ar.user_id=u.id) attendance,
 (SELECT count(*) FROM item_progress ip JOIN module_items i ON i.id=ip.item_id JOIN modules m ON m.id=i.module_id WHERE m.section_id=$1 AND ip.user_id=u.id) completed
 FROM users u JOIN enrollments e ON e.user_id=u.id WHERE e.section_id=$1 AND e.kind='STUDENT' AND e.active ORDER BY u.name LIMIT 100`,
        [sid],
      ),
    );
  }
}
@Module({ controllers: [SocialController] })
export class SocialModule {}
