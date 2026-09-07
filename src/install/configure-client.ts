import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PACKAGE_SPEC } from "../version.js";

export type InstallClient = "codex" | "claude" | "claude-desktop" | "cursor";

export type InstallOptions = {
  readAccess?: boolean;
};

const SERVER_NAME = "edu-workspace";

export function jsonConfigPath(
  client: "claude-desktop" | "cursor",
  platform = process.platform,
  homeDirectory = os.homedir(),
  appData = process.env.APPDATA
): string {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (client === "cursor") return pathApi.join(homeDirectory, ".cursor", "mcp.json");
  if (platform === "darwin") return pathApi.join(homeDirectory, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  if (platform === "win32") {
    if (!appData) throw new Error("Windows APPDATA 경로를 찾지 못했습니다.");
    return pathApi.join(appData, "Claude", "claude_desktop_config.json");
  }
  return pathApi.join(homeDirectory, ".config", "Claude", "claude_desktop_config.json");
}

export async function updateJsonClientConfig(filePath: string, options: InstallOptions = {}): Promise<void> {
  let config: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("MCP 설정의 최상위 값은 JSON 객체여야 합니다.");
    config = parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`기존 MCP 설정을 안전하게 읽지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const existingServers = config.mcpServers;
  if (existingServers !== undefined && (!existingServers || typeof existingServers !== "object" || Array.isArray(existingServers))) {
    throw new Error("기존 mcpServers 설정이 JSON 객체가 아니므로 자동으로 변경하지 않았습니다.");
  }
  const mcpServers = { ...(existingServers as Record<string, unknown> | undefined) };
  mcpServers[SERVER_NAME] = {
    command: "npx",
    args: ["-y", PACKAGE_SPEC],
    ...(options.readAccess ? { env: { EDU_WORKSPACE_READ_ACCESS: "1" } } : {})
  };
  const nextConfig = { ...config, mcpServers };

  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  const backupPath = `${filePath}.${process.pid}.bak`;
  let replacementSucceeded = false;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(nextConfig, null, 2)}\n`, { mode: 0o600 });
    if (process.platform === "win32") {
      let backedUp = false;
      try {
        await access(filePath);
        await rename(filePath, backupPath);
        backedUp = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      try {
        await rename(temporaryPath, filePath);
        replacementSucceeded = true;
      } catch (error) {
        if (backedUp) await rename(backupPath, filePath);
        throw error;
      }
      if (backedUp) await rm(backupPath, { force: true });
    } else {
      await rename(temporaryPath, filePath);
      replacementSucceeded = true;
    }
  } finally {
    await rm(temporaryPath, { force: true });
    if (replacementSucceeded) await rm(backupPath, { force: true });
  }
}

function configureCodex(options: InstallOptions): void {
  const probe = spawnSync("codex", ["mcp", "--help"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    throw new Error("Codex CLI를 찾지 못했습니다. Codex 설정의 MCP servers 화면에서 npx 명령을 직접 등록하세요.");
  }
  spawnSync("codex", ["mcp", "remove", SERVER_NAME], { encoding: "utf8" });
  const added = spawnSync("codex", codexAddArgs(options), { encoding: "utf8" });
  if (added.error || added.status !== 0) {
    throw new Error(added.stderr?.trim() || added.error?.message || "Codex MCP 등록에 실패했습니다.");
  }
}

export function codexAddArgs(options: InstallOptions = {}): string[] {
  return [
    "mcp", "add", SERVER_NAME,
    ...(options.readAccess ? ["--env", "EDU_WORKSPACE_READ_ACCESS=1"] : []),
    "--", "npx", "-y", PACKAGE_SPEC
  ];
}

export function claudeCodeAddArgs(options: InstallOptions = {}, platform = process.platform): string[] {
  const serverCommand = platform === "win32"
    ? ["cmd", "/c", "npx", "-y", PACKAGE_SPEC]
    : ["npx", "-y", PACKAGE_SPEC];
  return [
    "mcp", "add", SERVER_NAME, "--scope", "user",
    ...(options.readAccess ? ["--env", "EDU_WORKSPACE_READ_ACCESS=1"] : []),
    "--", ...serverCommand
  ];
}

function configureClaudeCode(options: InstallOptions): void {
  const probe = spawnSync("claude", ["mcp", "--help"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    throw new Error("Claude Code CLI를 찾지 못했습니다. Claude Code를 설치한 터미널에서 이 명령을 다시 실행하세요.");
  }
  spawnSync("claude", ["mcp", "remove", SERVER_NAME, "--scope", "user"], { encoding: "utf8" });
  const added = spawnSync("claude", claudeCodeAddArgs(options), { encoding: "utf8" });
  if (added.error || added.status !== 0) {
    throw new Error(added.stderr?.trim() || added.error?.message || "Claude Code MCP 등록에 실패했습니다.");
  }
}

export async function installClient(client: InstallClient, options: InstallOptions = {}): Promise<string> {
  if (client === "codex") {
    configureCodex(options);
    return "Codex 전체 프로젝트용 MCP 설정에 등록했습니다. Codex를 재시작하세요.";
  }
  if (client === "claude") {
    configureClaudeCode(options);
    return "Claude Code 사용자 범위 MCP 설정에 등록했습니다. 모든 프로젝트에서 사용할 수 있습니다.";
  }
  const filePath = jsonConfigPath(client);
  await updateJsonClientConfig(filePath, options);
  return `${client === "claude-desktop" ? "Claude Desktop" : "Cursor"} 전체 프로젝트용 MCP 설정에 등록했습니다: ${filePath}`;
}
