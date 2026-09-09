import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, type WorkspaceServices } from "../server.js";
import { resetApprovalsForTests } from "../approvals/service.js";

function services(): WorkspaceServices {
  return {
    getAuthStatus: async () => ({ authenticated: true, oauthClientConfigured: true, oauthClientSource: "bundled", credentialsPath: "/test/credentials.json", tokenPath: "/test/token.json", grantedScopes: [], readAccessEnabled: false, message: "ok" }),
    listCourses: async () => [{ id: "course-1", name: "2학년 과학" }],
    listCourseWork: async (courseId) => ({ courseId, returnedCourseWork: 1, hasMore: false, courseWork: [{
      id: "work-1", title: "형성평가", description: undefined, state: "PUBLISHED", workType: "ASSIGNMENT",
      alternateLink: undefined, creationTime: undefined, updateTime: undefined, dueDate: undefined, dueTime: undefined,
      scheduledTime: undefined, maxPoints: 10, topicId: undefined, associatedWithDeveloper: true, materials: []
    }] }),
    listStudents: async (courseId) => ({ courseId, returnedStudents: 1, hasMore: false, students: [{
      userId: "student-1", fullName: "김학생", givenName: "학생", familyName: "김", emailAddress: undefined,
      photoUrl: undefined, courseWorkFolder: undefined
    }] }),
    listStudentSubmissions: async (courseId, courseWorkId) => ({ courseId, courseWorkId, returnedSubmissions: 1, hasMore: false, submissions: [{
      id: "submission-1", userId: "student-1", state: "TURNED_IN", late: false, assignedGrade: undefined,
      draftGrade: undefined, creationTime: undefined, updateTime: undefined, alternateLink: undefined,
      shortAnswer: undefined, multipleChoiceAnswer: undefined, attachments: []
    }] }),
    searchFiles: async () => [{ id: "file-1", name: "학습지" }],
    getFileMetadata: async () => ({ id: "file-1", name: "학습지", mimeType: "application/vnd.google-apps.document" }),
    createFolder: async (name) => ({ id: "folder-1", name }),
    createDocument: async (title) => ({ documentId: "doc-1", title, url: "https://docs.google.com/document/d/doc-1/edit" }),
    readDocument: async () => ({ documentId: "doc-1", title: "학습지", url: "https://docs.google.com/document/d/doc-1/edit", totalCharacters: 2, returnedCharacters: 2, truncated: false, tabs: [{ tabId: "tab-1", title: "탭 1", index: 0, nestingLevel: 0, text: "내용", totalCharacters: 2, truncated: false }] }),
    createWorkbook: async (title) => ({ spreadsheetId: "sheet-1", title, url: "https://docs.google.com/spreadsheets/d/sheet-1/edit" }),
    listSheets: async (spreadsheet) => ({ spreadsheetId: "sheet-1", title: "학급 기록", url: "https://docs.google.com/spreadsheets/d/sheet-1/edit", sheets: [{ title: "AI 피드백", sheetId: 0, index: 0, rowCount: 100, columnCount: 12, hidden: false }] }),
    readValues: async (spreadsheet, options) => ({ spreadsheetId: "sheet-1", range: options?.range ?? "'AI 피드백'", totalRows: 2, returnedRows: 2, truncated: false, rows: [["이름", "국어"], ["김리안", "95"]] }),
    inspectWorkbook: (async () => ({ spreadsheetId: "sheet-1", title: "학급 기록", sheetCount: 1, formulaCount: 3, formulaErrorCount: 0, privacy: "no cell values" })) as unknown as WorkspaceServices["inspectWorkbook"],
    createAssessmentTracker: (async (input: { title: string; students: unknown[] }) => ({ spreadsheetId: "assessment-1", title: input.title, url: "https://docs.google.com/spreadsheets/d/assessment-1/edit", template: "ASSESSMENT_TRACKER", studentCount: input.students.length, subjectCount: 5, sheets: [], privacy: "no names returned" })) as WorkspaceServices["createAssessmentTracker"],
    createSubmissionTracker: (async (input: { title: string; students: unknown[]; submissions: unknown[] }) => ({ spreadsheetId: "submission-1", title: input.title, url: "https://docs.google.com/spreadsheets/d/submission-1/edit", template: "CLASSROOM_SUBMISSION_TRACKER", studentCount: input.students.length, submissionCount: input.submissions.length, submittedCount: 1, missingCount: 0, lateCount: 0, sheets: [], privacy: "no names returned" })) as WorkspaceServices["createSubmissionTracker"],
    createPresentation: async (title) => ({ presentationId: "slides-1", title, url: "https://docs.google.com/presentation/d/slides-1/edit" }),
    readPresentation: async () => ({ presentationId: "slides-1", title: "수업 자료", url: "https://docs.google.com/presentation/d/slides-1/edit", totalSlides: 1, returnedSlides: 1, truncated: false, slides: [{ index: 1, objectId: "slide-1", text: "내용", notes: "", elementCount: 1, truncated: false }] }),
    createQuiz: async (title) => ({ formId: "form-1", title, responderUrl: "https://forms.example/respond", editUrl: "https://forms.example/edit" }),
    readForm: async () => ({ formId: "form-1", title: "형성평가", documentTitle: "형성평가", description: "", isQuiz: true, responderUrl: "https://forms.example/respond", editUrl: "https://forms.example/edit", linkedSheetId: undefined, totalItems: 1, returnedItems: 1, truncated: false, items: [] }),
    listFormResponses: async () => ({ formId: "form-1", returnedResponses: 1, hasMore: false, responses: [{ responseId: "response-1", respondentEmail: undefined, createTime: undefined, lastSubmittedTime: undefined, totalScore: undefined, answers: {} }] }),
    createAssignmentDraft: async (input) => ({ courseId: input.courseId, courseWorkId: "work-1", title: input.title, state: "DRAFT", alternateLink: undefined, dueDate: undefined, dueTime: undefined, materials: input.materials ?? [] }),
    publishAssignment: async (courseId, courseWorkId) => ({ courseId, courseWorkId, state: "PUBLISHED", title: "과제", alternateLink: undefined }),
    shareFile: async (_fileId, type, role, emailAddress, domain) => ({ id: "permission-1", type, role, emailAddress, domain })
  };
}

async function connectedClient() {
  const server = createServer(services());
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("server exposes the complete MVP tool set", async () => {
  const { client, server } = await connectedClient();
  const result = await client.listTools();
  assert.deepEqual(result.tools.map((tool) => tool.name).sort(), [
    "classroom_create_assignment_draft", "classroom_list_courses", "classroom_publish_assignment",
    "classroom_list_coursework", "classroom_list_students", "classroom_list_student_submissions",
    "docs_create_document", "docs_read_document", "drive_create_folder", "drive_get_file_metadata", "drive_prepare_share", "drive_search_files", "drive_share_file",
    "education_create_assessment_tracker", "education_create_classroom_submission_tracker",
    "forms_create_quiz", "forms_read_form", "forms_list_responses", "sheets_create_workbook", "sheets_inspect_workbook", "sheets_list_sheets", "sheets_read_values",
    "slides_create_presentation", "slides_read_presentation", "workspace_get_auth_status"
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

test("unsafe public writer sharing is rejected as an MCP error", async () => {
  const { client, server } = await connectedClient();
  const result = await client.callTool({ name: "drive_prepare_share", arguments: { fileId: "file-1", type: "anyone", role: "writer" } });
  assert.equal(result.isError, true);
  assert.equal((result.structuredContent as { error: string }).error, "INVALID_SHARE_TARGET");
  await client.close(); await server.close();
});

test("invalid sheet titles are rejected before calling Google", async () => {
  const { client, server } = await connectedClient();
  const result = await client.callTool({ name: "sheets_create_workbook", arguments: { title: "평가", sheets: [{ title: "잘못된/시트", rows: [] }] } });
  assert.equal(result.isError, true);
  await client.close(); await server.close();
});

test("multiple-choice answers must be one of the choices", async () => {
  const { client, server } = await connectedClient();
  const result = await client.callTool({ name: "forms_create_quiz", arguments: { title: "형성평가", questions: [{ title: "정답은?", type: "MULTIPLE_CHOICE", choices: ["가", "나"], correctAnswer: "다" }] } });
  assert.equal(result.isError, true);
  await client.close(); await server.close();
});

test("sheets_list_sheets returns the tabs of a spreadsheet", async () => {
  const { client, server } = await connectedClient();
  const result = await client.callTool({
    name: "sheets_list_sheets",
    arguments: { spreadsheet: "https://docs.google.com/spreadsheets/d/1AbC_defGHIjklMNOpqrstUVwxyz012345/edit" }
  });
  assert.notEqual(result.isError, true);
  const value = result.structuredContent as { sheets: Array<{ title: string }> };
  assert.equal(value.sheets[0].title, "AI 피드백");
  await client.close(); await server.close();
});

test("sheets_read_values passes the requested range through", async () => {
  const { client, server } = await connectedClient();
  const result = await client.callTool({
    name: "sheets_read_values",
    arguments: { spreadsheet: "1AbC_defGHIjklMNOpqrstUVwxyz012345", range: "'AI 피드백'!A1:J40", maxRows: 40 }
  });
  assert.notEqual(result.isError, true);
  const value = result.structuredContent as { range: string; rows: string[][] };
  assert.equal(value.range, "'AI 피드백'!A1:J40");
  assert.deepEqual(value.rows[0], ["이름", "국어"]);
  await client.close(); await server.close();
});

test("sheets_inspect_workbook returns a privacy-safe structural report", async () => {
  const { client, server } = await connectedClient();
  const result = await client.callTool({ name: "sheets_inspect_workbook", arguments: { spreadsheet: "sheet-1234567890" } });
  assert.notEqual(result.isError, true);
  const value = result.structuredContent as { title: string; privacy: string };
  assert.equal(value.title, "학급 기록");
  assert.match(value.privacy, /cell values/i);
  await client.close(); await server.close();
});

test("education assessment tracker returns counts without echoing student names", async () => {
  const { client, server } = await connectedClient();
  const result = await client.callTool({
    name: "education_create_assessment_tracker",
    arguments: {
      title: "과정중심평가", className: "5학년 3반", schoolYear: 2026, semester: "2학기",
      students: [{ number: 1, name: "학생01" }]
    }
  });
  assert.notEqual(result.isError, true);
  const serialized = JSON.stringify(result.structuredContent);
  assert.equal(serialized.includes("학생01"), false);
  assert.equal((result.structuredContent as { spreadsheet: { studentCount: number } }).spreadsheet.studentCount, 1);
  await client.close(); await server.close();
});

test("education Classroom submission tracker combines roster and submission data without echoing names", async () => {
  const { client, server } = await connectedClient();
  const result = await client.callTool({
    name: "education_create_classroom_submission_tracker",
    arguments: { courseId: "course-1", courseWorkId: "work-1", assignmentTitle: "형성평가" }
  });
  assert.notEqual(result.isError, true);
  const serialized = JSON.stringify(result.structuredContent);
  assert.equal(serialized.includes("김학생"), false);
  assert.equal((result.structuredContent as { spreadsheet: { submittedCount: number } }).spreadsheet.submittedCount, 1);
  await client.close(); await server.close();
});

test("all content reading tools are marked read-only", async () => {
  const { client, server } = await connectedClient();
  const result = await client.listTools();
  for (const name of [
    "classroom_list_courses", "classroom_list_coursework", "classroom_list_students", "classroom_list_student_submissions",
    "drive_search_files", "drive_get_file_metadata", "docs_read_document", "sheets_list_sheets", "sheets_read_values", "sheets_inspect_workbook",
    "slides_read_presentation", "forms_read_form", "forms_list_responses"
  ]) {
    const tool = result.tools.find((candidate) => candidate.name === name);
    assert.equal(tool?.annotations?.readOnlyHint, true, `${name} 은 읽기 전용이어야 합니다`);
    assert.equal(tool?.annotations?.destructiveHint, false, `${name} 은 파괴적이지 않아야 합니다`);
  }
  await client.close(); await server.close();
});
