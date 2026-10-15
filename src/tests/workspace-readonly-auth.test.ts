import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getAuthStatus, getAuthorizedClient } from "../auth/google-auth.js";
import { WORKSPACE_READONLY_SCOPES } from "../config.js";

test("Agent authentication requires its own Desktop credentials and exactly five grants", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "workspace-readonly-auth-test-"));
  const credentialFile = path.join(directory, "fake-credentials.json");
  const tokenFile = path.join(directory, "fake-token.json");
  const keys = ["EDU_WORKSPACE_SCOPE_PROFILE", "EDU_WORKSPACE_CREDENTIALS_PATH", "EDU_WORKSPACE_TOKEN_PATH", "EDU_WORKSPACE_GOOGLE_CLIENT_ID"];
  const previous = keys.map(key => process.env[key]);
  process.env.EDU_WORKSPACE_SCOPE_PROFILE = "workspace-readonly";
  process.env.EDU_WORKSPACE_CREDENTIALS_PATH = credentialFile;
  process.env.EDU_WORKSPACE_TOKEN_PATH = tokenFile;
  process.env.EDU_WORKSPACE_GOOGLE_CLIENT_ID = "test-only-old-client";
  try {
    const missing = await getAuthStatus();
    assert.equal(missing.oauthClientConfigured, false);
    assert.equal(missing.authenticated, false);
    assert.equal(missing.scopeProfile, "workspace-readonly");
    // Synthetic fixtures only: no user credentials or network requests.
    await writeFile(credentialFile, JSON.stringify({ installed: {
      client_id: "test-only-agent", client_secret: "test-only", redirect_uris: ["http://127.0.0.1"]
    } }), { mode: 0o600 });
    await writeFile(tokenFile, JSON.stringify({ scope: WORKSPACE_READONLY_SCOPES.join(" ") }), { mode: 0o600 });
    const ready = await getAuthStatus();
    assert.equal(ready.authenticated, true);
    assert.equal(ready.oauthClientSource, "credentials_file");
    assert.deepEqual(ready.missingScopes, []);
    assert.deepEqual(ready.unexpectedScopes, []);
    const client = await getAuthorizedClient();
    assert.equal(client.credentials.scope, WORKSPACE_READONLY_SCOPES.join(" "));
    await writeFile(tokenFile, JSON.stringify({ scope: [...WORKSPACE_READONLY_SCOPES, "https://www.googleapis.com/auth/drive.file"].join(" ") }), { mode: 0o600 });
    const overbroad = await getAuthStatus();
    assert.equal(overbroad.authenticated, false);
    assert.match(overbroad.message, /login --workspace-readonly/);
    await assert.rejects(() => getAuthorizedClient(), /5개/);
    await writeFile(tokenFile, '{"access_token":"test-only-private-marker",');
    await assert.rejects(() => getAuthorizedClient(), error => {
      assert.doesNotMatch(String(error), /test-only-private-marker/);
      return /Agent 토큰/.test(String(error));
    });
    await writeFile(credentialFile, '{"installed":{"client_secret":"test-only-private-marker"},');
    await assert.rejects(() => getAuthorizedClient(), error => {
      assert.doesNotMatch(String(error), /test-only-private-marker/);
      return /Desktop OAuth JSON/.test(String(error));
    });
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
    await rm(directory, { recursive: true, force: true });
  }
});
