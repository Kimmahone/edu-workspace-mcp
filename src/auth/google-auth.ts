import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import { CodeChallengeMethod, type Credentials } from "google-auth-library";
import { credentialsPath, googleScopes, readAccessEnabled, tokenPath } from "../config.js";
import { BUNDLED_GOOGLE_OAUTH_CLIENT } from "./bundled-oauth-client.js";

export type AuthStatus = {
  authenticated: boolean;
  oauthClientConfigured: boolean;
  oauthClientSource: "environment" | "credentials_file" | "bundled" | "missing";
  credentialsPath: string;
  tokenPath: string;
  grantedScopes: string[];
  missingScopes?: string[];
  unexpectedScopes?: string[];
  tokenFileProtected?: boolean;
  readAccessEnabled: boolean;
  message: string;
};

const LOGIN_TIMEOUT_MS = 5 * 60_000;

function createState(): string {
  return randomBytes(32).toString("base64url");
}

export function validateOAuthCallback(callbackUrl: URL, expectedState: string): string {
  const error = callbackUrl.searchParams.get("error");
  if (error) throw new Error(`Google OAuth 오류: ${error}`);
  if (callbackUrl.searchParams.get("state") !== expectedState) {
    throw new Error("OAuth state가 일치하지 않습니다. 로그인을 다시 시도하세요.");
  }
  const code = callbackUrl.searchParams.get("code");
  if (!code) throw new Error("OAuth 콜백에 인증 코드가 없습니다.");
  return code;
}

async function openSystemBrowser(url: string): Promise<boolean> {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "rundll32" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  return new Promise((resolve) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

async function protectTokenFile(filePath: string): Promise<boolean> {
  if (process.platform === "win32") return true;
  try {
    await chmod(filePath, 0o600);
    return ((await stat(filePath)).mode & 0o077) === 0;
  } catch {
    return false;
  }
}

async function writeTokenAtomically(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), { mode: 0o600 });
    await rename(temporaryPath, filePath);
    if (!(await protectTokenFile(filePath))) throw new Error("OAuth 토큰 파일 권한을 안전하게 설정하지 못했습니다.");
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8"));
}

type OAuthClientConfig = {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
};

async function loadClientConfig(): Promise<{ config: OAuthClientConfig; source: AuthStatus["oauthClientSource"] }> {
  const environmentClientId = process.env.EDU_WORKSPACE_GOOGLE_CLIENT_ID?.trim();
  if (environmentClientId) {
    return {
      source: "environment",
      config: {
        client_id: environmentClientId,
        client_secret: process.env.EDU_WORKSPACE_GOOGLE_CLIENT_SECRET?.trim() ?? "",
        redirect_uris: ["http://127.0.0.1"]
      }
    };
  }

  try {
    const credentials = (await readJson(credentialsPath())) as {
      installed?: OAuthClientConfig;
      web?: OAuthClientConfig;
    };
    const clientConfig = credentials.installed ?? credentials.web;
    if (clientConfig) return { config: clientConfig, source: "credentials_file" };
  } catch {
    // Continue to the bundled public client.
  }

  if (BUNDLED_GOOGLE_OAUTH_CLIENT.clientId) {
    return {
      source: "bundled",
      config: {
        client_id: BUNDLED_GOOGLE_OAUTH_CLIENT.clientId,
        client_secret: BUNDLED_GOOGLE_OAUTH_CLIENT.clientSecret,
        redirect_uris: ["http://127.0.0.1"]
      }
    };
  }

  throw new Error("공용 Google OAuth 앱이 아직 구성되지 않았습니다. 개발자는 credentials.json 또는 EDU_WORKSPACE_GOOGLE_CLIENT_ID를 설정하세요.");
}

function createOAuthClient(config: OAuthClientConfig, redirectUri?: string) {
  return new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    redirectUri ?? config.redirect_uris[0]
  );
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const credentialFile = credentialsPath();
  const tokenFile = tokenPath();

  let oauthClientSource: AuthStatus["oauthClientSource"] = "missing";
  try {
    oauthClientSource = (await loadClientConfig()).source;
  } catch {
    // Report missing configuration below.
  }

  try {
    if (oauthClientSource === "missing") throw new Error("OAuth client missing");
    const token = (await readJson(tokenFile)) as { scope?: string };
    const grantedScopes = token.scope?.split(" ").filter(Boolean) ?? [];
    const expectedScopes = googleScopes();
    const missingScopes = expectedScopes.filter((scope) => !grantedScopes.includes(scope));
    const unexpectedScopes = grantedScopes.filter((scope) => !expectedScopes.includes(scope));
    const tokenFileProtected = await protectTokenFile(tokenFile);
    return {
      authenticated: true,
      oauthClientConfigured: true,
      oauthClientSource,
      credentialsPath: credentialFile,
      tokenPath: tokenFile,
      grantedScopes,
      missingScopes,
      unexpectedScopes,
      tokenFileProtected,
      readAccessEnabled: readAccessEnabled(),
      message: missingScopes.length
        ? "Google 토큰에 필요한 권한이 없습니다. disconnect 후 다시 로그인하세요."
        : unexpectedScopes.length
          ? "Google 계정은 연결되어 있지만 이전의 추가 권한이 남아 있습니다. 최소 권한으로 다시 로그인하는 것을 권장합니다."
          : readAccessEnabled()
            ? "Google 계정이 읽기 확장 권한으로 안전하게 연결되어 있습니다."
            : "Google 계정이 기본 권한으로 안전하게 연결되어 있습니다."
    };
  } catch {
    return {
      authenticated: false,
      oauthClientConfigured: oauthClientSource !== "missing",
      oauthClientSource,
      credentialsPath: credentialFile,
      tokenPath: tokenFile,
      grantedScopes: [],
      readAccessEnabled: readAccessEnabled(),
      message: oauthClientSource === "missing"
        ? "공용 Google OAuth 앱이 아직 구성되지 않았습니다. 개발용 credentials.json 또는 환경 변수가 필요합니다."
        : "Google 계정이 연결되지 않았습니다. edu-workspace-mcp login을 실행하세요."
    };
  }
}

export async function login(): Promise<AuthStatus> {
  const tokenFile = tokenPath();

  const { config } = await loadClientConfig();
  const expectedState = createState();
  const callbackServer = createServer();
  const authorizationCode = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Google 로그인 대기 시간이 만료되었습니다. 다시 시도하세요.")), LOGIN_TIMEOUT_MS);
    callbackServer.on("request", (request, response) => {
      const callbackUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      if (callbackUrl.pathname !== "/oauth2callback") {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      try {
        const code = validateOAuthCallback(callbackUrl, expectedState);
        clearTimeout(timeout);
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end("로그인이 완료되었습니다. 이 창을 닫고 터미널로 돌아가세요.");
        resolve(code);
      } catch (error) {
        clearTimeout(timeout);
        response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        response.end("Google 로그인을 완료하지 못했습니다. 터미널에서 다시 시도하세요.");
        reject(error);
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    callbackServer.once("error", reject);
    callbackServer.listen(0, "127.0.0.1", () => resolve());
  });

  const address = callbackServer.address();
  if (!address || typeof address === "string") {
    callbackServer.close();
    throw new Error("OAuth 콜백 서버의 포트를 할당하지 못했습니다.");
  }

  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
  const client = createOAuthClient(config, redirectUri);
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: googleScopes(),
    state: expectedState,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256
  });
  const browserOpened = await openSystemBrowser(authUrl);
  console.log(browserOpened ? "기본 브라우저에서 Google 로그인을 완료하세요.\n" : "브라우저에서 아래 URL을 열어 Google 로그인을 완료하세요:\n");
  console.log(authUrl);

  let code: string;
  try {
    code = await authorizationCode;
  } finally {
    callbackServer.close();
  }

  const { tokens } = await client.getToken({ code, codeVerifier, redirect_uri: redirectUri });
  if (!tokens.refresh_token) {
    throw new Error("갱신 토큰을 받지 못했습니다. Google 계정에서 기존 앱 권한을 해제한 뒤 다시 로그인하세요.");
  }

  await writeTokenAtomically(tokenFile, tokens);
  return getAuthStatus();
}

export async function getAuthorizedClient() {
  const tokenFile = tokenPath();
  const { config } = await loadClientConfig();
  const client = createOAuthClient(config);
  client.setCredentials((await readJson(tokenFile)) as Credentials);
  return client;
}

export async function disconnectGoogleAccount(options: { localOnly?: boolean } = {}): Promise<{ revoked: boolean; tokenPath: string }> {
  const tokenFile = tokenPath();
  let revoked = false;
  if (!options.localOnly) {
    const token = (await readJson(tokenFile)) as Credentials;
    const credential = token.refresh_token ?? token.access_token;
    if (!credential) throw new Error("철회할 Google OAuth 토큰을 찾지 못했습니다. --local-only로 로컬 파일만 삭제할 수 있습니다.");
    const { config } = await loadClientConfig();
    const client = createOAuthClient(config);
    await client.revokeToken(credential);
    revoked = true;
  }
  await rm(tokenFile, { force: true });
  return { revoked, tokenPath: tokenFile };
}
