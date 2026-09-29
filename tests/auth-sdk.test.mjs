import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
const require = createRequire(import.meta.url),
  { CryptoProvider } = require("@azure/msal-node"),
  { msal, encrypt, decrypt } = require("../apps/api/dist/auth/auth.js");
test("Microsoft SDK PKCE, token cache and encryption work offline", async () => {
  process.env.ENTRA_CLIENT_ID = "11111111-1111-4111-8111-111111111111";
  process.env.ENTRA_TENANT_ID = "22222222-2222-4222-8222-222222222222";
  process.env.ENTRA_CLIENT_SECRET = "local-test-fixture-not-a-real-secret";
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const pkce = await new CryptoProvider().generatePkceCodes();
  assert.ok(pkce.verifier.length >= 43);
  assert.equal(
    createHash("sha256").update(pkce.verifier).digest("base64url"),
    pkce.challenge,
  );
  const client = msal(),
    cache = client.getTokenCache().serialize();
  client.getTokenCache().deserialize(cache);
  const encrypted = encrypt(cache);
  assert.notEqual(encrypted, cache);
  assert.equal(decrypt(encrypted), cache);
  const corrupted = Buffer.from(encrypted, "base64");
  corrupted[15] ^= 1;
  assert.throws(() => decrypt(corrupted.toString("base64")));
});
