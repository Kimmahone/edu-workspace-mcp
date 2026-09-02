import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, type WorkspaceServices } from "../server.js";
import { resetApprovalsForTests } from "../approvals/service.js";

function services(): WorkspaceServices {
  return {
    getAuthStatus: async () => ({ authenticated: true, credentialsPath: "/test/credentials.json", tokenPath: "/test/token.json", grantedScopes: [], message: "ok" }),
    listCourses: async () => [{ id: "course-1", name: "2학년 과학" }],
    searchFiles: async () => [{ id: "file-1", name: "학습지" }],
    createFolder: async (name) => ({ id: "folder-1", name }),
    createDocument: async (title) => ({ documentId: "doc-1", title, url: "https://docs.google.com/document/d/doc-1/edit" }),
    createWorkbook: async (title) => ({ spreadsheetId: "sheet-1", title, url: "https://docs.google.com/spreadsheets/d/sheet-1/edit" }),
    createPresentation: async (title) => ({ presentationId: "slides-1", title, url: "https://docs.google.com/presentation/d/slides-1/edit" }),
    createQuiz: async (title) => ({ formId: "form-1", title, responderUrl: "https://forms.example/respond", editUrl: "https://forms.example/edit" }),
    createAssignmentDraft: async (input) => ({ courseId: input.courseId, courseWorkId: "work-1", title: input.title, state: "DRAFT", alternateLink: undefined, dueDate: undefined, dueTime: undefined, materials: input.materials ?? [] }),
    publishAssignment: async (courseId, courseWorkId) => ({ courseId, courseWorkId, state: "PUBLISHED", title: "과제", alternateLink: undefined }),
    shareFile: async (_fileId, type, role, emailAddress, domain) => ({ id: "permission-1", type, role, emailAddress, domain })
  };
}

async function connectedClient() {
  const server = createServer(services());
  const client = new Client({ name: "test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("server exposes the complete MVP tool set", async () => {
  const { client, server } = await connectedClient();
  const result = await client.listTools();
  assert.deepEqual(result.tools.map((tool) => tool.name).sort(), [
    "classroom_create_assignment_draft", "classroom_list_courses", "classroom_publish_assignment",
    "docs_create_document", "drive_create_folder", "drive_prepare_share", "drive_search_files", "drive_share_file",
    "forms_create_quiz", "sheets_create_workbook", "slides_create_presentation", "workspace_get_auth_status"
  ].sort());
  assert.equal(result.tools.find((tool) => tool.name === "drive_search_files")?.annotations?.readOnlyHint, true);
  assert.equal(result.tools.find((tool) => tool.name === "classroom_publish_assignment")?.annotations?.destructiveHint, true);
  await client.close(); await server.close();
});

test("document tool returns a structured result", async () => {
  const { client, server } = await connectedClient();
  const result = await client.callTool({ name: "docs_create_document", arguments: { title: "과학 학습지", blocks: [{ text: "내용" }] } });
  const content = result.structuredContent as { document: { documentId: string } };
  assert.equal(content.document.documentId, "doc-1");
  await client.close(); await server.close();
});

test("assignment publishing requires a matching one-time approval", async () => {
  resetApprovalsForTests();
  const { client, server } = await connectedClient();
  const draft = await client.callTool({ name: "classroom_create_assignment_draft", arguments: { courseId: "course-1", title: "형성평가" } });
  const approvalId = (draft.structuredContent as { approval: { id: string } }).approval.id;
  const published = await client.callTool({ name: "classroom_publish_assignment", arguments: { courseId: "course-1", courseWorkId: "work-1", approvalId, confirmation: "PUBLISH" } });
  assert.equal((published.structuredContent as { assignment: { state: string } }).assignment.state, "PUBLISHED");
  const repeated = await client.callTool({ name: "classroom_publish_assignment", arguments: { courseId: "course-1", courseWorkId: "work-1", approvalId, confirmation: "PUBLISH" } });
  assert.equal((repeated.structuredContent as { error: string }).error, "ASSIGNMENT_PUBLISH_FAILED");
  await client.close(); await server.close();
});
