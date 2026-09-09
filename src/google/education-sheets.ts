import { google, type sheets_v4 } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";
import { withGoogleRetry } from "./retry.js";

type FormulaCell = { formula: string };
type CellValue = string | number | boolean | null | FormulaCell;

type PlannedSheet = {
  sheetId: number;
  title: string;
  rows: CellValue[][];
  rowCount: number;
  columnCount: number;
  frozenRows?: number;
  frozenColumns?: number;
  hidden?: boolean;
  headerRows?: number[];
};

type WorkbookPlan = {
  title: string;
  sheets: PlannedSheet[];
  requests: sheets_v4.Schema$Request[];
};

export type EducationStudent = {
  number: number;
  name: string;
};

export type AssessmentTrackerInput = {
  title: string;
  className: string;
  schoolYear: number;
  semester: "1학기" | "2학기" | "연간";
  students: EducationStudent[];
  subjects: string[];
  assessmentScale: string[];
  parentFolderId?: string;
};

export type ClassroomStudentForSheet = EducationStudent & {
  userId: string;
};

export type ClassroomSubmissionForSheet = {
  userId: string;
  state?: string;
  late?: boolean;
  assignedGrade?: number;
  draftGrade?: number;
  updateTime?: string;
  alternateLink?: string;
};

export type SubmissionTrackerInput = {
  title: string;
  courseId: string;
  courseWorkId: string;
  assignmentTitle: string;
  students: ClassroomStudentForSheet[];
  submissions: ClassroomSubmissionForSheet[];
  parentFolderId?: string;
};

const COLORS = {
  navy: { red: 0.105, green: 0.235, blue: 0.38 },
  blue: { red: 0.18, green: 0.45, blue: 0.72 },
  paleBlue: { red: 0.86, green: 0.93, blue: 0.98 },
  paleGreen: { red: 0.84, green: 0.93, blue: 0.82 },
  paleRed: { red: 0.96, green: 0.80, blue: 0.80 },
  paleYellow: { red: 1, green: 0.95, blue: 0.80 },
  white: { red: 1, green: 1, blue: 1 }
};

function formula(value: string): FormulaCell {
  return { formula: value };
}

function formulaStringLiteral(value: string): string {
  return value.replaceAll('"', '""');
}

function extendedValue(value: CellValue): sheets_v4.Schema$ExtendedValue | undefined {
  if (value === null) return undefined;
  if (typeof value === "object") return { formulaValue: value.formula };
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "number") return { numberValue: value };
  return { stringValue: value };
}

function gridData(rows: CellValue[][]): sheets_v4.Schema$GridData[] {
  return [{
    startRow: 0,
    startColumn: 0,
    rowData: rows.map((row) => ({ values: row.map((value) => ({ userEnteredValue: extendedValue(value) })) }))
  }];
}

function gridRange(sheetId: number, startRow: number, endRow: number, startColumn: number, endColumn: number): sheets_v4.Schema$GridRange {
  return { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startColumn, endColumnIndex: endColumn };
}

function headerRequest(sheetId: number, row: number, columnCount: number): sheets_v4.Schema$Request {
  return {
    repeatCell: {
      range: gridRange(sheetId, row, row + 1, 0, columnCount),
      cell: {
        userEnteredFormat: {
          backgroundColor: COLORS.navy,
          textFormat: { foregroundColor: COLORS.white, bold: true },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          wrapStrategy: "WRAP"
        }
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)"
    }
  };
}

function titleRequest(sheetId: number, columnCount: number): sheets_v4.Schema$Request {
  return {
    repeatCell: {
      range: gridRange(sheetId, 0, 1, 0, columnCount),
      cell: {
        userEnteredFormat: {
          backgroundColor: COLORS.navy,
          textFormat: { foregroundColor: COLORS.white, bold: true, fontSize: 14 },
          verticalAlignment: "MIDDLE"
        }
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)"
    }
  };
}

function autoResizeRequest(sheetId: number, columnCount: number): sheets_v4.Schema$Request {
  return { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: columnCount } } };
}

function oneOfRangeValidation(sheetId: number, range: sheets_v4.Schema$GridRange, source: string): sheets_v4.Schema$Request {
  return {
    setDataValidation: {
      range: { ...range, sheetId },
      rule: {
        condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: source }] },
        strict: true,
        showCustomUi: true
      }
    }
  };
}

function oneOfListValidation(sheetId: number, range: sheets_v4.Schema$GridRange, values: string[]): sheets_v4.Schema$Request {
  return {
    setDataValidation: {
      range: { ...range, sheetId },
      rule: {
        condition: { type: "ONE_OF_LIST", values: values.map((value) => ({ userEnteredValue: value })) },
        strict: true,
        showCustomUi: true
      }
    }
  };
}

function checkboxValidation(sheetId: number, range: sheets_v4.Schema$GridRange): sheets_v4.Schema$Request {
  return {
    setDataValidation: {
      range: { ...range, sheetId },
      rule: { condition: { type: "BOOLEAN" }, strict: true, showCustomUi: true }
    }
  };
}

function dateValidation(sheetId: number, range: sheets_v4.Schema$GridRange): sheets_v4.Schema$Request {
  return {
    setDataValidation: {
      range: { ...range, sheetId },
      rule: { condition: { type: "DATE_IS_VALID" }, strict: false, showCustomUi: true }
    }
  };
}

function numberValidation(sheetId: number, range: sheets_v4.Schema$GridRange, minimum: number, maximum: number): sheets_v4.Schema$Request {
  return {
    setDataValidation: {
      range: { ...range, sheetId },
      rule: {
        condition: {
          type: "NUMBER_BETWEEN",
          values: [{ userEnteredValue: String(minimum) }, { userEnteredValue: String(maximum) }]
        },
        strict: false,
        showCustomUi: true
      }
    }
  };
}

function customConditionalFormat(
  sheetId: number,
  range: sheets_v4.Schema$GridRange,
  customFormula: string,
  backgroundColor: sheets_v4.Schema$Color,
  foregroundColor?: sheets_v4.Schema$Color
): sheets_v4.Schema$Request {
  return {
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [{ ...range, sheetId }],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: customFormula }] },
          format: {
            backgroundColor,
            textFormat: foregroundColor ? { foregroundColor } : undefined
          }
        }
      }
    }
  };
}

function basicWorkbookRequests(sheets: PlannedSheet[]): sheets_v4.Schema$Request[] {
  return sheets.flatMap((sheet) => [
    ...(sheet.headerRows ?? [0]).map((row) => headerRequest(sheet.sheetId, row, sheet.columnCount)),
    autoResizeRequest(sheet.sheetId, sheet.columnCount)
  ]);
}

async function createPlannedWorkbook(plan: WorkbookPlan, parentFolderId?: string) {
  const auth = await getAuthorizedClient();
  const api = google.sheets({ version: "v4", auth });
  const response = await withGoogleRetry(() => api.spreadsheets.create({
    requestBody: {
      properties: { title: plan.title, locale: "ko_KR", timeZone: "Asia/Seoul" },
      sheets: plan.sheets.map((sheet) => ({
        properties: {
          sheetId: sheet.sheetId,
          title: sheet.title,
          hidden: sheet.hidden,
          gridProperties: {
            rowCount: Math.max(sheet.rowCount, sheet.rows.length + 5),
            columnCount: sheet.columnCount,
            frozenRowCount: sheet.frozenRows,
            frozenColumnCount: sheet.frozenColumns,
            hideGridlines: true
          }
        },
        data: gridData(sheet.rows)
      }))
    }
  }), { idempotent: false });
  const spreadsheetId = response.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google Sheets 문서 ID를 받지 못했습니다.");

  if (plan.requests.length) {
    await withGoogleRetry(() => api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: plan.requests }
    }), { idempotent: false });
  }
  await moveFile(spreadsheetId, parentFolderId);
  return { spreadsheetId, title: plan.title, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
}

export function buildAssessmentTrackerPlan(input: AssessmentTrackerInput): WorkbookPlan {
  const ids = {
    guide: 2101,
    students: 2102,
    plans: 2103,
    records: 2104,
    overview: 2105,
    submissions: 2106,
    observations: 2107,
    dashboard: 2108,
    settings: 2109
  };
  const students = [...input.students].sort((a, b) => a.number - b.number);
  const subjects = input.subjects.length ? input.subjects : ["국어", "사회", "수학", "과학", "영어"];
  const scale = input.assessmentScale.length ? input.assessmentScale : ["매우잘함", "잘함", "보통", "노력요함"];
  const assessmentTypes = ["과정중심평가", "단원평가", "수행평가", "형성평가", "관찰평가"];
  const submissionStates = ["미제출", "작성중", "제출완료", "반환", "회수"];
  const observationAreas = ["학습", "생활", "관계", "정서", "상담", "기타"];

  const studentRows: CellValue[][] = [
    ["번호", "이름", "재학 여부"],
    ...students.map((student) => [student.number, student.name, true])
  ];
  const overviewRows: CellValue[][] = [
    ["번호", "이름", "평가기록 수", "평균 점수", "과제 수", "제출완료", "제출률"],
    ...students.map((student, index) => {
      const row = index + 2;
      return [
        student.number,
        student.name,
        formula(`=COUNTIF('평가기록'!$B:$B,A${row})`),
        formula(`=IFERROR(AVERAGEIF('평가기록'!$B:$B,A${row},'평가기록'!$G:$G),"")`),
        formula(`=COUNTIF('제출현황'!$C:$C,A${row})`),
        formula(`=COUNTIFS('제출현황'!$C:$C,A${row},'제출현황'!$E:$E,"제출완료")`),
        formula(`=IF(E${row}=0,"",F${row}/E${row})`)
      ];
    })
  ];

  const dashboardRows: CellValue[][] = [
    [`${input.className} ${input.semester} 평가 대시보드`],
    ["기준 연도", input.schoolYear],
    ["학생 수", formula("=COUNTA('학생명단'!B2:B)")],
    ["평가 기록 수", formula("=COUNTA('평가기록'!A2:A)")],
    ["전체 평균", formula("=IFERROR(AVERAGE('평가기록'!G2:G),\"\")")],
    ["미제출 건수", formula("=COUNTIF('제출현황'!E2:E,\"미제출\")")],
    [],
    ["교과별 현황"],
    ["교과", "평균 점수", "기록 수"],
    ...subjects.map((subject, index) => {
      const row = index + 10;
      return [subject, formula(`=IFERROR(AVERAGEIF('평가기록'!$D:$D,A${row},'평가기록'!$G:$G),"")`), formula(`=COUNTIF('평가기록'!$D:$D,A${row})`)];
    }),
    [],
    ["수준별 분포", "건수"],
    ...scale.map((level, index) => {
      const row = 12 + subjects.length + index;
      return [level, formula(`=COUNTIF('평가기록'!$H:$H,A${row})`)];
    })
  ];

  const sheets: PlannedSheet[] = [
    {
      sheetId: ids.guide, title: "안내", rowCount: 40, columnCount: 6, frozenRows: 1, headerRows: [0], rows: [
        ["교육용 평가 관리 시스템"],
        ["학급", input.className],
        ["학년도", input.schoolYear],
        ["학기", input.semester],
        ["사용 순서", "학생명단 확인 → 평가계획 등록 → 평가기록 입력 → 제출·관찰 기록 → 대시보드 확인"],
        ["개인정보", "학생 정보가 포함되므로 링크 공개 대신 지정 사용자 공유를 권장합니다."],
        ["안전", "설정 탭과 수식 영역을 수정하기 전 사본을 만드세요."]
      ]
    },
    { sheetId: ids.students, title: "학생명단", rowCount: Math.max(210, students.length + 10), columnCount: 5, frozenRows: 1, frozenColumns: 2, rows: studentRows },
    { sheetId: ids.plans, title: "평가계획", rowCount: 300, columnCount: 9, frozenRows: 1, rows: [["평가 ID", "교과", "영역", "성취기준", "평가명", "평가유형", "평가일", "만점", "비고"]] },
    {
      sheetId: ids.records, title: "평가기록", rowCount: 2000, columnCount: 10, frozenRows: 1, frozenColumns: 3, rows: [
        ["평가일", "학생번호", "학생이름", "교과", "평가명", "평가유형", "점수", "수준", "관찰기록", "피드백"],
        [null, null, formula("=ARRAYFORMULA(IF(B2:B=\"\",\"\",IFNA(VLOOKUP(B2:B,'학생명단'!A:B,2,FALSE),\"\")))")]
      ]
    },
    { sheetId: ids.overview, title: "학생별현황", rowCount: Math.max(210, students.length + 10), columnCount: 8, frozenRows: 1, frozenColumns: 2, rows: overviewRows },
    {
      sheetId: ids.submissions, title: "제출현황", rowCount: 2000, columnCount: 10, frozenRows: 1, frozenColumns: 4, rows: [
        ["과제 ID", "과제명", "학생번호", "학생이름", "상태", "지각", "제출일", "점수", "확인", "메모"],
        [null, null, null, formula("=ARRAYFORMULA(IF(C2:C=\"\",\"\",IFNA(VLOOKUP(C2:C,'학생명단'!A:B,2,FALSE),\"\")))")]
      ]
    },
    {
      sheetId: ids.observations, title: "관찰기록", rowCount: 2000, columnCount: 8, frozenRows: 1, frozenColumns: 3, rows: [
        ["날짜", "학생번호", "학생이름", "영역", "관찰 내용", "후속 조치", "공개 범위", "확인"],
        [null, null, formula("=ARRAYFORMULA(IF(B2:B=\"\",\"\",IFNA(VLOOKUP(B2:B,'학생명단'!A:B,2,FALSE),\"\")))")]
      ]
    },
    { sheetId: ids.dashboard, title: "대시보드", rowCount: 100, columnCount: 12, frozenRows: 1, headerRows: [0, 8, 10 + subjects.length], rows: dashboardRows },
    {
      sheetId: ids.settings, title: "설정", rowCount: 100, columnCount: 6, frozenRows: 1, hidden: true, rows: [
        ["교과", "평가수준", "평가유형", "제출상태", "관찰영역", "학기"],
        ...Array.from({ length: Math.max(subjects.length, scale.length, assessmentTypes.length, submissionStates.length, observationAreas.length, 3) }, (_, index) => [
          subjects[index] ?? null,
          scale[index] ?? null,
          assessmentTypes[index] ?? null,
          submissionStates[index] ?? null,
          observationAreas[index] ?? null,
          ["1학기", "2학기", "연간"][index] ?? null
        ])
      ]
    }
  ];

  const studentEnd = Math.max(2, students.length + 1);
  const subjectEnd = subjects.length + 1;
  const scaleEnd = scale.length + 1;
  const requests = [
    ...basicWorkbookRequests(sheets),
    titleRequest(ids.guide, 6),
    titleRequest(ids.dashboard, 12),
    checkboxValidation(ids.students, gridRange(ids.students, 1, studentEnd, 2, 3)),
    oneOfRangeValidation(ids.plans, gridRange(ids.plans, 1, 300, 1, 2), `='설정'!$A$2:$A$${subjectEnd}`),
    oneOfRangeValidation(ids.plans, gridRange(ids.plans, 1, 300, 5, 6), "='설정'!$C$2:$C$6"),
    dateValidation(ids.plans, gridRange(ids.plans, 1, 300, 6, 7)),
    numberValidation(ids.plans, gridRange(ids.plans, 1, 300, 7, 8), 0, 1000),
    oneOfRangeValidation(ids.records, gridRange(ids.records, 1, 2000, 1, 2), `='학생명단'!$A$2:$A$${studentEnd}`),
    oneOfRangeValidation(ids.records, gridRange(ids.records, 1, 2000, 3, 4), `='설정'!$A$2:$A$${subjectEnd}`),
    oneOfRangeValidation(ids.records, gridRange(ids.records, 1, 2000, 5, 6), "='설정'!$C$2:$C$6"),
    oneOfRangeValidation(ids.records, gridRange(ids.records, 1, 2000, 7, 8), `='설정'!$B$2:$B$${scaleEnd}`),
    dateValidation(ids.records, gridRange(ids.records, 1, 2000, 0, 1)),
    numberValidation(ids.records, gridRange(ids.records, 1, 2000, 6, 7), 0, 100),
    oneOfRangeValidation(ids.submissions, gridRange(ids.submissions, 1, 2000, 2, 3), `='학생명단'!$A$2:$A$${studentEnd}`),
    oneOfRangeValidation(ids.submissions, gridRange(ids.submissions, 1, 2000, 4, 5), "='설정'!$D$2:$D$6"),
    checkboxValidation(ids.submissions, gridRange(ids.submissions, 1, 2000, 5, 6)),
    checkboxValidation(ids.submissions, gridRange(ids.submissions, 1, 2000, 8, 9)),
    oneOfRangeValidation(ids.observations, gridRange(ids.observations, 1, 2000, 1, 2), `='학생명단'!$A$2:$A$${studentEnd}`),
    oneOfRangeValidation(ids.observations, gridRange(ids.observations, 1, 2000, 3, 4), "='설정'!$E$2:$E$7"),
    oneOfListValidation(ids.observations, gridRange(ids.observations, 1, 2000, 6, 7), ["교사용", "학부모 공유 가능", "공유 금지"]),
    checkboxValidation(ids.observations, gridRange(ids.observations, 1, 2000, 7, 8)),
    customConditionalFormat(ids.records, gridRange(ids.records, 1, 2000, 0, 10), "=AND($G2<70,$G2<>\"\")", COLORS.paleRed),
    customConditionalFormat(ids.records, gridRange(ids.records, 1, 2000, 0, 10), `=$H2="${formulaStringLiteral(scale.at(-1) ?? "노력요함")}"`, COLORS.paleYellow),
    customConditionalFormat(ids.submissions, gridRange(ids.submissions, 1, 2000, 0, 10), "=$E2=\"제출완료\"", COLORS.paleGreen),
    customConditionalFormat(ids.submissions, gridRange(ids.submissions, 1, 2000, 0, 10), "=$E2=\"미제출\"", COLORS.paleRed),
    {
      repeatCell: {
        range: gridRange(ids.overview, 1, Math.max(2, students.length + 1), 6, 7),
        cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0%" } } },
        fields: "userEnteredFormat.numberFormat"
      }
    },
    {
      addProtectedRange: {
        protectedRange: {
          range: gridRange(ids.settings, 0, 100, 0, 6),
          description: "드롭다운 원본 설정 — 변경 전 사본을 권장합니다.",
          warningOnly: true
        }
      }
    },
    {
      addChart: {
        chart: {
          spec: {
            title: "교과별 평균",
            basicChart: {
              chartType: "COLUMN",
              legendPosition: "NO_LEGEND",
              headerCount: 1,
              domains: [{ domain: { sourceRange: { sources: [gridRange(ids.dashboard, 8, 9 + subjects.length, 0, 1)] } } }],
              series: [{ series: { sourceRange: { sources: [gridRange(ids.dashboard, 8, 9 + subjects.length, 1, 2)] } } }]
            }
          },
          position: { overlayPosition: { anchorCell: { sheetId: ids.dashboard, rowIndex: 1, columnIndex: 4 }, widthPixels: 600, heightPixels: 320 } }
        }
      }
    }
  ] satisfies sheets_v4.Schema$Request[];

  return { title: input.title, sheets, requests };
}

export async function createAssessmentTracker(input: AssessmentTrackerInput) {
  const workbook = await createPlannedWorkbook(buildAssessmentTrackerPlan(input), input.parentFolderId);
  return {
    ...workbook,
    template: "ASSESSMENT_TRACKER",
    studentCount: input.students.length,
    subjectCount: input.subjects.length,
    sheets: ["안내", "학생명단", "평가계획", "평가기록", "학생별현황", "제출현황", "관찰기록", "대시보드", "설정"],
    privacy: "학생 이름은 생성된 스프레드시트에만 기록되며 MCP 응답에는 포함하지 않습니다."
  };
}

function submissionStateLabel(state?: string): string {
  if (state === "TURNED_IN") return "제출완료";
  if (state === "RETURNED") return "반환";
  if (state === "RECLAIMED_BY_STUDENT") return "회수";
  if (state === "CREATED") return "작성중";
  return "미제출";
}

export function buildSubmissionTrackerPlan(input: SubmissionTrackerInput): WorkbookPlan {
  const ids = { guide: 3101, students: 3102, submissions: 3103, dashboard: 3104, settings: 3105 };
  const submissionsByUser = new Map(input.submissions.map((submission) => [submission.userId, submission]));
  const students = [...input.students].sort((a, b) => a.number - b.number);
  const rows: CellValue[][] = [
    ["번호", "학생이름", "상태", "지각", "임시점수", "확정점수", "최근 변경", "제출물 링크", "확인"],
    ...students.map((student) => {
      const submission = submissionsByUser.get(student.userId);
      return [
        student.number,
        student.name,
        submissionStateLabel(submission?.state),
        Boolean(submission?.late),
        submission?.draftGrade ?? null,
        submission?.assignedGrade ?? null,
        submission?.updateTime ?? null,
        submission?.alternateLink ?? null,
        false
      ];
    })
  ];
  const states = ["미제출", "작성중", "제출완료", "반환", "회수"];
  const dashboardRows: CellValue[][] = [
    [`${input.assignmentTitle} 제출 대시보드`],
    ["전체 학생", formula("=COUNTA('제출현황'!B2:B)")],
    ["제출·반환", formula("=COUNTIF('제출현황'!C2:C,\"제출완료\")+COUNTIF('제출현황'!C2:C,\"반환\")")],
    ["미제출", formula("=COUNTIF('제출현황'!C2:C,\"미제출\")")],
    ["지각 제출", formula("=COUNTIF('제출현황'!D2:D,TRUE)")],
    ["확정점수 평균", formula("=IFERROR(AVERAGE('제출현황'!F2:F),\"\")")],
    [],
    ["상태", "인원"],
    ...states.map((state, index) => [state, formula(`=COUNTIF('제출현황'!$C:$C,A${index + 9})`)])
  ];
  const sheets: PlannedSheet[] = [
    {
      sheetId: ids.guide, title: "안내", rowCount: 30, columnCount: 6, frozenRows: 1, rows: [
        ["Classroom 제출 현황"],
        ["과제", input.assignmentTitle],
        ["수업 ID", input.courseId],
        ["과제 ID", input.courseWorkId],
        ["개인정보", "학생 이름과 평가 정보가 포함되어 있으므로 지정 사용자에게만 공유하세요."],
        ["갱신", "이 파일은 생성 시점의 스냅샷입니다. 최신 현황은 MCP로 다시 생성하거나 갱신 기능을 사용하세요."]
      ]
    },
    { sheetId: ids.students, title: "학생명단", rowCount: Math.max(210, students.length + 10), columnCount: 2, frozenRows: 1, frozenColumns: 1, rows: [["번호", "학생이름"], ...students.map((student) => [student.number, student.name])] },
    { sheetId: ids.submissions, title: "제출현황", rowCount: Math.max(500, students.length + 20), columnCount: 9, frozenRows: 1, frozenColumns: 2, rows },
    { sheetId: ids.dashboard, title: "대시보드", rowCount: 80, columnCount: 10, frozenRows: 1, headerRows: [0, 7], rows: dashboardRows },
    { sheetId: ids.settings, title: "설정", rowCount: 30, columnCount: 3, frozenRows: 1, hidden: true, rows: [["제출상태"], ...states.map((state) => [state])] }
  ];
  const dataEnd = Math.max(2, students.length + 1);
  const requests = [
    ...basicWorkbookRequests(sheets),
    titleRequest(ids.guide, 6),
    titleRequest(ids.dashboard, 10),
    oneOfRangeValidation(ids.submissions, gridRange(ids.submissions, 1, dataEnd, 2, 3), "='설정'!$A$2:$A$6"),
    checkboxValidation(ids.submissions, gridRange(ids.submissions, 1, dataEnd, 3, 4)),
    checkboxValidation(ids.submissions, gridRange(ids.submissions, 1, dataEnd, 8, 9)),
    customConditionalFormat(ids.submissions, gridRange(ids.submissions, 1, dataEnd, 0, 9), "=$C2=\"제출완료\"", COLORS.paleGreen),
    customConditionalFormat(ids.submissions, gridRange(ids.submissions, 1, dataEnd, 0, 9), "=$C2=\"미제출\"", COLORS.paleRed),
    customConditionalFormat(ids.submissions, gridRange(ids.submissions, 1, dataEnd, 0, 9), "=$D2=TRUE", COLORS.paleYellow),
    {
      addProtectedRange: {
        protectedRange: {
          range: gridRange(ids.settings, 0, 30, 0, 3),
          description: "제출 상태 설정 — 변경 전 사본을 권장합니다.",
          warningOnly: true
        }
      }
    },
    {
      addChart: {
        chart: {
          spec: {
            title: "제출 상태 분포",
            pieChart: {
              legendPosition: "RIGHT_LEGEND",
              domain: { sourceRange: { sources: [gridRange(ids.dashboard, 7, 13, 0, 1)] } },
              series: { sourceRange: { sources: [gridRange(ids.dashboard, 7, 13, 1, 2)] } }
            }
          },
          position: { overlayPosition: { anchorCell: { sheetId: ids.dashboard, rowIndex: 1, columnIndex: 3 }, widthPixels: 540, heightPixels: 320 } }
        }
      }
    }
  ] satisfies sheets_v4.Schema$Request[];

  return { title: input.title, sheets, requests };
}

export async function createSubmissionTracker(input: SubmissionTrackerInput) {
  const workbook = await createPlannedWorkbook(buildSubmissionTrackerPlan(input), input.parentFolderId);
  const submittedCount = input.submissions.filter((submission) => submission.state === "TURNED_IN" || submission.state === "RETURNED").length;
  return {
    ...workbook,
    template: "CLASSROOM_SUBMISSION_TRACKER",
    studentCount: input.students.length,
    submissionCount: input.submissions.length,
    submittedCount,
    missingCount: Math.max(0, input.students.length - submittedCount),
    lateCount: input.submissions.filter((submission) => submission.late).length,
    sheets: ["안내", "학생명단", "제출현황", "대시보드", "설정"],
    privacy: "학생 이름은 생성된 스프레드시트에만 기록되고 Classroom 사용자 ID는 저장하지 않으며, 둘 다 MCP 응답에는 포함하지 않습니다."
  };
}
