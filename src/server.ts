import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createApproval, consumeApproval } from "./approvals/service.js";
import { getAuthStatus } from "./auth/google-auth.js";
import { createAssignmentDraft, listCourses, listCourseWork, listStudents, listStudentSubmissions, publishAssignment } from "./google/classroom.js";
import { createDocument, readDocument } from "./google/docs.js";
import { createFolder, getFileMetadata, searchFiles, shareFile } from "./google/drive.js";
import { createQuiz, listFormResponses, readForm } from "./google/forms.js";
import { createAssessmentTracker, createSubmissionTracker } from "./google/education-sheets.js";
import { createWorkbook, listSheets, readValues } from "./google/sheets.js";
import { inspectWorkbook } from "./google/sheets-inspection.js";
import { createPresentation, readPresentation } from "./google/slides.js";
import { APP_VERSION } from "./version.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const createAction = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
const externalChange = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };

function jsonResult(value: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], structuredContent: value };
}

function errorResult(code: string, error: unknown) {
  return { ...jsonResult({ error: code, message: error instanceof Error ? error.message : String(error) }), isError: true };
}

export type WorkspaceServices = {
  getAuthStatus: typeof getAuthStatus;
  listCourses: typeof listCourses;
  listCourseWork: typeof listCourseWork;
  listStudents: typeof listStudents;
  listStudentSubmissions: typeof listStudentSubmissions;
  searchFiles: typeof searchFiles;
  getFileMetadata: typeof getFileMetadata;
  createFolder: typeof createFolder;
  createDocument: typeof createDocument;
  readDocument: typeof readDocument;
  createWorkbook: typeof createWorkbook;
  listSheets: typeof listSheets;
  readValues: typeof readValues;
  inspectWorkbook: typeof inspectWorkbook;
  createAssessmentTracker: typeof createAssessmentTracker;
  createSubmissionTracker: typeof createSubmissionTracker;
  createPresentation: typeof createPresentation;
  readPresentation: typeof readPresentation;
  createQuiz: typeof createQuiz;
  readForm: typeof readForm;
  listFormResponses: typeof listFormResponses;
  createAssignmentDraft: typeof createAssignmentDraft;
  publishAssignment: typeof publishAssignment;
  shareFile: typeof shareFile;
};

const defaultServices: WorkspaceServices = {
  getAuthStatus, listCourses, listCourseWork, listStudents, listStudentSubmissions,
  searchFiles, getFileMetadata, createFolder, createDocument, readDocument, createWorkbook, listSheets, readValues,
  inspectWorkbook, createAssessmentTracker, createSubmissionTracker,
  createPresentation, readPresentation, createQuiz, readForm, listFormResponses,
  createAssignmentDraft, publishAssignment, shareFile
};

export function createServer(overrides: Partial<WorkspaceServices> = {}) {
  const services = { ...defaultServices, ...overrides };
  const server = new McpServer(
    { name: "edu-workspace-mcp", version: APP_VERSION },
    { instructions: "Google Workspace for Education MCP입니다. 검색·조회 도구로 대상을 먼저 확인하세요. 학생 개인정보가 포함된 자료는 필요한 최소 범위만 읽고 응답에 불필요하게 반복하지 마세요. 생성 도구는 요청한 콘텐츠만 만들며 비멱등이므로 실패 또는 시간 초과 후 자동으로 중복 호출하지 마세요. Classroom 게시와 Drive 공유는 대상·마감·첨부·권한을 사용자에게 보여 주고 명시적으로 확인받은 경우에만 확정 도구를 호출하세요." }
  );

  async function requireAuth() {
    const status = await services.getAuthStatus();
    if (!status.authenticated) return errorResult("AUTH_REQUIRED", status.message);
    if (status.missingScopes?.length) {
      return errorResult("AUTH_SCOPE_REQUIRED", `${status.message} 읽기 확장 모드라면 login --read를 실행하세요.`);
    }
    return undefined;
  }

  const googleFileRefSchema = z.string().trim().min(10).max(500)
    .describe("Google 파일 ID 또는 docs.google.com / drive.google.com 주소");

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

  server.registerTool("classroom_list_coursework", {
    title: "Classroom 과제 목록 읽기", description: "선택한 수업의 과제·자료·마감·배점·게시 상태를 최근 수정순으로 읽습니다.",
    inputSchema: {
      courseId: z.string().trim().min(1).max(200),
      states: z.array(z.enum(["PUBLISHED", "DRAFT", "DELETED"])).max(3).optional(),
      maxResults: z.number().int().min(1).max(500).optional()
    }, annotations: readOnly
  }, async ({ courseId, states, maxResults }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult(await services.listCourseWork(courseId, { states, maxResults }) as unknown as Record<string, unknown>); }
    catch (error) { return errorResult("CLASSROOM_COURSEWORK_LIST_FAILED", error); }
  });

  server.registerTool("classroom_list_students", {
    title: "Classroom 학생 명단 읽기", description: "선택한 수업의 학생 이름·사용자 ID·이메일을 읽습니다. 읽기 확장 권한이 필요합니다.",
    inputSchema: {
      courseId: z.string().trim().min(1).max(200),
      maxResults: z.number().int().min(1).max(1_000).optional()
    }, annotations: readOnly
  }, async ({ courseId, maxResults }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult(await services.listStudents(courseId, maxResults) as unknown as Record<string, unknown>); }
    catch (error) { return errorResult("CLASSROOM_STUDENTS_LIST_FAILED", error); }
  });

  server.registerTool("classroom_list_student_submissions", {
    title: "Classroom 학생 제출물 읽기", description: "과제별 제출 상태·제출 시각·점수·답변·첨부 파일을 읽습니다.",
    inputSchema: {
      courseId: z.string().trim().min(1).max(200),
      courseWorkId: z.string().trim().min(1).max(200),
      states: z.array(z.enum(["NEW", "CREATED", "TURNED_IN", "RETURNED", "RECLAIMED_BY_STUDENT"])).max(5).optional(),
      maxResults: z.number().int().min(1).max(1_000).optional()
    }, annotations: readOnly
  }, async ({ courseId, courseWorkId, states, maxResults }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult(await services.listStudentSubmissions(courseId, courseWorkId, { states, maxResults }) as unknown as Record<string, unknown>); }
    catch (error) { return errorResult("CLASSROOM_SUBMISSIONS_LIST_FAILED", error); }
  });

  server.registerTool("drive_search_files", {
    title: "Drive 파일 검색", description: "이 MCP가 만들었거나 접근 권한을 받은 Drive 파일을 이름·MIME 유형·상위 폴더로 검색합니다.",
    inputSchema: { query: z.string().max(200).optional(), mimeType: z.string().max(200).optional(), parentId: z.string().max(200).optional() }, annotations: readOnly
  }, async ({ query, mimeType, parentId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ files: await services.searchFiles(query, mimeType, parentId) }); }
    catch (error) { return errorResult("DRIVE_SEARCH_FAILED", error); }
  });

  server.registerTool("drive_get_file_metadata", {
    title: "Drive 파일 정보 읽기", description: "파일 이름·유형·위치·수정 시각·소유자·가능한 작업 등 Drive 메타데이터를 읽습니다.",
    inputSchema: { file: googleFileRefSchema }, annotations: readOnly
  }, async ({ file }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult(await services.getFileMetadata(file) as unknown as Record<string, unknown>); }
    catch (error) { return errorResult("DRIVE_FILE_READ_FAILED", error); }
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
  const blocksSchema = z.array(blockSchema).max(100).default([]).superRefine((blocks, context) => {
    const characters = blocks.reduce((total, block) => total + (block.heading?.length ?? 0) + block.text.length, 0);
    if (characters > 500_000) context.addIssue({ code: z.ZodIssueCode.custom, message: "문서 전체 텍스트는 500,000자를 넘을 수 없습니다." });
  });
  server.registerTool("docs_create_document", {
    title: "Google Docs 문서 생성", description: "제목과 본문 블록으로 Google Docs 문서를 생성하고 읽기 좋은 제목·소제목·본문 서식을 적용합니다.",
    inputSchema: { title: z.string().trim().min(1).max(200), blocks: blocksSchema, parentFolderId: z.string().max(200).optional() }, annotations: createAction
  }, async ({ title, blocks, parentFolderId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ document: await services.createDocument(title, blocks, parentFolderId) }); }
    catch (error) { return errorResult("DOCUMENT_CREATE_FAILED", error); }
  });

  server.registerTool("docs_read_document", {
    title: "Google Docs 문서 읽기", description: "문서 URL 또는 ID로 본문과 모든 문서 탭을 읽습니다. 표는 탭으로 구분한 텍스트로 보존합니다.",
    inputSchema: {
      document: googleFileRefSchema,
      maxCharacters: z.number().int().min(1_000).max(200_000).optional().describe("반환할 최대 글자 수 (기본 50,000)")
    }, annotations: readOnly
  }, async ({ document, maxCharacters }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult(await services.readDocument(document, maxCharacters) as unknown as Record<string, unknown>); }
    catch (error) { return errorResult("DOCUMENT_READ_FAILED", error); }
  });

  const cellSchema = z.union([z.string().max(50_000), z.number().finite(), z.boolean(), z.null()]);
  const sheetTitleSchema = z.string().trim().min(1).max(100).refine((title) => !/[\\/?*\[\]:]/.test(title), { message: "시트 제목에는 \\ / ? * [ ] : 문자를 사용할 수 없습니다." });
  const sheetsSchema = z.array(z.object({ title: sheetTitleSchema, rows: z.array(z.array(cellSchema).max(100)).max(5_000).optional() })).min(1).max(20).superRefine((sheets, context) => {
    const normalizedTitles = sheets.map((sheet) => sheet.title.toLocaleLowerCase("ko-KR"));
    if (new Set(normalizedTitles).size !== normalizedTitles.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "시트 제목은 중복될 수 없습니다." });
    const cells = sheets.reduce((total, sheet) => total + (sheet.rows ?? []).reduce((rowTotal, row) => rowTotal + row.length, 0), 0);
    if (cells > 200_000) context.addIssue({ code: z.ZodIssueCode.custom, message: "통합 문서는 200,000개 셀을 넘을 수 없습니다." });
  });
  server.registerTool("sheets_create_workbook", {
    title: "Google Sheets 생성", description: "여러 시트와 초기 행 데이터를 포함한 Google Sheets 파일을 생성합니다. 문자열 수식, 고정 머리글, 넉넉한 행 높이와 내용에 맞춘 열 너비를 지원합니다.",
    inputSchema: {
      title: z.string().trim().min(1).max(200),
      sheets: sheetsSchema,
      parentFolderId: z.string().max(200).optional()
    }, annotations: createAction
  }, async ({ title, sheets, parentFolderId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ spreadsheet: await services.createWorkbook(title, sheets, parentFolderId) }); }
    catch (error) { return errorResult("SPREADSHEET_CREATE_FAILED", error); }
  });

  const spreadsheetRefSchema = googleFileRefSchema
    .describe("스프레드시트 ID 또는 https://docs.google.com/spreadsheets/d/... 주소");

  server.registerTool("sheets_list_sheets", {
    title: "Google Sheets 탭 목록",
    description: "스프레드시트에 어떤 시트(탭)가 있는지, 각 시트의 행·열 크기와 숨김 여부를 확인합니다. 값을 읽기 전에 먼저 호출해 대상 범위를 정하세요.",
    inputSchema: { spreadsheet: spreadsheetRefSchema },
    annotations: readOnly
  }, async ({ spreadsheet }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult(await services.listSheets(spreadsheet) as unknown as Record<string, unknown>); }
    catch (error) { return errorResult("SPREADSHEET_LIST_FAILED", error); }
  });

  server.registerTool("sheets_read_values", {
    title: "Google Sheets 값 읽기",
    description: "스프레드시트의 값을 읽습니다. range 를 비우면 첫 시트를 읽습니다. 기본은 화면에 보이는 값이라 수식과 IMPORTRANGE 결과도 그대로 읽힙니다. 큰 시트는 maxRows 로 잘라 읽으세요.",
    inputSchema: {
      spreadsheet: spreadsheetRefSchema,
      range: z.string().trim().max(200).optional().describe("A1 표기. 예: 'AI 피드백'!A1:J40. 비우면 첫 시트 전체"),
      maxRows: z.number().int().min(1).max(2_000).optional().describe("가져올 최대 행 수 (기본 200)"),
      raw: z.boolean().optional().describe("true 면 서식 없는 원본 값으로 읽습니다")
    },
    annotations: readOnly
  }, async ({ spreadsheet, range, maxRows, raw }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult(await services.readValues(spreadsheet, { range, maxRows, raw }) as unknown as Record<string, unknown>); }
    catch (error) { return errorResult("SPREADSHEET_READ_FAILED", error); }
  });

  server.registerTool("sheets_inspect_workbook", {
    title: "Google Sheets 구조·수식 진단",
    description: "셀 값과 수식 본문을 노출하지 않고 탭 구조, 수식 함수, 시트 간 의존성, 수식 오류, 드롭다운·체크박스, 조건부 서식, 차트와 보호 범위를 진단합니다.",
    inputSchema: {
      spreadsheet: spreadsheetRefSchema,
      sheetNames: z.array(sheetTitleSchema).max(50).optional().describe("진단할 탭 이름. 생략하면 셀 제한 안에서 모든 탭을 확인합니다."),
      includeHidden: z.boolean().optional().describe("숨김 탭 포함 여부. 기본 true"),
      maxCells: z.number().int().min(1_000).max(2_000_000).optional().describe("분석할 최대 셀 수. 기본 1,000,000"),
      maxRowsPerSheet: z.number().int().min(1).max(10_000).optional().describe("탭별 최대 행 수. 기본 2,000"),
      maxErrorLocations: z.number().int().min(1).max(100).optional().describe("탭별 반환할 오류 셀 위치 수. 기본 20")
    },
    annotations: readOnly
  }, async ({ spreadsheet, sheetNames, includeHidden, maxCells, maxRowsPerSheet, maxErrorLocations }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try {
      return jsonResult(await services.inspectWorkbook(spreadsheet, {
        sheetNames, includeHidden, maxCells, maxRowsPerSheet, maxErrorLocations
      }) as unknown as Record<string, unknown>);
    } catch (error) { return errorResult("SPREADSHEET_INSPECTION_FAILED", error); }
  });

  const educationStudentSchema = z.object({
    number: z.number().int().min(1).max(10_000),
    name: z.string().trim().min(1).max(100)
  });
  const educationStudentsSchema = z.array(educationStudentSchema).max(200).default([]).superRefine((students, context) => {
    const numbers = students.map((student) => student.number);
    if (new Set(numbers).size !== numbers.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "학생 번호는 중복될 수 없습니다." });
  });

  server.registerTool("education_create_assessment_tracker", {
    title: "교육용 과정중심평가 시스템 생성",
    description: "학생명단·평가계획·평가기록·학생별현황·제출현황·관찰기록·대시보드가 연결된 교육용 Google Sheets를 만듭니다. 넉넉한 입력 칸, 용도별 열 너비, 드롭다운, 체크박스, 조건부 서식, 차트와 보호 경고를 포함합니다.",
    inputSchema: {
      title: z.string().trim().min(1).max(200),
      className: z.string().trim().min(1).max(100),
      schoolYear: z.number().int().min(2000).max(2100),
      semester: z.enum(["1학기", "2학기", "연간"]),
      students: educationStudentsSchema,
      subjects: z.array(z.string().trim().min(1).max(50)).min(1).max(20).default(["국어", "사회", "수학", "과학", "영어"]),
      assessmentScale: z.array(z.string().trim().min(1).max(50)).min(2).max(10).default(["매우잘함", "잘함", "보통", "노력요함"]),
      parentFolderId: z.string().max(200).optional()
    },
    annotations: createAction
  }, async (input) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ spreadsheet: await services.createAssessmentTracker(input) }); }
    catch (error) { return errorResult("EDUCATION_ASSESSMENT_TRACKER_CREATE_FAILED", error); }
  });

  server.registerTool("education_create_classroom_submission_tracker", {
    title: "Classroom 제출 현황 시트 생성",
    description: "Classroom 학생 명단과 특정 과제의 제출·지각·점수를 읽어 제출현황과 대시보드가 있는 개인정보 보호형 스냅샷 시트를 만듭니다. 읽기 확장 로그인(--read)이 필요합니다.",
    inputSchema: {
      courseId: z.string().trim().min(1).max(200),
      courseWorkId: z.string().trim().min(1).max(200),
      assignmentTitle: z.string().trim().min(1).max(300),
      title: z.string().trim().min(1).max(200).optional(),
      parentFolderId: z.string().max(200).optional()
    },
    annotations: createAction
  }, async ({ courseId, courseWorkId, assignmentTitle, title, parentFolderId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try {
      const [studentsResult, submissionsResult] = await Promise.all([
        services.listStudents(courseId, 1_000),
        services.listStudentSubmissions(courseId, courseWorkId, { maxResults: 1_000 })
      ]);
      if (submissionsResult.unavailableReason) throw new Error(submissionsResult.unavailableReason);
      const students = studentsResult.students.map((student, index) => ({
        number: index + 1,
        name: student.fullName,
        userId: student.userId
      }));
      const spreadsheet = await services.createSubmissionTracker({
        title: title ?? `${assignmentTitle} 제출 현황`,
        courseId,
        courseWorkId,
        assignmentTitle,
        students,
        submissions: submissionsResult.submissions,
        parentFolderId
      });
      return jsonResult({ spreadsheet });
    } catch (error) {
      const message = error instanceof Error ? `${error.message} 학생 명단 권한 오류라면 disconnect 후 login --read로 다시 연결하세요.` : error;
      return errorResult("EDUCATION_CLASSROOM_TRACKER_CREATE_FAILED", message);
    }
  });

  server.registerTool("slides_create_presentation", {
    title: "Google Slides 생성", description: "제목과 본문으로 구성된 Google Slides 프레젠테이션을 생성하고 수업용 기본 테마와 읽기 좋은 여백을 적용합니다.",
    inputSchema: { title: z.string().trim().min(1).max(200), slides: z.array(z.object({ title: z.string().max(500), body: z.string().max(20_000).optional() })).min(1).max(50).superRefine((slides, context) => {
      const characters = slides.reduce((total, slide) => total + slide.title.length + (slide.body?.length ?? 0), 0);
      if (characters > 500_000) context.addIssue({ code: z.ZodIssueCode.custom, message: "프레젠테이션 전체 텍스트는 500,000자를 넘을 수 없습니다." });
    }), parentFolderId: z.string().max(200).optional() }, annotations: createAction
  }, async ({ title, slides, parentFolderId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ presentation: await services.createPresentation(title, slides, parentFolderId) }); }
    catch (error) { return errorResult("PRESENTATION_CREATE_FAILED", error); }
  });

  server.registerTool("slides_read_presentation", {
    title: "Google Slides 읽기", description: "프레젠테이션 URL 또는 ID로 슬라이드별 텍스트·표·발표자 노트를 읽습니다.",
    inputSchema: {
      presentation: googleFileRefSchema,
      maxSlides: z.number().int().min(1).max(200).optional(),
      maxCharactersPerSlide: z.number().int().min(500).max(50_000).optional()
    }, annotations: readOnly
  }, async ({ presentation, maxSlides, maxCharactersPerSlide }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult(await services.readPresentation(presentation, { maxSlides, maxCharactersPerSlide }) as unknown as Record<string, unknown>); }
    catch (error) { return errorResult("PRESENTATION_READ_FAILED", error); }
  });

  const quizQuestionSchema = z.object({
    title: z.string().trim().min(1).max(2_000), type: z.enum(["MULTIPLE_CHOICE", "SHORT_ANSWER", "PARAGRAPH"]),
    choices: z.array(z.string().min(1).max(1_000)).min(2).max(20).optional(), correctAnswer: z.string().max(1_000).optional(),
    points: z.number().int().min(0).max(100).optional(), required: z.boolean().optional()
  })
    .refine((value) => value.type !== "MULTIPLE_CHOICE" || Boolean(value.choices?.length), { message: "객관식 문항에는 choices가 필요합니다." })
    .refine((value) => value.type !== "MULTIPLE_CHOICE" || !value.correctAnswer || value.choices?.includes(value.correctAnswer), { message: "객관식 정답은 choices 중 하나여야 합니다." });
  server.registerTool("forms_create_quiz", {
    title: "Google Forms 퀴즈 생성", description: "객관식·단답형·서술형 문항과 정답·배점이 포함된 Google Forms 퀴즈를 생성합니다.",
    inputSchema: { title: z.string().trim().min(1).max(200), description: z.string().max(5_000).optional(), questions: z.array(quizQuestionSchema).min(1).max(100), parentFolderId: z.string().max(200).optional() }, annotations: createAction
  }, async ({ title, description, questions, parentFolderId }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult({ form: await services.createQuiz(title, description, questions, parentFolderId) }); }
    catch (error) { return errorResult("QUIZ_CREATE_FAILED", error); }
  });

  server.registerTool("forms_read_form", {
    title: "Google Forms 설문 읽기", description: "설문 또는 퀴즈의 제목·설명·문항 유형·선택지·배점·정답을 읽습니다.",
    inputSchema: {
      form: googleFileRefSchema,
      maxItems: z.number().int().min(1).max(500).optional()
    }, annotations: readOnly
  }, async ({ form, maxItems }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult(await services.readForm(form, maxItems) as unknown as Record<string, unknown>); }
    catch (error) { return errorResult("FORM_READ_FAILED", error); }
  });

  server.registerTool("forms_list_responses", {
    title: "Google Forms 응답 읽기", description: "설문 응답자의 제출 시각·답변·퀴즈 점수를 읽습니다. 학생 개인정보가 포함될 수 있으므로 필요한 범위만 요청하세요.",
    inputSchema: {
      form: googleFileRefSchema,
      maxResponses: z.number().int().min(1).max(500).optional()
    }, annotations: readOnly
  }, async ({ form, maxResponses }) => {
    const authError = await requireAuth(); if (authError) return authError;
    try { return jsonResult(await services.listFormResponses(form, maxResponses) as unknown as Record<string, unknown>); }
    catch (error) { return errorResult("FORM_RESPONSES_LIST_FAILED", error); }
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
    if (input.type === "anyone" && input.role === "writer") return errorResult("INVALID_SHARE_TARGET", "인터넷 전체에 writer 권한을 부여할 수 없습니다.");
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
