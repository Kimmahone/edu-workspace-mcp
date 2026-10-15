import os from "node:os";
import path from "node:path";

export const APP_NAME = "edu-workspace-mcp";

export const APP_DIRECTORY = path.join(os.homedir(), `.${APP_NAME}`);
export const DEFAULT_CREDENTIALS_PATH = path.join(APP_DIRECTORY, "credentials.json");
export const DEFAULT_TOKEN_PATH = path.join(APP_DIRECTORY, "token.json");
export const AGENT_DIRECTORY = path.join(os.homedir(), ".edu-workspace-mcp-agent");
export const WORKSPACE_READONLY_SCOPES = [
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/forms.body.readonly",
  "https://www.googleapis.com/auth/forms.responses.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/presentations.readonly"
] as const;

export function workspaceReadonlyEnabled(): boolean {
  const profile = process.env.EDU_WORKSPACE_SCOPE_PROFILE?.trim();
  if (profile && profile !== "workspace-readonly") throw new Error("지원하지 않는 EDU_WORKSPACE_SCOPE_PROFILE입니다.");
  return profile === "workspace-readonly";
}

export function loginCommand(): string {
  return workspaceReadonlyEnabled() ? "edu-workspace-mcp login --workspace-readonly"
    : `edu-workspace-mcp login --legacy${readAccessEnabled() ? " --read" : ""}`;
}

export function assertWorkspaceReadonlyScopes(scopes: string | undefined): void {
  if (!workspaceReadonlyEnabled()) return;
  const granted = new Set(scopes?.split(" ").filter(Boolean) ?? []);
  if (granted.size !== WORKSPACE_READONLY_SCOPES.length || WORKSPACE_READONLY_SCOPES.some(scope => !granted.has(scope))) {
    throw new Error(`승인된 Workspace 읽기 범위 5개와 일치하지 않습니다. ${loginCommand()}으로 전용 클라이언트 연결을 다시 진행하세요. Classroom 또는 쓰기 권한을 추가하지 마세요.`);
  }
}

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students"
] as const;

// drive.file은 앱이 만들었거나 사용자가 앱에 명시적으로 허용한 파일만 다룬다.
// 기존 Workspace 파일과 Classroom 학급 데이터를 읽는 범위는 민감 범위이므로
// EDU_WORKSPACE_READ_ACCESS=1로 명시적으로 켠 사용자에게만 요청한다.
export const READ_ACCESS_SCOPES = [
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/presentations.readonly",
  "https://www.googleapis.com/auth/forms.body.readonly",
  "https://www.googleapis.com/auth/forms.responses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly"
] as const;

export function readAccessEnabled(): boolean {
  if (workspaceReadonlyEnabled()) return true;
  // 이전 실험 버전의 변수도 호환한다.
  const value = (process.env.EDU_WORKSPACE_READ_ACCESS ?? process.env.EDU_WORKSPACE_SHEETS_READ)?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function googleScopes(): string[] {
  if (workspaceReadonlyEnabled()) return [...WORKSPACE_READONLY_SCOPES];
  return readAccessEnabled() ? [...GOOGLE_SCOPES, ...READ_ACCESS_SCOPES] : [...GOOGLE_SCOPES];
}

export function credentialsPath(): string {
  const selected = process.env.EDU_WORKSPACE_CREDENTIALS_PATH ?? (workspaceReadonlyEnabled() ? path.join(AGENT_DIRECTORY, "credentials.json") : DEFAULT_CREDENTIALS_PATH);
  if (workspaceReadonlyEnabled() && path.resolve(selected) === DEFAULT_CREDENTIALS_PATH) throw new Error("새 모드에는 기존 credentials.json 대신 별도 Agent 자격증명 경로가 필요합니다.");
  return selected;
}

export function tokenPath(): string {
  const selected = process.env.EDU_WORKSPACE_TOKEN_PATH ?? (workspaceReadonlyEnabled() ? path.join(AGENT_DIRECTORY, "token.json") : DEFAULT_TOKEN_PATH);
  if (workspaceReadonlyEnabled() && path.resolve(selected) === DEFAULT_TOKEN_PATH) throw new Error("새 모드는 기존 token.json을 덮어쓸 수 없습니다. 별도 Agent 토큰 경로를 사용하세요.");
  return selected;
}
