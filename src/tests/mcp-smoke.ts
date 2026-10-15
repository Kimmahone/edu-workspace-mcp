import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const isolatedAuth = {
  EDU_WORKSPACE_CREDENTIALS_PATH: path.join(os.tmpdir(), `edu-mcp-smoke-no-credentials-${process.pid}.json`),
  EDU_WORKSPACE_TOKEN_PATH: path.join(os.tmpdir(), `edu-mcp-smoke-no-token-${process.pid}.json`)
};
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/cli.js", "serve", "--legacy"],
  cwd: process.cwd(),
  stderr: "pipe", env: isolatedAuth
});
const client = new Client({ name: "stdio-smoke-test", version: "1.0.0" });
await client.connect(transport);
const tools = await client.listTools();
assert.equal(tools.tools.length, 31);
assert.ok(tools.tools.some((tool) => tool.name === "forms_create_quiz"));
assert.ok(tools.tools.some((tool) => tool.name === "sheets_read_values"));
assert.ok(tools.tools.some((tool) => tool.name === "sheets_list_sheets"));
assert.ok(tools.tools.some((tool) => tool.name === "sheets_inspect_workbook"));
assert.ok(tools.tools.some((tool) => tool.name === "education_create_assessment_tracker"));
assert.ok(tools.tools.some((tool) => tool.name === "education_create_classroom_submission_tracker"));
assert.ok(tools.tools.some((tool) => tool.name === "docs_read_document"));
assert.ok(tools.tools.some((tool) => tool.name === "docs_create_lesson_plan"));
assert.ok(tools.tools.some((tool) => tool.name === "docs_create_worksheet"));
assert.ok(tools.tools.some((tool) => tool.name === "docs_import_hwp"));
assert.ok(tools.tools.some((tool) => tool.name === "docs_export_hwpx"));
assert.ok(tools.tools.some((tool) => tool.name === "slides_read_presentation"));
assert.ok(tools.tools.some((tool) => tool.name === "forms_list_responses"));
assert.ok(tools.tools.some((tool) => tool.name === "classroom_list_student_submissions"));
// 빌드된 패키지 위치(dist/curriculum)에서 정리본(data/curriculum)을 실제로 찾는지 확인한다.
const standards = await client.callTool({ name: "curriculum_get_standards", arguments: { codes: ["[6사04-01]"] } });
assert.equal((standards.structuredContent as { standards: Array<{ code: string }> }).standards[0].code, "[6사04-01]");
const prompts = await client.listPrompts();
assert.ok(prompts.prompts.some((prompt) => prompt.name === "lesson_package_with_standards"));
assert.ok(prompts.prompts.some((prompt) => prompt.name === "google_document_helper"));
const status = await client.callTool({ name: "workspace_get_auth_status", arguments: {} });
assert.equal(typeof (status.structuredContent as { authenticated?: unknown } | undefined)?.authenticated, "boolean");
console.log(`MCP smoke test passed (${tools.tools.length} tools)`);
await client.close();

const agentTransport = new StdioClientTransport({
  command: process.execPath, args: ["dist/cli.js", "serve", "--workspace-readonly"],
  cwd: process.cwd(), stderr: "pipe", env: isolatedAuth
});
const agent = new Client({ name: "readonly-stdio-smoke", version: "1.0.0" });
await agent.connect(agentTransport);
try {
  const readers = await agent.listTools();
  assert.equal(readers.tools.length, 10);
  assert.ok(readers.tools.every(tool => tool.annotations?.readOnlyHint === true));
  assert.ok(readers.tools.every(tool => !tool.name.startsWith("classroom_") && !tool.name.startsWith("drive_")));
  const agentStatus = await agent.callTool({ name: "workspace_get_auth_status", arguments: {} });
  const value = agentStatus.structuredContent as { authenticated: boolean; oauthClientConfigured: boolean; scopeProfile: string };
  assert.equal(value.authenticated, false);
  assert.equal(value.oauthClientConfigured, false);
  assert.equal(value.scopeProfile, "workspace-readonly");
  console.log(`Workspace readonly MCP smoke passed (${readers.tools.length} tools, no credentials or network)`);
} finally { await agent.close(); }

// The default public path is the remote bridge; it must keep offline curriculum
// available without private Google credentials or any network request.
const remoteDirectory=await mkdtemp(path.join(os.tmpdir(),'edu-remote-smoke-'));
const publicTransport=new StdioClientTransport({command:process.execPath,args:['dist/cli.js','serve'],cwd:process.cwd(),stderr:'pipe',env:{EDU_WORKSPACE_REMOTE_DIRECTORY:remoteDirectory}});
const publicAgent=new Client({name:'public-remote-stdio-smoke',version:'1'});
try {
 await publicAgent.connect(publicTransport);
 const available=await publicAgent.listTools();assert.equal(available.tools.length,10);assert.ok(available.tools.every(tool=>tool.annotations?.readOnlyHint));
 const status=await publicAgent.callTool({name:'workspace_get_auth_status',arguments:{}});assert.equal((status.structuredContent as {authenticated:boolean}).authenticated,false);
 const standards=await publicAgent.callTool({name:'curriculum_get_standards',arguments:{codes:['[6사04-01]']}});assert.equal((standards.structuredContent as {standards:{code:string}[]}).standards[0].code,'[6사04-01]');
 const denied=await publicAgent.callTool({name:'classroom_publish_assignment',arguments:{}});assert.equal(denied.isError,true);
 console.log('Public remote bridge stdio smoke passed (10 read-only tools, offline curriculum, no credentials or network)');
}finally{await publicAgent.close();await rm(remoteDirectory,{recursive:true,force:true});}
