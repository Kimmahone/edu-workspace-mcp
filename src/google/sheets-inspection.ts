import { google, type sheets_v4 } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { extractSpreadsheetId } from "./sheets.js";
import { withGoogleRetry } from "./retry.js";

export type WorkbookInspectionOptions = {
  sheetNames?: string[];
  includeHidden?: boolean;
  maxCells?: number;
  maxRowsPerSheet?: number;
  maxErrorLocations?: number;
};

type InspectionRange = {
  title: string;
  sheetId: number;
  rowCount: number;
  columnCount: number;
  range: string;
};

type FormulaCell = {
  sheetTitle: string;
  row: number;
  column: number;
  formula: string;
  evaluatedError?: string;
};

function quoteSheetTitle(title: string): string {
  return `'${title.replaceAll("'", "''")}'`;
}

export function columnName(column: number): string {
  let value = column;
  let output = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function formulaFunctions(formula: string): string[] {
  return [...formula.matchAll(/\b([A-Za-z][A-Za-z0-9_.]*)\s*\(/g)]
    .map((match) => match[1].toUpperCase());
}

function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function referencedSheets(formula: string, titles: string[]): string[] {
  return titles.filter((title) => {
    const quoted = `${quoteSheetTitle(title)}!`;
    const bare = `${title}!`;
    return formula.includes(quoted) || formula.includes(bare);
  });
}

function buildInspectionRanges(
  metadata: sheets_v4.Schema$Spreadsheet,
  options: Required<Pick<WorkbookInspectionOptions, "includeHidden" | "maxCells" | "maxRowsPerSheet">> & Pick<WorkbookInspectionOptions, "sheetNames">
): { ranges: InspectionRange[]; skippedSheets: string[]; clippedSheets: string[] } {
  const requested = options.sheetNames?.length ? new Set(options.sheetNames) : undefined;
  const known = new Set((metadata.sheets ?? []).map((sheet) => sheet.properties?.title ?? ""));
  const unknown = [...(requested ?? [])].filter((title) => !known.has(title));
  if (unknown.length) throw new Error(`존재하지 않는 시트입니다: ${unknown.join(", ")}`);

  let remainingCells = options.maxCells;
  const ranges: InspectionRange[] = [];
  const skippedSheets: string[] = [];
  const clippedSheets: string[] = [];

  for (const sheet of metadata.sheets ?? []) {
    const properties = sheet.properties;
    const title = properties?.title ?? "";
    if (!title || (requested && !requested.has(title)) || (!options.includeHidden && properties?.hidden)) continue;

    const rowCount = properties?.gridProperties?.rowCount ?? 0;
    const columnCount = Math.min(properties?.gridProperties?.columnCount ?? 0, 200);
    if (!rowCount || !columnCount || remainingCells < columnCount) {
      skippedSheets.push(title);
      continue;
    }

    const inspectedRows = Math.min(rowCount, options.maxRowsPerSheet, Math.floor(remainingCells / columnCount));
    if (inspectedRows < rowCount) clippedSheets.push(title);
    remainingCells -= inspectedRows * columnCount;
    ranges.push({
      title,
      sheetId: properties?.sheetId ?? 0,
      rowCount: inspectedRows,
      columnCount,
      range: `${quoteSheetTitle(title)}!A1:${columnName(columnCount)}${inspectedRows}`
    });
  }

  return { ranges, skippedSheets, clippedSheets };
}

export function analyzeWorkbookStructure(
  metadata: sheets_v4.Schema$Spreadsheet,
  gridData: sheets_v4.Schema$Spreadsheet,
  inspectionRanges: InspectionRange[],
  options: { maxErrorLocations: number; skippedSheets: string[]; clippedSheets: string[] }
) {
  const sheetTitles = (metadata.sheets ?? []).map((sheet) => sheet.properties?.title ?? "").filter(Boolean);
  const formulaCells: FormulaCell[] = [];
  const perSheetValidationCounts = new Map<number, Map<string, number>>();

  for (const sheet of gridData.sheets ?? []) {
    const sheetId = sheet.properties?.sheetId ?? 0;
    const sheetTitle = sheet.properties?.title ?? "";
    const validationCounts = new Map<string, number>();
    perSheetValidationCounts.set(sheetId, validationCounts);

    for (const grid of sheet.data ?? []) {
      const startRow = grid.startRow ?? 0;
      const startColumn = grid.startColumn ?? 0;
      for (let rowOffset = 0; rowOffset < (grid.rowData ?? []).length; rowOffset += 1) {
        const row = grid.rowData?.[rowOffset];
        for (let columnOffset = 0; columnOffset < (row?.values ?? []).length; columnOffset += 1) {
          const cell = row?.values?.[columnOffset];
          if (cell?.dataValidation) increment(validationCounts, cell.dataValidation.condition?.type ?? "UNKNOWN");
          const formula = cell?.userEnteredValue?.formulaValue;
          if (!formula) continue;
          formulaCells.push({
            sheetTitle,
            row: startRow + rowOffset + 1,
            column: startColumn + columnOffset + 1,
            formula,
            evaluatedError: cell.effectiveValue?.errorValue?.type ?? undefined
          });
        }
      }
    }
  }

  const globalFunctions = new Map<string, number>();
  const dependencyCounts = new Map<string, number>();
  const sheets = (metadata.sheets ?? []).map((metadataSheet) => {
    const properties = metadataSheet.properties ?? {};
    const sheetId = properties.sheetId ?? 0;
    const title = properties.title ?? "";
    const formulas = formulaCells.filter((cell) => cell.sheetTitle === title);
    const functions = new Map<string, number>();
    const references = new Map<string, number>();
    const errors = new Map<string, number>();
    const errorLocations: Array<{ cell: string; error: string }> = [];

    for (const cell of formulas) {
      for (const name of formulaFunctions(cell.formula)) {
        increment(functions, name);
        increment(globalFunctions, name);
      }
      for (const target of referencedSheets(cell.formula, sheetTitles)) {
        increment(references, target);
        increment(dependencyCounts, `${title} -> ${target}`);
      }

      const embeddedError = ["#REF!", "#VALUE!", "#NAME?", "#N/A", "#DIV/0!"]
        .find((value) => cell.formula.toUpperCase().includes(value));
      const error = cell.evaluatedError ?? embeddedError;
      if (error) {
        increment(errors, error);
        if (errorLocations.length < options.maxErrorLocations) {
          errorLocations.push({ cell: `${columnName(cell.column)}${cell.row}`, error });
        }
      }
    }

    const validations = perSheetValidationCounts.get(sheetId) ?? new Map<string, number>();
    return {
      title,
      sheetId,
      index: properties.index ?? 0,
      hidden: Boolean(properties.hidden),
      rowCount: properties.gridProperties?.rowCount ?? 0,
      columnCount: properties.gridProperties?.columnCount ?? 0,
      frozenRowCount: properties.gridProperties?.frozenRowCount ?? 0,
      frozenColumnCount: properties.gridProperties?.frozenColumnCount ?? 0,
      formulaCount: formulas.length,
      formulaErrorCount: [...errors.values()].reduce((sum, count) => sum + count, 0),
      formulaErrors: [...errors.entries()].map(([error, count]) => ({ error, count })),
      formulaErrorLocations: errorLocations,
      validationCount: [...validations.values()].reduce((sum, count) => sum + count, 0),
      validationTypes: [...validations.entries()].map(([type, count]) => ({ type, count })),
      conditionalFormatRuleCount: metadataSheet.conditionalFormats?.length ?? 0,
      chartCount: metadataSheet.charts?.length ?? 0,
      mergeCount: metadataSheet.merges?.length ?? 0,
      protectedRangeCount: metadataSheet.protectedRanges?.length ?? 0,
      topFormulaFunctions: [...functions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count })),
      referencedSheets: [...references.entries()].sort((a, b) => b[1] - a[1]).map(([sheet, count]) => ({ sheet, count }))
    };
  });

  const inspectedNames = new Set(inspectionRanges.map((range) => range.title));
  return {
    spreadsheetId: metadata.spreadsheetId ?? "",
    title: metadata.properties?.title ?? "",
    locale: metadata.properties?.locale ?? "",
    timeZone: metadata.properties?.timeZone ?? "",
    sheetCount: sheets.length,
    inspectedSheetCount: inspectedNames.size,
    hiddenSheetCount: sheets.filter((sheet) => sheet.hidden).length,
    formulaCount: formulaCells.length,
    formulaErrorCount: sheets.reduce((sum, sheet) => sum + sheet.formulaErrorCount, 0),
    validationCount: sheets.reduce((sum, sheet) => sum + sheet.validationCount, 0),
    conditionalFormatRuleCount: sheets.reduce((sum, sheet) => sum + sheet.conditionalFormatRuleCount, 0),
    chartCount: sheets.reduce((sum, sheet) => sum + sheet.chartCount, 0),
    protectedRangeCount: sheets.reduce((sum, sheet) => sum + sheet.protectedRangeCount, 0),
    namedRangeCount: metadata.namedRanges?.length ?? 0,
    topFormulaFunctions: [...globalFunctions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([name, count]) => ({ name, count })),
    dependencies: [...dependencyCounts.entries()].sort((a, b) => b[1] - a[1]).map(([edge, count]) => {
      const [from, to] = edge.split(" -> ");
      return { from, to, count };
    }),
    truncated: options.skippedSheets.length > 0 || options.clippedSheets.length > 0,
    skippedSheets: options.skippedSheets,
    clippedSheets: options.clippedSheets,
    inspectedRanges: inspectionRanges.map((range) => range.range),
    privacy: "셀 값, 학생 이름, 이메일, 점수, 수식 본문과 수식 안의 문자열은 반환하지 않았습니다.",
    sheets
  };
}

export async function inspectWorkbook(spreadsheetIdOrUrl: string, options: WorkbookInspectionOptions = {}) {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  const auth = await getAuthorizedClient();
  const api = google.sheets({ version: "v4", auth });
  const metadataResponse = await withGoogleRetry(() => api.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: [
      "spreadsheetId",
      "properties(title,locale,timeZone)",
      "namedRanges(name,range)",
      "sheets(properties(sheetId,title,index,hidden,gridProperties))",
      "sheets(conditionalFormats,charts(chartId),merges,protectedRanges(range,warningOnly,description))"
    ].join(",")
  }));

  const settings = {
    includeHidden: options.includeHidden ?? true,
    maxCells: Math.max(1_000, Math.min(options.maxCells ?? 1_000_000, 2_000_000)),
    maxRowsPerSheet: Math.max(1, Math.min(options.maxRowsPerSheet ?? 2_000, 10_000)),
    sheetNames: options.sheetNames
  };
  const { ranges, skippedSheets, clippedSheets } = buildInspectionRanges(metadataResponse.data, settings);
  const gridResponse = ranges.length
    ? await withGoogleRetry(() => api.spreadsheets.get({
      spreadsheetId,
      includeGridData: true,
      ranges: ranges.map((range) => range.range),
      fields: [
        "spreadsheetId",
        "sheets(properties(sheetId,title))",
        "sheets(data(startRow,startColumn,rowData(values(userEnteredValue/formulaValue,effectiveValue/errorValue/type,dataValidation/condition/type))))"
      ].join(",")
    }))
    : { data: { sheets: [] } as sheets_v4.Schema$Spreadsheet };

  return analyzeWorkbookStructure(metadataResponse.data, gridResponse.data, ranges, {
    maxErrorLocations: Math.max(1, Math.min(options.maxErrorLocations ?? 20, 200)),
    skippedSheets,
    clippedSheets
  });
}
