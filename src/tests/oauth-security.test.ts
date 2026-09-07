import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { disconnectGoogleAccount, validateOAuthCallback } from "../auth/google-auth.js";

test("OAuth callback requires the exact state and an authorization code", () => {
  const valid = new URL("http://127.0.0.1/oauth2callback?code=code-123&state=state-123");
  assert.equal(validateOAuthCallback(valid, "state-123"), "code-123");

  const mismatched = new URL("http://127.0.0.1/oauth2callback?code=code-123&state=attacker");
  assert.throws(() => validateOAuthCallback(mismatched, "state-123"), /state/);

  const missingCode = new URL("http://127.0.0.1/oauth2callback?state=state-123");
  assert.throws(() => validateOAuthCallback(missingCode, "state-123"), /인증 코드/);
});

test("local-only disconnect removes the local token without a network request", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "edu-workspace-oauth-"));
  const tokenFile = path.join(directory, "token.json");
  const previous = process.env.EDU_WORKSPACE_TOKEN_PATH;
  try {
    await writeFile(tokenFile, JSON.stringify({ access_token: "test-only" }), { mode: 0o600 });
    process.env.EDU_WORKSPACE_TOKEN_PATH = tokenFile;
    const result = await disconnectGoogleAccount({ localOnly: true });
    assert.equal(result.revoked, false);
    await assert.rejects(() => access(tokenFile));
  } finally {
    if (previous === undefined) delete process.env.EDU_WORKSPACE_TOKEN_PATH;
    else process.env.EDU_WORKSPACE_TOKEN_PATH = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
