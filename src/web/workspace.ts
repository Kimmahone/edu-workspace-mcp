import { google } from "googleapis";
import { createDocumentFromHtml } from "../google/docs.js";
import { extractGoogleFileId } from "../google/references.js";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { type Draft } from "./drafts.js";
import { designedDocument, type DesignId } from "./design.js";
import {createDesignedSlides,createDesignedSheet,createDesignedQuiz} from "./native-design.js";
import { MAX_FILE, documentJob } from "./documents.js";
import { resolveStandardCodes, standardsDescription } from "../curriculum/standards.js";

export const outputKinds = ["document", "worksheet", "slides", "quiz", "sheet"] as const;
export type OutputKind = typeof outputKinds[number];
export async function saveOutput(kind: OutputKind, draft: Draft, template: string, standardCodes: string[] = [], design: DesignId = "navy", formsTemplateId?: string) {
  const standards = resolveStandardCodes(standardCodes), source = standards.length ? standardsDescription(standards) : "";
  if (kind === "slides") return createDesignedSlides({...draft,slides:[...draft.slides,...(source?[{title:"참고 성취기준",body:source}]:[])]},design);
  if (kind === "quiz") return createDesignedQuiz({...draft,summary:draft.summary+(source?"\n\n"+source:"")},formsTemplateId);
  if (kind === "sheet") return createDesignedSheet({...draft,summary:draft.summary+(source?"\n\n"+source:"")},design);
  return createDocumentFromHtml(draft.title + (kind === "worksheet" ? " 학습지" : ""),designedDocument(draft,kind==='worksheet'?'worksheet':template==='lesson-package'?'lesson-plan':template,design,source),undefined,{repeatTableHeaders:true});
}
export async function readGoogleDoc(reference: string) {
  const auth = await getAuthorizedClient(), drive = google.drive({ version: "v3", auth });
  const fileId = extractGoogleFileId(reference, "document");
  const meta = await drive.files.get({ fileId, fields: "name,mimeType,capabilities(canDownload)" });
  if (meta.data.mimeType !== "application/vnd.google-apps.document" || meta.data.capabilities?.canDownload === false) throw new Error("다운로드 가능한 Google Docs 문서를 선택해 주세요.");
  const response = await drive.files.export({ fileId, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, { responseType: "arraybuffer", maxContentLength: MAX_FILE });
  const result = await documentJob({ action: "parse", input: Buffer.from(response.data as ArrayBuffer) });
  return { ...result, title: meta.data.name };
}
