import { google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";

export type SlideDefinition = { title: string; body?: string };

export async function createPresentation(title: string, slides: SlideDefinition[], parentFolderId?: string) {
  const auth = await getAuthorizedClient();
  const api = google.slides({ version: "v1", auth });
  const created = await api.presentations.create({ requestBody: { title } });
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
  if (requests.length) await api.presentations.batchUpdate({ presentationId, requestBody: { requests } });
  await moveFile(presentationId, parentFolderId);
  return { presentationId, title, url: `https://docs.google.com/presentation/d/${presentationId}/edit` };
}
