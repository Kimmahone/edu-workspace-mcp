import { docs_v1, google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";
import { extractGoogleFileId } from "./references.js";
import { withGoogleRetry } from "./retry.js";

export type DocumentBlock = {
  heading?: string;
  text: string;
};

type TextRange = { startIndex: number; endIndex: number };

export function buildDocumentContent(title: string, blocks: DocumentBlock[]) {
  let text = `${title}\n\n`;
  let cursor = 1 + text.length;
  const headingRanges: TextRange[] = [];
  for (const block of blocks) {
    if (block.heading) {
      const headingText = `${block.heading}\n`;
      headingRanges.push({ startIndex: cursor, endIndex: cursor + block.heading.length });
      text += headingText;
      cursor += headingText.length;
    }
    const bodyText = `${block.text}\n\n`;
    text += bodyText;
    cursor += bodyText.length;
  }
  return {
    text,
    titleRange: { startIndex: 1, endIndex: 1 + title.length },
    headingRanges
  };
}

export async function createDocument(title: string, blocks: DocumentBlock[], parentFolderId?: string) {
  const auth = await getAuthorizedClient();
  const docs = google.docs({ version: "v1", auth });
  const document = await withGoogleRetry(() => docs.documents.create({ requestBody: { title } }), { idempotent: false });
  const documentId = document.data.documentId;

  if (!documentId) {
    throw new Error("Google Docs 문서 ID를 받지 못했습니다.");
  }

  const content = buildDocumentContent(title, blocks);

  if (content.text) {
    await withGoogleRetry(() => docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          { insertText: { location: { index: 1 }, text: content.text } },
          {
            updateDocumentStyle: {
              documentStyle: {
                marginTop: { magnitude: 54, unit: "PT" },
                marginBottom: { magnitude: 54, unit: "PT" },
                marginLeft: { magnitude: 58, unit: "PT" },
                marginRight: { magnitude: 58, unit: "PT" },
                background: { color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } } }
              },
              fields: "marginTop,marginBottom,marginLeft,marginRight,background"
            }
          },
          {
            updateTextStyle: {
              range: { startIndex: 1, endIndex: 1 + content.text.length },
              textStyle: {
                weightedFontFamily: { fontFamily: "Arial" },
                fontSize: { magnitude: 11, unit: "PT" },
                foregroundColor: { color: { rgbColor: { red: 0.12, green: 0.18, blue: 0.24 } } }
              },
              fields: "weightedFontFamily,fontSize,foregroundColor"
            }
          },
          {
            updateParagraphStyle: {
              range: { startIndex: 1, endIndex: 1 + content.text.length },
              paragraphStyle: {
                lineSpacing: 135,
                spaceBelow: { magnitude: 8, unit: "PT" }
              },
              fields: "lineSpacing,spaceBelow"
            }
          },
          {
            updateParagraphStyle: {
              range: content.titleRange,
              paragraphStyle: {
                namedStyleType: "TITLE",
                spaceBelow: { magnitude: 18, unit: "PT" },
                keepWithNext: true
              },
              fields: "namedStyleType,spaceBelow,keepWithNext"
            }
          },
          {
            updateTextStyle: {
              range: content.titleRange,
              textStyle: {
                bold: true,
                fontSize: { magnitude: 24, unit: "PT" },
                foregroundColor: { color: { rgbColor: { red: 0.105, green: 0.235, blue: 0.38 } } }
              },
              fields: "bold,fontSize,foregroundColor"
            }
          },
          ...content.headingRanges.flatMap((range) => [
            {
              updateParagraphStyle: {
                range,
                paragraphStyle: {
                  namedStyleType: "HEADING_1",
                  spaceAbove: { magnitude: 18, unit: "PT" },
                  spaceBelow: { magnitude: 8, unit: "PT" },
                  keepWithNext: true
                },
                fields: "namedStyleType,spaceAbove,spaceBelow,keepWithNext"
              }
            },
            {
              updateTextStyle: {
                range,
                textStyle: {
                  bold: true,
                  fontSize: { magnitude: 15, unit: "PT" },
                  foregroundColor: { color: { rgbColor: { red: 0.09, green: 0.42, blue: 0.32 } } }
                },
                fields: "bold,fontSize,foregroundColor"
              }
            }
          ])
        ]
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
