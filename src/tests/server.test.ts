import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, type WorkspaceServices } from "../server.js";
import { resetApprovalsForTests } from "../approvals/service.js";
import type { DocumentOptions, LessonPlanInput } from "../google/docs.js";

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
    createDocument: async (title) => ({ documentId: "doc-1", title, url: "https://docs.google.com/document/d/doc-1/edit", pageSize: "A4" as const }),
    createLessonPlan: async (input) => ({ documentId: "plan-1", title: "과정안", url: "https://docs.google.com/document/d/plan-1/edit", pageSize: "A4" as const, sessionCount: input.sessions.length, standardCount: input.standards?.length ?? 0 }),
    readDocument: async () => ({ documentId: "doc-1", title: "학습지", url: "https://docs.google.com/document/d/doc-1/edit", totalCharacters: 2, returnedCharacters: 2, truncated: false, tabs: [{ tabId: "tab-1", title: "탭 1", index: 0, nestingLevel: 0, text: "내용", totalCharacters: 2, truncated: false }] }),
    createWorkbook: async (title) => ({ spreadsheetId: "sheet-1", title, url: "https://docs.google.com/spreadsheets/d/sheet-1/edit" }),
    listSheets: async (spreadsheet) => ({ spreadsheetId: "sheet-1", title: "학급 기록", url: "https://docs.google.com/spreadsheets/d/sheet-1/edit", sheets: [{ title: "AI 피드백", sheetId: 0, index: 0, rowCount: 100, columnCount: 12, hidden: false }] }),
    readValues: async (spreadsheet, options) => ({ spreadsheetId: "sheet-1", range: options?.range ?? "'AI 피드백'", totalRows: 2, returnedRows: 2, truncated: false, rows: [["이름", "국어"], ["김리안", "95"]] }),
    inspectWorkbook: (async () => ({ spreadsheetId: "sheet-1", title: "학급 기록", sheetCount: 1, formulaCount: 3, formulaErrorCount: 0, privacy: "no cell values" })) as unknown as WorkspaceServices["inspectWorkbook"],
    createAssessmentTracker: (async (input: { title: string; students: unknown[]; plannedStandards?: unknown[] }) => ({ spreadsheetId: "assessment-1", title: input.title, url: "https://docs.google.com/spreadsheets/d/assessment-1/edit", template: "ASSESSMENT_TRACKER", studentCount: input.students.length, subjectCount: 5, plannedStandardCount: input.plannedStandards?.length ?? 0, sheets: [], privacy: "no names returned" })) as WorkspaceServices["createAssessmentTracker"],
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

async function connectedClient(overrides: Partial<WorkspaceServices> = {}) {
  const server = createServer({ ...services(), ...overrides });
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
    "curriculum_get_standards", "curriculum_search_standards",
    "docs_create_document", "docs_create_lesson_plan", "docs_read_document", "drive_create_folder", "drive_get_file_metadata", "drive_prepare_share", "drive_search_files", "drive_share_file",
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
    "slides_read_presentation", "forms_read_form", "forms_list_responses",
    "curriculum_search_standards", "curriculum_get_standards"
  ]) {
    const tool = result.tools.find((candidate) => candidate.name === name);
    assert.equal(tool?.annotations?.readOnlyHint, true, `${name} 은 읽기 전용이어야 합니다`);
    assert.equal(tool?.annotations?.destructiveHint, false, `${name} 은 파괴적이지 않아야 합니다`);
  }
  await client.close(); await server.close();
});

test("curriculum tools work without a Google login and are local read-only", async () => {
  const { client, server } = await connectedClient({
    getAuthStatus: async () => ({ authenticated: false, oauthClientConfigured: true, oauthClientSource: "bundled", credentialsPath: "/test/credentials.json", tokenPath: "/test/token.json", grantedScopes: [], readAccessEnabled: false, message: "로그인 필요" })
  });
  const search = await client.callTool({ name: "curriculum_search_standards", arguments: { subject: "사회", grade: 5, query: "고조선" } });
  assert.notEqual(search.isError, true);
  const found = search.structuredContent as { standards: Array<{ code: string }>; source: { upstream: { package: string } } };
  assert.ok(found.standards.some((standard) => standard.code === "[6사04-01]"));
  assert.equal(found.source.upstream.package, "korean-elementary-learning-map-mcp");

  const detail = await client.callTool({ name: "curriculum_get_standards", arguments: { codes: ["6사04-01", "[6사04-99]"] } });
  const value = detail.structuredContent as { standards: Array<{ code: string; sourceUrl: string }>; notFound: Array<{ code: string; suggestions: string[] }> };
  assert.equal(value.standards[0].code, "[6사04-01]");
  assert.match(value.standards[0].sourceUrl, /^https:\/\/ncic\.re\.kr\//);
  assert.equal(value.notFound[0].code, "[6사04-99]");

  const tools = await client.listTools();
  assert.equal(tools.tools.find((tool) => tool.name === "curriculum_search_standards")?.annotations?.openWorldHint, false);
  await client.close(); await server.close();
});

test("docs_create_document hands server-verified standards to the document form", async () => {
  let received: { blocks: Array<{ heading?: string; text: string }>; options?: DocumentOptions } | undefined;
  const { client, server } = await connectedClient({
    createDocument: async (title, blocks, _parentFolderId, options) => {
      received = { blocks, options };
      return { documentId: "doc-1", title, url: "https://docs.google.com/document/d/doc-1/edit", pageSize: "A4" as const };
    }
  });
  const result = await client.callTool({
    name: "docs_create_document",
    arguments: { title: "고조선 수업안", subtitle: "5학년 사회", blocks: [{ heading: "학습 목표", text: "유물로 생활을 추론한다." }], standardCodes: ["6사04-01", "[2건01-01]"] }
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(received?.options?.standards?.map((standard) => standard.code), ["[6사04-01]", "[2건01-01]"]);
  assert.match(received?.options?.standards?.[0].text ?? "", /^선사 시대와 고조선의 유적과 유물을 활용하여/);
  assert.equal(received?.options?.standards?.[1].text, null, "깨진 원문은 지어내지 않고 null 로 넘깁니다");
  assert.match(received?.options?.standardsNote ?? "", /NCIC/);
  assert.equal(received?.options?.subtitle, "5학년 사회");
  assert.equal(received?.blocks[0].heading, "학습 목표", "성취기준은 본문 블록이 아니라 양식으로 넘깁니다");
  const value = result.structuredContent as { standards: Array<{ code: string }>; warnings?: string[] };
  assert.deepEqual(value.standards.map((standard) => standard.code), ["[6사04-01]", "[2건01-01]"]);
  assert.match(value.warnings?.[0] ?? "", /원문/);
  await client.close(); await server.close();
});

test("unknown standard codes stop creation before any Google call", async () => {
  const calls: string[] = [];
  const { client, server } = await connectedClient({
    createDocument: async (title) => { calls.push("docs"); return { documentId: "doc-1", title, url: "https://docs.google.com/document/d/doc-1/edit", pageSize: "A4" as const }; },
    createQuiz: async (title) => { calls.push("forms"); return { formId: "form-1", title, responderUrl: "https://forms.example/respond", editUrl: "https://forms.example/edit" }; }
  });
  const document = await client.callTool({ name: "docs_create_document", arguments: { title: "수업안", blocks: [], standardCodes: ["[6사04-99]"] } });
  assert.equal(document.isError, true);
  assert.equal((document.structuredContent as { error: string }).error, "INVALID_STANDARD_CODE");
  assert.match((document.structuredContent as { message: string }).message, /\[6사04-01\]/, "비슷한 코드를 제안해야 합니다");
  const quiz = await client.callTool({ name: "forms_create_quiz", arguments: { title: "형성평가", questions: [{ title: "문항", type: "SHORT_ANSWER" }], standardCodes: ["없는코드"] } });
  assert.equal(quiz.isError, true);
  assert.deepEqual(calls, []);
  await client.close(); await server.close();
});

test("quiz and Classroom draft append standards to the description", async () => {
  let quizDescription: string | undefined;
  let draftDescription: string | undefined;
  const { client, server } = await connectedClient({
    createQuiz: async (title, description) => {
      quizDescription = description;
      return { formId: "form-1", title, responderUrl: "https://forms.example/respond", editUrl: "https://forms.example/edit" };
    },
    createAssignmentDraft: async (input) => {
      draftDescription = input.description;
      return { courseId: input.courseId, courseWorkId: "work-1", title: input.title, state: "DRAFT", alternateLink: undefined, dueDate: undefined, dueTime: undefined, materials: [] };
    }
  });
  await client.callTool({ name: "forms_create_quiz", arguments: { title: "형성평가", description: "3문항입니다.", questions: [{ title: "문항", type: "SHORT_ANSWER" }], standardCodes: ["[6사04-01]"] } });
  assert.match(quizDescription ?? "", /^3문항입니다\.\n\n관련 성취기준/);
  const draft = await client.callTool({ name: "classroom_create_assignment_draft", arguments: { courseId: "course-1", title: "학습지", standardCodes: ["[6사04-02]"] } });
  assert.notEqual(draft.isError, true);
  assert.match(draftDescription ?? "", /^관련 성취기준 \(2022 개정 교육과정\)\n\[6사04-02\]/);
  assert.ok((draft.structuredContent as { approval: { id: string } }).approval.id, "승인 흐름은 그대로여야 합니다");
  await client.close(); await server.close();
});

test("assessment tracker receives planned standards and their subjects", async () => {
  let received: { subjects: string[]; plannedStandards?: Array<{ code: string; subject: string; text: string | null }> } | undefined;
  const { client, server } = await connectedClient({
    createAssessmentTracker: (async (input: { title: string; students: unknown[]; subjects: string[]; plannedStandards?: Array<{ code: string; subject: string; text: string | null }> }) => {
      received = input;
      return { spreadsheetId: "assessment-1", title: input.title, url: "https://docs.google.com/spreadsheets/d/assessment-1/edit", template: "ASSESSMENT_TRACKER", studentCount: 0, subjectCount: 5, plannedStandardCount: input.plannedStandards?.length ?? 0, sheets: [], privacy: "no names returned" };
    }) as unknown as WorkspaceServices["createAssessmentTracker"]
  });
  const result = await client.callTool({
    name: "education_create_assessment_tracker",
    arguments: { title: "2학기 평가", className: "5학년 3반", schoolYear: 2026, semester: "2학기", standardCodes: ["[6사04-01]", "[6실03-04]"] }
  });
  assert.notEqual(result.isError, true);
  assert.deepEqual(received?.plannedStandards?.map((standard) => standard.code), ["[6사04-01]", "[6실03-04]"]);
  assert.equal(received?.plannedStandards?.[1].subject, "실과");
  assert.equal("standardCodes" in (received ?? {}), false, "Google 쪽에는 코드 대신 확인된 성취기준만 넘깁니다");
  await client.close(); await server.close();
});

test("lesson package prompt connects curriculum lookup to Workspace creation", async () => {
  const { client, server } = await connectedClient();
  const prompts = await client.listPrompts();
  assert.ok(prompts.prompts.some((prompt) => prompt.name === "lesson_package_with_standards"));
  const prompt = await client.getPrompt({ name: "lesson_package_with_standards", arguments: { grade: "5", subject: "사회", topic: "고조선 사람들의 생활", classroom: "5학년 3반 사회" } });
  const text = (prompt.messages[0].content as { text: string }).text;
  assert.match(text, /curriculum_search_standards\(subject: "사회", grade: 5/);
  assert.match(text, /standardCodes/);
  assert.match(text, /「5학년 3반 사회」 Classroom에/);
  assert.match(text, /게시는 제가 대상·마감·첨부를 확인한 뒤에만/);
  await client.close(); await server.close();
});

test("docs_create_lesson_plan builds a lesson plan with verified standards", async () => {
  let received: LessonPlanInput | undefined;
  let folder: string | undefined;
  const { client, server } = await connectedClient({
    createLessonPlan: async (input, parentFolderId) => {
      received = input;
      folder = parentFolderId;
      return { documentId: "plan-1", title: "국어과 교수·학습 과정안", url: "https://docs.google.com/document/d/plan-1/edit", pageSize: "A4" as const, sessionCount: input.sessions.length, standardCount: input.standards?.length ?? 0 };
    }
  });
  const result = await client.callTool({
    name: "docs_create_lesson_plan",
    arguments: {
      subject: "국어", grade: 5, unit: "4. 의견을 조정해요", lesson: "1. 의견을 조정하며 토의하기",
      standardCodes: ["6국01-06"], objectives: ["의견을 조정하는 방법을 설명할 수 있다."],
      sessions: [{ title: "토의 내용 읽기", steps: [
        { stage: "도입", process: "경험 떠올리기", activities: ["경험을 이야기한다."], minutes: 5 },
        { stage: "전개", process: "토의 내용 읽기", activities: ["역할을 나누어 읽는다.", "  사회자·민찬·수영·혜진"], minutes: 30, notes: ["▣ 교과서 182쪽"] }
      ] }],
      parentFolderId: "folder-1"
    }
  });
  assert.notEqual(result.isError, true);
  assert.equal(received?.standards?.[0].code, "[6국01-06]");
  assert.match(received?.standards?.[0].text ?? "", /토의에 협력적으로 참여하며/);
  assert.equal("standardCodes" in (received ?? {}), false);
  assert.equal(folder, "folder-1");
  assert.equal((result.structuredContent as { document: { sessionCount: number } }).document.sessionCount, 1);

  const invalid = await client.callTool({
    name: "docs_create_lesson_plan",
    arguments: { subject: "국어", grade: 5, unit: "4단원", standardCodes: ["[6국09-99]"], objectives: ["목표"], sessions: [{ title: "1차시", steps: [{ stage: "도입", process: "시작", activities: ["활동"] }] }] }
  });
  assert.equal((invalid.structuredContent as { error: string }).error, "INVALID_STANDARD_CODE");
  await client.close(); await server.close();
});
