import os from "node:os";
import path from "node:path";

export const APP_NAME = "edu-workspace-mcp";

export const APP_DIRECTORY = path.join(os.homedir(), `.${APP_NAME}`);
export const DEFAULT_CREDENTIALS_PATH = path.join(APP_DIRECTORY, "credentials.json");
export const DEFAULT_TOKEN_PATH = path.join(APP_DIRECTORY, "token.json");

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
  // 이전 실험 버전의 변수도 호환한다.
  const value = (process.env.EDU_WORKSPACE_READ_ACCESS ?? process.env.EDU_WORKSPACE_SHEETS_READ)?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function googleScopes(): string[] {
  return readAccessEnabled() ? [...GOOGLE_SCOPES, ...READ_ACCESS_SCOPES] : [...GOOGLE_SCOPES];
}

export function credentialsPath(): string {
  return process.env.EDU_WORKSPACE_CREDENTIALS_PATH ?? DEFAULT_CREDENTIALS_PATH;
}

export function tokenPath(): string {
  return process.env.EDU_WORKSPACE_TOKEN_PATH ?? DEFAULT_TOKEN_PATH;
}
