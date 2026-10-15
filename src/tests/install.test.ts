import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PACKAGE_SPEC } from "../version.js";
import { claudeCodeAddArgs, codexAddArgs, jsonConfigPath, updateJsonClientConfig, updateCodexConfig, installClient } from "../install/configure-client.js";
import { parse } from "smol-toml";

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
    assert.deepEqual(config.mcpServers["edu-workspace-agent"], { command: "npx", args: ["-y", PACKAGE_SPEC, "serve", "--workspace-readonly"], env: { EDU_WORKSPACE_SCOPE_PROFILE: "workspace-readonly" } });
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
    "--", "npx", "-y", PACKAGE_SPEC, "serve", "--legacy"
  ]);
  assert.deepEqual(claudeCodeAddArgs({ readAccess: true }, "darwin"), [
    "mcp", "add", "edu-workspace", "--scope", "user", "--env", "EDU_WORKSPACE_READ_ACCESS=1",
    "--", "npx", "-y", PACKAGE_SPEC, "serve", "--legacy"
  ]);
  assert.deepEqual(claudeCodeAddArgs({}, "win32").slice(-10), [
    "--", "cmd", "/d", "/s", "/c", "npx", "-y", PACKAGE_SPEC, "serve", "--workspace-readonly"
  ]);
});

test("four-app clean installation and repeated upgrade preserve unrelated settings", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "edu-public-install-"));
  try {
    for (const client of ["codex", "claude", "claude-desktop", "cursor"] as const) {
      await installClient(client, { homeDirectory: directory, platform: "darwin" });
      await installClient(client, { homeDirectory: directory, platform: "darwin" });
    }
    const codexPath = path.join(directory, ".codex", "config.toml");
    const before = await readFile(codexPath,"utf8");
    await writeFile(codexPath, '# user preference\nmodel = "user-model"\n\n'+before+'\n[mcp_servers.other]\ncommand = "other"\n');
    await updateCodexConfig(codexPath);
    const after = await readFile(codexPath,"utf8");
    const obj = parse(after) as { model: string; mcp_servers: Record<string,{command:string}> };
    assert.equal(obj.model,"user-model");
    assert.equal(obj.mcp_servers.other.command,"other");
    assert.ok(after.startsWith('# user preference'));
    assert.equal((after.match(/\[mcp_servers\.edu-workspace-agent\]/g) ?? []).length,1);
    const gui = JSON.parse(await readFile(jsonConfigPath("cursor","darwin",directory),"utf8"));
    assert.equal(gui.mcpServers["edu-workspace-agent"].env.EDU_WORKSPACE_SCOPE_PROFILE,"workspace-readonly");
    assert.ok(gui.mcpServers["edu-workspace-agent"].args.includes("--workspace-readonly"));
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test("malformed configuration and server-name collisions never overwrite user data", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(),"edu-public-install-stop-"));
  const file = path.join(directory,"config.json");
  try {
    await writeFile(file,'{"mcpServers":');
    await assert.rejects(()=>updateJsonClientConfig(file), /변경하지/);
    assert.equal(await readFile(file,"utf8"),'{"mcpServers":');
    const collision=JSON.stringify({mcpServers:{"edu-workspace-agent":{command:"other"}}});
    await writeFile(file,collision);
    await assert.rejects(()=>updateJsonClientConfig(file), /덮어쓰지/);
    assert.equal(await readFile(file,"utf8"),collision);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
