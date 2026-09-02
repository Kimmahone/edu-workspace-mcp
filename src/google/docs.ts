import { google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";

export type DocumentBlock = {
  heading?: string;
  text: string;
};

export async function createDocument(title: string, blocks: DocumentBlock[], parentFolderId?: string) {
  const auth = await getAuthorizedClient();
  const docs = google.docs({ version: "v1", auth });
  const document = await docs.documents.create({ requestBody: { title } });
  const documentId = document.data.documentId;

  if (!documentId) {
    throw new Error("Google Docs 문서 ID를 받지 못했습니다.");
  }

  const text = blocks
    .map((block) => `${block.heading ? `${block.heading}\n` : ""}${block.text}\n\n`)
    .join("");

  if (text) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{ insertText: { location: { index: 1 }, text } }]
      }
    });
  }

  await moveFile(documentId, parentFolderId);

  return {
    documentId,
    title,
    url: `https://docs.google.com/document/d/${documentId}/edit`
  };
}
