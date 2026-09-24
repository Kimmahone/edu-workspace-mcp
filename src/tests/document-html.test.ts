import assert from "node:assert/strict";
import test from "node:test";
import type { docs_v1 } from "googleapis";
import { markdownToHtml, renderDocumentHtml, renderLessonPlanHtml, renderWorksheetHtml, type LessonPlanInput } from "../google/document-html.js";
import { SESSION_HEADING, printLayoutRequests } from "../google/docs.js";

const textOf = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");

test("사용자 문자열은 escape 한 뒤에만 굵게를 해석한다", () => {
  const html = markdownToHtml("<script>alert(1)</script> & **굵게** <b>꾸밈</b>");
  assert.doesNotMatch(html, /<script>|<b>꾸밈/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; <b>굵게<\/b> &lt;b&gt;꾸밈&lt;\/b&gt;/);
});

test("본문 서식: 소제목·중첩 글머리·번호·표·참고 상자, 빈 줄은 빈 문단을 만들지 않는다", () => {
  const html = markdownToHtml([
    "## 도입(5분)", "- 경험 떠올리기", "  - 모둠에서 이야기하기", "- 학습 문제 확인", "", "",
    "1. 첫째", "2. 둘째", "",
    "| 단계 | 시간 |", "|---|---|", "| 도입 | 5분 |", "",
    "> 합의점: 서로 조금씩 양보해 이루는 일치"
  ].join("\n"));
  assert.match(html, /<h3[^>]*>도입\(5분\)<\/h3>/);
  assert.match(html, /<ul[^>]*><li[^>]*>경험 떠올리기<ul[^>]*><li[^>]*>모둠에서 이야기하기<\/li><\/ul><\/li><li[^>]*>학습 문제 확인<\/li><\/ul>/);
  assert.match(html, /<ol[^>]*><li[^>]*>첫째<\/li><li[^>]*>둘째<\/li><\/ol>/);
  assert.match(html, /background:#1b3c61[^>]*>단계<\/td>/, "표 첫 줄은 머리행이 된다");
  assert.match(html, /<td[^>]*>도입<\/td><td[^>]*>5분<\/td>/);
  assert.match(html, /border-left:3pt solid #1b3c61[^>]*><p[^>]*>합의점: 서로/);
  assert.doesNotMatch(html, /<p[^>]*>\s*<\/p>/, "빈 줄이 빈 문단이 되면 안 됩니다");
});

test("일반 문서: 제목 상자, 성취기준 표와 작은 출처, 깨진 원문은 지어내지 않는다", () => {
  const html = renderDocumentHtml("고조선 수업안", [{ heading: "학습 목표", text: "- 유물로 생활을 추론한다." }], {
    subtitle: "5학년 사회",
    standards: [
      { code: "[6사04-01]", text: "선사 시대와 고조선의 유적과 유물을 활용하여 당시 사람들의 생활을 추론한다.", summary: "요지" },
      { code: "[2건01-01]", text: null, summary: "몸을 긍정적으로 인식하기" }
    ],
    standardsNote: "출처: NCIC"
  });
  assert.match(html, /font-family:'Noto Sans KR'/);
  assert.match(html, /border-top:2\.25pt solid #1b3c61[\s\S]*고조선 수업안[\s\S]*5학년 사회/);
  assert.match(html, />성취기준<\/td>/);
  assert.match(html, /<b>\[6사04-01\]<\/b> 선사 시대와/);
  assert.match(textOf(html), /\[2건01-01\] 원문 확인 필요 — 자동 추출이 깨져 요지만 싣습니다: 몸을 긍정적으로 인식하기/);
  assert.match(html, /font-size:8pt[^>]*>출처: NCIC/);
  assert.match(html, /<h2[^>]*>.*학습 목표<\/h2>/);
});

const plan: LessonPlanInput = {
  subject: "국어", grade: 5, unit: "4. 의견을 조정해요", lesson: "1. 의견을 조정하며 토의하기", textbookPages: "182~193쪽",
  objectives: ["의견을 조정하는 방법을 설명할 수 있다."],
  materials: ["교과서", "붙임딱지"],
  keyTerms: [{ term: "합의점", meaning: "서로 조금씩 양보해 이루는 일치" }],
  sessions: [
    { title: "토의 내용 읽기", pages: "182~185쪽", problem: "토의 내용을 읽어 봅시다.", steps: [
      { stage: "도입", process: "경험 떠올리기", activities: ["경험을 이야기한다."], minutes: 5, notes: ["※ 과정에 초점"] },
      { stage: "전개", process: "읽기", activities: ["역할을 나누어 읽는다.", "  사회자·민찬"], minutes: 15, notes: ["▣ 교과서 182쪽"] },
      { stage: "전개", process: "정리하기", activities: ["세 의견을 정리한다."], minutes: 15 },
      { stage: "정리", process: "나누기", activities: ["까닭을 이야기한다."], minutes: 5 }
    ] },
    { title: "방법 정리하기", steps: [{ stage: "도입", process: "떠올리기", activities: ["비교한다."], minutes: 5 }] }
  ],
  assessment: [{ element: "의견 조정", method: "관찰", high: "상 기준", middle: "중 기준", low: "하 기준" }],
  guidance: ["합의점은 양보해 만드는 것임을 강조한다."],
  standards: [{ code: "[6국01-06]", text: "토의에 협력적으로 참여하며 서로의 의견을 비교하고 조정한다.", summary: "" }],
  standardsNote: "출처: NCIC"
};

test("과정안: 기본 정보표·차시별 흐름·단계별 과정표·평가표를 갖춘다", () => {
  const html = renderLessonPlanHtml(plan);
  const text = textOf(html);
  assert.match(text, /국어과 교수·학습 과정안/);
  assert.match(text, /5학년 · 4\. 의견을 조정해요 · 1\. 의견을 조정하며 토의하기/);
  for (const label of ["교과", "차시", "단원", "교과서", "학습 주제", "성취기준", "학습 목표", "학습 자료"]) {
    assert.match(html, new RegExp(`>${label}</td>`), `${label} 칸이 있어야 합니다`);
  }
  assert.match(text, /국어 \(5학년\)/);
  assert.match(text, /2차시/, "차시를 비우면 차시 수로 채웁니다");
  assert.match(text, /차시별 흐름/);
  assert.match(text, /경험 떠올리기 → 읽기 → 정리하기 → 나누기/);
  assert.match(html, /학습 문제<\/b>&nbsp;&nbsp;<b>토의 내용을 읽어 봅시다\./);
  assert.match(html, /<td rowspan="2"[^>]*>전개<\/td>/, "이어진 같은 단계는 한 칸으로 합칩니다");
  assert.match(html, /<td rowspan="2"[^>]*>30′<\/td>/, "같은 단계의 시간은 합쳐 한 칸에 적습니다");
  assert.equal((html.match(/>전개<\/td>/g) ?? []).length, 1);
  assert.match(html, /<li[^>]*>역할을 나누어 읽는다\.<ul[^>]*><li[^>]*>사회자·민찬/);
  assert.match(html, />상<\/td><td[^>]*>중<\/td><td[^>]*>하<\/td>/);
  assert.match(text, /지도상 유의점/);
});

test("과정안의 차시 제목은 docs.ts 의 쪽 나눔 규칙과 맞물린다", () => {
  const headings = [...renderLessonPlanHtml(plan).matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((match) => textOf(match[1]).trim());
  const sessionHeadings = headings.filter((heading) => SESSION_HEADING.test(heading));
  assert.deepEqual(sessionHeadings.map((heading) => heading.replace(/\s*\(.*\)$/, "")), ["■ 1차시 · 토의 내용 읽기", "■ 2차시 · 방법 정리하기"]);
  assert.ok(headings.includes("■ 평가 계획") && !SESSION_HEADING.test("■ 평가 계획"));
  const single = renderLessonPlanHtml({ ...plan, sessions: [plan.sessions[0]] });
  assert.doesNotMatch(single, /차시별 흐름/);
  assert.match(textOf(single), /■ 교수·학습 과정 · 토의 내용 읽기/);
});

test("인쇄 설정: A4, 한글 글꼴 뒤 굵게 복원, 머리행 반복, 행 쪼개짐 방지, 차시 쪽 나눔", () => {
  const navy = { color: { rgbColor: { red: 0x1b / 255, green: 0x3c / 255, blue: 0x61 / 255 } } };
  const document: docs_v1.Schema$Document = { body: { content: [
    { startIndex: 0, endIndex: 1, sectionBreak: {} },
    { startIndex: 1, endIndex: 20, paragraph: { paragraphStyle: { namedStyleType: "HEADING_2" }, elements: [
      { startIndex: 1, endIndex: 20, textRun: { content: "■ 1차시 · 토의 읽기\n", textStyle: { bold: true } } }
    ] } },
    { startIndex: 20, endIndex: 60, table: { rows: 2, tableRows: [
      { tableCells: [{ tableCellStyle: { backgroundColor: navy }, content: [{ paragraph: { elements: [{ startIndex: 23, endIndex: 26, textRun: { content: "단계\n", textStyle: { bold: true } } }] } }] }] },
      { tableCells: [{ content: [{ paragraph: { elements: [{ startIndex: 28, endIndex: 31, textRun: { content: "도입\n", textStyle: {} } }] } }] }] }
    ] } },
    { startIndex: 60, endIndex: 70, table: { rows: 1, tableRows: [{ tableCells: [{ content: [] }] }] } },
    { startIndex: 70, endIndex: 80, paragraph: { paragraphStyle: { namedStyleType: "HEADING_2" }, elements: [
      { startIndex: 70, endIndex: 80, textRun: { content: "■ 평가 계획\n", textStyle: { bold: true } } }
    ] } },
    { startIndex: 80, endIndex: 81, paragraph: { elements: [{ startIndex: 80, endIndex: 81, textRun: { content: "\n" } }] } }
  ] } };
  const requests = printLayoutRequests(document, { pageBreakBefore: (text) => SESSION_HEADING.test(text) });
  assert.ok(requests.every((request) => !request.insertText && !request.deleteContentRange && !request.insertTable), "글자 위치를 바꾸는 요청이 없어야 한 번 읽은 위치를 그대로 쓸 수 있습니다");
  assert.equal(requests[0].updateDocumentStyle?.documentStyle?.pageSize?.width?.magnitude, 595.28);
  const fontIndex = requests.findIndex((request) => request.updateTextStyle?.textStyle?.weightedFontFamily?.fontFamily === "Noto Sans KR");
  assert.deepEqual(requests[fontIndex].updateTextStyle?.range, { startIndex: 1, endIndex: 80 });
  const boldRanges = requests.slice(fontIndex + 1).filter((request) => request.updateTextStyle?.textStyle?.bold).map((request) => request.updateTextStyle?.range);
  assert.deepEqual(boldRanges, [{ startIndex: 1, endIndex: 20 }, { startIndex: 23, endIndex: 26 }, { startIndex: 70, endIndex: 80 }], "글꼴을 바꾼 뒤 원래 굵던 글자에 굵게를 다시 입힙니다");
  assert.deepEqual(requests.filter((request) => request.pinTableHeaderRows).map((request) => request.pinTableHeaderRows?.tableStartLocation?.index), [20], "머리행 색이 있는 표만 머리행을 반복합니다");
  assert.equal(requests.filter((request) => request.updateTableRowStyle?.tableRowStyle?.preventOverflow).length, 2);
  const headingStyles = requests.filter((request) => request.updateParagraphStyle).map((request) => request.updateParagraphStyle?.paragraphStyle);
  assert.deepEqual(headingStyles, [{ keepWithNext: true, pageBreakBefore: true }, { keepWithNext: true }]);
});

test("학습지: 이름 칸, 학습 목표, 이름표 달린 줄 칸, 행 이름 있는 빈 표, ○ 점검표, 도움말", () => {
  const html = renderWorksheetHtml({
    title: "의견을 조정하며 토의하기 활동지", grade: 5, subject: "국어", unit: "4. 의견을 조정해요", lesson: "3차시",
    objective: "의견을 조정할 수 있다.",
    sections: [
      { kind: "write", tag: "의견 마련하기", prompt: "의견과 그 이유를 써 봅시다.", boxes: [{ label: "의견", lines: 2 }, { label: "그 이유", lines: 3 }], hint: "이유를 구체적으로" },
      { kind: "table", prompt: "평가해 봅시다.", columns: ["검토 기준", "내 의견", "친구 의견"], rows: ["실천할 수 있는가?", "효과적인가?"], lines: 1 },
      { kind: "table", columns: ["이름", "장점", "단점"], blankRows: 3 },
      { kind: "checklist", prompt: "점검해 봅시다.", items: ["주제를 정했나요?", "존중하며 참여했나요?"] },
      { kind: "box", prompt: "마인드맵을 그려 봅시다.", lines: 6 }
    ]
  });
  const text = textOf(html);
  assert.match(text, /5학년 · 국어 · 4\. 의견을 조정해요 · 3차시/);
  assert.match(html, />학년·반·번호<\/td>/);
  assert.match(text, /5학년\s+반\s+번/);
  assert.match(html, /학습 목표<\/b>&nbsp;&nbsp;의견을 조정할 수 있다\./);
  assert.match(html, /background-color:#1b3c61[^>]*>&nbsp;의견 마련하기&nbsp;/, "활동 이름표");
  assert.deepEqual([...html.matchAll(/<h3[^>]*><b[^>]*>(\d+)\.<\/b>/g)].map((match) => match[1]), ["1", "2", "3", "4"], "물음만 번호가 붙습니다");
  assert.match(html, /<td rowspan="2"[^>]*>의견<\/td>/);
  assert.match(html, /<td rowspan="3"[^>]*>그 이유<\/td>/);
  assert.match(html, />실천할 수 있는가\?<\/td>(<td[^>]*><p[^>]*>&nbsp;<\/p><\/td>){2}<\/tr>/, "행 이름 옆은 빈 칸");
  assert.equal((html.match(/<tr><td style="border:0\.75pt solid #9aa9b8; padding:4pt 6pt; vertical-align:top;">/g) ?? []).length >= 3, true);
  assert.equal((html.match(/>○<\/td>/g) ?? []).length, 6, "두 문항 × 기본 척도 세 칸");
  assert.match(html, />매우 잘함<\/td>[\s\S]*>잘함<\/td>[\s\S]*>보통<\/td>/);
  assert.match(html, /도움말<\/b>&nbsp;&nbsp;이유를 구체적으로/);
  const noInfo = renderWorksheetHtml({ title: "t", studentInfo: false, sections: [{ kind: "text", text: "- 안내" }] });
  assert.doesNotMatch(noInfo, /학년·반·번호/);
});
