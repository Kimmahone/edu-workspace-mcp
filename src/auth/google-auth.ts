import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import { CodeChallengeMethod, type Credentials } from "google-auth-library";
import { credentialsPath, googleScopes, readAccessEnabled, tokenPath, workspaceReadonlyEnabled, loginCommand, assertWorkspaceReadonlyScopes } from "../config.js";
import { googleContext } from "./context.js";

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
  scopeProfile?: "legacy" | "workspace-readonly";
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
  if (workspaceReadonlyEnabled()) {
    if (!process.env.EDU_WORKSPACE_CREDENTIALS_PATH) {
      throw new Error("PUBLIC_AUTH_NOT_READY: 공개 client ID + PKCE로 사용자 직접 로그인·갱신을 아직 검증하지 않아 공개 로그인을 시작하지 않았습니다. 일반 사용자가 Cloud 프로젝트나 JSON을 만들 필요는 없습니다.");
    }
    // Agent mode never falls back to the old bundled/environment client.
    let credentials: { installed?: OAuthClientConfig };
    try { credentials = (await readJson(credentialsPath())) as { installed?: OAuthClientConfig }; }
    catch { throw new Error("Agent용 Desktop OAuth JSON을 읽지 못했습니다. 전용 경로와 JSON 형식을 사용자 기기에서 확인하세요."); }
    if (!credentials.installed?.client_id || !Array.isArray(credentials.installed.redirect_uris) || !credentials.installed.redirect_uris.length) {
      throw new Error("Agent용 Desktop OAuth JSON을 전용 credentials.json에 직접 보관하세요.");
    }
    return { config: credentials.installed, source: "credentials_file" };
  }
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
    // No secret fallback is distributed in the public candidate.
  }

  throw new Error("기존 웹·고급 모드는 사용자 기기의 기존 OAuth 설정이 필요합니다. 공개 패키지에는 client secret을 넣지 않습니다. 기존 버전·토큰을 자동 변경하지 않았습니다.");
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
      authenticated: !workspaceReadonlyEnabled() || (!missingScopes.length && !unexpectedScopes.length),
      oauthClientConfigured: true,
      oauthClientSource,
      credentialsPath: credentialFile,
      tokenPath: tokenFile,
      grantedScopes,
      missingScopes,
      unexpectedScopes,
      tokenFileProtected,
      readAccessEnabled: readAccessEnabled(),
      scopeProfile: workspaceReadonlyEnabled() ? "workspace-readonly" : "legacy",
      message: workspaceReadonlyEnabled()
        ? (missingScopes.length || unexpectedScopes.length
          ? `승인된 읽기 범위 5개와 일치하지 않습니다. ${loginCommand()}으로 다시 연결하세요. Classroom·쓰기 권한을 추가하지 마세요.`
          : "Google 계정이 Workspace 읽기 전용 범위 5개로 연결되어 있습니다.")
        : missingScopes.length
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
      scopeProfile: workspaceReadonlyEnabled() ? "workspace-readonly" : "legacy",
      message: workspaceReadonlyEnabled()
        ? (oauthClientSource === "missing"
          ? (process.env.EDU_WORKSPACE_CREDENTIALS_PATH
            ? `운영자가 지정한 로컬 Desktop OAuth 설정을 ${credentialFile}에서 확인하세요. 일반 사용자에게 JSON 생성을 요청하지 마세요.`
            : "공개 Agent 인증 경로가 아직 준비되지 않았습니다. 설치는 인증 완료가 아니며, 일반 사용자가 Cloud 프로젝트나 JSON을 만들 필요는 없습니다.")
          : `Google Agent 계정이 연결되지 않았습니다. ${loginCommand()}을 직접 실행하세요.`)
        : oauthClientSource === "missing"
        ? "공용 Google OAuth 앱이 아직 구성되지 않았습니다. 개발용 credentials.json 또는 환경 변수가 필요합니다."
        : "Google 계정이 연결되지 않았습니다. edu-workspace-mcp login을 실행하세요."
    };
  }
}

export async function login(options: { openBrowser?: boolean } = {}): Promise<AuthStatus> {
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
  const browserOpened = options.openBrowser === false ? false : await openSystemBrowser(authUrl);
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

  assertWorkspaceReadonlyScopes(tokens.scope);
  await writeTokenAtomically(tokenFile, tokens);
  return getAuthStatus();
}

export async function getAuthorizedClient() {
  const context = googleContext.getStore();
  if (context) {
    if (!context.client) throw new Error("Google 계정을 먼저 연결해 주세요.");
    return context.client;
  }
  const tokenFile = tokenPath();
  const { config } = await loadClientConfig();
  const client = createOAuthClient(config);
  let credentials: Credentials;
  try { credentials = (await readJson(tokenFile)) as Credentials; }
  catch (error) {
    if (workspaceReadonlyEnabled()) throw new Error(`Agent 토큰을 읽지 못했습니다. ${loginCommand()}으로 다시 연결하세요.`);
    throw error;
  }
  assertWorkspaceReadonlyScopes(credentials.scope);
  client.setCredentials(credentials);
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
