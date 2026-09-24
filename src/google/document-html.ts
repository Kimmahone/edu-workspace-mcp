// Google Docs로 변환할 HTML을 만든다. Drive가 HTML을 Docs로 바꿀 때 표·칸 합치기·음영·목록·글꼴을
// 그대로 살리므로, Docs API로 글자 위치를 계산해 서식을 입히는 것보다 공문서 같은 양식을 안정적으로 만들 수 있다.
// 여기에는 Google 호출이 없어서 모양을 테스트로 고정할 수 있다.
//
// 모든 사용자 문자열은 escapeHtml 을 거친다. 서식 문법은 escape 한 뒤에만 해석한다.

export type DocumentBlock = {
  heading?: string;
  text: string;
};

export type DocumentStandard = {
  code: string;
  /** null 이면 원문 자동 추출이 깨진 항목 — 요지만 싣고 확인을 안내한다. */
  text: string | null;
  summary: string;
};

export type DocumentOptions = {
  subtitle?: string;
  standards?: DocumentStandard[];
  /** 성취기준 아래에 작게 붙이는 출처 문구 */
  standardsNote?: string;
};

// 한글 글리프가 있는 글꼴이어야 굵게·크기가 한글에도 적용된다(Arial 은 한글이 없어 대체 글꼴로 그려졌다).
const FONT = "'Noto Sans KR'";
const COLOR = {
  navy: "#1b3c61",
  ink: "#1f2a37",
  muted: "#5f6b78",
  faint: "#7a8591",
  line: "#9aa9b8",
  label: "#e8eef5",
  stage: "#f3f6f9",
  note: "#f1f5f9",
  highlight: "#fff8e1",
  highlightLine: "#e0b93b",
  warn: "#9a3412"
};
const CELL = `border:0.75pt solid ${COLOR.line}; padding:4pt 6pt; vertical-align:top;`;
const LABEL_CELL = `${CELL} background:${COLOR.label}; font-weight:bold; text-align:center; vertical-align:middle;`;
const HEADER_CELL = `border:0.75pt solid ${COLOR.navy}; padding:4pt 6pt; background:${COLOR.navy}; color:#ffffff; font-weight:bold; text-align:center; vertical-align:middle;`;
const TABLE = "border-collapse:collapse; width:100%;";
const P = "margin:0 0 3pt 0; line-height:1.2;";
const LIST = "margin:0; padding-left:14pt;";
const LI = "margin:0 0 2pt 0; line-height:1.2;";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** escape 후 **굵게** 만 해석한다. */
export function inlineHtml(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

function spacer(points = 6): string {
  // Docs는 표 두 개가 붙어 있을 수 없어 사이에 문단을 둔다. 높이를 작게 고정해 빈 줄처럼 보이지 않게 한다.
  return `<p style="margin:0; font-size:${points}pt; line-height:1;">&nbsp;</p>`;
}

function smallNote(text: string): string {
  return `<p style="margin:2pt 0 0 0; font-size:8pt; line-height:1.35; color:${COLOR.faint};">${inlineHtml(text)}</p>`;
}

function titleBox(title: string, subtitle?: string): string {
  const sub = subtitle?.trim()
    ? `<p style="margin:3pt 0 0 0; font-size:10pt; color:${COLOR.muted}; text-align:center;">${inlineHtml(subtitle.trim())}</p>`
    : "";
  return `<table style="${TABLE}"><tr><td style="border-top:2.25pt solid ${COLOR.navy}; border-bottom:2.25pt solid ${COLOR.navy}; border-left:none; border-right:none; padding:9pt 6pt;">`
    + `<p style="margin:0; font-size:18pt; font-weight:bold; color:${COLOR.navy}; text-align:center;">${inlineHtml(title)}</p>${sub}`
    + "</td></tr></table>";
}

function sectionHeading(text: string, aside?: string): string {
  // 밑줄(border-bottom)은 Docs 변환에서 제목과 떨어진 선 문단이 되어 다음 목록 안으로 끼어든다. 색과 굵기로만 구분한다.
  // 쪽 나눔 CSS 는 변환에서 무시되어 docs.ts 가 변환 뒤에 입힌다("■ n차시 ·" 로 찾는다).
  const asideHtml = aside ? ` <span style="font-size:10pt; font-weight:normal; color:${COLOR.muted};">${inlineHtml(aside)}</span>` : "";
  return `<h2 style="margin:16pt 0 6pt 0; font-size:13pt; font-weight:bold; color:${COLOR.navy};">`
    + `<span style="color:${COLOR.navy};">■</span> ${inlineHtml(text)}${asideHtml}</h2>`;
}

function subHeading(text: string): string {
  return `<h3 style="margin:10pt 0 4pt 0; font-size:11pt; font-weight:bold; color:${COLOR.ink};">${inlineHtml(text)}</h3>`;
}

type ListItem = { level: number; ordered: boolean; text: string };

function renderList(items: ListItem[]): string {
  let html = "";
  const open: string[] = [];
  for (const item of items) {
    const level = Math.min(item.level, open.length);
    while (open.length > level + 1) html += `</li></${open.pop()}>`;
    if (open.length === level + 1) {
      html += "</li>";
    } else {
      const tag = item.ordered ? "ol" : "ul";
      open.push(tag);
      html += `<${tag} style="${LIST}">`;
    }
    html += `<li style="${LI}">${inlineHtml(item.text)}`;
  }
  while (open.length) html += `</li></${open.pop()}>`;
  return html;
}

function callout(lines: string[]): string {
  const body = lines.map((line) => `<p style="margin:0 0 2pt 0; line-height:1.25;">${inlineHtml(line)}</p>`).join("");
  return `<table style="${TABLE}"><tr><td style="background:${COLOR.note}; border-left:3pt solid ${COLOR.navy}; border-top:none; border-right:none; border-bottom:none; padding:6pt 9pt; font-size:9.5pt;">${body}</td></tr></table>`;
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function markdownTable(rows: string[][]): string {
  const [header, ...body] = rows;
  const columns = Math.max(...rows.map((row) => row.length));
  const pad = (row: string[]) => [...row, ...Array(columns - row.length).fill("")];
  const head = `<tr>${pad(header).map((cell) => `<td style="${HEADER_CELL}">${inlineHtml(cell)}</td>`).join("")}</tr>`;
  const rest = body.map((row) => `<tr>${pad(row).map((cell) => `<td style="${CELL}">${inlineHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<table style="${TABLE}">${head}${rest}</table>`;
}

const LIST_LINE = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/**
 * 블록 본문에 쓰는 간단한 서식.
 * `## 소제목`, `- 글머리`(두 칸 들여쓰면 한 단계 아래), `1. 번호`, `| 표 |`(둘째 줄에 `|---|`), `> 참고 상자`, `**굵게**`.
 * 빈 줄은 문단을 나눌 뿐 빈 문단을 만들지 않는다.
 */
export function markdownToHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const parts: string[] = [];
  let list: ListItem[] = [];
  let lastWasTable = false;

  const flushList = () => {
    if (list.length) parts.push(renderList(list));
    list = [];
  };
  const pushTable = (html: string) => {
    if (lastWasTable || parts.length === 0) parts.push(spacer(4));
    parts.push(html);
    lastWasTable = true;
  };
  const pushBlock = (html: string) => {
    parts.push(html);
    lastWasTable = false;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) { flushList(); continue; }

    const listMatch = line.match(LIST_LINE);
    if (listMatch) {
      const indent = listMatch[1].replace(/\t/g, "  ").length;
      list.push({ level: Math.min(Math.floor(indent / 2), 2), ordered: /\d/.test(listMatch[2]), text: listMatch[3] });
      lastWasTable = false;
      continue;
    }
    flushList();

    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) { pushBlock(subHeading(heading[1])); continue; }

    if (line.trim().startsWith("|") && TABLE_SEPARATOR.test(lines[index + 1] ?? "")) {
      const rows = [splitTableRow(line)];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      index -= 1;
      pushTable(markdownTable(rows));
      continue;
    }

    if (line.trim().startsWith(">")) {
      const quoted = [line.trim().replace(/^>\s?/, "")];
      while (index + 1 < lines.length && lines[index + 1].trim().startsWith(">")) {
        index += 1;
        quoted.push(lines[index].trim().replace(/^>\s?/, ""));
      }
      pushTable(callout(quoted));
      continue;
    }

    pushBlock(`<p style="${P}">${inlineHtml(line.trim())}</p>`);
  }
  flushList();
  return parts.join("");
}

function standardLines(standards: DocumentStandard[]): string {
  return standards.map((standard) => standard.text
    ? `<p style="${P}"><b>${escapeHtml(standard.code)}</b> ${escapeHtml(standard.text)}</p>`
    : `<p style="${P}"><b>${escapeHtml(standard.code)}</b> <span style="color:${COLOR.warn};">원문 확인 필요</span>`
      + ` <span style="color:${COLOR.muted};">— 자동 추출이 깨져 요지만 싣습니다: ${escapeHtml(standard.summary)}</span></p>`
  ).join("");
}

function htmlDocument(body: string): string {
  return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
    + `<body style="font-family:${FONT}; font-size:10pt; color:${COLOR.ink};">${body}</body></html>`;
}

export function renderDocumentHtml(title: string, blocks: DocumentBlock[], options: DocumentOptions = {}): string {
  const parts = [titleBox(title, options.subtitle)];
  if (options.standards?.length) {
    parts.push(spacer(6));
    parts.push(`<table style="${TABLE}"><tr><td style="${LABEL_CELL} width:16%;">성취기준</td><td style="${CELL}">${standardLines(options.standards)}</td></tr></table>`);
    if (options.standardsNote) parts.push(smallNote(options.standardsNote));
  }
  for (const block of blocks) {
    if (block.heading) parts.push(sectionHeading(block.heading));
    const body = markdownToHtml(block.text);
    // 제목 없는 첫 블록이 표로 시작하면 제목 상자와 붙지 않게 띄운다.
    parts.push(block.heading ? body : `${spacer(6)}${body}`);
  }
  return htmlDocument(parts.join(""));
}

export type LessonStep = {
  stage: string;
  process: string;
  activities: string[];
  minutes?: number;
  notes?: string[];
};

export type LessonSession = {
  title: string;
  pages?: string;
  problem?: string;
  steps: LessonStep[];
};

export type LessonAssessment = {
  element: string;
  method: string;
  high?: string;
  middle?: string;
  low?: string;
};

export type LessonPlanInput = {
  title?: string;
  subject: string;
  grade: number;
  unit: string;
  lesson?: string;
  textbookPages?: string;
  periods?: string;
  objectives: string[];
  materials?: string[];
  keyTerms?: Array<{ term: string; meaning: string }>;
  sessions: LessonSession[];
  assessment?: LessonAssessment[];
  guidance?: string[];
  standards?: DocumentStandard[];
  standardsNote?: string;
};

export function lessonPlanTitle(input: Pick<LessonPlanInput, "title" | "subject">): string {
  return input.title?.trim() || `${input.subject}과 교수·학습 과정안`;
}

function bulletCell(lines: string[]): string {
  const items: ListItem[] = lines.filter((line) => line.trim()).map((line) => {
    const match = line.match(LIST_LINE);
    const indent = (match?.[1] ?? line.match(/^\s*/)?.[0] ?? "").length;
    return { level: indent >= 2 ? 1 : 0, ordered: false, text: (match?.[3] ?? line).trim() };
  });
  return items.length ? renderList(items) : "";
}

function paragraphCell(lines: string[] = []): string {
  return lines.filter((line) => line.trim()).map((line) => `<p style="${P}">${inlineHtml(line.trim())}</p>`).join("");
}

function infoTable(input: LessonPlanInput): string {
  const row = (cells: string) => `<tr>${cells}</tr>`;
  const label = (text: string) => `<td style="${LABEL_CELL} width:14%;">${escapeHtml(text)}</td>`;
  const value = (html: string, colspan = 1) => `<td ${colspan > 1 ? `colspan="${colspan}" ` : ""}style="${CELL}">${html}</td>`;
  const periods = input.periods?.trim() || `${input.sessions.length}차시`;
  const rows = [
    row(`${label("교과")}${value(`${escapeHtml(input.subject)} (${input.grade}학년)`)}${label("차시")}${value(escapeHtml(periods))}`),
    row(`${label("단원")}${value(escapeHtml(input.unit))}${label("교과서")}${value(escapeHtml(input.textbookPages?.trim() || "—"))}`)
  ];
  if (input.lesson?.trim()) rows.push(row(`${label("학습 주제")}${value(escapeHtml(input.lesson.trim()), 3)}`));
  if (input.standards?.length) rows.push(row(`${label("성취기준")}${value(standardLines(input.standards), 3)}`));
  rows.push(row(`${label("학습 목표")}${value(bulletCell(input.objectives), 3)}`));
  if (input.materials?.length) rows.push(row(`${label("학습 자료")}${value(input.materials.map(escapeHtml).join(" · "), 3)}`));
  return `<table style="${TABLE}">${rows.join("")}</table>`;
}

function sessionsOverview(sessions: LessonSession[]): string {
  // 열 너비는 첫 행에서 정해진다.
  const head = [["차시", "8%"], ["학습 주제", "32%"], ["교과서", "13%"], ["학습 흐름", "47%"]]
    .map(([text, width]) => `<td style="${HEADER_CELL} width:${width};">${text}</td>`).join("");
  const rows = sessions.map((session, index) => {
    const flow = session.steps.map((step) => step.process).filter(Boolean).join(" → ");
    return `<tr><td style="${CELL} text-align:center;">${index + 1}</td>`
      + `<td style="${CELL}">${inlineHtml(session.title)}</td>`
      + `<td style="${CELL} text-align:center;">${escapeHtml(session.pages ?? "—")}</td>`
      + `<td style="${CELL}">${escapeHtml(flow)}</td></tr>`;
  }).join("");
  return `<table style="${TABLE}"><tr>${head}</tr>${rows}</table>`;
}

function processTable(steps: LessonStep[]): string {
  // 같은 단계(도입·전개·정리)가 이어지면 단계와 시간 칸을 세로로 합친다. 두 칸을 같은 범위로 합쳐야 표가 밀리지 않는다.
  const groups: LessonStep[][] = [];
  for (const step of steps) {
    const last = groups.at(-1);
    if (last && last[0].stage.trim() === step.stage.trim()) last.push(step);
    else groups.push([step]);
  }
  const head = [["단계", "9%"], ["학습 과정", "16%"], ["교수·학습 활동", "45%"], ["시간", "8%"], ["자료·유의점", "22%"]]
    .map(([text, width]) => `<td style="${HEADER_CELL} width:${width};">${text}</td>`).join("");
  const rows = groups.flatMap((group) => {
    const minutes = group.reduce((total, step) => total + (step.minutes ?? 0), 0);
    const span = group.length > 1 ? ` rowspan="${group.length}"` : "";
    return group.map((step, index) => {
      const lead = index === 0
        ? `<td${span} style="${CELL} background:${COLOR.stage}; font-weight:bold; text-align:center; vertical-align:middle;">${escapeHtml(step.stage)}</td>`
        : "";
      const time = index === 0
        ? `<td${span} style="${CELL} text-align:center; vertical-align:middle;">${minutes ? `${minutes}′` : ""}</td>`
        : "";
      return `<tr>${lead}<td style="${CELL}">${inlineHtml(step.process)}</td><td style="${CELL}">${bulletCell(step.activities)}</td>${time}<td style="${CELL} font-size:9pt;">${paragraphCell(step.notes)}</td></tr>`;
    });
  }).join("");
  return `<table style="${TABLE}"><tr>${head}</tr>${rows}</table>`;
}

function problemBox(problem: string): string {
  return `<table style="${TABLE}"><tr><td style="border:0.75pt solid ${COLOR.highlightLine}; background:${COLOR.highlight}; padding:5pt 9pt;">`
    + `<p style="margin:0; line-height:1.25;"><b style="color:${COLOR.navy};">학습 문제</b>&nbsp;&nbsp;<b>${inlineHtml(problem)}</b></p></td></tr></table>`;
}

function assessmentTable(rows: LessonAssessment[]): string {
  const withLevels = rows.some((row) => row.high || row.middle || row.low);
  const columns = withLevels
    ? [["평가 요소", "22%"], ["평가 방법", "14%"], ["상", "22%"], ["중", "21%"], ["하", "21%"]]
    : [["평가 요소", "60%"], ["평가 방법", "40%"]];
  const head = columns.map(([text, width]) => `<td style="${HEADER_CELL} width:${width};">${text}</td>`).join("");
  const body = rows.map((row) => {
    const cells = [row.element, row.method, ...(withLevels ? [row.high ?? "", row.middle ?? "", row.low ?? ""] : [])];
    return `<tr>${cells.map((cell, index) => `<td style="${CELL}${index === 1 ? " text-align:center;" : ""}">${inlineHtml(cell)}</td>`).join("")}</tr>`;
  }).join("");
  return `<table style="${TABLE}"><tr>${head}</tr>${body}</table>`;
}

export function renderLessonPlanHtml(input: LessonPlanInput): string {
  const lesson = input.lesson?.trim();
  const subtitle = [`${input.grade}학년`, input.unit, lesson].filter(Boolean).join(" · ");
  const parts = [titleBox(lessonPlanTitle(input), subtitle), spacer(6), infoTable(input)];
  if (input.standards?.length && input.standardsNote) parts.push(smallNote(input.standardsNote));

  if (input.keyTerms?.length) {
    parts.push(spacer(6));
    parts.push(callout(["**핵심 용어**", ...input.keyTerms.map(({ term, meaning }) => `**${term}** — ${meaning}`)]));
  }

  if (input.sessions.length > 1) {
    parts.push(sectionHeading("차시별 흐름"));
    parts.push(sessionsOverview(input.sessions));
  }

  input.sessions.forEach((session, index) => {
    const name = input.sessions.length > 1 ? `${index + 1}차시 · ${session.title}` : `교수·학습 과정 · ${session.title}`;
    parts.push(sectionHeading(name, session.pages ? `(${session.pages})` : undefined));
    if (session.problem?.trim()) {
      parts.push(problemBox(session.problem.trim()));
      parts.push(spacer(4));
    }
    parts.push(processTable(session.steps));
  });

  if (input.assessment?.length) {
    parts.push(sectionHeading("평가 계획"));
    parts.push(assessmentTable(input.assessment));
  }
  if (input.guidance?.length) {
    parts.push(sectionHeading("지도상 유의점"));
    parts.push(renderList(input.guidance.map((text) => ({ level: 0, ordered: false, text }))));
  }
  return htmlDocument(parts.join(""));
}

// ── 학생용 학습지 ─────────────────────────────────────────────────────────────
// 교과서 활동 쪽처럼 이름 칸, 학습 목표 상자, 이름표가 붙은 줄 있는 답 칸, 빈 표, ○ 자기 점검표를 그린다.

export type WorksheetSection = {
  kind: "write" | "table" | "checklist" | "box" | "text";
  /** 교과서의 활동 이름표. 예: 의견 마련하기 */
  tag?: string;
  /** 번호가 붙는 물음 */
  prompt?: string;
  /** write: 이름표 붙은 답 칸들. 예: [{ label: "의견", lines: 2 }, { label: "그 이유", lines: 4 }] */
  boxes?: Array<{ label?: string; lines: number }>;
  /** table: 머리행 */
  columns?: string[];
  /** table: 첫 열에 들어갈 행 이름. 없으면 blankRows 만큼 빈 행 */
  rows?: string[];
  blankRows?: number;
  /** table·box: 칸 높이(줄 수) */
  lines?: number;
  /** checklist: 점검 문항과 척도 */
  items?: string[];
  scale?: string[];
  /** text: 본문 서식 */
  text?: string;
  /** 물음 아래 도움말 상자 */
  hint?: string;
};

export type WorksheetInput = {
  title: string;
  subject?: string;
  grade?: number;
  unit?: string;
  lesson?: string;
  objective?: string;
  studentInfo?: boolean;
  sections: WorksheetSection[];
};

const WRITE_LINE = `<p style="margin:0; font-size:14pt; line-height:1.3;">&nbsp;</p>`;
const RULE = `0.75pt dotted ${COLOR.line}`;
const FRAME = `0.75pt solid ${COLOR.line}`;

function studentInfoStrip(grade?: number): string {
  const gradeText = grade ? `${grade}학년` : "&nbsp;&nbsp;&nbsp;&nbsp;학년";
  return `<table style="${TABLE}"><tr>`
    + `<td style="${LABEL_CELL} width:18%;">학년·반·번호</td>`
    + `<td style="${CELL} width:36%; vertical-align:middle;">${gradeText}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;반&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;번</td>`
    + `<td style="${LABEL_CELL} width:10%;">이름</td>`
    + `<td style="${CELL} width:36%;">${WRITE_LINE}</td>`
    + "</tr></table>";
}

function sectionTag(tag: string): string {
  return `<p style="margin:12pt 0 3pt 0;"><span style="background-color:${COLOR.navy}; color:#ffffff; font-weight:bold; font-size:9pt;">&nbsp;${escapeHtml(tag)}&nbsp;</span></p>`;
}

function promptLine(number: number, prompt: string): string {
  // h3 로 두어 Docs 개요에 보이고, 변환 뒤 "다음 내용과 같은 쪽에" 설정이 걸리게 한다.
  return `<h3 style="margin:6pt 0 4pt 0; font-size:11pt; font-weight:normal; color:${COLOR.ink};"><b style="color:${COLOR.navy};">${number}.</b> ${inlineHtml(prompt)}</h3>`;
}

/** 이름표가 있으면 왼쪽 칸에 세로로 합쳐 두고, 오른쪽은 점선 줄. 겉테두리는 실선. */
function answerBox(lines: number, label?: string): string {
  const count = Math.max(1, Math.min(lines, 20));
  const rows = Array.from({ length: count }, (_, index) => {
    const top = index === 0 ? FRAME : "none";
    const bottom = index === count - 1 ? FRAME : RULE;
    const labelCell = index === 0 && label
      ? `<td rowspan="${count}" style="${LABEL_CELL} width:15%; border:${FRAME};">${escapeHtml(label)}</td>`
      : "";
    return `<tr>${labelCell}<td style="border-top:${top}; border-bottom:${bottom}; border-left:${FRAME}; border-right:${FRAME}; padding:2pt 8pt;">${WRITE_LINE}</td></tr>`;
  }).join("");
  return `<table style="${TABLE}">${rows}</table>`;
}

function fillTable(section: WorksheetSection): string {
  const columns = section.columns ?? [];
  const rowLabels = section.rows ?? [];
  const lines = Math.max(1, Math.min(section.lines ?? 2, 12));
  const cellBody = Array.from({ length: lines }, () => WRITE_LINE).join("");
  const labelWidth = rowLabels.length ? 24 : 0;
  const width = Math.floor((100 - labelWidth) / Math.max(1, columns.length - (rowLabels.length ? 1 : 0)));
  const head = columns.map((column, index) => {
    const w = rowLabels.length && index === 0 ? labelWidth : width;
    return `<td style="${HEADER_CELL} width:${w}%;">${inlineHtml(column)}</td>`;
  }).join("");
  const bodyRows = rowLabels.length
    ? rowLabels.map((label) => `<tr><td style="${LABEL_CELL} text-align:left; font-weight:normal;">${inlineHtml(label)}</td>${columns.slice(1).map(() => `<td style="${CELL}">${cellBody}</td>`).join("")}</tr>`)
    : Array.from({ length: Math.max(1, Math.min(section.blankRows ?? 2, 20)) }, () => `<tr>${columns.map(() => `<td style="${CELL}">${cellBody}</td>`).join("")}</tr>`);
  return `<table style="${TABLE}"><tr>${head}</tr>${bodyRows.join("")}</table>`;
}

function checklistTable(items: string[], scale: string[]): string {
  const scaleWidth = Math.floor(40 / scale.length);
  const head = `<td style="${HEADER_CELL} width:${100 - scaleWidth * scale.length}%;">점검 내용</td>`
    + scale.map((level) => `<td style="${HEADER_CELL} width:${scaleWidth}%;">${inlineHtml(level)}</td>`).join("");
  const rows = items.map((item) => `<tr><td style="${CELL} vertical-align:middle;">${inlineHtml(item)}</td>`
    + scale.map(() => `<td style="${CELL} text-align:center; vertical-align:middle; font-size:14pt; color:${COLOR.line};">○</td>`).join("")
    + "</tr>").join("");
  return `<table style="${TABLE}"><tr>${head}</tr>${rows}</table>`;
}

function hintBox(hint: string): string {
  return `<table style="${TABLE}"><tr><td style="background:${COLOR.highlight}; border:0.75pt solid ${COLOR.highlightLine}; padding:4pt 8pt; font-size:9pt;">`
    + `<p style="margin:0; line-height:1.25;"><b style="color:${COLOR.navy};">도움말</b>&nbsp;&nbsp;${inlineHtml(hint)}</p></td></tr></table>`;
}

export function renderWorksheetHtml(input: WorksheetInput): string {
  const subtitle = [input.grade ? `${input.grade}학년` : "", input.subject ?? "", input.unit ?? "", input.lesson ?? ""]
    .map((part) => part.trim()).filter(Boolean).join(" · ");
  const parts = [titleBox(input.title, subtitle || undefined)];
  if (input.studentInfo ?? true) parts.push(spacer(6), studentInfoStrip(input.grade));
  if (input.objective?.trim()) {
    parts.push(spacer(6));
    parts.push(`<table style="${TABLE}"><tr><td style="background:${COLOR.note}; border-left:3pt solid ${COLOR.navy}; border-top:none; border-right:none; border-bottom:none; padding:6pt 9pt;">`
      + `<p style="margin:0; line-height:1.25;"><b style="color:${COLOR.navy};">학습 목표</b>&nbsp;&nbsp;${inlineHtml(input.objective.trim())}</p></td></tr></table>`);
  }

  let number = 0;
  for (const section of input.sections) {
    if (section.tag?.trim()) parts.push(sectionTag(section.tag.trim()));
    else parts.push(spacer(8));
    if (section.prompt?.trim()) {
      number += 1;
      parts.push(promptLine(number, section.prompt.trim()));
    }
    if (section.kind === "write") {
      const boxes = section.boxes?.length ? section.boxes : [{ lines: 3 }];
      boxes.forEach((box, index) => {
        if (index > 0) parts.push(spacer(4));
        parts.push(answerBox(box.lines, box.label));
      });
    } else if (section.kind === "table") {
      parts.push(fillTable(section));
    } else if (section.kind === "checklist") {
      parts.push(checklistTable(section.items ?? [], section.scale?.length ? section.scale : ["매우 잘함", "잘함", "보통"]));
    } else if (section.kind === "box") {
      parts.push(`<table style="${TABLE}"><tr><td style="border:${FRAME}; padding:4pt 8pt;">${Array.from({ length: Math.max(2, Math.min(section.lines ?? 8, 30)) }, () => WRITE_LINE).join("")}</td></tr></table>`);
    } else if (section.text?.trim()) {
      parts.push(markdownToHtml(section.text));
    }
    if (section.hint?.trim()) parts.push(spacer(4), hintBox(section.hint.trim()));
  }
  return htmlDocument(parts.join(""));
}
