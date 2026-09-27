import { Readable } from "node:stream";
import { google } from "googleapis";
import { markdownToHwpx, parse, VERSION as KORDOC_VERSION } from "kordoc";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { renderDocumentHtml } from "./document-html.js";
import { createDocumentFromHtml } from "./docs.js";
import { extractGoogleFileId } from "./references.js";
import { withGoogleRetry } from "./retry.js";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const DOC_MIME = "application/vnd.google-apps.document";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const HWPX_MIME = "application/vnd.hancom.hwpx";

function bytes(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  throw new Error("Google Drive에서 바이너리 파일을 받지 못했습니다.");
}

function checkSize(size: number): void {
  if (size > MAX_SOURCE_BYTES) throw new Error("문서 크기가 20MB를 넘습니다. 더 작은 파일을 사용해 주세요.");
}

function documentTitle(name: string, replacement?: string): string {
  const title = replacement?.trim() || name.replace(/\.(hwp|hwpx|docx)$/i, "").trim();
  if (!title) throw new Error("문서 제목이 비어 있습니다.");
  return title;
}

/** Drive HWP/HWPX → kordoc → Google Docs. */
export async function importKoreanDocument(file: string, title?: string, parentFolderId?: string) {
  const fileId = extractGoogleFileId(file, "file");
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const metadata = await withGoogleRetry(() => drive.files.get({ fileId, fields: "id,name,mimeType,size,capabilities(canDownload)" }));
  const source = metadata.data;
  if (!source.name || !/\.hwp(x)?$/i.test(source.name) || source.mimeType === DOC_MIME) {
    throw new Error("Drive의 HWP 또는 HWPX 파일만 선택해 주세요.");
  }
  if (source.capabilities?.canDownload === false) throw new Error("이 파일은 다운로드 권한이 없습니다.");
  checkSize(Number(source.size ?? 0));
  const downloaded = await withGoogleRetry(() => drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" }));
  const input = bytes(downloaded.data);
  checkSize(input.length);
  const parsed = await parse(input);
  if (!parsed.success) throw new Error("kordoc 변환 실패: " + parsed.error);
  if (!["hwp", "hwp3", "hwpx"].includes(parsed.fileType)) throw new Error("파일 내용이 HWP/HWPX 형식이 아닙니다.");
  if (!parsed.markdown.trim()) throw new Error("문서에서 변환할 텍스트를 찾지 못했습니다.");
  const name = documentTitle(source.name, title);
  const html = renderDocumentHtml(name, [{ text: parsed.markdown }]);
  const document = await createDocumentFromHtml(name, html, parentFolderId);
  return {
    document, source: { id: fileId, name: source.name },
    kordocVersion: KORDOC_VERSION,
    warnings: (parsed.warnings ?? []).map((warning) => warning.message),
    note: "Google Docs 변환 과정에서 한글 고유 서식과 이미지의 배치가 달라질 수 있습니다. 표와 본문을 확인해 주세요."
  };
}

/** Google Docs → DOCX → kordoc → HWPX in Drive. */
export async function exportGoogleDocumentToHwpx(document: string, name?: string, parentFolderId?: string) {
  const fileId = extractGoogleFileId(document, "document");
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const metadata = await withGoogleRetry(() => drive.files.get({ fileId, fields: "id,name,mimeType,capabilities(canDownload)" }));
  if (metadata.data.mimeType !== DOC_MIME) throw new Error("Google Docs 문서만 HWPX로 내보낼 수 있습니다.");
  if (metadata.data.capabilities?.canDownload === false) throw new Error("이 문서는 다운로드 권한이 없습니다.");
  const exported = await withGoogleRetry(() => drive.files.export({ fileId, mimeType: DOCX_MIME }, { responseType: "arraybuffer" }));
  const docx = bytes(exported.data);
  checkSize(docx.length);
  const parsed = await parse(docx);
  if (!parsed.success) throw new Error("kordoc 변환 실패: " + parsed.error);
  if (!parsed.markdown.trim()) throw new Error("Google 문서에서 변환할 텍스트를 찾지 못했습니다.");
  const output = Buffer.from(await markdownToHwpx(parsed.markdown));
  const outputName = documentTitle(metadata.data.name ?? "문서", name).replace(/\.hwpx$/i, "") + ".hwpx";
  const created = await withGoogleRetry(() => drive.files.create({
    requestBody: { name: outputName, parents: parentFolderId ? [parentFolderId] : undefined },
    media: { mimeType: HWPX_MIME, body: Readable.from([output]) },
    fields: "id,name,webViewLink,size"
  }), { idempotent: false });
  if (!created.data.id) throw new Error("HWPX 파일은 만들어졌지만 Drive 파일 ID를 받지 못했습니다.");
  return {
    file: { id: created.data.id, name: created.data.name, url: created.data.webViewLink ?? "https://drive.google.com/file/d/" + created.data.id + "/view", size: output.length },
    source: { id: fileId, name: metadata.data.name },
    kordocVersion: KORDOC_VERSION,
    warnings: (parsed.warnings ?? []).map((warning) => warning.message),
    note: "HWPX에는 문서의 텍스트·표를 재구성했습니다. Google Docs 고유 요소와 페이지 배치는 확인해 주세요."
  };
}
