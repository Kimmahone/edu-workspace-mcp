import assert from "node:assert/strict";
import test from "node:test";
import { buildAssessmentTrackerPlan, buildSubmissionTrackerPlan } from "../google/education-sheets.js";

test("assessment tracker plan contains connected education tabs and native sheet features", () => {
  const plan = buildAssessmentTrackerPlan({
    title: "5학년 평가 관리",
    className: "5학년 3반",
    schoolYear: 2026,
    semester: "2학기",
    students: [{ number: 2, name: "학생02" }, { number: 1, name: "=학생01" }],
    subjects: ["국어", "수학"],
    assessmentScale: ["매우잘함", "잘함", "보통", "노력요함"]
  });

  assert.deepEqual(plan.sheets.map((sheet) => sheet.title), [
    "안내", "학생명단", "평가계획", "평가기록", "학생별현황", "제출현황", "관찰기록", "대시보드", "설정"
  ]);
  const roster = plan.sheets.find((sheet) => sheet.title === "학생명단");
  assert.equal(roster?.rows[1][1], "=학생01", "사용자 문자열은 수식 객체로 바뀌지 않아야 합니다");
  const records = plan.sheets.find((sheet) => sheet.title === "평가기록");
  assert.deepEqual(records?.rows[1][2], { formula: "=ARRAYFORMULA(IF(B2:B=\"\",\"\",IFNA(VLOOKUP(B2:B,'학생명단'!A:B,2,FALSE),\"\")))" });
  assert.ok(plan.requests.some((request) => request.addChart));
  assert.ok(plan.requests.some((request) => request.setDataValidation?.rule?.condition?.type === "BOOLEAN"));
  assert.ok(plan.requests.some((request) => request.addConditionalFormatRule));
  assert.ok(plan.requests.some((request) => request.addProtectedRange?.protectedRange?.warningOnly));
  assert.ok(plan.requests.some((request) => request.mergeCells?.range?.sheetId === 2108));
  assert.ok(plan.requests.some((request) => request.updateDimensionProperties?.range?.dimension === "ROWS"
    && request.updateDimensionProperties.properties?.pixelSize === 32));
  assert.ok((records?.columnWidths?.[8] ?? 0) >= 300, "관찰기록 열은 긴 문장을 읽기 좋게 넓어야 합니다");
  assert.ok(plan.sheets.every((sheet) => (sheet.frozenColumns ?? 0) < sheet.columnCount));
});

test("Classroom submission plan matches students without persisting Classroom identifiers", () => {
  const plan = buildSubmissionTrackerPlan({
    title: "과제 제출 현황",
    assignmentTitle: "분수 형성평가",
    courseId: "course-1",
    courseWorkId: "work-1",
    students: [
      { number: 1, name: "학생01", userId: "user-1" },
      { number: 2, name: "학생02", userId: "user-2" }
    ],
    submissions: [{ userId: "user-1", state: "TURNED_IN", late: true, assignedGrade: 9 }]
  });
  const sheet = plan.sheets.find((candidate) => candidate.title === "제출현황");
  assert.equal(sheet?.rows[1][2], "제출완료");
  assert.equal(sheet?.rows[2][2], "미제출");
  assert.equal(sheet?.rows[1][3], true);
  assert.equal(JSON.stringify(plan).includes("user-1"), false, "Classroom 사용자 ID는 결과 시트에 저장하지 않아야 합니다");
  assert.ok(plan.requests.some((request) => request.addChart?.chart?.spec?.pieChart));
  assert.ok((sheet?.columnWidths?.[7] ?? 0) >= 240, "제출물 링크 열은 읽기 좋은 너비여야 합니다");
  assert.ok(plan.sheets.every((candidate) => (candidate.frozenColumns ?? 0) < candidate.columnCount));
});

test("assessment plan is prefilled with standards and adds their subjects to the dropdowns", () => {
  const plan = buildAssessmentTrackerPlan({
    title: "2학기 평가",
    className: "5학년 3반",
    schoolYear: 2026,
    semester: "2학기",
    students: [],
    subjects: ["국어", "사회"],
    assessmentScale: ["잘함", "보통", "노력요함"],
    plannedStandards: [
      { code: "[6사04-01]", subject: "사회", domain: "역사", text: "선사 시대와 고조선의 유적과 유물을 활용하여 당시 사람들의 생활을 추론한다.", summary: "요지" },
      { code: "[6실03-04]", subject: "실과", domain: "기술 시스템", text: null, summary: "수송 수단의 요지" }
    ]
  });
  const plans = plan.sheets.find((sheet) => sheet.title === "평가계획");
  assert.deepEqual(plans?.rows[1].slice(0, 4), ["P01", "사회", "역사", "[6사04-01] 선사 시대와 고조선의 유적과 유물을 활용하여 당시 사람들의 생활을 추론한다."]);
  assert.equal(plans?.rows[1][8], null);
  assert.match(String(plans?.rows[2][3]), /^\[6실03-04\] \(원문 확인 필요\) 수송 수단의 요지$/);
  assert.match(String(plans?.rows[2][8]), /NCIC/);
  const settings = plan.sheets.find((sheet) => sheet.title === "설정");
  assert.deepEqual(settings?.rows.slice(1, 4).map((row) => row[0]), ["국어", "사회", "실과"], "실과가 교과 드롭다운에 더해져야 합니다");
});
