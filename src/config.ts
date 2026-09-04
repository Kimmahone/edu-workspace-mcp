import os from "node:os";
import path from "node:path";

export const APP_NAME = "edu-workspace-mcp";

export const APP_DIRECTORY = path.join(os.homedir(), `.${APP_NAME}`);
export const DEFAULT_CREDENTIALS_PATH = path.join(APP_DIRECTORY, "credentials.json");
export const DEFAULT_TOKEN_PATH = path.join(APP_DIRECTORY, "token.json");

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me"
] as const;

export function credentialsPath(): string {
  return process.env.EDU_WORKSPACE_CREDENTIALS_PATH ?? DEFAULT_CREDENTIALS_PATH;
}

export function tokenPath(): string {
  return process.env.EDU_WORKSPACE_TOKEN_PATH ?? DEFAULT_TOKEN_PATH;
}
