// 초등 2022 개정 교육과정 성취기준 정리본을 만든다.
//
// 원천: korean-elementary-learning-map-mcp (devDependency, 버전 고정).
// 이 패키지의 성취기준 "원문"은 NCIC 공개 PDF에서 자동 추출한 것이라 일부가 깨져 있다.
// 교사 문서에 그대로 넣으면 잘못된 성취기준이 수업안에 남기 때문에, 여기서 정리하고
// 검사를 통과하지 못한 문장은 null 로 두어 "원문 확인 필요"로 표시되게 한다.
//
//   npm run curriculum:build
//
// 결과: data/curriculum/elementary-2022.json (저장소에 커밋하고 npm 패키지에 포함)
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UPSTREAM = "korean-elementary-learning-map-mcp";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const upstreamRoot = path.dirname(require.resolve(`${UPSTREAM}/package.json`));
const upstreamData = path.join(upstreamRoot, "data", "kr");
const outputPath = path.join(projectRoot, "data", "curriculum", "elementary-2022.json");

// 성취기준 코드의 교과 글자 → 교사가 쓰는 짧은 교과명.
// 원천의 교과명("실과(기술·가정)/정보", "통합교과")은 평가계획 드롭다운에 쓰기에 길거나 넓다.
const SUBJECT_BY_CODE_LETTER = {
  국: "국어", 수: "수학", 과: "과학", 사: "사회", 영: "영어", 도: "도덕", 실: "실과",
  미: "미술", 음: "음악", 체: "체육", 바: "바른 생활", 슬: "슬기로운 생활", 즐: "즐거운 생활", 건: "건강한 생활"
};

// PDF 줄바꿈 때문에 낱말 사이에 들어간 띄어쓰기. 0.5.1 원문을 한 줄씩 대조해 확인한 것만 둔다.
// 추측으로 넓히지 말 것 — "문제 해결", "생활 습관"처럼 원래 띄어 쓰는 말이 섞여 있다.
export const SPACING_FIXES = [
  ["파 악", "파악"], ["설 명", "설명"], ["공 유", "공유"], ["관 련", "관련"], ["실 천", "실천"],
  ["다 양", "다양"], ["용 액", "용액"], ["높 이는", "높이는"], ["합 리적", "합리적"], ["달라 짐", "달라짐"],
  ["진하 기", "진하기"], ["필요 성", "필요성"], ["평행 사변형", "평행사변형"], ["둔각 삼각형", "둔각삼각형"],
  ["용액 의", "용액의"], ["등) 을", "등)을"], ["말 할 수", "말할 수"], ["비교 할 수", "비교할 수"],
  ["공유 할 수", "공유할 수"], ["측정 할 수", "측정할 수"], ["비례배분 할 수", "비례배분할 수"],
  ["설명 한다.", "설명한다."], ["이해 한다.", "이해한다."], ["참여 한다.", "참여한다."], ["탐색 한다.", "탐색한다."],
  ["탐색 하여", "탐색하여"], ["인식 하여", "인식하여"], ["고안 하며", "고안하며"],
  ["체험 하면서", "체험하면서"], ["분립 하는", "분립하는"], ["구현 되는", "구현되는"], ["알아 보고", "알아보고"]
];

// 해설 문단이 잘려 들어온 경우 조사로 시작한다(예: "은 학생들의 생활이…").
const FRAGMENT_START = /^(은|는|이|가|을|를|의|에|에서|와|과|로|으로)\s/;

export function cleanStandardText(raw) {
  const notes = [];
  let text = String(raw ?? "").replace(/\s+/g, " ").trim();

  // "∙"(U+2219)는 교육과정 표의 내용 요소 기호다. 이것이 섞였다면 옆 칸 글자가 문장 사이에 끼어든 것이라
  // 첫 문장만 잘라 내도 "건강하고 안전한 생활 대가 된다."처럼 그럴듯하게 틀린 문장이 남는다. 통째로 막는다.
  if (text.includes("∙")) {
    return { text: null, status: "unavailable", notes: ["표 내용이 섞임"], spacingFixes: 0 };
  }

  const inquiry = text.indexOf("<탐구 활동>");
  if (inquiry >= 0) {
    text = text.slice(0, inquiry).trim();
    notes.push("탐구 활동 목록 제거");
  }

  // 성취기준은 한 문장이다. 첫 "…다." 뒤에 붙은 다음 단원 제목·쪽 번호를 잘라 낸다.
  const firstSentence = text.match(/^(.*?다\.)(\s|$)/);
  if (firstSentence && firstSentence[1].length < text.length) {
    text = firstSentence[1];
    notes.push("뒤에 붙은 제목·쪽 번호 제거");
  }

  let fixed = 0;
  for (const [from, to] of SPACING_FIXES) {
    if (text.includes(from)) {
      fixed += text.split(from).length - 1;
      text = text.replaceAll(from, to);
    }
  }
  if (fixed) notes.push(`띄어쓰기 ${fixed}곳 교정`);

  if (/다$/.test(text)) {
    text = `${text}.`;
    notes.push("마침표 보충");
  }

  const problems = [];
  if (text.includes("•")) problems.push("탐구 활동 목록이 섞임");
  if (FRAGMENT_START.test(text)) problems.push("해설 문단 조각");
  if (!/다\.$/.test(text)) problems.push("문장이 끝나지 않음");
  if (text.length < 15 || text.length > 220) problems.push("길이가 성취기준답지 않음");

  if (problems.length) return { text: null, status: "unavailable", notes: problems, spacingFixes: 0 };
  return { text, status: notes.length ? "cleaned" : "extracted", notes, spacingFixes: fixed };
}

async function readVerified(manifest, file) {
  const raw = await readFile(path.join(upstreamData, file));
  const expected = manifest.files?.[file]?.sha256;
  const actual = createHash("sha256").update(raw).digest("hex");
  if (!expected || expected !== actual) {
    throw new Error(`${file} 체크섬이 manifest 와 다릅니다. ${UPSTREAM} 을 다시 설치하세요.`);
  }
  return JSON.parse(raw.toString("utf8"));
}

async function build() {
  const upstreamPackage = JSON.parse(await readFile(path.join(upstreamRoot, "package.json"), "utf8"));
  const manifest = JSON.parse(await readFile(path.join(upstreamData, "manifest.json"), "utf8"));
  const { curricula, sources } = await readVerified(manifest, "curriculum-standards.json");
  const { texts } = await readVerified(manifest, "standard-texts.json");

  const sourceUrlById = new Map(sources.map((source) => [source.id, source.url]));
  const textByCode = new Map(texts.map((entry) => [entry.code, entry]));

  const standards = [];
  const counts = { total: 0, extracted: 0, cleaned: 0, unavailable: 0, spacingFixes: 0 };
  for (const curriculum of curricula) {
    for (const standard of curriculum.standards) {
      const letter = standard.code.match(/^\[\d(.)/)?.[1];
      const subject = SUBJECT_BY_CODE_LETTER[letter];
      if (!subject) throw new Error(`교과를 알 수 없는 성취기준 코드: ${standard.code}`);
      const entry = textByCode.get(standard.code);
      if (!entry) throw new Error(`원문 항목이 없는 성취기준: ${standard.code}`);
      const cleaned = cleanStandardText(entry.text);

      counts.total += 1;
      counts[cleaned.status] += 1;
      counts.spacingFixes += cleaned.spacingFixes;
      standards.push({
        code: standard.code,
        subject,
        gradeBand: standard.gradeBand,
        // 영어는 영역을 domainKorean 대신 officialAreaKorean(이해·표현)에 둔다.
        domain: standard.domainKorean ?? standard.officialAreaKorean ?? "",
        summary: standard.summary ?? "",
        text: cleaned.text,
        textStatus: cleaned.status,
        textNotes: cleaned.notes,
        sourceUrl: sourceUrlById.get(entry.sourceId) ?? "https://ncic.re.kr/inv/org/list.do"
      });
    }
  }

  standards.sort((a, b) => a.code.localeCompare(b.code, "ko-KR"));
  const output = {
    dataset: "초등 2022 개정 교육과정 성취기준 (edu-workspace-mcp 정리본)",
    upstream: {
      package: UPSTREAM,
      version: upstreamPackage.version,
      license: upstreamPackage.license,
      repository: "https://github.com/taehyeonglim/korean-elementary-learning-map-mcp"
    },
    textSource: "교육부 고시 제2022-33호(2026 일부 개정 포함) 교육과정 문서, 국가교육과정정보센터(NCIC) 공개 PDF. 저작권법 제24조의2(공공저작물의 자유이용)에 따라 출처를 표기해 이용합니다.",
    textPolicy: "PDF에서 자동 추출한 문장을 정리한 것입니다. 검사를 통과하지 못한 문장은 text 를 null 로 두며, 수업 문서에 쓰기 전 NCIC 원문과 대조하세요.",
    counts,
    standards
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 1)}\n`);
  console.log(`성취기준 ${counts.total}개 — 그대로 ${counts.extracted}, 정리 ${counts.cleaned}(띄어쓰기 ${counts.spacingFixes}곳), 원문 확인 필요 ${counts.unavailable}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
}
