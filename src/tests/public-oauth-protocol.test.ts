import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { OAuth2Client, ClientAuthentication, CodeChallengeMethod } from "google-auth-library";
import { GOOGLE_AGENT_CLIENT_ID } from "../auth/bundled-oauth-client.js";
import { WORKSPACE_READONLY_SCOPES } from "../config.js";

test("public Desktop protocol can omit secret in SDK exchange and refresh; no real login is implied", async () => {
  const makeClient = () => new OAuth2Client({ clientId: GOOGLE_AGENT_CLIENT_ID, clientAuthentication: ClientAuthentication.None, redirectUri: "http://127.0.0.1:12345/oauth2callback" });
  const client = makeClient();
  const freshRefreshClient = makeClient();
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  assert.match(codeVerifier!, /^[A-Za-z0-9._~-]{43,128}$/);
  assert.equal(codeChallenge, createHash("sha256").update(codeVerifier!).digest("base64url"));
  const authorization = new URL(client.generateAuthUrl({ scope: [...WORKSPACE_READONLY_SCOPES], access_type: "offline", prompt: "consent", state: "test-only-state", code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256 }));
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorization.searchParams.get("code_challenge"), codeChallenge);
  assert.equal(authorization.searchParams.get("state"), "test-only-state");
  assert.equal(authorization.searchParams.get("redirect_uri"), "http://127.0.0.1:12345/oauth2callback");
  assert.equal(authorization.searchParams.get("scope"), WORKSPACE_READONLY_SCOPES.join(" "));
  assert.equal(authorization.searchParams.get("access_type"), "offline");
  const requests: string[] = [];
  const request = (async (options: { data?: unknown; headers?: HeadersInit }) => {
    const body = options.data as URLSearchParams;
    assert.equal(body.has("client_secret"),false);
    assert.equal(new Headers(options.headers).has("authorization"), false);
    assert.equal(body.get("client_id"),GOOGLE_AGENT_CLIENT_ID);
    requests.push(body.get("grant_type")!);
    if (body.get("grant_type") === "authorization_code") {
      assert.equal(body.get("code_verifier"), codeVerifier);
      assert.equal(body.get("redirect_uri"), authorization.searchParams.get("redirect_uri"));
    }
    return { data: { access_token: "test-only", expires_in: 3600, scope: WORKSPACE_READONLY_SCOPES.join(" ") }, status: 200, headers: new Headers() };
  }) as typeof client.transporter.request;
  client.transporter.request = request;
  freshRefreshClient.transporter.request = request;
  await client.getToken({ code: "test-only-code", codeVerifier });
  freshRefreshClient.setCredentials({ refresh_token: "test-only-refresh" });
  await freshRefreshClient.refreshAccessToken();
  assert.deepEqual(requests,["authorization_code","refresh_token"]);
});
