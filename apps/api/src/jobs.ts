import { Injectable, Inject, Module, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { BlobServiceClient } from "@azure/storage-blob";
import { Db } from "./db/db";
import { expireAttempts } from "./learning/quizzes";
import { notifySection } from "./common";

export async function maintain(db: Db) {
  await expireAttempts(db);
  await db.tx(async (tx) => {
    await tx.q(
      "UPDATE module_items SET status='PUBLISHED' WHERE status='SCHEDULED' AND available_at<=now() AND deleted_at IS NULL",
    );
    const announcements = await tx.q(
      "SELECT * FROM announcements WHERE notified_at IS NULL AND publish_at<=now() AND (expires_at IS NULL OR expires_at>now()) ORDER BY publish_at LIMIT 100 FOR UPDATE SKIP LOCKED",
    );
    for (const a of announcements) {
      await notifySection(
        tx,
        a.section_id,
        a.title,
        a.content.slice(0, 200),
        `/courses/${a.section_id}?tab=announcements`,
      );
      await tx.q("UPDATE announcements SET notified_at=now() WHERE id=$1", [
        a.id,
      ]);
    }
    await tx.q("DELETE FROM auth_states WHERE expires_at<now()");
    await tx.q("DELETE FROM sessions WHERE expires_at<now()");
  });
}

@Injectable()
export class Jobs implements OnModuleDestroy {
  queue?: Queue;
  worker?: Worker;
  timer?: ReturnType<typeof setInterval>;
  running = false;
  constructor(@Inject(Db) private db: Db) {}
  async start() {
    if (process.env.REDIS_URL) {
      const u = new URL(process.env.REDIS_URL);
      const connection = {
        host: u.hostname,
        port: Number(u.port || 6379),
        username: u.username ? decodeURIComponent(u.username) : undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
        db: Number(u.pathname.slice(1) || 0),
        ...(u.protocol === "rediss:" ? { tls: {} } : {}),
      };
      this.queue = new Queue("mituni-maintenance", { connection });
      this.worker = new Worker(
        "mituni-maintenance",
        async () => maintain(this.db),
        { connection, concurrency: 1 },
      );
      this.worker.on("failed", (_job, error) =>
        console.error(
          JSON.stringify({
            event: "maintenance_failed",
            message: error.message,
          }),
        ),
      );
      this.worker.on("error", (error) =>
        console.error(
          JSON.stringify({ event: "queue_error", message: error.message }),
        ),
      );
      this.queue.on("error", (error) =>
        console.error(
          JSON.stringify({ event: "queue_error", message: error.message }),
        ),
      );
      await this.queue.add(
        "maintenance",
        {},
        {
          jobId: "maintenance",
          repeat: { every: 15000 },
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      );
    } else {
      const tick = async () => {
        if (this.running) return;
        this.running = true;
        try {
          await maintain(this.db);
        } catch (e: any) {
          console.error(
            JSON.stringify({ event: "maintenance_failed", message: e.message }),
          );
        } finally {
          this.running = false;
        }
      };
      await tick();
      this.timer = setInterval(tick, 15000);
      this.timer.unref();
    }
  }
  async health() {
    if (this.queue) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          this.queue.getJobCounts("waiting"),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("Redis timeout")), 3000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      const container = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING,
        { retryOptions: { maxTries: 1, tryTimeoutInMs: 3000 } },
      ).getContainerClient(process.env.AZURE_STORAGE_CONTAINER || "lms-files");
      await container.getProperties();
    }
    return {
      redis: this.queue ? "ok" : "development-disabled",
      storage: process.env.AZURE_STORAGE_CONNECTION_STRING
        ? "azure-ok"
        : "development-filesystem",
    };
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }
}
@Module({ providers: [Jobs], exports: [Jobs] })
export class JobsModule {}
