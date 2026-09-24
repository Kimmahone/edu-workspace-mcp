import { Readable } from "node:stream";
import { docs_v1, google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import {
  lessonPlanTitle, renderDocumentHtml, renderLessonPlanHtml, renderWorksheetHtml,
  type DocumentBlock, type DocumentOptions, type LessonPlanInput, type WorksheetInput
} from "./document-html.js";
import { extractGoogleFileId } from "./references.js";
import { withGoogleRetry } from "./retry.js";

export type { DocumentBlock, DocumentOptions, LessonPlanInput, WorksheetInput, WorksheetSection } from "./document-html.js";

// 문서는 HTML로 양식을 그린 뒤 Drive가 Google Docs로 변환하게 만든다(표·음영·칸 합치기·목록이 살아남는다).
// 변환만으로는 안 되는 인쇄 설정은 변환된 문서를 읽어 한 번에 입힌다.
const A4_DOCUMENT_STYLE = {
  pageSize: { width: { magnitude: 595.28, unit: "PT" }, height: { magnitude: 841.89, unit: "PT" } },
  marginTop: { magnitude: 48, unit: "PT" },
  marginBottom: { magnitude: 48, unit: "PT" },
  marginLeft: { magnitude: 50, unit: "PT" },
  marginRight: { magnitude: 50, unit: "PT" }
};

const DOCUMENT_FONT = "Noto Sans KR";
// document-html.ts 의 차시 제목("■ 2차시 · …")
export const SESSION_HEADING = /^■\s*\d+차시\s·/;

// document-html.ts 의 머리행 색(#1b3c61). 이 색으로 시작하는 표를 머리행 있는 표로 본다.
const HEADER_RGB = { red: 0x1b / 255, green: 0x3c / 255, blue: 0x61 / 255 };

function isHeaderTable(table: docs_v1.Schema$Table): boolean {
  const rgb = table.tableRows?.[0]?.tableCells?.[0]?.tableCellStyle?.backgroundColor?.color?.rgbColor;
  if (!rgb || (table.rows ?? 0) < 2) return false;
  return Math.abs((rgb.red ?? 0) - HEADER_RGB.red) < 0.02
    && Math.abs((rgb.green ?? 0) - HEADER_RGB.green) < 0.02
    && Math.abs((rgb.blue ?? 0) - HEADER_RGB.blue) < 0.02;
}

function paragraphText(paragraph: docs_v1.Schema$Paragraph | undefined): string {
  return (paragraph?.elements ?? []).map((element) => {
    if (element.textRun?.content) return element.textRun.content;
    if (element.inlineObjectElement) return "[이미지]";
    if (element.person) return element.person.personProperties?.name ?? "";
    if (element.richLink) return element.richLink.richLinkProperties?.title ?? element.richLink.richLinkProperties?.uri ?? "";
    return "";
  }).join("");
}

type IndexRange = { startIndex: number; endIndex: number };

/** 표 칸 안까지 모든 굵은 글자 범위. 이어진 범위는 하나로 합친다. */
function boldRanges(content: docs_v1.Schema$StructuralElement[] = []): IndexRange[] {
  const ranges: IndexRange[] = [];
  const walk = (elements: docs_v1.Schema$StructuralElement[] = []) => {
    for (const element of elements) {
      for (const part of element.paragraph?.elements ?? []) {
        if (!part.textRun?.textStyle?.bold || part.startIndex == null || part.endIndex == null) continue;
        const last = ranges.at(-1);
        if (last && last.endIndex === part.startIndex) last.endIndex = part.endIndex;
        else ranges.push({ startIndex: part.startIndex, endIndex: part.endIndex });
      }
      for (const row of element.table?.tableRows ?? []) for (const cell of row.tableCells ?? []) walk(cell.content);
    }
  };
  walk(content);
  return ranges;
}

export type PrintLayoutOptions = {
  /** true 를 돌려주는 제목 문단은 새 쪽에서 시작한다. */
  pageBreakBefore?: (headingText: string) => boolean;
};

/**
 * 변환된 문서에 입힐 설정. HTML 변환은 글꼴을 Arial 로 바꿔 버리기도 하고 쪽 나눔 CSS 는 무시하므로 여기서 확실히 입힌다.
 * - A4 용지와 여백
 * - 본문 전체 글꼴을 한글 글꼴로. 글꼴을 바꾸면 Docs 가 굵게를 지우므로, 원래 굵던 범위에 굵게를 다시 입힌다.
 * - 제목은 다음 내용과 같은 쪽에, 지정한 제목은 새 쪽에서 시작
 * - 표의 행이 두 쪽에 걸쳐 쪼개지지 않게, 머리행 있는 표는 쪽마다 머리행 반복
 * 모두 글자 위치를 바꾸지 않는 요청이라 한 번 읽은 위치 그대로 한 번에 보낼 수 있다.
 */
export function printLayoutRequests(document: docs_v1.Schema$Document, options: PrintLayoutOptions = {}): docs_v1.Schema$Request[] {
  const content = document.body?.content ?? [];
  const requests: docs_v1.Schema$Request[] = [{
    updateDocumentStyle: { documentStyle: A4_DOCUMENT_STYLE, fields: "pageSize,marginTop,marginBottom,marginLeft,marginRight" }
  }];
  const bodyEnd = content.at(-1)?.endIndex ?? 0;
  if (bodyEnd > 2) {
    requests.push({
      updateTextStyle: {
        range: { startIndex: 1, endIndex: bodyEnd - 1 },
        textStyle: { weightedFontFamily: { fontFamily: DOCUMENT_FONT, weight: 400 } },
        fields: "weightedFontFamily"
      }
    });
    for (const range of boldRanges(content)) {
      requests.push({ updateTextStyle: { range, textStyle: { bold: true }, fields: "bold" } });
    }
  }
  for (const element of content) {
    if (element.startIndex == null) continue;
    if (element.table) {
      const tableStartLocation = { index: element.startIndex };
      requests.push({ updateTableRowStyle: { tableStartLocation, tableRowStyle: { preventOverflow: true }, fields: "preventOverflow" } });
      if (isHeaderTable(element.table)) requests.push({ pinTableHeaderRows: { tableStartLocation, pinnedHeaderRowsCount: 1 } });
      continue;
    }
    const namedStyle = element.paragraph?.paragraphStyle?.namedStyleType;
    if (element.endIndex != null && (namedStyle === "HEADING_2" || namedStyle === "HEADING_3")) {
      const pageBreak = options.pageBreakBefore?.(paragraphText(element.paragraph).trim()) ?? false;
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: element.startIndex, endIndex: element.endIndex },
          paragraphStyle: pageBreak ? { keepWithNext: true, pageBreakBefore: true } : { keepWithNext: true },
          fields: pageBreak ? "keepWithNext,pageBreakBefore" : "keepWithNext"
        }
      });
    }
  }
  return requests;
}

export type CreatedDocument = {
  documentId: string;
  title: string;
  url: string;
  pageSize: "A4" | "Letter";
  warning?: string;
};

export async function createDocumentFromHtml(title: string, html: string, parentFolderId?: string, layout: PrintLayoutOptions = {}): Promise<CreatedDocument> {
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const created = await withGoogleRetry(() => drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.document",
      parents: parentFolderId ? [parentFolderId] : undefined
    },
    // 재시도마다 새 스트림을 만든다. 한 번 읽힌 스트림을 다시 보내면 빈 문서가 된다.
    media: { mimeType: "text/html", body: Readable.from([html]) },
    fields: "id"
  }), { idempotent: false });
  const documentId = created.data.id;
  if (!documentId) throw new Error("Google Docs 문서 ID를 받지 못했습니다.");

  const result = { documentId, title, url: `https://docs.google.com/document/d/${documentId}/edit` };
  try {
    const docs = google.docs({ version: "v1", auth });
    const converted = await withGoogleRetry(() => docs.documents.get({ documentId }));
    await withGoogleRetry(() => docs.documents.batchUpdate({ documentId, requestBody: { requests: printLayoutRequests(converted.data, layout) } }));
    return { ...result, pageSize: "A4" as const };
  } catch {
    // 문서는 이미 만들어졌다. 여기서 실패로 돌려주면 다시 만들다 같은 문서가 두 개 생긴다.
    return { ...result, pageSize: "Letter" as const, warning: "문서는 만들었지만 A4 용지·글꼴·표 인쇄 설정을 입히지 못했습니다. 파일 > 페이지 설정에서 A4로 바꿔 주세요." };
  }
}

export async function createDocument(title: string, blocks: DocumentBlock[], parentFolderId?: string, options: DocumentOptions = {}): Promise<CreatedDocument> {
  return createDocumentFromHtml(title, renderDocumentHtml(title, blocks, options), parentFolderId);
}

export async function createLessonPlan(input: LessonPlanInput, parentFolderId?: string): Promise<CreatedDocument & { sessionCount: number; standardCount: number }> {
  const title = lessonPlanTitle(input);
  // 차시가 여럿이면 차시마다 새 쪽에서 시작해 한 쪽씩 인쇄해 쓸 수 있게 한다.
  const layout: PrintLayoutOptions = input.sessions.length > 1 ? { pageBreakBefore: (text) => SESSION_HEADING.test(text) } : {};
  const document = await createDocumentFromHtml(input.lesson?.trim() ? `${title} — ${input.lesson.trim()}` : title, renderLessonPlanHtml(input), parentFolderId, layout);
  return { ...document, sessionCount: input.sessions.length, standardCount: input.standards?.length ?? 0 };
}

export async function createWorksheet(input: WorksheetInput, parentFolderId?: string): Promise<CreatedDocument & { sectionCount: number }> {
  const document = await createDocumentFromHtml(input.title, renderWorksheetHtml(input), parentFolderId);
  return { ...document, sectionCount: input.sections.length };
}

export function extractDocumentText(elements: docs_v1.Schema$StructuralElement[] = []): string {
  return elements.map((element) => {
    if (element.paragraph) return paragraphText(element.paragraph);
    if (element.table) {
      return (element.table.tableRows ?? []).map((row) =>
        (row.tableCells ?? []).map((cell) => extractDocumentText(cell.content).trimEnd()).join("\t")
      ).join("\n") + "\n";
    }
    if (element.tableOfContents) return extractDocumentText(element.tableOfContents.content);
    if (element.sectionBreak) return "\n";
    return "";
  }).join("");
}

type DocumentTabSummary = {
  tabId: string;
  title: string;
  index: number;
  nestingLevel: number;
  text: string;
  totalCharacters: number;
  truncated: boolean;
};

function flattenDocumentTabs(tabs: docs_v1.Schema$Tab[] = []): docs_v1.Schema$Tab[] {
  return tabs.flatMap((tab) => [tab, ...flattenDocumentTabs(tab.childTabs)]);
}

export async function readDocument(documentIdOrUrl: string, maxCharacters = 50_000) {
  const documentId = extractGoogleFileId(documentIdOrUrl, "document");
  const limit = Math.max(1_000, Math.min(maxCharacters, 200_000));
  const auth = await getAuthorizedClient();
  const docs = google.docs({ version: "v1", auth });
  const response = await withGoogleRetry(() => docs.documents.get({ documentId, includeTabsContent: true }));
  const document = response.data;

  const sourceTabs = flattenDocumentTabs(document.tabs);
  const tabs = sourceTabs.length
    ? sourceTabs.map((tab) => ({
      tabId: tab.tabProperties?.tabId ?? "",
      title: tab.tabProperties?.title ?? "이름 없는 탭",
      index: tab.tabProperties?.index ?? 0,
      nestingLevel: tab.tabProperties?.nestingLevel ?? 0,
      fullText: extractDocumentText(tab.documentTab?.body?.content)
    }))
    : [{
      tabId: "",
      title: document.title ?? "문서",
      index: 0,
      nestingLevel: 0,
      fullText: extractDocumentText(document.body?.content)
    }];

  let remaining = limit;
  const summaries: DocumentTabSummary[] = tabs.map((tab) => {
    const text = tab.fullText.slice(0, remaining);
    remaining = Math.max(0, remaining - text.length);
    return {
      tabId: tab.tabId,
      title: tab.title,
      index: tab.index,
      nestingLevel: tab.nestingLevel,
      text,
      totalCharacters: tab.fullText.length,
      truncated: text.length < tab.fullText.length
    };
  });
  const totalCharacters = tabs.reduce((total, tab) => total + tab.fullText.length, 0);

  return {
    documentId,
    title: document.title ?? "",
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    totalCharacters,
    returnedCharacters: Math.min(totalCharacters, limit),
    truncated: totalCharacters > limit,
    tabs: summaries
  };
}
