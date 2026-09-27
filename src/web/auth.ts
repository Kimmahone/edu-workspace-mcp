import { randomBytes, createHash } from "node:crypto";
import { type Credentials, CodeChallengeMethod } from "google-auth-library";
import { google } from "googleapis";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Store } from "./store.js";
import type { WebConfig } from "./config.js";
import { getAuthorizedClient } from "../auth/google-auth.js";

const TTL = 8 * 60 * 60 * 1000;
export type Session = { csrf: string; user?: { id: string; email: string }; tokens?: Credentials };
export const nonce = () => randomBytes(32).toString("hex");
export class WebAuth {
  constructor(private config: WebConfig, private store: Store) {}
  cookie(res: ServerResponse, id: string, expire = false) {
    res.setHeader("Set-Cookie", `edu_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expire ? 0 : TTL / 1000}${this.config.hosted ? "; Secure" : ""}`);
  }
  async session(req: IncomingMessage, res: ServerResponse) {
    const candidate = /(?:^|;\s*)edu_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? "")?.[1];
    const found = candidate ? await this.store.get<Session>(`session:${candidate}`) : undefined;
    if (found) return { id: candidate!, value: found };
    const id = nonce(), value: Session = { csrf: nonce() };
    await this.store.put(`session:${id}`, value, TTL); this.cookie(res, id);
    return { id, value };
  }
  oauth() { return new google.auth.OAuth2(this.config.googleClientId, this.config.googleClientSecret, `${this.config.origin}/auth/callback`); }
  async start(id: string, classroom = false) {
    const state = nonce(), verifier = nonce();
    await this.store.put(`oauth:${state}`, { id, verifier }, 10 * 60 * 1000);
    return this.oauth().generateAuthUrl({ access_type: "offline", prompt: "consent", state,
      include_granted_scopes: true,
      scope: ["openid", "email", "https://www.googleapis.com/auth/drive.file", ...(classroom ? ["https://www.googleapis.com/auth/classroom.courses.readonly", "https://www.googleapis.com/auth/classroom.coursework.students"] : [])],
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: CodeChallengeMethod.S256
    });
  }
  async finish(state: string, code: string, id: string, res: ServerResponse) {
    const expected = await this.store.take<{ id: string; verifier: string }>(`oauth:${state}`);
    if (!expected || expected.id !== id) throw new Error("로그인 요청이 만료되었습니다. 다시 연결해 주세요.");
    const client = this.oauth();
    const { tokens } = await client.getToken({ code, codeVerifier: expected.verifier });
    if (!tokens.id_token) throw new Error("Google 계정을 확인하지 못했습니다.");
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: this.config.googleClientId });
    const user = ticket.getPayload();
    if (!user?.sub || !user.email || !user.email_verified) throw new Error("인증된 이메일이 필요합니다.");
    if (this.config.allowedEmails.length && !this.config.allowedEmails.includes(user.email.toLowerCase())) throw new Error("현재 시범 운영 대상 계정만 사용할 수 있습니다.");
    const newId = nonce();
    await this.store.put(`session:${newId}`, { csrf: nonce(), user: { id: user.sub, email: user.email }, tokens }, TTL);
    await this.store.remove(`session:${id}`); this.cookie(res, newId);
  }
  async client(id: string, session: Session) {
    if (!this.config.hosted) return getAuthorizedClient();
    if (!session.tokens || !session.user) throw new Error("Google 로그인이 필요합니다.");
    const client = this.oauth(); client.setCredentials(session.tokens);
    const access = await client.getAccessToken();
    if (!access.token) throw new Error("Google 연결이 만료되었습니다. 다시 로그인해 주세요.");
    // Re-read before persisting refreshed tokens so a simultaneous logout stays logged out.
    const current = await this.store.get<Session>(`session:${id}`);
    if (!current) throw new Error("로그아웃된 세션입니다.");
    await this.store.put(`session:${id}`, { ...current, tokens: client.credentials }, TTL);
    return client;
  }
}
