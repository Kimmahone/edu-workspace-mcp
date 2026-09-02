import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createApproval, consumeApproval } from "./approvals/service.js";
import { getAuthStatus } from "./auth/google-auth.js";
import { createAssignmentDraft, listCourses, publishAssignment } from "./google/classroom.js";
import { createDocument } from "./google/docs.js";
import { createFolder, searchFiles, shareFile } from "./google/drive.js";
import { createQuiz } from "./google/forms.js";
import { createWorkbook } from "./google/sheets.js";
import { createPresentation } from "./google/slides.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const createAction = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
const externalChange = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };

function jsonResult(value: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], structuredContent: value };
}

function errorResult(code: string, error: unknown) {
  return jsonResult({ error: code, message: error instanceof Error ? error.message : String(error) });
}

export type WorkspaceServices = {
  getAuthStatus: typeof getAuthStatus;
  listCourses: typeof listCourses;
  searchFiles: typeof searchFiles;
  createFolder: typeof createFolder;
  createDocument: typeof createDocument;
  createWorkbook: typeof createWorkbook;
  createPresentation: typeof createPresentation;
  createQuiz: typeof createQuiz;
  createAssignmentDraft: typeof createAssignmentDraft;
  publishAssignment: typeof publishAssignment;
  shareFile: typeof shareFile;
};

const defaultServices: WorkspaceServices = {
  getAuthStatus, listCourses, searchFiles, createFolder, createDocument, createWorkbook,
  createPresentation, createQuiz, createAssignmentDraft, publishAssignment, shareFile
};

export function createServer(overrides: Partial<WorkspaceServices> = {}) {
  const services = { ...defaultServices, ...overrides };
  const server = new McpServer(
    { name: "edu-workspace-mcp", version: "0.1.0" },
    { instructions: "Google Workspace for Education MCP입니다. 검색·조회 도구로 대상을 먼저 확인하세요. 생성 도구는 요청한 콘텐츠만 만듭니다. Classroom 게시와 Drive 공유는 대상·마감·첨부·권한을 사용자에게 보여 주고 명시적으로 확인받은 경우에만 확정 도구를 호출하세요." }
  );

  async function requireAuth() {
    const status = await services.getAuthStatus();
    return status.authenticated ? undefined : jsonResult({ error: "AUTH_REQUIRED", message: status.message });
  }

  server.registerTool("workspace_get_auth_status", {
    title: "Google 연결 상태 확인", description: "Google Workspace 연결 상태와 허용 범위를 확인합니다.", annotations: readOnly
  }, async () => jsonResult(await services.getAuthStatus() as unknown as Record<string, unknown>));

  server.registerTool("classroom_list_courses", {
    title: "Classroom 수업 조회", description: "로그인한 교사가 접근할 수 있는 활성 Google Classroom 수업을 조회합니다.",
    inputSchema: { query: z.string().max(200).optional() }, annotations: readOnly
  }, async ({ query }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ courses: await services.listCourses(query) }); }
    catch (error) { return errorResult("CLASSROOM_LIST_FAILED", error); }
  });

  server.registerTool("drive_search_files", {
    title: "Drive 파일 검색", description: "Google Drive에서 이름, MIME 유형, 상위 폴더로 파일을 검색합니다.",
    inputSchema: { query: z.string().max(200).optional(), mimeType: z.string().max(200).optional(), parentId: z.string().max(200).optional() }, annotations: readOnly
  }, async ({ query, mimeType, parentId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ files: await services.searchFiles(query, mimeType, parentId) }); }
    catch (error) { return errorResult("DRIVE_SEARCH_FAILED", error); }
  });

  server.registerTool("drive_create_folder", {
    title: "Drive 폴더 생성", description: "Google Drive에 새 폴더를 만듭니다.",
    inputSchema: { name: z.string().trim().min(1).max(200), parentId: z.string().max(200).optional() }, annotations: createAction
  }, async ({ name, parentId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ folder: await services.createFolder(name, parentId) }); }
    catch (error) { return errorResult("FOLDER_CREATE_FAILED", error); }
  });

  const blockSchema = z.object({ heading: z.string().trim().min(1).max(200).optional(), text: z.string().max(20_000) });
  server.registerTool("docs_create_document", {
    title: "Google Docs 문서 생성", description: "제목과 본문 블록으로 Google Docs 문서를 생성합니다.",
    inputSchema: { title: z.string().trim().min(1).max(200), blocks: z.array(blockSchema).max(100).default([]), parentFolderId: z.string().max(200).optional() }, annotations: createAction
  }, async ({ title, blocks, parentFolderId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ document: await services.createDocument(title, blocks, parentFolderId) }); }
    catch (error) { return errorResult("DOCUMENT_CREATE_FAILED", error); }
  });

  const cellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
  server.registerTool("sheets_create_workbook", {
    title: "Google Sheets 생성", description: "여러 시트와 초기 행 데이터를 포함한 Google Sheets 파일을 생성합니다. 문자열 수식도 지원합니다.",
    inputSchema: {
      title: z.string().trim().min(1).max(200),
      sheets: z.array(z.object({ title: z.string().trim().min(1).max(100), rows: z.array(z.array(cellSchema).max(100)).max(10_000).optional() })).min(1).max(50),
      parentFolderId: z.string().max(200).optional()
    }, annotations: createAction
  }, async ({ title, sheets, parentFolderId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ spreadsheet: await services.createWorkbook(title, sheets, parentFolderId) }); }
    catch (error) { return errorResult("SPREADSHEET_CREATE_FAILED", error); }
  });

  server.registerTool("slides_create_presentation", {
    title: "Google Slides 생성", description: "제목과 본문으로 구성된 Google Slides 프레젠테이션을 생성합니다.",
    inputSchema: { title: z.string().trim().min(1).max(200), slides: z.array(z.object({ title: z.string().max(500), body: z.string().max(20_000).optional() })).min(1).max(100), parentFolderId: z.string().max(200).optional() }, annotations: createAction
  }, async ({ title, slides, parentFolderId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ presentation: await services.createPresentation(title, slides, parentFolderId) }); }
    catch (error) { return errorResult("PRESENTATION_CREATE_FAILED", error); }
  });

  const quizQuestionSchema = z.object({
    title: z.string().trim().min(1).max(2_000), type: z.enum(["MULTIPLE_CHOICE", "SHORT_ANSWER", "PARAGRAPH"]),
    choices: z.array(z.string().min(1).max(1_000)).min(2).max(20).optional(), correctAnswer: z.string().max(1_000).optional(),
    points: z.number().int().min(0).max(100).optional(), required: z.boolean().optional()
  }).refine((value) => value.type !== "MULTIPLE_CHOICE" || Boolean(value.choices?.length), { message: "객관식 문항에는 choices가 필요합니다." });
  server.registerTool("forms_create_quiz", {
    title: "Google Forms 퀴즈 생성", description: "객관식·단답형·서술형 문항과 정답·배점이 포함된 Google Forms 퀴즈를 생성합니다.",
    inputSchema: { title: z.string().trim().min(1).max(200), description: z.string().max(5_000).optional(), questions: z.array(quizQuestionSchema).min(1).max(200), parentFolderId: z.string().max(200).optional() }, annotations: createAction
  }, async ({ title, description, questions, parentFolderId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ form: await services.createQuiz(title, description, questions, parentFolderId) }); }
    catch (error) { return errorResult("QUIZ_CREATE_FAILED", error); }
  });

  server.registerTool("classroom_create_assignment_draft", {
    title: "Classroom 과제 초안 생성", description: "Classroom에 DRAFT 과제를 생성하고 게시 승인 ID를 반환합니다. 학생에게 아직 보이지 않습니다.",
    inputSchema: {
      courseId: z.string().min(1).max(200), title: z.string().trim().min(1).max(300), description: z.string().max(30_000).optional(),
      dueAt: z.string().datetime({ offset: true }).optional(), maxPoints: z.number().min(0).max(10_000).optional(),
      materials: z.array(z.object({ title: z.string().max(500), url: z.string().url() })).max(20).optional()
    }, annotations: createAction
  }, async (input) => {
    const authError = await requireAuth(); if (authError) return authError;
    try {
      const assignment = await services.createAssignmentDraft(input);
      const approval = createApproval("classroom.publish", assignment as Record<string, unknown>);
      return jsonResult({ assignment, approval, message: "게시 전 수업·제목·마감·첨부 자료를 사용자에게 확인하세요." });
    } catch (error) { return errorResult("ASSIGNMENT_DRAFT_FAILED", error); }
  });

  server.registerTool("classroom_publish_assignment", {
    title: "Classroom 과제 게시", description: "승인된 과제 초안을 학생에게 게시합니다. 바로 전에 사용자 확인을 받아야 합니다.",
    inputSchema: { courseId: z.string().min(1).max(200), courseWorkId: z.string().min(1).max(200), approvalId: z.string().uuid(), confirmation: z.literal("PUBLISH") }, annotations: externalChange
  }, async ({ courseId, courseWorkId, approvalId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try {
      const approval = consumeApproval(approvalId, "classroom.publish");
      if (approval.summary.courseId !== courseId || approval.summary.courseWorkId !== courseWorkId) throw new Error("승인된 과제와 게시 대상이 일치하지 않습니다.");
      return jsonResult({ assignment: await services.publishAssignment(courseId, courseWorkId) });
    } catch (error) { return errorResult("ASSIGNMENT_PUBLISH_FAILED", error); }
  });

  server.registerTool("drive_prepare_share", {
    title: "Drive 공유 승인 준비", description: "공유 내용을 정리하고 15분간 유효한 승인 ID를 만듭니다. 아직 권한은 바뀌지 않습니다.",
    inputSchema: { fileId: z.string().min(1).max(200), type: z.enum(["user", "group", "domain", "anyone"]), role: z.enum(["reader", "commenter", "writer"]), emailAddress: z.string().email().optional(), domain: z.string().max(253).optional() }, annotations: createAction
  }, async (input) => {
    const authError = await requireAuth(); if (authError) return authError;
    if ((input.type === "user" || input.type === "group") && !input.emailAddress) return errorResult("INVALID_SHARE_TARGET", "user 또는 group 공유에는 emailAddress가 필요합니다.");
    if (input.type === "domain" && !input.domain) return errorResult("INVALID_SHARE_TARGET", "domain 공유에는 domain이 필요합니다.");
    return jsonResult({ approval: createApproval("drive.share", input), message: "공유 대상과 권한을 사용자에게 확인하세요." });
  });

  server.registerTool("drive_share_file", {
    title: "Drive 파일 공유", description: "승인된 대상에게 Drive 파일 권한을 부여합니다. 바로 전에 사용자 확인을 받아야 합니다.",
    inputSchema: { approvalId: z.string().uuid(), confirmation: z.literal("SHARE") }, annotations: externalChange
  }, async ({ approvalId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try {
      const approval = consumeApproval(approvalId, "drive.share");
      const input = approval.summary as { fileId: string; type: "user" | "group" | "domain" | "anyone"; role: "reader" | "commenter" | "writer"; emailAddress?: string; domain?: string };
      return jsonResult({ permission: await services.shareFile(input.fileId, input.type, input.role, input.emailAddress, input.domain) });
    } catch (error) { return errorResult("DRIVE_SHARE_FAILED", error); }
  });

  return server;
}
