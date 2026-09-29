import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync } from "node:fs";
const require = createRequire(import.meta.url),
  { Db } = require("../apps/api/dist/db/db.js");
test(
  "Versioned migrations preserve existing data and reject changed checksums",
  async () => {
    mkdirSync(".data/test-runs", { recursive: true });
    process.env.DATA_DIR = mkdtempSync(".data/test-runs/migration-");
    process.env.DATABASE_URL = "";
    process.env.NODE_ENV = "test";
    let db = new Db();
    try {
      await db.onModuleInit();
      assert.deepEqual(
        (
          await db.q("SELECT version FROM schema_migrations ORDER BY version")
        ).map((r) => r.version),
        ["001_initial", "002_workspace_indexes"],
      );
      await db.q("INSERT INTO institutions(name) VALUES('Migration fixture')");
      await db.onModuleDestroy();
      db = new Db();
      await db.onModuleInit();
      assert.equal(
        Number((await db.one("SELECT count(*) n FROM institutions")).n),
        1,
      );
      assert.equal(
        Number((await db.one("SELECT count(*) n FROM schema_migrations")).n),
        2,
      );
      await db.q(
        "UPDATE schema_migrations SET checksum='intentional-test-mismatch' WHERE version='001_initial'",
      );
      await db.onModuleDestroy();
      db = new Db();
      await assert.rejects(db.onModuleInit(), /Migration checksum changed/);
    } finally {
      await db.onModuleDestroy();
    }
  },
  { timeout: 60000 },
);
