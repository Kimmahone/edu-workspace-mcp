import { google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";

export type SheetDefinition = {
  title: string;
  rows?: Array<Array<string | number | boolean | null>>;
};

export async function createWorkbook(title: string, sheets: SheetDefinition[], parentFolderId?: string) {
  const auth = await getAuthorizedClient();
  const api = google.sheets({ version: "v4", auth });
  const definitions = sheets.length ? sheets : [{ title: "Sheet1", rows: [] }];
  const response = await api.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: definitions.map((sheet) => ({ properties: { title: sheet.title } }))
    }
  });
  const spreadsheetId = response.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google Sheets 문서 ID를 받지 못했습니다.");

  const data = definitions
    .filter((sheet) => sheet.rows?.length)
    .map((sheet) => ({ range: `'${sheet.title.replace(/'/g, "''")}'!A1`, values: sheet.rows }));
  if (data.length) {
    await api.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data }
    });
  }
  await moveFile(spreadsheetId, parentFolderId);
  return {
    spreadsheetId,
    title,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  };
}
