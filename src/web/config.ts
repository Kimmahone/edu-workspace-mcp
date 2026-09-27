import { randomBytes } from "node:crypto";

export function webConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.APP_MODE ?? "local";
  if (!["local", "hosted"].includes(mode)) throw new Error("APP_MODE는 local 또는 hosted여야 합니다.");
  const hosted = mode === "hosted";
  const port = Number(env.PORT ?? 3210);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT는 1~65535 정수여야 합니다.");
  const aiDailyLimit = Number(env.AI_DAILY_LIMIT ?? 20);
  if (!Number.isInteger(aiDailyLimit) || aiDailyLimit < 1 || aiDailyLimit > 1000) throw new Error("AI_DAILY_LIMIT는 1~1000 정수여야 합니다.");
  const origin = env.APP_ORIGIN ?? `http://127.0.0.1:${port}`;
  const parsed = new URL(origin);
  if (parsed.origin !== origin) throw new Error("APP_ORIGIN에는 경로 없이 origin만 설정하세요.");
  if (hosted && parsed.protocol !== "https:") throw new Error("배포용 APP_ORIGIN은 HTTPS여야 합니다.");
  if (!hosted && !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) throw new Error("로컬 앱은 loopback 주소에서만 실행할 수 있습니다.");
  const secret = env.APP_SECRET ?? (hosted ? "" : randomBytes(32).toString("hex"));
  if (secret.length < 32) throw new Error("APP_SECRET에 32자 이상의 비밀 키를 설정하세요.");
  if (hosted && (!env.DATABASE_URL || !env.GOOGLE_WEB_CLIENT_ID || !env.GOOGLE_WEB_CLIENT_SECRET)) {
    throw new Error("배포 모드에는 DATABASE_URL, GOOGLE_WEB_CLIENT_ID, GOOGLE_WEB_CLIENT_SECRET이 필요합니다.");
  }
  return {
    hosted, port, origin, secret, databaseUrl: env.DATABASE_URL,
    googleClientId: env.GOOGLE_WEB_CLIENT_ID, googleClientSecret: env.GOOGLE_WEB_CLIENT_SECRET,
    geminiKey: env.GEMINI_API_KEY, geminiModel: env.GEMINI_MODEL || "gemini-flash-latest",
    openaiKey: env.OPENAI_API_KEY, openaiModel: env.OPENAI_MODEL ?? "gpt-6-luna",
    aiDailyLimit,
    formsTemplateId: env.GOOGLE_FORMS_TEMPLATE_ID,
    operator: env.APP_OPERATOR ?? "Workspace Lab 운영자",
    supportEmail: env.APP_SUPPORT_EMAIL ?? "",
    allowedEmails: (env.ALLOWED_EMAILS ?? "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean)
  };
}
export type WebConfig = ReturnType<typeof webConfig>;
