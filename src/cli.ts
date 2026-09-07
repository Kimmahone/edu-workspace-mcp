#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { APP_DIRECTORY, credentialsPath } from "./config.js";
import { disconnectGoogleAccount, getAuthStatus, getAuthorizedClient, login } from "./auth/google-auth.js";
import { installClient, type InstallClient } from "./install/configure-client.js";
import { APP_VERSION, PACKAGE_SPEC } from "./version.js";

function printHelp() {
  console.log(`
edu-workspace-mcp

명령어:
  setup       초기 폴더와 MCP 설정 예시를 보여줍니다.
  install     AI 클라이언트 전체 프로젝트 설정에 MCP를 등록합니다.
  login       Google OAuth 로그인 후 토큰을 안전한 로컬 경로에 저장합니다.
  doctor      OAuth 자격 증명·토큰 상태를 확인합니다.
  disconnect  Google 권한을 철회하고 로컬 토큰을 삭제합니다.
  serve       stdio MCP 서버를 시작합니다. 명령이 없을 때의 기본 동작입니다.
  version     설치된 버전을 표시합니다.

설치 예시:
  npx -y ${PACKAGE_SPEC} install codex
  npx -y ${PACKAGE_SPEC} install claude --read
  npx -y ${PACKAGE_SPEC} install claude-desktop --read
  npx -y ${PACKAGE_SPEC} install cursor

읽기 확장:
  install과 login에 --read를 붙이면 기존 Docs·Sheets·Slides·Forms와
  Classroom 학생 명단을 읽을 수 있는 읽기 전용 범위를 요청합니다.
`);
}

async function main() {
  const command = process.argv[2] ?? "serve";

  if (command === "serve") {
    await import("./index.js");
    return;
  }

  if (command === "setup") {
    await mkdir(APP_DIRECTORY, { recursive: true });
    const status = await getAuthStatus();
    console.log(`\n설정 폴더: ${APP_DIRECTORY}`);
    console.log(`OAuth 클라이언트: ${status.oauthClientConfigured ? `${status.oauthClientSource} 설정 사용` : "아직 구성되지 않음"}`);
    console.log(`\n권장 자동 설치:\n  npx -y ${PACKAGE_SPEC} install codex --read\n  npx -y ${PACKAGE_SPEC} install claude --read\n  npx -y ${PACKAGE_SPEC} install claude-desktop --read\n  npx -y ${PACKAGE_SPEC} install cursor --read`);
    console.log(`\nCodex/ChatGPT Desktop 예시:\n[mcp_servers.edu-workspace]\ncommand = "npx"\nargs = ["-y", "${PACKAGE_SPEC}"]`);
    console.log(`\nClaude Desktop/Cursor 예시:\n{\n  "mcpServers": {\n    "edu-workspace": {\n      "command": "npx",\n      "args": ["-y", "${PACKAGE_SPEC}"]\n    }\n  }\n}`);
    console.log(status.oauthClientConfigured
      ? `\n\`npx -y ${PACKAGE_SPEC} login\`으로 Google 계정을 연결하세요.`
      : `\n공개 배포 전에는 배포자가 공용 OAuth 앱을 설정해야 합니다. 개발 중에는 ${credentialsPath()}에 credentials.json을 둘 수 있습니다.`);
    return;
  }

  if (command === "install") {
    const client = process.argv[3] as InstallClient | undefined;
    if (!client || !["codex", "claude", "claude-desktop", "cursor"].includes(client)) {
      throw new Error("설치 대상을 지정하세요: codex, claude, claude-desktop, cursor");
    }
    const readAccess = process.argv.includes("--read");
    console.log(await installClient(client, { readAccess }));
    console.log(`다음 단계: npx -y ${PACKAGE_SPEC} login${readAccess ? " --read" : ""}`);
    return;
  }

  if (command === "login") {
    if (process.argv.includes("--read")) process.env.EDU_WORKSPACE_READ_ACCESS = "1";
    const status = await login();
    console.log(status.message);
    console.log(`토큰 저장 위치: ${status.tokenPath}`);
    return;
  }

  if (command === "doctor") {
    if (process.argv.includes("--read")) process.env.EDU_WORKSPACE_READ_ACCESS = "1";
    const status = await getAuthStatus();
    console.log(JSON.stringify({ version: APP_VERSION, node: process.version, ...status }, null, 2));
    if (Number(process.versions.node.split(".")[0]) < 20) throw new Error("Node.js 20 이상이 필요합니다.");
    if (status.authenticated) {
      const client = await getAuthorizedClient();
      await client.getAccessToken();
      console.log("Google OAuth 토큰 갱신: 정상");
      if (status.missingScopes?.length) throw new Error("필수 OAuth 범위가 누락되었습니다. disconnect 후 다시 로그인하세요.");
      if (status.unexpectedScopes?.length) console.warn("경고: 이전의 추가 OAuth 권한이 남아 있습니다. 최소 권한 재로그인을 권장합니다.");
      if (status.tokenFileProtected === false) throw new Error("OAuth 토큰 파일 권한이 안전하지 않습니다.");
    }
    return;
  }

  if (command === "version" || command === "--version" || command === "-v") {
    console.log(APP_VERSION);
    return;
  }

  if (command === "disconnect") {
    const localOnly = process.argv.includes("--local-only");
    const result = await disconnectGoogleAccount({ localOnly });
    console.log(`${result.revoked ? "Google OAuth 권한을 철회하고 " : ""}로컬 토큰을 제거했습니다: ${result.tokenPath}`);
    return;
  }

  printHelp();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
