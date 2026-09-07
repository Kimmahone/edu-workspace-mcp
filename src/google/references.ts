export type GoogleFileKind = "document" | "spreadsheet" | "presentation" | "form" | "file";

const PATHS: Record<Exclude<GoogleFileKind, "file">, RegExp> = {
  document: /\/document\/d\/([a-zA-Z0-9_-]+)/,
  spreadsheet: /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
  presentation: /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
  form: /\/forms\/d\/(?!e\/)([a-zA-Z0-9_-]+)/
};

const LABELS: Record<GoogleFileKind, string> = {
  document: "Google Docs 문서",
  spreadsheet: "Google Sheets 문서",
  presentation: "Google Slides 문서",
  form: "Google Forms 문서",
  file: "Google Drive 파일"
};

export function extractGoogleFileId(input: string, kind: GoogleFileKind): string {
  const value = input.trim();
  if (kind !== "file") {
    const match = PATHS[kind].exec(value);
    if (match) return match[1];
  }
  const driveMatch = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(value);
  if (driveMatch) return driveMatch[1];
  const queryId = /[?&]id=([a-zA-Z0-9_-]+)/.exec(value);
  if (queryId) return queryId[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(value)) return value;
  throw new Error(`${LABELS[kind]} ID 또는 URL 형식이 아닙니다.`);
}
