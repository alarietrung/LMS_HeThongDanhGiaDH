import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  Res,
  Inject,
  Module,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ConfidentialClientApplication,
  CryptoProvider,
} from "@azure/msal-node";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { Db, Row } from "../db/db";
import { audit, hash, ok, parse, permission, user, uuid } from "../common";
import { z } from "zod";
export const demo = () =>
  process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
export const configured = () =>
  !!(
    process.env.ENTRA_CLIENT_ID &&
    process.env.ENTRA_TENANT_ID &&
    process.env.ENTRA_CLIENT_SECRET
  );
export const appUrl = () => process.env.APP_URL || "http://localhost:3000";
export const cookieOptions = () => ({
  httpOnly: true,
  secure: appUrl().startsWith("https://"),
  sameSite: "lax" as const,
  path: "/",
});
export function msal() {
  if (!configured())
    throw new ServiceUnavailableException(
      "Chưa cấu hình Microsoft 365 của trường.",
    );
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.ENTRA_CLIENT_ID!,
      authority: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}`,
      clientSecret: process.env.ENTRA_CLIENT_SECRET!,
    },
  });
}
export function encrypt(value: string) {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key)
    throw new ServiceUnavailableException("Thiếu khóa mã hóa token máy chủ.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
  return Buffer.concat([
    iv,
    cipher.update(value, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decrypt(value: string) {
  const b = Buffer.from(value, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "base64"),
    b.subarray(0, 12),
  );
  cipher.setAuthTag(b.subarray(b.length - 16));
  return Buffer.concat([
    cipher.update(b.subarray(12, -16)),
    cipher.final(),
  ]).toString("utf8");
}
export async function loadIdentity(db: Db, uid: string) {
  const u = await db.one("SELECT * FROM users WHERE id=$1 AND active=true", [
    uid,
  ]);
  if (!u) return;
  const roles = await db.q(
    "SELECT r.* FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1",
    [uid],
  );
  return {
    ...u,
    roles: roles.map((r) => ({ id: r.id, name: r.name })),
    permissions: [...new Set(roles.flatMap((r) => r.permissions))],
  };
}
export async function sessionMiddleware(db: Db, req: any, res: any, next: any) {
  try {
    const sid = req.cookies?.["lms.sid"];
    if (sid) {
      const s = await db.one(
        "SELECT * FROM sessions WHERE id=$1 AND expires_at>now()",
        [hash(sid)],
      );
      if (s) {
        req.session = s;
        req.user = await loadIdentity(db, s.user_id);
      }
    }
    const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (mutating) {
      const origin = req.headers.origin;
      if (origin !== new URL(appUrl()).origin)
        return res
          .status(403)
          .json({
            error: {
              code: "ORIGIN",
              message: "Nguồn yêu cầu không hợp lệ.",
              traceId: req.traceId,
            },
          });
      if (req.path.startsWith("/api/")) {
        const sent = req.headers["x-csrf-token"];
        if (
          !req.session ||
          typeof sent !== "string" ||
          sent.length !== req.session.csrf.length ||
          !timingSafeEqual(Buffer.from(sent), Buffer.from(req.session.csrf))
        )
          return res
            .status(403)
            .json({
              error: {
                code: "CSRF",
                message: "Phiên xác thực không hợp lệ. Vui lòng tải lại trang.",
                traceId: req.traceId,
              },
            });
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}
async function createSession(
  db: Db,
  req: any,
  res: any,
  uid: string,
  cache?: string,
) {
  const token = randomBytes(32).toString("base64url");
  const csrf = randomBytes(32).toString("hex");
  if (req.session)
    await db.q("DELETE FROM sessions WHERE id=$1", [req.session.id]);
  await db.q(
    "INSERT INTO sessions(id,user_id,csrf,expires_at,device,token_cache) VALUES($1,$2,$3,$4,$5,$6)",
    [
      hash(token),
      uid,
      csrf,
      new Date(Date.now() + 8 * 3600000),
      String(req.headers["user-agent"] || "").slice(0, 300),
      cache || null,
    ],
  );
  res.cookie("lms.sid", token, { ...cookieOptions(), maxAge: 8 * 3600000 });
  req.user = await loadIdentity(db, uid);
  await audit(db, req, "LOGIN", "session");
  return req.user;
}
@Controller()
export class AuthController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("auth/config") config() {
    return ok({ microsoft: configured(), demo: demo(), appUrl: appUrl() });
  }
  @Post("auth/demo") async demo(@Req() req: any, @Res() res: any) {
    if (!demo()) throw new UnauthorizedException();
    const { persona } = parse(
      z.object({
        persona: z.enum(["student", "lecturer", "admin", "student2"]),
      }),
      req.body,
    );
    const u = await this.db.one("SELECT id FROM users WHERE external_id=$1", [
      `demo-${persona}`,
    ]);
    if (!u) throw new UnauthorizedException();
    const identity = await createSession(this.db, req, res, u.id);
    res.json(ok(identity));
  }
  @Get("auth/microsoft") async start(@Res() res: any) {
    const client = msal();
    if (!process.env.TOKEN_ENCRYPTION_KEY)
      throw new ServiceUnavailableException("Chưa cấu hình khóa mã hóa token.");
    const state = randomBytes(24).toString("hex"),
      nonce = randomBytes(24).toString("hex");
    const pkce = await new CryptoProvider().generatePkceCodes();
    await this.db.q("DELETE FROM auth_states WHERE expires_at<now()");
    await this.db.q(
      "INSERT INTO auth_states(id,verifier,nonce,expires_at) VALUES($1,$2,$3,$4)",
      [hash(state), pkce.verifier, nonce, new Date(Date.now() + 600000)],
    );
    res.cookie("lms.auth", state, { ...cookieOptions(), maxAge: 600000 });
    res.redirect(
      await client.getAuthCodeUrl({
        scopes: [
          "openid",
          "profile",
          "email",
          "offline_access",
          "User.Read",
          "Calendars.ReadWrite",
        ],
        redirectUri:
          process.env.ENTRA_REDIRECT_URI ||
          `${appUrl()}/auth/microsoft/callback`,
        state,
        nonce,
        codeChallenge: pkce.challenge,
        codeChallengeMethod: "S256",
        responseMode: "query" as any,
      }),
    );
  }
  @Get("auth/microsoft/callback") async callback(
    @Req() req: any,
    @Res() res: any,
  ) {
    const code = String(req.query.code || ""),
      state = String(req.query.state || "");
    if (!code || !state || req.cookies?.["lms.auth"] !== state)
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn.");
    const record = await this.db.one(
      "DELETE FROM auth_states WHERE id=$1 AND expires_at>now() RETURNING *",
      [hash(state)],
    );
    res.clearCookie("lms.auth", cookieOptions());
    if (!record) throw new UnauthorizedException();
    const client = msal();
    const result = await client.acquireTokenByCode({
      code,
      scopes: [
        "openid",
        "profile",
        "email",
        "offline_access",
        "User.Read",
        "Calendars.ReadWrite",
      ],
      codeVerifier: record.verifier,
      redirectUri:
        process.env.ENTRA_REDIRECT_URI || `${appUrl()}/auth/microsoft/callback`,
    });
    const claims = result.idTokenClaims as Row;
    if (
      claims.tid !== process.env.ENTRA_TENANT_ID ||
      claims.nonce !== record.nonce ||
      !claims.oid
    )
      throw new UnauthorizedException("Danh tính Microsoft không hợp lệ.");
    const u = await this.db.one(
      "SELECT id FROM users WHERE microsoft_id=$1 AND active=true",
      [claims.oid],
    );
    if (!u) return res.redirect(`${appUrl()}/login?error=not-enrolled`);
    await createSession(
      this.db,
      req,
      res,
      u.id,
      encrypt(client.getTokenCache().serialize()),
    );
    res.redirect(`${appUrl()}/dashboard`);
  }
  @Get("api/v1/me") me(@Req() req: any) {
    return ok({ ...user(req), csrf: req.session.csrf, demo: demo() });
  }
  @Post("api/v1/logout") async logout(@Req() req: any, @Res() res: any) {
    user(req);
    await audit(this.db, req, "LOGOUT", "session");
    await this.db.q("DELETE FROM sessions WHERE id=$1", [req.session.id]);
    res.clearCookie("lms.sid", cookieOptions());
    res.json(ok({ loggedOut: true }));
  }
  @Get("api/v1/sessions") async sessions(@Req() req: any) {
    return ok(
      await this.db.q(
        "SELECT id,device,created_at,expires_at FROM sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
        [user(req).id],
      ),
    );
  }
  @Delete("api/v1/sessions/:id") async revoke(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    await this.db.q("DELETE FROM sessions WHERE id=$1 AND user_id=$2", [
      id,
      user(req).id,
    ]);
    return ok({ revoked: true });
  }
}
@Module({ controllers: [AuthController] })
export class AuthModule {}
