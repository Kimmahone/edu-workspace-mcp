import { google, type sheets_v4 } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";
import { extractGoogleFileId } from "./references.js";
import { withGoogleRetry } from "./retry.js";

export type SheetDefinition = {
  title: string;
  rows?: Array<Array<string | number | boolean | null>>;
};

const WORKBOOK_COLORS = {
  navy: { red: 0.105, green: 0.235, blue: 0.38 },
  ink: { red: 0.12, green: 0.18, blue: 0.24 },
  line: { red: 0.84, green: 0.87, blue: 0.89 },
  paleBlue: { red: 0.94, green: 0.97, blue: 0.99 },
  white: { red: 1, green: 1, blue: 1 }
};

function estimatedTextWidth(value: string | number | boolean | null): number {
  const text = value === null ? "" : String(value);
  const units = [...text].reduce((total, character) => total + (/[^\u0000-\u00ff]/.test(character) ? 2 : 1), 0);
  return Math.max(96, Math.min(320, 28 + units * 7));
}

export function buildWorkbookFormattingRequests(
  sheets: SheetDefinition[],
  sheetIds: number[]
): sheets_v4.Schema$Request[] {
  return sheets.flatMap((sheet, sheetIndex) => {
    const sheetId = sheetIds[sheetIndex];
    if (sheetId === undefined) return [];
    const rows = sheet.rows ?? [];
    const columnCount = Math.max(1, ...rows.map((row) => row.length));
    const rowCount = Math.max(1, rows.length);
    const widths = Array.from({ length: columnCount }, (_, columnIndex) =>
      Math.max(...rows.map((row) => estimatedTextWidth(row[columnIndex] ?? null)), 96));
    const range = { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: columnCount };
    const requests: sheets_v4.Schema$Request[] = [
      {
        repeatCell: {
          range,
          cell: {
            userEnteredFormat: {
              textFormat: { foregroundColor: WORKBOOK_COLORS.ink, fontSize: 10 },
              verticalAlignment: "MIDDLE",
              wrapStrategy: "WRAP",
              borders: { bottom: { style: "SOLID", color: WORKBOOK_COLORS.line } }
            }
          },
          fields: "userEnteredFormat(textFormat,verticalAlignment,wrapStrategy,borders.bottom)"
        }
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: rowCount },
          properties: { pixelSize: 32 },
          fields: "pixelSize"
        }
      },
      ...widths.map((pixelSize, columnIndex) => ({
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS" as const, startIndex: columnIndex, endIndex: columnIndex + 1 },
          properties: { pixelSize },
          fields: "pixelSize"
        }
      }))
    ];
    if (rows.length) {
      requests.push(
        {
          repeatCell: {
            range: { ...range, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: WORKBOOK_COLORS.navy,
                textFormat: { foregroundColor: WORKBOOK_COLORS.white, bold: true, fontSize: 11 },
                horizontalAlignment: "CENTER",
                verticalAlignment: "MIDDLE",
                wrapStrategy: "WRAP"
              }
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)"
          }
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 42 },
            fields: "pixelSize"
          }
        }
      );
    }
    if (rows.length > 2) {
      requests.push({
        addBanding: {
          bandedRange: {
            range,
            rowProperties: {
              headerColor: WORKBOOK_COLORS.navy,
              firstBandColor: WORKBOOK_COLORS.white,
              secondBandColor: WORKBOOK_COLORS.paleBlue
            }
          }
        }
      });
    }
    return requests;
  });
}

export async function createWorkbook(title: string, sheets: SheetDefinition[], parentFolderId?: string) {
  const auth = await getAuthorizedClient();
  const api = google.sheets({ version: "v4", auth });
  const definitions = sheets.length ? sheets : [{ title: "Sheet1", rows: [] }];
  const response = await withGoogleRetry(() => api.spreadsheets.create({
    requestBody: {
      properties: { title, locale: "ko_KR", timeZone: "Asia/Seoul" },
      sheets: definitions.map((sheet) => ({
        properties: {
          title: sheet.title,
          gridProperties: { frozenRowCount: sheet.rows?.length ? 1 : 0 }
        }
      }))
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
  const formattingRequests = buildWorkbookFormattingRequests(
    definitions,
    (response.data.sheets ?? []).map((sheet) => sheet.properties?.sheetId ?? 0)
  );
  if (formattingRequests.length) {
    await withGoogleRetry(() => api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formattingRequests }
    }), { idempotent: false });
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
