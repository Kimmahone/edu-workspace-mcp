import { readFileSync } from "node:fs";
import type { DocumentStandard } from "../google/document-html.js";

// 초등 2022 개정 교육과정 성취기준. 원천은 korean-elementary-learning-map-mcp 이고,
// scripts/build-curriculum-data.mjs 가 깨진 원문을 정리·검사해 data/curriculum/ 에 둔다.
// 네트워크를 쓰지 않으며 Google 인증과도 무관하다.

export const CURRICULUM_SUBJECTS = [
  "국어", "수학", "과학", "사회", "영어", "도덕", "실과", "미술", "음악", "체육",
  "바른 생활", "슬기로운 생활", "즐거운 생활", "건강한 생활"
] as const;
export type CurriculumSubject = typeof CURRICULUM_SUBJECTS[number];

export const GRADE_BANDS = ["1-2", "3-4", "5-6"] as const;
export type GradeBand = typeof GRADE_BANDS[number];

export type CurriculumStandard = {
  code: string;
  subject: CurriculumSubject;
  gradeBand: GradeBand;
  domain: string;
  summary: string;
  /** 정리·검사를 통과한 성취기준 문장. 통과하지 못하면 null — 지어내지 말고 원문 확인을 안내한다. */
  text: string | null;
  textStatus: "extracted" | "cleaned" | "unavailable";
  textNotes: string[];
  sourceUrl: string;
};

type CurriculumDataset = {
  dataset: string;
  upstream: { package: string; version: string; license: string; repository: string };
  textSource: string;
  textPolicy: string;
  counts: { total: number; extracted: number; cleaned: number; unavailable: number; spacingFixes: number };
  standards: CurriculumStandard[];
};

export const CURRICULUM_SOURCE_NOTE = "출처: 2022 개정 교육과정(교육부 고시 제2022-33호), 국가교육과정정보센터(NCIC) 공개 문서. "
  + "PDF에서 자동 추출·정리한 문장이므로 공식 문서로 쓰기 전에 원문과 대조하세요.";

const DATA_URL = new URL("../../data/curriculum/elementary-2022.json", import.meta.url);
let cached: { dataset: CurriculumDataset; byCode: Map<string, CurriculumStandard> } | undefined;

export function loadCurriculum() {
  if (!cached) {
    const dataset = JSON.parse(readFileSync(DATA_URL, "utf8")) as CurriculumDataset;
    cached = { dataset, byCode: new Map(dataset.standards.map((standard) => [standard.code, standard])) };
  }
  return cached;
}

export function curriculumInfo() {
  const { dataset } = loadCurriculum();
  return {
    dataset: dataset.dataset,
    upstream: dataset.upstream,
    textSource: dataset.textSource,
    textPolicy: dataset.textPolicy,
    counts: dataset.counts
  };
}

/** "6사04-01", "[6사 04-01]", "［6사04-01］" 을 모두 "[6사04-01]" 로 맞춘다. */
export function normalizeStandardCode(input: string): string {
  const compact = input.normalize("NFKC").replace(/\s+/g, "").replace(/^\[|\]$/g, "");
  return `[${compact}]`;
}

export function gradeBandOf(grade: number): GradeBand {
  if (grade <= 2) return "1-2";
  if (grade <= 4) return "3-4";
  return "5-6";
}

export type StandardSearchInput = {
  query?: string;
  subject?: CurriculumSubject;
  grade?: number;
  gradeBand?: GradeBand;
  limit?: number;
};

export function searchStandards(input: StandardSearchInput) {
  const { dataset } = loadCurriculum();
  const band = input.gradeBand ?? (input.grade ? gradeBandOf(input.grade) : undefined);
  const terms = (input.query ?? "").normalize("NFKC").toLocaleLowerCase("ko-KR").split(/\s+/).filter(Boolean);
  const matches = dataset.standards.filter((standard) => {
    if (input.subject && standard.subject !== input.subject) return false;
    if (band && standard.gradeBand !== band) return false;
    if (!terms.length) return true;
    const haystack = `${standard.code} ${standard.text ?? ""} ${standard.summary} ${standard.domain}`.toLocaleLowerCase("ko-KR");
    return terms.every((term) => haystack.includes(term));
  });
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));
  return {
    total: matches.length,
    returned: Math.min(matches.length, limit),
    standards: matches.slice(0, limit).map(({ code, subject, gradeBand, domain, text, textStatus, summary }) =>
      ({ code, subject, gradeBand, domain, text, textStatus, summary }))
  };
}

function suggestionsFor(code: string, standards: CurriculumStandard[]): string[] {
  // 같은 학년군·교과·영역(예: "[6사04-")부터, 없으면 같은 학년군·교과(예: "[6사")에서 고른다.
  for (const prefixLength of [6, 3]) {
    const prefix = code.slice(0, prefixLength);
    const found = standards.filter((standard) => standard.code.startsWith(prefix)).slice(0, 5).map((standard) => standard.code);
    if (found.length) return found;
  }
  return [];
}

export function getStandards(codes: string[]) {
  const { dataset, byCode } = loadCurriculum();
  const standards: CurriculumStandard[] = [];
  const notFound: Array<{ code: string; suggestions: string[] }> = [];
  for (const code of [...new Set(codes.map(normalizeStandardCode))]) {
    const standard = byCode.get(code);
    if (standard) standards.push(standard);
    else notFound.push({ code, suggestions: suggestionsFor(code, dataset.standards) });
  }
  return { standards, notFound };
}

export class StandardCodeError extends Error {}

/** 생성 도구용. 모르는 코드가 하나라도 있으면 Google 호출 전에 멈춘다(생성 도구는 비멱등이라 되돌릴 수 없다). */
export function resolveStandardCodes(codes: string[] | undefined): CurriculumStandard[] {
  if (!codes?.length) return [];
  const { standards, notFound } = getStandards(codes);
  if (notFound.length) {
    const detail = notFound
      .map(({ code, suggestions }) => suggestions.length ? `${code} (비슷한 코드: ${suggestions.join(", ")})` : code)
      .join("; ");
    throw new StandardCodeError(`초등 2022 개정 교육과정에 없는 성취기준 코드입니다: ${detail}. curriculum_search_standards로 코드를 확인하세요.`);
  }
  return standards;
}

export function standardLine(standard: CurriculumStandard): string {
  if (standard.text) return `${standard.code} ${standard.text}`;
  return `${standard.code} (원문 확인 필요 — 자동 추출이 깨져 싣지 않았습니다. 요지: ${standard.summary})`;
}

/** 문서 양식에 넘길 형태. 원문·요지만 넘기고, 출처 문구(CURRICULUM_SOURCE_NOTE)는 양식이 작게 붙인다. */
export function toDocumentStandards(standards: CurriculumStandard[]): DocumentStandard[] {
  return standards.map(({ code, text, summary }) => ({ code, text, summary }));
}

/** Forms·Classroom 설명처럼 학생도 보는 곳에는 짧게 붙인다. */
export function standardsDescription(standards: CurriculumStandard[]): string {
  return `관련 성취기준 (2022 개정 교육과정)\n${standards.map(standardLine).join("\n")}`;
}

export function appendStandardsDescription(description: string | undefined, standards: CurriculumStandard[]): string | undefined {
  if (!standards.length) return description;
  return [description?.trim(), standardsDescription(standards)].filter(Boolean).join("\n\n");
}

export function standardsSummary(standards: CurriculumStandard[]) {
  const unavailable = standards.filter((standard) => !standard.text).map((standard) => standard.code);
  return {
    standards: standards.map(({ code, textStatus }) => ({ code, textStatus })),
    ...(unavailable.length ? {
      warnings: [`${unavailable.join(", ")} 는 원문 자동 추출이 깨져 요지만 넣었습니다. NCIC 교육과정 원문을 확인해 채워 주세요.`]
    } : {})
  };
}
