import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import os from "node:os";
import path from "node:path";
import { parse, stringify } from "smol-toml";
import { PACKAGE_SPEC } from "../version.js";

export type InstallClient = "codex" | "claude" | "claude-desktop" | "cursor";
export type InstallOptions = { readAccess?: boolean; workspaceReadonly?: boolean; homeDirectory?: string; platform?: NodeJS.Platform; appData?: string };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const readonlyMode = (options: InstallOptions) => options.workspaceReadonly ?? !options.readAccess;
const serverName = (options: InstallOptions) => readonlyMode(options) ? "edu-workspace-agent" : "edu-workspace";

export function jsonConfigPath(client: "claude-desktop" | "cursor" | "claude", platform = process.platform, homeDirectory = os.homedir(), appData = process.env.APPDATA): string {
  const p = platform === "win32" ? path.win32 : path.posix;
  if (client === "claude") return p.join(homeDirectory, ".claude.json");
  if (client === "cursor") return p.join(homeDirectory, ".cursor", "mcp.json");
  if (platform === "darwin") return p.join(homeDirectory, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  if (platform === "win32") { if (!appData) throw new Error("Windows APPDATA 경로를 찾지 못했습니다."); return p.join(appData, "Claude", "claude_desktop_config.json"); }
  return p.join(homeDirectory, ".config", "Claude", "claude_desktop_config.json");
}

export function registration(options: InstallOptions = {}, previous: Record<string, unknown> = {}) {
  if (Object.keys(previous).length && (!Array.isArray(previous.args) || !previous.args.some(arg => typeof arg === "string" && /edu[- ]workspace[- ]mcp/i.test(arg)))) {
    throw new Error("같은 서버 이름에 다른 사용자 설정이 있어 덮어쓰지 않았습니다.");
  }
  const env = record(previous.env) ? { ...previous.env } : {};
  if (readonlyMode(options)) env.EDU_WORKSPACE_SCOPE_PROFILE = "workspace-readonly";
  else { delete env.EDU_WORKSPACE_SCOPE_PROFILE; if (options.readAccess) env.EDU_WORKSPACE_READ_ACCESS = "1"; }
  const platform = options.platform ?? process.platform;
  return { ...previous, command: platform === "win32" ? "cmd" : "npx", args: [
    ...(platform === "win32" ? ["/d", "/s", "/c", "npx"] : []), "-y", PACKAGE_SPEC,
    "serve", readonlyMode(options) ? "--workspace-readonly" : "--legacy"
  ], ...(Object.keys(env).length ? { env } : {}) };
}

async function textAt(filePath: string): Promise<string> {
  try { return await readFile(filePath, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw new Error("기존 앱 설정을 읽지 못했습니다. 설정은 변경하지 않았습니다."); }
}
async function atomicReplace(filePath: string, before: string, after: string): Promise<void> {
  if (before === after) return;
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, after, { mode: 0o600 });
    if (await textAt(filePath) !== before) throw new Error("다른 앱이 설정을 변경해 설치를 중단했습니다. 기존 설정은 보존했습니다. 다시 실행하세요.");
    await rename(temporary, filePath);
  } finally { await rm(temporary, { force: true }); }
}

export async function updateJsonClientConfig(filePath: string, options: InstallOptions = {}): Promise<void> {
  const before = await textAt(filePath);
  let config: Record<string, unknown>;
  try { config = before ? JSON.parse(before) : {}; if (!record(config)) throw new Error(); }
  catch { throw new Error("기존 MCP 설정이 올바른 JSON 객체가 아닙니다. 설정은 변경하지 않았습니다."); }
  if (config.mcpServers !== undefined && !record(config.mcpServers)) throw new Error("기존 mcpServers 설정이 객체가 아니므로 변경하지 않았습니다.");
  const name = serverName(options);
  const servers = { ...(config.mcpServers as Record<string, unknown> | undefined) };
  if (servers[name] !== undefined && !record(servers[name])) throw new Error("기존 서버 설정 형식이 달라 변경하지 않았습니다.");
  const next = registration(options, servers[name] as Record<string, unknown> | undefined);
  if (isDeepStrictEqual(servers[name], next)) return;
  servers[name] = next;
  await atomicReplace(filePath, before, `${JSON.stringify({ ...config, mcpServers: servers }, null, 2)}\n`);
}

export async function updateCodexConfig(filePath: string, options: InstallOptions = {}): Promise<void> {
  const before = await textAt(filePath);
  let config: Record<string, unknown>;
  try { config = parse(before, { integersAsBigInt: true, unsafeKeyBehaviour: "throw" }) as Record<string, unknown>; }
  catch { throw new Error("기존 Codex TOML 설정을 안전하게 읽지 못했습니다. 설정은 변경하지 않았습니다."); }
  if (config.mcp_servers !== undefined && !record(config.mcp_servers)) throw new Error("기존 Codex MCP 설정 형식이 달라 변경하지 않았습니다.");
  const name = serverName(options);
  const servers = (config.mcp_servers ?? {}) as Record<string, unknown>;
  if (servers[name] !== undefined && !record(servers[name])) throw new Error("기존 Codex 서버 설정 형식이 달라 변경하지 않았습니다.");
  const next = registration(options, servers[name] as Record<string, unknown> | undefined);
  if (isDeepStrictEqual(servers[name], next)) return;
  const replacement = stringify({ mcp_servers: { [name]: next } });
  const headers = [...before.matchAll(/^\[(?!\[)([^\]\n]+)\]\s*(?:#[^\n]*)?$/gm)];
  const owned = new RegExp(`^mcp_servers\\.(?:${name}|"${name}")(?:\\.|$)`);
  const spans = headers.map((match,index) => ({ start: match.index!, end: headers[index+1]?.index ?? before.length, own: owned.test(match[1]) })).filter(span=>span.own);
  if (servers[name] && !spans.length) throw new Error("Codex의 사용자 인라인 설정은 자동으로 덮어쓰지 않습니다. MCP 설정 화면에서 이 서버만 갱신하세요.");
  let after = before;
  for (const span of spans.reverse()) after = after.slice(0,span.start)+after.slice(span.end);
  after = after.trimEnd()+"\n\n"+replacement+"\n";
  try {
    const verified = parse(after, { integersAsBigInt: true, unsafeKeyBehaviour: "throw" }) as Record<string, unknown>;
    const expected = { ...config, mcp_servers: { ...servers, [name]: next } };
    // Preserve non-MCP values and all other servers before committing the edit.
    if (!isDeepStrictEqual(verified, parse(stringify(expected), { integersAsBigInt: true, unsafeKeyBehaviour: "throw" }))) throw new Error();
  } catch { throw new Error("Codex 설정 보존 검증에 실패해 변경하지 않았습니다."); }
  await atomicReplace(filePath, before, after);
}

export function codexAddArgs(options: InstallOptions = {}): string[] {
  const config = registration(options);
  return ["mcp","add",serverName(options), ...Object.entries(config.env ?? {}).flatMap(([key,value])=>["--env",`${key}=${value}`]), "--",config.command,...config.args];
}
export function claudeCodeAddArgs(options: InstallOptions = {}, platform = process.platform): string[] {
  const config = registration({ ...options, platform });
  return ["mcp","add",serverName(options),"--scope","user", ...Object.entries(config.env ?? {}).flatMap(([key,value])=>["--env",`${key}=${value}`]), "--",config.command,...config.args];
}
export async function detectClients(options: InstallOptions = {}): Promise<InstallClient[]> {
  const home = options.homeDirectory ?? os.homedir(), platform = options.platform ?? process.platform;
  const found: InstallClient[] = [];
  for (const client of ["codex", "claude"] as const) {
    const result = spawnSync(client,["--version"],{stdio:"ignore",timeout:3000});
    if (!result.error && result.status === 0) found.push(client);
  }
  for (const client of ["claude-desktop", "cursor"] as const) {
    const app = client === "claude-desktop" ? "Claude" : "Cursor";
    const candidates = [jsonConfigPath(client,platform,home,options.appData)];
    if (platform === "darwin") candidates.push(`/Applications/${app}.app`,path.join(home,"Applications",`${app}.app`));
    if (platform === "win32" && process.env.LOCALAPPDATA) candidates.push(path.win32.join(process.env.LOCALAPPDATA,"Programs",app,`${app}.exe`));
    for (const candidate of candidates) {
      try { await access(candidate); found.push(client); break; } catch { /* absent */ }
    }
  }
  return found;
}
export async function installClient(client: InstallClient, options: InstallOptions = {}): Promise<string> {
  const home = options.homeDirectory ?? os.homedir(), platform = options.platform ?? process.platform;
  const filePath = client === "codex" ? (platform === "win32" ? path.win32 : path.posix).join(home,".codex","config.toml") : jsonConfigPath(client,platform,home,options.appData);
  if (client === "codex") await updateCodexConfig(filePath,options);
  else await updateJsonClientConfig(filePath,options);
  return `${client}: ${serverName(options)} 등록 준비 완료. 앱 재시작과 사용자 Google 로그인이 필요합니다.`;
}
