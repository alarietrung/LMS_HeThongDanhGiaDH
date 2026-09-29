import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const prod = process.argv.includes("--production");
const run = (args, options = {}) =>
  spawn(process.execPath, args, { cwd: root, stdio: "inherit", ...options });
if (!existsSync("node_modules")) {
  console.error("Chạy npm install trước.");
  process.exit(1);
}
if (!prod) {
  const build = run([
    "node_modules/typescript/bin/tsc",
    "-p",
    "apps/api/tsconfig.json",
  ]);
  await new Promise((r) =>
    build.on("exit", (c) => {
      if (c) process.exit(c);
      r();
    }),
  );
}
const env = { ...process.env, NODE_ENV: prod ? "production" : "development" };
const api = run(["apps/api/dist/main.js"], { env });
const webRequire = createRequire(path.join(root, "apps/web/package.json"));
const web = run(
  [
    webRequire.resolve("next/dist/bin/next"),
    prod ? "start" : "dev",
    "--hostname",
    process.env.HOST || "127.0.0.1",
    "--port",
    "3000",
  ],
  { cwd: path.join(root, "apps/web"), env },
);
let closing = false;
function stop() {
  if (closing) return;
  closing = true;
  api.kill();
  web.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", () => {
  stop();
  process.exitCode = 1;
});
web.on("exit", () => {
  stop();
  process.exitCode = 1;
});
