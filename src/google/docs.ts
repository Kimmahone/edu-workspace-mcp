import { docs_v1, google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";
import { extractGoogleFileId } from "./references.js";
import { withGoogleRetry } from "./retry.js";

export type DocumentBlock = {
  heading?: string;
  text: string;
};

export async function createDocument(title: string, blocks: DocumentBlock[], parentFolderId?: string) {
  const auth = await getAuthorizedClient();
  const docs = google.docs({ version: "v1", auth });
  const document = await withGoogleRetry(() => docs.documents.create({ requestBody: { title } }), { idempotent: false });
  const documentId = document.data.documentId;

  if (!documentId) {
    throw new Error("Google Docs 문서 ID를 받지 못했습니다.");
  }

  const text = blocks
    .map((block) => `${block.heading ? `${block.heading}\n` : ""}${block.text}\n\n`)
    .join("");

  if (text) {
    await withGoogleRetry(() => docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{ insertText: { location: { index: 1 }, text } }]
      }
    }), { idempotent: false });
  }

  await moveFile(documentId, parentFolderId);

  return {
    documentId,
    title,
    url: `https://docs.google.com/document/d/${documentId}/edit`
  };
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
