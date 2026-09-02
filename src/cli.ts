#!/usr/bin/env node
import { mkdir, rm } from "node:fs/promises";
import { APP_DIRECTORY, credentialsPath, tokenPath } from "./config.js";
import { getAuthStatus, getAuthorizedClient, login } from "./auth/google-auth.js";

function printHelp() {
  console.log(`
edu-workspace-mcp

명령어:
  setup       초기 폴더와 MCP 설정 예시를 보여줍니다.
  login       Google OAuth 로그인 후 토큰을 안전한 로컬 경로에 저장합니다.
  doctor      OAuth 자격 증명·토큰 상태를 확인합니다.
  disconnect  연결 해제 방법을 안내합니다.
  serve       stdio MCP 서버를 시작합니다. 명령이 없을 때의 기본 동작입니다.
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
    console.log(`\n설정 폴더: ${APP_DIRECTORY}`);
    console.log(`OAuth 자격 증명 파일 위치: ${credentialsPath()}`);
    console.log(`\nCodex/ChatGPT Desktop 예시:\n[mcp_servers.edu_workspace]\ncommand = "npx"\nargs = ["-y", "edu-workspace-mcp"]`);
    console.log(`\nClaude Desktop/Cursor 예시:\n{\n  "mcpServers": {\n    "edu-workspace": {\n      "command": "npx",\n      "args": ["-y", "edu-workspace-mcp"]\n    }\n  }\n}`);
    console.log("\ncredentials.json을 위 위치에 저장한 뒤 `npx edu-workspace-mcp login`을 실행하세요.");
    return;
  }

  if (command === "login") {
    const status = await login();
    console.log(status.message);
    console.log(`토큰 저장 위치: ${status.tokenPath}`);
    return;
  }

  if (command === "doctor") {
    const status = await getAuthStatus();
    console.log(JSON.stringify(status, null, 2));
    if (status.authenticated) {
      const client = await getAuthorizedClient();
      await client.getAccessToken();
      console.log("Google OAuth 토큰 갱신: 정상");
    }
    return;
  }

  if (command === "disconnect") {
    await rm(tokenPath(), { force: true });
    console.log(`로컬 Google 토큰을 제거했습니다: ${tokenPath()}`);
    console.log("Google 계정의 제3자 앱 액세스 페이지에서도 이 앱의 권한을 철회할 수 있습니다.");
    return;
  }

  printHelp();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
