import { google } from "googleapis";
import { getAuthorizedClient } from "../dist/auth/google-auth.js";
import { listCourses } from "../dist/google/classroom.js";
import { createDocument, readDocument } from "../dist/google/docs.js";
import { createFolder, getFileMetadata } from "../dist/google/drive.js";
import { createQuiz, listFormResponses, readForm } from "../dist/google/forms.js";
import { createWorkbook, listSheets, readValues } from "../dist/google/sheets.js";
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

  const presentation = await createPresentation(`${marker} Slides`, [{ title: "정식판 검증", body: "테스트 후 휴지통으로 이동합니다." }], folder.id);
  createdIds.push(presentation.presentationId);

  const quiz = await createQuiz(`${marker} Forms`, "정식판 E2E 테스트", [{ title: "정상 동작합니까?", type: "MULTIPLE_CHOICE", choices: ["예", "아니요"], correctAnswer: "예", points: 1 }], folder.id);
  createdIds.push(quiz.formId);

  const [folderMetadata, documentRead, sheetTabs, sheetValues, slidesRead, formRead, formResponses] = await Promise.all([
    getFileMetadata(folder.id),
    readDocument(document.documentId),
    listSheets(workbook.spreadsheetId),
    readValues(workbook.spreadsheetId, { range: "'검증'!A1:B2" }),
    readPresentation(presentation.presentationId),
    readForm(quiz.formId),
    listFormResponses(quiz.formId)
  ]);
  if (folderMetadata.name !== marker) throw new Error("Drive 메타데이터 읽기 결과가 일치하지 않습니다.");
  if (!documentRead.tabs.some((tab) => tab.text.includes("정식판 E2E"))) throw new Error("Docs 본문을 읽지 못했습니다.");
  if (sheetTabs.sheets[0]?.title !== "검증" || sheetValues.rows[1]?.[1] !== "정상") throw new Error("Sheets 내용을 읽지 못했습니다.");
  if (!slidesRead.slides[0]?.text.includes("정식판 검증")) throw new Error("Slides 내용을 읽지 못했습니다.");
  if (formRead.items[0]?.title !== "정상 동작합니까?") throw new Error("Forms 문항을 읽지 못했습니다.");
  if (formResponses.returnedResponses !== 0) throw new Error("새 Forms 응답 수가 예상과 다릅니다.");

  const courses = await listCourses();
  console.log(JSON.stringify({ drive: "create+read", docs: "create+read", sheets: "create+read", slides: "create+read", forms: "create+read+responses", classroom: "list", activeCourseCount: courses.length }, null, 2));
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
