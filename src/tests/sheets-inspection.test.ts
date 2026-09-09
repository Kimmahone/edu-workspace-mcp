import assert from "node:assert/strict";
import test from "node:test";
import { analyzeWorkbookStructure } from "../google/sheets-inspection.js";

test("privacy-safe workbook inspection reports structure and broken formulas without cell values", () => {
  const metadata = {
    spreadsheetId: "sheet-1",
    properties: { title: "교사용 다이어리", locale: "ko_KR", timeZone: "Asia/Seoul" },
    namedRanges: [{ name: "Subjects" }],
    sheets: [
      {
        properties: { sheetId: 1, title: "DB", index: 0, gridProperties: { rowCount: 100, columnCount: 5 } },
        conditionalFormats: [{}], protectedRanges: [{}]
      },
      {
        properties: { sheetId: 2, title: "대시보드", index: 1, gridProperties: { rowCount: 20, columnCount: 5 } },
        charts: [{ chartId: 1 }], merges: [{}]
      }
    ]
  };
  const gridData = {
    sheets: [
      {
        properties: { sheetId: 1, title: "DB" },
        data: [{ rowData: [{}, { values: [{ dataValidation: { condition: { type: "ONE_OF_LIST" } } }] }] }]
      },
      {
        properties: { sheetId: 2, title: "대시보드" },
        data: [{ rowData: [
          {},
          { values: [{}, { userEnteredValue: { formulaValue: '=IFERROR(FILTER(DB!A:A,DB!A:A<>"민감한 값"),"")' } }] },
          { values: [{}, { userEnteredValue: { formulaValue: '=IFERROR(VLOOKUP(#REF!,DB!A:B,2,FALSE),"")' } }] }
        ] }]
      }
    ]
  };

  const result = analyzeWorkbookStructure(metadata, gridData, [
    { title: "DB", sheetId: 1, rowCount: 100, columnCount: 5, range: "'DB'!A1:E100" },
    { title: "대시보드", sheetId: 2, rowCount: 20, columnCount: 5, range: "'대시보드'!A1:E20" }
  ], { maxErrorLocations: 20, skippedSheets: [], clippedSheets: [] });

  assert.equal(result.formulaCount, 2);
  assert.equal(result.formulaErrorCount, 1);
  assert.deepEqual(result.dependencies, [{ from: "대시보드", to: "DB", count: 2 }]);
  assert.equal(result.sheets[0].validationCount, 1);
  assert.equal(result.sheets[1].chartCount, 1);
  assert.deepEqual(result.sheets[1].formulaErrorLocations, [{ cell: "B3", error: "#REF!" }]);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("민감한 값"), false);
  assert.equal(serialized.includes("VLOOKUP"), true, "함수 이름 통계는 유지해야 합니다");
  assert.equal(serialized.includes("=IFERROR"), false, "수식 본문은 반환하지 않아야 합니다");
});
