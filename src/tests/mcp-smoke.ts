import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/cli.js"],
  cwd: process.cwd(),
  stderr: "pipe"
});
const client = new Client({ name: "stdio-smoke-test", version: "1.0.0" });
await client.connect(transport);
const tools = await client.listTools();
assert.equal(tools.tools.length, 28);
assert.ok(tools.tools.some((tool) => tool.name === "forms_create_quiz"));
assert.ok(tools.tools.some((tool) => tool.name === "sheets_read_values"));
assert.ok(tools.tools.some((tool) => tool.name === "sheets_list_sheets"));
assert.ok(tools.tools.some((tool) => tool.name === "sheets_inspect_workbook"));
assert.ok(tools.tools.some((tool) => tool.name === "education_create_assessment_tracker"));
assert.ok(tools.tools.some((tool) => tool.name === "education_create_classroom_submission_tracker"));
assert.ok(tools.tools.some((tool) => tool.name === "docs_read_document"));
assert.ok(tools.tools.some((tool) => tool.name === "docs_create_lesson_plan"));
assert.ok(tools.tools.some((tool) => tool.name === "slides_read_presentation"));
assert.ok(tools.tools.some((tool) => tool.name === "forms_list_responses"));
assert.ok(tools.tools.some((tool) => tool.name === "classroom_list_student_submissions"));
// 빌드된 패키지 위치(dist/curriculum)에서 정리본(data/curriculum)을 실제로 찾는지 확인한다.
const standards = await client.callTool({ name: "curriculum_get_standards", arguments: { codes: ["[6사04-01]"] } });
assert.equal((standards.structuredContent as { standards: Array<{ code: string }> }).standards[0].code, "[6사04-01]");
const prompts = await client.listPrompts();
assert.ok(prompts.prompts.some((prompt) => prompt.name === "lesson_package_with_standards"));
const status = await client.callTool({ name: "workspace_get_auth_status", arguments: {} });
assert.equal(typeof (status.structuredContent as { authenticated?: unknown } | undefined)?.authenticated, "boolean");
console.log(`MCP smoke test passed (${tools.tools.length} tools)`);
await client.close();
