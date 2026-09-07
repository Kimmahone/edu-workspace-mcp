import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { claudeCodeAddArgs, codexAddArgs, jsonConfigPath, updateJsonClientConfig } from "../install/configure-client.js";

test("client installer preserves existing MCP servers and pins the stable version", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "edu-workspace-install-"));
  const configPath = path.join(directory, "mcp.json");
  try {
    await writeFile(configPath, JSON.stringify({ mcpServers: { existing: { command: "existing" } }, setting: true }));
    await updateJsonClientConfig(configPath);
    const config = JSON.parse(await readFile(configPath, "utf8")) as {
      setting: boolean;
      mcpServers: Record<string, { command: string; args?: string[] }>;
    };
    assert.equal(config.setting, true);
    assert.equal(config.mcpServers.existing.command, "existing");
    assert.deepEqual(config.mcpServers["edu-workspace"], { command: "npx", args: ["-y", "edu-workspace-mcp@1.0.0"] });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("read installation adds the opt-in environment variable", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "edu-workspace-install-read-"));
  const configPath = path.join(directory, "mcp.json");
  try {
    await updateJsonClientConfig(configPath, { readAccess: true });
    const config = JSON.parse(await readFile(configPath, "utf8")) as {
      mcpServers: Record<string, { env?: Record<string, string> }>;
    };
    assert.equal(config.mcpServers["edu-workspace"].env?.EDU_WORKSPACE_READ_ACCESS, "1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("client config paths are computer-wide, not project-relative", () => {
  assert.equal(jsonConfigPath("cursor", "linux", "/home/teacher"), "/home/teacher/.cursor/mcp.json");
  assert.equal(jsonConfigPath("claude-desktop", "darwin", "/Users/teacher"), "/Users/teacher/Library/Application Support/Claude/claude_desktop_config.json");
  assert.equal(jsonConfigPath("claude-desktop", "win32", "C:\\Users\\teacher", "C:\\Users\\teacher\\AppData\\Roaming"), "C:\\Users\\teacher\\AppData\\Roaming\\Claude\\claude_desktop_config.json");
});

test("CLI installers use global scope and carry the read profile", () => {
  assert.deepEqual(codexAddArgs({ readAccess: true }), [
    "mcp", "add", "edu-workspace", "--env", "EDU_WORKSPACE_READ_ACCESS=1",
    "--", "npx", "-y", "edu-workspace-mcp@1.0.0"
  ]);
  assert.deepEqual(claudeCodeAddArgs({ readAccess: true }, "darwin"), [
    "mcp", "add", "edu-workspace", "--scope", "user", "--env", "EDU_WORKSPACE_READ_ACCESS=1",
    "--", "npx", "-y", "edu-workspace-mcp@1.0.0"
  ]);
  assert.deepEqual(claudeCodeAddArgs({}, "win32").slice(-6), [
    "--", "cmd", "/c", "npx", "-y", "edu-workspace-mcp@1.0.0"
  ]);
});
