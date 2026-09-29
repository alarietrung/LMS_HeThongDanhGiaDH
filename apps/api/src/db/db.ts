import {
  Global,
  Injectable,
  Module,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { PGlite } from "@electric-sql/pglite";
import { Pool, PoolClient } from "pg";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
export type Row = Record<string, any>;
export interface Query {
  q<T extends Row = Row>(sql: string, values?: any[]): Promise<T[]>;
  one<T extends Row = Row>(sql: string, values?: any[]): Promise<T | undefined>;
}
@Injectable()
export class Db implements OnModuleInit, OnModuleDestroy, Query {
  pool?: Pool;
  embedded?: PGlite;
  async onModuleInit() {
    if (process.env.DATABASE_URL)
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
      });
    else {
      if (process.env.NODE_ENV === "production")
        throw new Error("Production requires DATABASE_URL");
      const dir = process.env.DATA_DIR || path.resolve(".data/postgres");
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      this.embedded = new PGlite(dir);
      await this.embedded.waitReady;
    }
    await this.migrate();
  }
  async onModuleDestroy() {
    if (this.pool) await this.pool.end();
    if (this.embedded) await this.embedded.close();
  }
  private async migrate() {
    const directory = path.resolve("apps/api/src/db"),
      extra = path.join(directory, "migrations");
    const files = [
      { id: "001_initial", file: path.join(directory, "schema.sql") },
      ...(fs.existsSync(extra)
        ? fs
            .readdirSync(extra)
            .filter((f) => /^\d{3}_[a-z0-9_-]+\.sql$/.test(f))
            .sort()
            .map((f) => ({ id: f.slice(0, -4), file: path.join(extra, f) }))
        : []),
    ];
    if (new Set(files.map((f) => f.id)).size !== files.length)
      throw new Error("Duplicate database migration version");
    const apply = async (
      exec: (sql: string, params?: any[]) => Promise<any>,
      query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>,
    ) => {
      if (this.pool) await query("SELECT pg_advisory_xact_lock(19092026)");
      await exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const applied = (
        await query("SELECT version,checksum FROM schema_migrations")
      ).rows;
      for (const row of applied)
        if (!files.some((f) => f.id === row.version))
          throw new Error(`Missing migration source: ${row.version}`);
      for (const file of files) {
        const sql = fs.readFileSync(file.file, "utf8").replace(/\r\n/g, "\n"),
          checksum = createHash("sha256").update(sql).digest("hex"),
          existing = applied.find((m) => m.version === file.id);
        if (existing) {
          if (existing.checksum !== checksum)
            throw new Error(
              `Migration checksum changed: ${file.id}. Restore the original file and add a new migration.`,
            );
          continue;
        }
        await exec(sql);
        await query(
          "INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)",
          [file.id, checksum],
        );
      }
    };
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await apply(
          (s, p) => client.query(s, p),
          (s, p) => client.query(s, p),
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } else
      await this.embedded!.transaction(async (tx) =>
        apply(
          (s) => tx.exec(s),
          (s, p) => tx.query(s, p),
        ),
      );
  }
  async q<T extends Row = Row>(sql: string, values: any[] = []): Promise<T[]> {
    return (
      this.pool
        ? await this.pool.query(sql, values)
        : await this.embedded!.query(sql, values)
    ).rows as T[];
  }
  async one<T extends Row = Row>(
    sql: string,
    values: any[] = [],
  ): Promise<T | undefined> {
    return (await this.q<T>(sql, values))[0] as T | undefined;
  }
  async tx<T>(fn: (q: Query) => Promise<T>): Promise<T> {
    if (this.pool) {
      const c = await this.pool.connect();
      try {
        await c.query("BEGIN");
        const v = await fn(this.adapter(c));
        await c.query("COMMIT");
        return v;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    return this.embedded!.transaction(async (t) =>
      fn({
        q: async (s, v = []) => (await t.query(s, v)).rows as any,
        one: async (s, v = []) => (await t.query(s, v)).rows[0] as any,
      }),
    );
  }
  private adapter(c: PoolClient): Query {
    return {
      q: async (s, v = []) => (await c.query(s, v)).rows,
      one: async (s, v = []) => (await c.query(s, v)).rows[0],
    };
  }
}
@Global()
@Module({ providers: [Db], exports: [Db] })
export class DatabaseModule {}
