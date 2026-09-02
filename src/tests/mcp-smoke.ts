import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/cli.js"],
  cwd: process.cwd(),
  stderr: "pipe"
});
const client = new Client({ name: "stdio-smoke-test", version: "0.1.0" });
await client.connect(transport);
const tools = await client.listTools();
assert.equal(tools.tools.length, 12);
assert.ok(tools.tools.some((tool) => tool.name === "forms_create_quiz"));
const status = await client.callTool({ name: "workspace_get_auth_status", arguments: {} });
assert.equal(typeof (status.structuredContent as { authenticated?: unknown } | undefined)?.authenticated, "boolean");
console.log(`MCP smoke test passed (${tools.tools.length} tools)`);
await client.close();
