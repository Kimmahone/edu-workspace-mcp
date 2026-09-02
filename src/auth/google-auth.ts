import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import type { Credentials } from "google-auth-library";
import { credentialsPath, GOOGLE_SCOPES, tokenPath } from "../config.js";

export type AuthStatus = {
  authenticated: boolean;
  credentialsPath: string;
  tokenPath: string;
  grantedScopes: string[];
  message: string;
};

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8"));
}

type OAuthClientConfig = {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
};

async function loadClientConfig(): Promise<OAuthClientConfig> {
  const credentials = (await readJson(credentialsPath())) as {
    installed?: OAuthClientConfig;
    web?: OAuthClientConfig;
  };
  const clientConfig = credentials.installed ?? credentials.web;
  if (!clientConfig) {
    throw new Error("credentials.json에 Desktop 또는 Web OAuth 클라이언트 정보가 없습니다.");
  }
  return clientConfig;
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

  try {
    await readFile(credentialFile, "utf8");
    const token = (await readJson(tokenFile)) as { scope?: string };
    return {
      authenticated: true,
      credentialsPath: credentialFile,
      tokenPath: tokenFile,
      grantedScopes: token.scope?.split(" ").filter(Boolean) ?? [],
      message: "Google 계정이 연결되어 있습니다."
    };
  } catch {
    return {
      authenticated: false,
      credentialsPath: credentialFile,
      tokenPath: tokenFile,
      grantedScopes: [],
      message: `Google 계정이 연결되지 않았습니다. credentials.json을 ${credentialFile}에 둔 뒤 edu-workspace-mcp login을 실행하세요.`
    };
  }
}

export async function login(): Promise<AuthStatus> {
  const credentialFile = credentialsPath();
  const tokenFile = tokenPath();

  try {
    await readFile(credentialFile, "utf8");
  } catch {
    throw new Error(`OAuth 클라이언트 파일을 찾을 수 없습니다: ${credentialFile}`);
  }

  const config = await loadClientConfig();
  const callbackServer = createServer();
  const authorizationCode = new Promise<string>((resolve, reject) => {
    callbackServer.once("request", (request, response) => {
      const callbackUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const error = callbackUrl.searchParams.get("error");
      const code = callbackUrl.searchParams.get("code");

      if (error || !code) {
        response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        response.end("Google 로그인을 완료하지 못했습니다. 터미널에서 다시 시도하세요.");
        reject(new Error(error ? `Google OAuth 오류: ${error}` : "OAuth 콜백에 인증 코드가 없습니다."));
        return;
      }

      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("로그인이 완료되었습니다. 이 창을 닫고 터미널로 돌아가세요.");
      resolve(code);
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
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_SCOPES]
  });
  console.log("브라우저에서 아래 URL을 열어 Google 로그인을 완료하세요:\n");
  console.log(authUrl);

  let code: string;
  try {
    code = await authorizationCode;
  } finally {
    callbackServer.close();
  }

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("갱신 토큰을 받지 못했습니다. Google 계정에서 기존 앱 권한을 해제한 뒤 다시 로그인하세요.");
  }

  await mkdir(path.dirname(tokenFile), { recursive: true });
  await writeFile(tokenFile, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  return getAuthStatus();
}

export async function getAuthorizedClient() {
  const credentialFile = credentialsPath();
  const tokenFile = tokenPath();
  await readFile(credentialFile, "utf8");
  const client = createOAuthClient(await loadClientConfig());
  client.setCredentials((await readJson(tokenFile)) as Credentials);
  return client;
}
