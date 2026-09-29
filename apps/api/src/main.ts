import { ContentModule } from "./content";
import { WorkspaceModule } from "./workspace";
import { PackageModule } from "./packages";
import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  Module,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Controller,
  Get,
  Inject,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import express from "express";
import { DatabaseModule, Db } from "./db/db";
import { seed } from "./db/seed";
import { Jobs, JobsModule } from "./jobs";
import { AuthModule, sessionMiddleware } from "./auth/auth";
import { CourseModule } from "./courses/courses";
import { AssessmentModule } from "./learning/assessments";
import { QuizModule, expireAttempts } from "./learning/quizzes";
import { SocialModule } from "./collaboration/social";
import { AdminModule } from "./admin/admin";
import { MicrosoftModule } from "./integrations/microsoft";
import { FileModule } from "./files/files";
if (
  process.env.NODE_ENV !== "production" &&
  process.env.DEMO_MODE === undefined
)
  process.env.DEMO_MODE = "true";
if (process.env.NODE_ENV === "production") {
  for (const name of [
    "DATABASE_URL",
    "REDIS_URL",
    "APP_URL",
    "ENTRA_TENANT_ID",
    "ENTRA_CLIENT_ID",
    "ENTRA_CLIENT_SECRET",
    "TOKEN_ENCRYPTION_KEY",
    "AZURE_STORAGE_CONNECTION_STRING",
  ])
    if (!process.env[name])
      throw new Error(`Missing production setting: ${name}`);
  if (
    process.env.DEMO_MODE === "true" ||
    !process.env.APP_URL!.startsWith("https://") ||
    Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "base64").length !== 32
  )
    throw new Error(
      "Production requires HTTPS, a 32-byte encryption key and DEMO_MODE=false",
    );
}
@Catch()
class Errors implements ExceptionFilter {
  catch(e: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp(),
      res = ctx.getResponse(),
      req = ctx.getRequest();
    const status =
      e instanceof HttpException
        ? e.getStatus()
        : e.code === "23505"
          ? 409
          : e.code === "23503"
            ? 400
            : 500;
    const body = e instanceof HttpException ? e.getResponse() : null;
    const message =
      typeof body === "object"
        ? (body as any).message
        : typeof body === "string"
          ? body
          : status === 409
            ? "Dữ liệu đã tồn tại."
            : status === 400
              ? "Dữ liệu tham chiếu không hợp lệ."
              : "Không thể xử lý yêu cầu. Vui lòng thử lại.";
    console.error(
      JSON.stringify({
        level: "error",
        traceId: req.traceId,
        status,
        path: req.path,
        message: status === 500 ? e.message : message,
      }),
    );
    res.status(status).json({
      error: {
        code: (body as any)?.code || `HTTP_${status}`,
        message,
        details: (body as any)?.details,
        traceId: req.traceId,
      },
    });
  }
}
@Controller("health")
class HealthController {
  constructor(
    @Inject(Db) private db: Db,
    @Inject(Jobs) private jobs: Jobs,
  ) {}
  @Get("live") live() {
    return { status: "ok" };
  }
  @Get("ready") async ready() {
    await this.db.q("SELECT 1");
    return { status: "ready", database: "ok", ...(await this.jobs.health()) };
  }
}
@Module({
  imports: [
    DatabaseModule,
    ContentModule,
    WorkspaceModule,
    PackageModule,
    JobsModule,
    AuthModule,
    CourseModule,
    AssessmentModule,
    QuizModule,
    SocialModule,
    AdminModule,
    MicrosoftModule,
    FileModule,
  ],
  controllers: [HealthController],
})
class AppModule {}
async function main() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ["error", "warn", "log"],
  });
  const db = app.get(Db);
  app.use((req: any, res: any, next: any) => {
    req.traceId = randomUUID();
    res.setHeader("X-Request-ID", req.traceId);
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMIT",
          message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
        },
      },
    }),
  );
  app.use(
    "/auth",
    rateLimit({ windowMs: 60000, limit: 30, legacyHeaders: false }),
  );
  app.use(
    "/api/v1/attendance",
    rateLimit({ windowMs: 60000, limit: 15, legacyHeaders: false }),
  );
  app.use((req: any, res: any, next: any) =>
    sessionMiddleware(db, req, res, next),
  );
  app.useGlobalFilters(new Errors());
  await app.init();
  await seed(db);
  await app.get(Jobs).start();
  app.enableShutdownHooks();
  await app.listen(
    Number(process.env.API_PORT || 4100),
    process.env.API_HOST || "127.0.0.1",
  );
  console.log("MITUNI API ready");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
