#!/usr/bin/env node
import { workspaceReadonlyEnabled, loginCommand } from "./config.js";
import { parseCliOptions, CLIENTS } from "./cli-options.js";
import { APP_VERSION, PACKAGE_SPEC } from "./version.js";

function help() {
  console.log(`edu-workspace-mcp ${APP_VERSION}
Node.js 22 이상이 필요합니다.

  setup                 운영체제와 설치 앱 확인; Google 로그인은 별도 사용자 단계
  setup <app>           선택 앱 설치 후 다음 단계 안내
  install <app|all>     codex, claude(Claude Code), claude-desktop, cursor 등록
  login                 승인된 Workspace 읽기 5개로 브라우저 로그인
  doctor                같은 모드의 연결 상태 확인
  serve                 기본 stdio MCP (읽기 도구 10개)
  web                   기존 Workspace Lab 웹앱
  version               버전 확인

기본 Agent는 Docs·Forms·Sheets·Slides 읽기 5개만 사용합니다.
--workspace-readonly: 같은 기본 모드를 명시합니다.
--workspace-edit: 별도 Google 동의 후 Docs·Sheets 생성·수정을 추가합니다.
--legacy: 기존 생성·Classroom 모드를 명시적으로 선택합니다.
--read: --legacy에서만 기존 읽기 확장을 선택합니다.
--no-browser: login의 브라우저 자동 열기를 끕니다.

설치: npx -y ${PACKAGE_SPEC} setup codex
로그인·Google 동의는 사용자 직접 단계이며 설치만으로 연결 완료가 아닙니다.`);
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.help) { help(); return; }
  if (options.command === "version") { console.log(APP_VERSION); return; }
  if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Node.js 22 이상을 설치한 뒤 다시 실행하세요: https://nodejs.org/en/download");
  if (options.legacy) delete process.env.EDU_WORKSPACE_SCOPE_PROFILE;
  else process.env.EDU_WORKSPACE_SCOPE_PROFILE = options.workspaceEdit ? "workspace-edit" : "workspace-readonly";
  if (options.readAccess) process.env.EDU_WORKSPACE_READ_ACCESS = "1";

  const remoteAgent = !options.legacy && (options.workspaceEdit || !process.env.EDU_WORKSPACE_CREDENTIALS_PATH);
  if (options.command === "serve") {
    if (remoteAgent) await (await import("./remote/bridge.js")).serveRemote();
    else await import("./index.js");
    return;
  }
  if (options.command === "web") {
    try { process.loadEnvFile(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error(".env 설정 파일을 불러올 수 없습니다."); }
    delete process.env.EDU_WORKSPACE_SCOPE_PROFILE;
    await import("./web/main.js"); return;
  }
  if (options.command === "setup" || options.command === "install") {
    const { installClient, detectClients } = await import("./install/configure-client.js");
    if (!options.client) {
      console.log(`운영체제: ${process.platform}; Node.js ${process.version}`);
      const detected = await detectClients();
      console.log(`감지된 앱: ${detected.join(", ") || "없음"}`);
      console.log(`설치 앱을 선택한 뒤 npx -y ${PACKAGE_SPEC} setup <app>을 실행하세요. 지원 앱: ${CLIENTS.join(", ")}, all`);
      console.log("앱이나 Node.js를 자동 설치하거나 Google 로그인하지 않습니다.");
      return;
    }
    const targets = options.client === "all" ? await detectClients() : [options.client];
    if (!targets.length) throw new Error("설치된 앱을 찾지 못했습니다. 사용할 앱을 설치하고 setup <app>으로 다시 진행하세요.");
    for (const client of targets) console.log(await installClient(client, { readAccess: options.readAccess, workspaceReadonly: !options.legacy, workspaceEdit: options.workspaceEdit }));
    console.log(`다음 사용자 단계: npx -y ${PACKAGE_SPEC} ${options.legacy ? "login --legacy" : (options.workspaceEdit ? "login --workspace-edit" : "login")}${options.readAccess ? " --read" : ""}`);
    console.log("등록은 Google 인증 완료가 아닙니다. 로그인·동의는 사용자가 브라우저에서 직접 진행하세요.");
    return;
  }
  if (remoteAgent) {
    const { loginRemote, remoteStatus, disconnectRemote } = await import("./remote/session.js");
    if (options.command === "login") {const status=await loginRemote({openBrowser:!options.noBrowser});console.log(status.message);return;}
    if (options.command === "doctor") {
      const status=await remoteStatus(); console.log(JSON.stringify({version:APP_VERSION,...status},null,2));
      if(!status.authenticated) throw new Error(status.message);
      const result=await (await import("./remote/bridge.js")).callRemote("workspace_get_auth_status");
      if(result.isError) throw new Error("원격 서버 연결을 확인하지 못했습니다.");
      console.log("원격 MCP 연결 확인 완료. 실제 Google 읽기는 지정한 자료로 별도 확인하세요.");return;
    }
    if (options.command === "disconnect") {console.log((await disconnectRemote(Boolean(options.localOnly))).message);return;}
  }
  const { login, getAuthStatus, getAuthorizedClient, disconnectGoogleAccount } = await import("./auth/google-auth.js");
  if (options.command === "login") {
    console.log("Google API 원본·집계·파생 데이터를 범용 AI 모델 학습·개선에 사용하지 마세요. 학습 공유가 꺼진 MCP 호스트에서만 처리하세요.");
    const status = await login({ openBrowser: !options.noBrowser });
    console.log(status.message); console.log(`토큰 저장 위치: ${status.tokenPath}`); return;
  }
  if (options.command === "doctor") {
    const status = await getAuthStatus();
    console.log(JSON.stringify({ version: APP_VERSION, node: process.version, ...status }, null, 2));
    if (!status.authenticated) throw new Error(status.message);
    if (status.missingScopes?.length || (workspaceReadonlyEnabled() && status.unexpectedScopes?.length)) throw new Error(`${loginCommand()}으로 같은 범위에서 다시 연결하세요.`);
    await (await getAuthorizedClient()).getAccessToken();
    console.log("Google OAuth 토큰 갱신: 정상"); return;
  }
  if (options.command === "disconnect") {
    const result = await disconnectGoogleAccount({ localOnly: options.localOnly });
    console.log(`${result.revoked ? "Google 권한을 철회하고 " : ""}선택한 모드의 로컬 토큰을 제거했습니다: ${result.tokenPath}`);
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "명령 실행에 실패했습니다."); process.exitCode = 1; });
