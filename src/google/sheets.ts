import { google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";
import { extractGoogleFileId } from "./references.js";
import { withGoogleRetry } from "./retry.js";

export type SheetDefinition = {
  title: string;
  rows?: Array<Array<string | number | boolean | null>>;
};

export async function createWorkbook(title: string, sheets: SheetDefinition[], parentFolderId?: string) {
  const auth = await getAuthorizedClient();
  const api = google.sheets({ version: "v4", auth });
  const definitions = sheets.length ? sheets : [{ title: "Sheet1", rows: [] }];
  const response = await withGoogleRetry(() => api.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: definitions.map((sheet) => ({ properties: { title: sheet.title } }))
    }
  }), { idempotent: false });
  const spreadsheetId = response.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google Sheets 문서 ID를 받지 못했습니다.");

  const data = definitions
    .filter((sheet) => sheet.rows?.length)
    .map((sheet) => ({ range: `'${sheet.title.replace(/'/g, "''")}'!A1`, values: sheet.rows }));
  if (data.length) {
    await withGoogleRetry(() => api.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data }
    }));
  }
  await moveFile(spreadsheetId, parentFolderId);
  return {
    spreadsheetId,
    title,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  };
}

// 선생님은 보통 주소창의 URL 을 그대로 붙여 넣는다. ID 만 뽑아 쓴다.
export function extractSpreadsheetId(input: string): string {
  return extractGoogleFileId(input, "spreadsheet");
}

export type SheetSummary = {
  title: string;
  sheetId: number;
  index: number;
  rowCount: number;
  columnCount: number;
  hidden: boolean;
};

// 어떤 탭이 있는지 먼저 확인하고 필요한 범위만 읽도록 돕는다.
export async function listSheets(spreadsheetIdOrUrl: string) {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  const auth = await getAuthorizedClient();
  const api = google.sheets({ version: "v4", auth });
  const response = await withGoogleRetry(() => api.spreadsheets.get({
    spreadsheetId,
    fields: "properties(title),sheets(properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount)))"
  }));

  const sheets: SheetSummary[] = (response.data.sheets ?? []).map((sheet) => {
    const properties = sheet.properties ?? {};
    const grid = properties.gridProperties ?? {};
    return {
      title: properties.title ?? "",
      sheetId: properties.sheetId ?? 0,
      index: properties.index ?? 0,
      rowCount: grid.rowCount ?? 0,
      columnCount: grid.columnCount ?? 0,
      hidden: Boolean(properties.hidden)
    };
  });

  return {
    spreadsheetId,
    title: response.data.properties?.title ?? "",
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheets
  };
}

export type ReadValuesOptions = {
  range?: string;
  maxRows?: number;
  raw?: boolean;
};

// 값 읽기. 큰 시트를 통째로 가져와 대화가 넘치지 않도록 행 수를 제한한다.
export async function readValues(spreadsheetIdOrUrl: string, options: ReadValuesOptions = {}) {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  const maxRows = Math.max(1, Math.min(options.maxRows ?? 200, 2_000));
  const auth = await getAuthorizedClient();
  const api = google.sheets({ version: "v4", auth });

  // 범위를 안 주면 첫 시트를 읽는다.
  let range = options.range?.trim();
  if (!range) {
    const meta = await withGoogleRetry(() => api.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(title,index))"
    }));
    const first = (meta.data.sheets ?? [])
      .slice()
      .sort((a, b) => (a.properties?.index ?? 0) - (b.properties?.index ?? 0))[0];
    const title = first?.properties?.title;
    if (!title) throw new Error("읽을 시트를 찾지 못했습니다.");
    range = `'${title.replace(/'/g, "''")}'`;
  }

  const response = await withGoogleRetry(() => api.spreadsheets.values.get({
    spreadsheetId,
    range,
    // 기본은 화면에 보이는 값. IMPORTRANGE·수식 결과도 그대로 읽힌다.
    valueRenderOption: options.raw ? "UNFORMATTED_VALUE" : "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING"
  }));

  const all = (response.data.values ?? []) as Array<Array<string | number | boolean>>;
  const rows = all.slice(0, maxRows);

  return {
    spreadsheetId,
    range: response.data.range ?? range,
    totalRows: all.length,
    returnedRows: rows.length,
    truncated: all.length > rows.length,
    rows
  };
}
