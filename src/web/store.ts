import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";

/** One encrypted TTL store for sessions, OAuth states, approvals and job receipts. */
export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown, ttlMs: number): Promise<void>;
  take<T>(key: string): Promise<T | undefined>;
  remove(key: string): Promise<void>;
  claim(key: string, value: unknown, ttlMs: number): Promise<boolean>;
  close(): Promise<void>;
}
export class MemoryStore implements Store {
  private data = new Map<string, { value: unknown; expires: number }>();
  async get<T>(key: string): Promise<T | undefined> {
    const item = this.data.get(key);
    if (!item || item.expires <= Date.now()) { this.data.delete(key); return undefined; }
    return structuredClone(item.value) as T;
  }
  async put(key: string, value: unknown, ttlMs: number) {
    for (const [k, item] of this.data) if (item.expires <= Date.now()) this.data.delete(k);
    if (this.data.size >= 10_000 && !this.data.has(key)) throw new Error("작업 저장 공간이 가득 찼습니다. 잠시 뒤 다시 시도해 주세요.");
    this.data.set(key, { value: structuredClone(value), expires: Date.now() + ttlMs });
  }
  async take<T>(key: string) {
    const item = this.data.get(key); this.data.delete(key);
    return item && item.expires > Date.now() ? structuredClone(item.value) as T : undefined;
  }
  async remove(key: string) { this.data.delete(key); }
  async claim(key: string, value: unknown, ttlMs: number) {
    const existing = this.data.get(key);
    if (existing && existing.expires > Date.now()) return false;
    this.data.set(key, { value: structuredClone(value), expires: Date.now() + ttlMs }); return true;
  }
  async close() { this.data.clear(); }
}

export function seal(value: unknown, secret: string): string {
  const iv = randomBytes(12), key = createHash("sha256").update(secret).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function unseal<T>(value: string, secret: string): T {
  const b = Buffer.from(value, "base64"), key = createHash("sha256").update(secret).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString()) as T;
}

export class PostgresStore implements Store {
  private pool: Pool;
  constructor(url: string, private secret: string) { this.pool = new Pool({ connectionString: url, max: 8 }); }
  async init() {
    await this.pool.query("CREATE TABLE IF NOT EXISTS edu_web_state (key text PRIMARY KEY, payload text NOT NULL, expires_at timestamptz NOT NULL)");
    await this.pool.query("CREATE INDEX IF NOT EXISTS edu_web_state_expiry ON edu_web_state(expires_at)");
  }
  async get<T>(key: string) {
    const r = await this.pool.query("SELECT payload FROM edu_web_state WHERE key=$1 AND expires_at>NOW()", [key]);
    return r.rows[0] ? unseal<T>(r.rows[0].payload, this.secret) : undefined;
  }
  async put(key: string, value: unknown, ttlMs: number) {
    await this.pool.query("INSERT INTO edu_web_state VALUES ($1,$2,$3) ON CONFLICT(key) DO UPDATE SET payload=$2, expires_at=$3", [key, seal(value, this.secret), new Date(Date.now() + ttlMs)]);
    await this.pool.query("DELETE FROM edu_web_state WHERE expires_at<=NOW()");
  }
  async take<T>(key: string) {
    const r = await this.pool.query("DELETE FROM edu_web_state WHERE key=$1 RETURNING payload,expires_at", [key]);
    return r.rows[0] && new Date(r.rows[0].expires_at).getTime() > Date.now() ? unseal<T>(r.rows[0].payload, this.secret) : undefined;
  }
  async remove(key: string) { await this.pool.query("DELETE FROM edu_web_state WHERE key=$1", [key]); }
  async claim(key: string, value: unknown, ttlMs: number) {
    const r = await this.pool.query("INSERT INTO edu_web_state VALUES ($1,$2,$3) ON CONFLICT(key) DO UPDATE SET payload=$2,expires_at=$3 WHERE edu_web_state.expires_at<=NOW() RETURNING key", [key, seal(value, this.secret), new Date(Date.now() + ttlMs)]);
    return Boolean(r.rowCount);
  }
  async close() { await this.pool.end(); }
}
