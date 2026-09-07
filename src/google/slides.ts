import { google, slides_v1 } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";
import { extractGoogleFileId } from "./references.js";
import { withGoogleRetry } from "./retry.js";

export type SlideDefinition = { title: string; body?: string };

export async function createPresentation(title: string, slides: SlideDefinition[], parentFolderId?: string) {
  const auth = await getAuthorizedClient();
  const api = google.slides({ version: "v1", auth });
  const created = await withGoogleRetry(() => api.presentations.create({ requestBody: { title } }), { idempotent: false });
  const presentationId = created.data.presentationId;
  if (!presentationId) throw new Error("Google Slides 문서 ID를 받지 못했습니다.");

  const requests: Array<Record<string, unknown>> = [];
  slides.forEach((slide, index) => {
    const pageId = `slide_${index + 1}`;
    const titleId = `title_${index + 1}`;
    const bodyId = `body_${index + 1}`;
    requests.push(
      { createSlide: { objectId: pageId, slideLayoutReference: { predefinedLayout: "BLANK" } } },
      {
        createShape: {
          objectId: titleId,
          shapeType: "TEXT_BOX",
          elementProperties: {
            pageObjectId: pageId,
            size: { width: { magnitude: 640, unit: "PT" }, height: { magnitude: 60, unit: "PT" } },
            transform: { scaleX: 1, scaleY: 1, translateX: 40, translateY: 30, unit: "PT" }
          }
        }
      },
      { insertText: { objectId: titleId, text: slide.title } },
      {
        updateTextStyle: {
          objectId: titleId,
          style: { fontSize: { magnitude: 28, unit: "PT" }, bold: true },
          textRange: { type: "ALL" },
          fields: "fontSize,bold"
        }
      }
    );
    if (slide.body) {
      requests.push(
        {
          createShape: {
            objectId: bodyId,
            shapeType: "TEXT_BOX",
            elementProperties: {
              pageObjectId: pageId,
              size: { width: { magnitude: 640, unit: "PT" }, height: { magnitude: 360, unit: "PT" } },
              transform: { scaleX: 1, scaleY: 1, translateX: 40, translateY: 110, unit: "PT" }
            }
          }
        },
        { insertText: { objectId: bodyId, text: slide.body } },
        {
          updateTextStyle: {
            objectId: bodyId,
            style: { fontSize: { magnitude: 18, unit: "PT" } },
            textRange: { type: "ALL" },
            fields: "fontSize"
          }
        }
      );
    }
  });
  const initialSlideId = created.data.slides?.[0]?.objectId;
  if (initialSlideId && slides.length) requests.push({ deleteObject: { objectId: initialSlideId } });
  if (requests.length) await withGoogleRetry(() => api.presentations.batchUpdate({ presentationId, requestBody: { requests } }), { idempotent: false });
  await moveFile(presentationId, parentFolderId);
  return { presentationId, title, url: `https://docs.google.com/presentation/d/${presentationId}/edit` };
}

function textFromTextContent(text: slides_v1.Schema$TextContent | undefined): string {
  return (text?.textElements ?? []).map((element) => element.textRun?.content ?? "").join("");
}

export function extractPageElementText(element: slides_v1.Schema$PageElement): string {
  if (element.shape?.text) return textFromTextContent(element.shape.text);
  if (element.table) {
    return (element.table.tableRows ?? []).map((row) =>
      (row.tableCells ?? []).map((cell) => textFromTextContent(cell.text).trimEnd()).join("\t")
    ).join("\n");
  }
  if (element.elementGroup?.children) {
    return element.elementGroup.children.map(extractPageElementText).filter(Boolean).join("\n");
  }
  if (element.image) return `[이미지${element.title ? `: ${element.title}` : ""}]`;
  if (element.video) return `[동영상${element.title ? `: ${element.title}` : ""}]`;
  if (element.sheetsChart) return "[Google Sheets 차트]";
  return "";
}

function pageText(page: slides_v1.Schema$Page | undefined): string {
  return (page?.pageElements ?? []).map(extractPageElementText).filter(Boolean).join("\n").trim();
}

export async function readPresentation(presentationIdOrUrl: string, options: { maxSlides?: number; maxCharactersPerSlide?: number } = {}) {
  const presentationId = extractGoogleFileId(presentationIdOrUrl, "presentation");
  const maxSlides = Math.max(1, Math.min(options.maxSlides ?? 50, 200));
  const maxCharactersPerSlide = Math.max(500, Math.min(options.maxCharactersPerSlide ?? 20_000, 50_000));
  const auth = await getAuthorizedClient();
  const api = google.slides({ version: "v1", auth });
  const response = await withGoogleRetry(() => api.presentations.get({ presentationId }));
  const allSlides = response.data.slides ?? [];
  const slides = allSlides.slice(0, maxSlides).map((slide, index) => {
    const fullText = pageText(slide);
    const notesPage = slide.slideProperties?.notesPage;
    const speakerNotesId = notesPage?.notesProperties?.speakerNotesObjectId;
    const fullNotes = speakerNotesId
      ? pageText({ ...notesPage, pageElements: notesPage.pageElements?.filter((element) => element.objectId === speakerNotesId) })
      : "";
    return {
      index: index + 1,
      objectId: slide.objectId ?? "",
      text: fullText.slice(0, maxCharactersPerSlide),
      notes: fullNotes.slice(0, maxCharactersPerSlide),
      elementCount: slide.pageElements?.length ?? 0,
      truncated: fullText.length > maxCharactersPerSlide || fullNotes.length > maxCharactersPerSlide
    };
  });

  return {
    presentationId,
    title: response.data.title ?? "",
    url: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    totalSlides: allSlides.length,
    returnedSlides: slides.length,
    truncated: allSlides.length > slides.length || slides.some((slide) => slide.truncated),
    slides
  };
}
