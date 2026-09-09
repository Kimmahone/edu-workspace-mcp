import { google } from "googleapis";
import { getAuthorizedClient } from "../dist/auth/google-auth.js";
import { listCourses } from "../dist/google/classroom.js";
import { createDocument, readDocument } from "../dist/google/docs.js";
import { createFolder, getFileMetadata } from "../dist/google/drive.js";
import { createQuiz, listFormResponses, readForm } from "../dist/google/forms.js";
import { createAssessmentTracker, createSubmissionTracker } from "../dist/google/education-sheets.js";
import { createWorkbook, listSheets, readValues } from "../dist/google/sheets.js";
import { inspectWorkbook } from "../dist/google/sheets-inspection.js";
import { createPresentation, readPresentation } from "../dist/google/slides.js";

const marker = `Edu Workspace MCP 1.0 E2E ${new Date().toISOString()}`;
const createdIds = [];

try {
  const folder = await createFolder(marker);
  if (!folder.id) throw new Error("E2E 폴더 ID가 없습니다.");
  createdIds.push(folder.id);

  const document = await createDocument(`${marker} Docs`, [{ heading: "검증", text: "정식판 E2E 테스트 자료입니다." }], folder.id);
  createdIds.push(document.documentId);

  const workbook = await createWorkbook(`${marker} Sheets`, [{ title: "검증", rows: [["항목", "상태"], ["MCP", "정상"]] }], folder.id);
  createdIds.push(workbook.spreadsheetId);

  const assessmentTracker = await createAssessmentTracker({
    title: `${marker} 평가 시스템`,
    className: "테스트 1반",
    schoolYear: 2026,
    semester: "2학기",
    students: [{ number: 1, name: "가상학생01" }, { number: 2, name: "가상학생02" }],
    subjects: ["국어", "수학"],
    assessmentScale: ["매우잘함", "잘함", "보통", "노력요함"],
    parentFolderId: folder.id
  });
  createdIds.push(assessmentTracker.spreadsheetId);

  const submissionTracker = await createSubmissionTracker({
    title: `${marker} 제출 대시보드`,
    courseId: "synthetic-course",
    courseWorkId: "synthetic-coursework",
    assignmentTitle: "가상 형성평가",
    students: [
      { number: 1, name: "가상학생01", userId: "synthetic-user-1" },
      { number: 2, name: "가상학생02", userId: "synthetic-user-2" }
    ],
    submissions: [{ userId: "synthetic-user-1", state: "TURNED_IN", late: false, assignedGrade: 10 }],
    parentFolderId: folder.id
  });
  createdIds.push(submissionTracker.spreadsheetId);

  const presentation = await createPresentation(`${marker} Slides`, [{ title: "정식판 검증", body: "테스트 후 휴지통으로 이동합니다." }], folder.id);
  createdIds.push(presentation.presentationId);

  const quiz = await createQuiz(`${marker} Forms`, "정식판 E2E 테스트", [{ title: "정상 동작합니까?", type: "MULTIPLE_CHOICE", choices: ["예", "아니요"], correctAnswer: "예", points: 1 }], folder.id);
  createdIds.push(quiz.formId);

  const [folderMetadata, documentRead, sheetTabs, sheetValues, assessmentInspection, submissionInspection, slidesRead, formRead, formResponses] = await Promise.all([
    getFileMetadata(folder.id),
    readDocument(document.documentId),
    listSheets(workbook.spreadsheetId),
    readValues(workbook.spreadsheetId, { range: "'검증'!A1:B2" }),
    inspectWorkbook(assessmentTracker.spreadsheetId),
    inspectWorkbook(submissionTracker.spreadsheetId),
    readPresentation(presentation.presentationId),
    readForm(quiz.formId),
    listFormResponses(quiz.formId)
  ]);
  if (folderMetadata.name !== marker) throw new Error("Drive 메타데이터 읽기 결과가 일치하지 않습니다.");
  if (!documentRead.tabs.some((tab) => tab.text.includes("정식판 E2E"))) throw new Error("Docs 본문을 읽지 못했습니다.");
  if (sheetTabs.sheets[0]?.title !== "검증" || sheetValues.rows[1]?.[1] !== "정상") throw new Error("Sheets 내용을 읽지 못했습니다.");
  if (assessmentInspection.sheetCount !== 9 || assessmentInspection.chartCount !== 1 || assessmentInspection.validationCount < 1 || assessmentInspection.formulaErrorCount !== 0) {
    throw new Error("과정중심평가 템플릿 구조 검증에 실패했습니다.");
  }
  if (submissionInspection.sheetCount !== 5 || submissionInspection.chartCount !== 1 || submissionInspection.validationCount < 1 || submissionInspection.formulaErrorCount !== 0) {
    throw new Error("Classroom 제출 템플릿 구조 검증에 실패했습니다.");
  }
  if (!slidesRead.slides[0]?.text.includes("정식판 검증")) throw new Error("Slides 내용을 읽지 못했습니다.");
  if (formRead.items[0]?.title !== "정상 동작합니까?") throw new Error("Forms 문항을 읽지 못했습니다.");
  if (formResponses.returnedResponses !== 0) throw new Error("새 Forms 응답 수가 예상과 다릅니다.");

  const courses = await listCourses();
  console.log(JSON.stringify({ drive: "create+read", docs: "create+read", sheets: "create+read+inspect", assessmentTracker: "create+inspect", submissionTracker: "create+inspect", slides: "create+read", forms: "create+read+responses", classroom: "list", activeCourseCount: courses.length }, null, 2));
} finally {
  if (createdIds.length) {
    const auth = await getAuthorizedClient();
    const drive = google.drive({ version: "v3", auth });
    for (const fileId of createdIds.reverse()) {
      try {
        await drive.files.update({ fileId, requestBody: { trashed: true } });
      } catch (error) {
        console.error(`테스트 파일 정리에 실패했습니다: ${fileId}`, error instanceof Error ? error.message : error);
      }
    }
  }
}
