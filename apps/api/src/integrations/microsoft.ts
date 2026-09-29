import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Inject,
  Module,
  ServiceUnavailableException,
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { Db } from "../db/db";
import {
  access,
  audit,
  date,
  id,
  ok,
  owned,
  parse,
  title,
  user,
} from "../common";
import { configured, decrypt, encrypt, msal } from "../auth/auth";
export async function graph(
  db: Db,
  sessionId: string,
  path: string,
  body: any,
) {
  const s = await db.one(
    "SELECT * FROM sessions WHERE id=$1 AND expires_at>now()",
    [sessionId],
  );
  if (!s?.token_cache)
    throw new ServiceUnavailableException(
      "Cần đăng nhập Microsoft 365 để tạo lịch Teams.",
    );
  const client = msal();
  client.getTokenCache().deserialize(decrypt(s.token_cache));
  const account = (await client.getTokenCache().getAllAccounts())[0];
  if (!account)
    throw new ServiceUnavailableException("Phiên Microsoft đã hết hạn.");
  const token = await client.acquireTokenSilent({
    account,
    scopes: ["Calendars.ReadWrite"],
  });
  await db.q("UPDATE sessions SET token_cache=$2 WHERE id=$1", [
    sessionId,
    encrypt(client.getTokenCache().serialize()),
  ]);
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const retry = response.headers.get("Retry-After");
    throw new ServiceUnavailableException(
      response.status === 429
        ? `Microsoft đang giới hạn yêu cầu. Thử lại sau ${retry || 60} giây.`
        : "Không thể tạo phòng Microsoft Teams vào lúc này. Vui lòng thử lại.",
    );
  }
  return response.json() as Promise<any>;
}
@Controller("api/v1")
export class MicrosoftController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("courses/:sid/teams") async meetings(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid);
    return ok({
      configured: configured(),
      connected: !!r.session.token_cache,
      meetings: await this.db.q(
        "SELECT t.*,e.title,e.starts_at,e.ends_at FROM teams_meetings t JOIN calendar_events e ON e.id=t.event_id WHERE e.section_id=$1 ORDER BY e.starts_at DESC LIMIT 100",
        [sid],
      ),
    });
  }
  @Post("courses/:sid/teams") async create(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "teams.manage", true);
    if (!configured() || !r.session.token_cache)
      throw new ServiceUnavailableException(
        "Chưa kết nối Microsoft 365. Cấu hình Entra ID và đăng nhập Microsoft trước.",
      );
    const b = parse(
      z.object({ title, starts_at: date, ends_at: date }),
      r.body,
    );
    if (new Date(b.ends_at) <= new Date(b.starts_at))
      throw new BadRequestException("Thời gian không hợp lệ.");
    const key = parse(z.string().min(8).max(100), r.headers["idempotency-key"]);
    let meeting = await this.db.one(
      "SELECT * FROM teams_meetings WHERE idempotency_key=$1",
      [key],
    );
    if (meeting) {
      const e = await owned(this.db, "calendar_events", meeting.event_id);
      if (e.section_id !== sid || meeting.organizer_id !== user(r).id)
        throw new BadRequestException();
      if (meeting.sync_status === "SYNCED") return ok(meeting);
    } else
      meeting = await this.db.tx(async (tx) => {
        const event = await tx.one(
          "INSERT INTO calendar_events(section_id,title,kind,starts_at,ends_at) VALUES($1,$2,'TEAMS',$3,$4) RETURNING id",
          [sid, b.title, b.starts_at, b.ends_at],
        );
        return tx.one(
          "INSERT INTO teams_meetings(event_id,organizer_id,idempotency_key) VALUES($1,$2,$3) RETURNING *",
          [event!.id, user(r).id, key],
        );
      });
    try {
      const event = await graph(this.db, r.session.id, "/me/events", {
        subject: b.title,
        start: {
          dateTime: new Date(b.starts_at).toISOString(),
          timeZone: "UTC",
        },
        end: { dateTime: new Date(b.ends_at).toISOString(), timeZone: "UTC" },
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
        transactionId: meeting!.id,
      });
      if (!event.id || !event.onlineMeeting?.joinUrl)
        throw new ServiceUnavailableException(
          "Microsoft chưa trả về liên kết Teams.",
        );
      const result = await this.db.one(
        "UPDATE teams_meetings SET microsoft_event_id=$2,join_url=$3,sync_status='SYNCED',error=NULL WHERE id=$1 RETURNING *",
        [meeting!.id, event.id, event.onlineMeeting.joinUrl],
      );
      await audit(this.db, r, "TEAMS_CREATED", "teams_meeting", meeting!.id);
      return ok(result);
    } catch (e: any) {
      await this.db.q(
        "UPDATE teams_meetings SET sync_status='ERROR',error=$2 WHERE id=$1",
        [meeting!.id, String(e.message).slice(0, 500)],
      );
      throw e;
    }
  }
}
@Module({ controllers: [MicrosoftController] })
export class MicrosoftModule {}
