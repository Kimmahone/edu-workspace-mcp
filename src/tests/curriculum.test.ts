import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import {
  StandardCodeError, appendStandardsDescription, getStandards, loadCurriculum, normalizeStandardCode,
  resolveStandardCodes, searchStandards, standardsDescription, standardsSummary, toDocumentStandards
} from "../curriculum/standards.js";

const { dataset } = loadCurriculum();
const byCode = (code: string) => dataset.standards.find((standard) => standard.code === code);

test("정리본은 원천 패키지의 성취기준 620개를 빠짐없이 담는다", () => {
  assert.equal(dataset.standards.length, 620);
  assert.equal(new Set(dataset.standards.map((standard) => standard.code)).size, 620);
  assert.ok(dataset.standards.every((standard) => /^\[\d[가-힣]\d{2}-\d{2}\]$/.test(standard.code)));
  assert.ok(dataset.standards.every((standard) => standard.domain && standard.summary && standard.sourceUrl.startsWith("https://")));
  const { extracted, cleaned, unavailable, total } = dataset.counts;
  assert.equal(extracted + cleaned + unavailable, total);
});

test("정리본은 설치된 원천 패키지 버전에서 만든 것이다 — 원천을 올리면 npm run curriculum:build", () => {
  const require = createRequire(import.meta.url);
  const upstream = JSON.parse(readFileSync(require.resolve("korean-elementary-learning-map-mcp/package.json"), "utf8")) as { version: string };
  assert.equal(dataset.upstream.version, upstream.version);
});

test("싣는 원문은 모두 한 문장이고 표·탐구 활동·해설 조각이 섞이지 않는다", () => {
  for (const standard of dataset.standards.filter((candidate) => candidate.text)) {
    const text = standard.text ?? "";
    assert.match(text, /다\.$/, `${standard.code} 은 문장으로 끝나야 합니다`);
    assert.equal(text.match(/다\.(\s|$)/g)?.length, 1, `${standard.code} 에 다음 단원 제목이 붙어 있습니다`);
    assert.doesNotMatch(text, /[∙•]|<탐구 활동>/, `${standard.code} 에 표나 탐구 활동이 섞였습니다`);
    assert.doesNotMatch(text, /^(은|는|의|에서)\s/, `${standard.code} 은 해설 조각입니다`);
  }
});

test("깨진 원문은 고치거나 막는다 — 실제로 깨져 있던 항목으로 확인", () => {
  // 뒤에 다음 단원 제목이 붙어 있던 항목
  assert.equal(byCode("[6수01-01]")?.text, "덧셈, 뺄셈, 곱셈, 나눗셈의 혼합 계산에서 계산하는 순서를 알고, 혼합 계산을 할 수 있다.");
  // 탐구 활동 목록과 "공 유할" 띄어쓰기
  assert.equal(byCode("[6과03-03]")?.text, "일상생활에서 용액이 쓰이는 사례를 조사하여 용액의 필요성을 알리는 자료를 만들고 공유할 수 있다.");
  assert.match(byCode("[4수03-10]")?.text ?? "", /평행사변형/);
  assert.match(byCode("[6미03-02]")?.text ?? "", /원리 등\)을 분석하여/);
  // 표가 섞여 그럴듯하게 틀린 문장이 남던 항목과 해설 문단이 들어간 항목은 싣지 않는다
  for (const code of ["[2건01-01]", "[2건01-02]", "[4사01-01]", "[6사10-02]"]) {
    assert.equal(byCode(code)?.text, null, `${code} 은 원문 확인 필요여야 합니다`);
    assert.equal(byCode(code)?.textStatus, "unavailable");
  }
  // 깨지지 않은 항목은 그대로 둔다
  assert.equal(byCode("[6사04-01]")?.text, "선사 시대와 고조선의 유적과 유물을 활용하여 당시 사람들의 생활을 추론한다.");
  assert.equal(byCode("[6사04-01]")?.textStatus, "extracted");
});

test("코드 표기가 달라도 같은 성취기준을 찾는다", () => {
  assert.equal(normalizeStandardCode("6사04-01"), "[6사04-01]");
  assert.equal(normalizeStandardCode(" [6사 04-01] "), "[6사04-01]");
  assert.equal(normalizeStandardCode("［6사04-01］"), "[6사04-01]");
  assert.equal(getStandards(["6사04-01", "[6사04-01]"]).standards.length, 1);
});

test("교과·학년·낱말로 찾는다", () => {
  const result = searchStandards({ subject: "사회", grade: 5, query: "유적 유물" });
  assert.ok(result.standards.some((standard) => standard.code === "[6사04-01]"));
  assert.ok(result.standards.every((standard) => standard.subject === "사회" && standard.gradeBand === "5-6"));
  assert.equal(searchStandards({ subject: "수학", limit: 3 }).returned, 3);
  assert.equal(searchStandards({ subject: "수학", limit: 3 }).total, 121);
});

test("없는 코드는 비슷한 코드를 제안하고, 생성 도구용 확인은 멈춘다", () => {
  const { notFound } = getStandards(["[6사04-99]"]);
  assert.equal(notFound[0].code, "[6사04-99]");
  assert.ok(notFound[0].suggestions.includes("[6사04-01]"));
  assert.throws(() => resolveStandardCodes(["[6사04-01]", "[6사04-99]"]), StandardCodeError);
  assert.deepEqual(resolveStandardCodes(undefined), []);
});

test("문서에는 원문을, 깨진 항목에는 요지와 확인 안내를 넘긴다", () => {
  const standards = resolveStandardCodes(["[6사04-01]", "[2건01-01]"]);
  const forDocument = toDocumentStandards(standards);
  assert.deepEqual(Object.keys(forDocument[0]).sort(), ["code", "summary", "text"]);
  assert.equal(forDocument[1].text, null);
  const description = standardsDescription(standards);
  assert.match(description, /\[6사04-01\] 선사 시대와 고조선의/);
  assert.match(description, /\[2건01-01\] \(원문 확인 필요/);
  assert.match(appendStandardsDescription("5문항 퀴즈입니다.", standards) ?? "", /^5문항 퀴즈입니다\.\n\n관련 성취기준/);
  assert.equal(appendStandardsDescription("그대로", []), "그대로");
  assert.deepEqual(standardsSummary(standards).standards.map((standard) => standard.textStatus), ["extracted", "unavailable"]);
  assert.match(standardsSummary(standards).warnings?.[0] ?? "", /\[2건01-01\]/);
});
