import {polishSample} from "./quality-samples.js";
import {elementarySample} from "./elementary-examples.js";
import { designSchema } from "./design-schema.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const templateIds = ["lesson-package", "lesson-plan", "worksheet", "quiz", "slides", "notice", "minutes", "event-plan", "tracker", "report", "study-notes", "travel-plan"] as const;
export const templates = [
  { id: "lesson-package", category: "수업", title: "한 차시 수업 꾸러미", description: "수업안부터 학습지, 발표 자료와 퀴즈까지.", icon: "✦", outputs: "Docs · Slides · Forms", prompt: "5학년 과학 ‘소화와 순환’ 40분 수업. 모둠 탐구와 정리 퀴즈 5문항을 포함해 주세요." },
  { id: "lesson-plan", category: "수업", title: "교수·학습 과정안", description: "도입, 전개, 정리의 흐름이 보이는 수업안.", icon: "▤", outputs: "Docs · HWPX", prompt: "5학년 국어 토의 수업 40분. 의견과 근거를 구분하는 활동을 설계해 주세요." },
  { id: "worksheet", category: "수업", title: "학생용 학습지", description: "질문과 충분한 답안 공간을 갖춘 활동지.", icon: "▧", outputs: "Docs · HWPX", prompt: "5학년 사회 ‘우리 지역의 문화유산’ 모둠 조사 학습지. 관찰, 비교, 생각 정리 활동을 넣어 주세요." },
  { id: "quiz", category: "수업", title: "형성평가 퀴즈", description: "정답과 배점을 확인하고 Google 설문지로.", icon: "✓", outputs: "Forms", prompt: "5학년 과학 ‘소화와 순환’ 객관식 5문항. 오개념을 확인할 수 있게 만들어 주세요." },
  { id: "slides", category: "업무", title: "발표 자료", description: "수업, 팀 발표, 스터디를 위한 슬라이드.", icon: "▰", outputs: "Slides", prompt: "처음 만난 팀을 위한 Google 도구 협업 가이드 5장. Drive, Docs, Sheets 활용 사례와 첫 협업 체크리스트를 넣어 주세요." },
  { id: "notice", category: "업무", title: "가정통신문 초안", description: "일정과 준비물이 명확한 따뜻한 안내문.", icon: "↗", outputs: "Docs · HWPX", prompt: "현장체험학습 안내문. 일시·장소·준비물·참가 신청은 빈칸으로 남기고 안전 수칙을 포함해 주세요." },
  { id: "minutes", category: "업무", title: "회의록 정리", description: "논의, 결정, 다음 할 일이 명확한 회의록.", icon: "≡", outputs: "Docs · HWPX", prompt: "팀 프로젝트 시작 회의록. 안건, 논의 내용, 결정 사항, 후속 업무와 기한을 구분해 주세요. 확인되지 않은 내용은 빈칸으로 남겨 주세요." },
  { id: "event-plan", category: "업무", title: "행사 운영 계획", description: "목적, 일정, 역할과 점검표를 한 문서에.", icon: "◇", outputs: "Docs · HWPX", prompt: "학교 독서 행사 운영 계획서. 목적, 일정, 업무 분담, 준비물, 안전 점검과 평가 방법을 포함해 주세요." },
  { id: "tracker", category: "업무", title: "프로젝트 관리 시트", description: "함께 할 일과 진행 상황을 한눈에.", icon: "▦", outputs: "Sheets", prompt: "4주 동안 작은 독서 모임을 준비하는 프로젝트 관리표. 업무, 담당 역할, 기한, 진행 상태, 비고 열과 업무 예시 6개를 넣어 주세요." },
  { id: "report", category: "업무", title: "기획서·보고서", description: "아이디어를 실행 가능한 문서로 정리해요.", icon: "▤", outputs: "Docs · HWPX", prompt: "누구나 참여하는 주말 독서 모임 기획서. 목적, 참여 대상, 4주 일정, 역할, 준비물과 성과 확인 방법을 정리해 주세요." },
  { id: "study-notes", category: "학습", title: "스터디·독서 노트", description: "읽고 배운 내용을 나의 언어로 정리해요.", icon: "▤", outputs: "Docs · HWPX", prompt: "비문학 독서 스터디용 노트. 핵심 주장, 근거, 나의 질문, 토의 주제, 실천할 일을 기록할 수 있게 만들어 주세요." },
  { id: "travel-plan", category: "일상", title: "여행·모임 계획", description: "일정부터 준비물까지 함께 준비해요.", icon: "▤", outputs: "Docs · HWPX", prompt: "친구들과 떠나는 1박 2일 여행 계획서. 시간대별 일정, 예산, 준비물과 역할을 정리하고 미확정 장소·금액은 빈칸으로 남겨 주세요." }
];
const short = z.string().trim().max(500);
export const draftSchema = z.object({
  title: z.string().trim().min(1).max(200), summary: short,
  objective: short, markdown: z.string().max(40_000),
  steps: z.array(z.object({ stage: short, process: short, activities: z.array(short).max(8), minutes: z.number().int().min(0).max(180) })).max(15),
  activities: z.array(z.object({ title: short, prompt: short, lines: z.number().int().min(1).max(12) })).max(15),
  slides: z.array(z.object({ title: short, body: z.string().max(2000) })).max(20),
  questions: z.array(z.object({ title: short, choices: z.array(short).min(2).max(6), correctAnswer: short, explanation: z.string().max(1000).default(""), points: z.number().int().min(1).max(100) })).max(30),
  columns: z.array(short).max(20), rows: z.array(z.array(short).max(20)).max(200)
}).strict();
export type Draft = z.infer<typeof draftSchema>;
export const documentDraftSchema = draftSchema.extend({ markdown: z.string().max(200000) });
// Keep the provider schema portable; the full size/range checks run in Zod on return.
function portableSchema(value: unknown): any {
  if (Array.isArray(value)) return value.map(portableSchema);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !["$schema", "minLength", "maxLength", "minimum", "maximum", "minItems", "maxItems"].includes(key)).map(([key, v]) => [key, portableSchema(v)]));
  return value;
}
export const draftJsonSchema = portableSchema(zodToJsonSchema(draftSchema, { target: "openAi", $refStrategy: "none" }));
export const requestSchema = z.object({
  template: z.enum(templateIds), prompt: z.string().trim().min(3).max(10_000),
  grade: z.number().int().min(1).max(6).default(5), subject: z.string().trim().min(1).max(20).default("과학"),
  standardCodes: z.array(z.string().max(30)).max(10).default([]),
  design: designSchema,
  audience: z.string().trim().max(100).default("누구나"),
  provider: z.enum(["gemini", "openai"]).default("gemini"),
  noPersonalData: z.literal(true), previous: draftSchema.optional()
});
export type DraftRequest = z.infer<typeof requestSchema>;
export function validateDraft(draft: Draft, template: string): Draft {
  (template === "conversion" ? documentDraftSchema : draftSchema).parse(draft);
  for (const q of draft.questions) {
    if (!q.title || q.choices.some(x => !x) || new Set(q.choices).size !== q.choices.length || !q.choices.includes(q.correctAnswer)) throw new Error("퀴즈의 정답과 보기를 확인해 주세요.");
  }
  if (["lesson-package", "lesson-plan"].includes(template) && (!draft.steps.length || !draft.objective)) throw new Error("학습 목표와 수업 단계가 필요합니다.");
  if (["lesson-package", "worksheet"].includes(template) && !draft.activities.length) throw new Error("학습지 활동이 필요합니다.");
  if (["lesson-package", "slides"].includes(template) && !draft.slides.length) throw new Error("슬라이드가 필요합니다.");
  if (["lesson-package", "quiz"].includes(template) && !draft.questions.length) throw new Error("퀴즈 문항이 필요합니다.");
  if (["notice", "minutes", "event-plan", "conversion", "report", "study-notes", "travel-plan"].includes(template) && !draft.markdown.trim()) throw new Error("문서 본문이 필요합니다.");
  if (template === "tracker" && (!draft.columns.length || draft.rows.some(r => r.length !== draft.columns.length))) throw new Error("시트의 열과 행을 확인해 주세요.");
  return draft;
}

export function sampleDraft(template: string): Draft {
  const elementary=elementarySample(template);if(elementary)return elementary;
  const t = templates.find(x => x.id === template) ?? templates[0];
  const d: Draft = { title:t.title, summary:t.description, objective:'', markdown:'', steps:[], activities:[], slides:[], questions:[], columns:[], rows:[] };
  if (t.category === "업무") {
    d.title = t.title.replace(" 초안", ""); d.summary = "필요한 내용을 직접 채워 사용할 수 있는 업무 예시입니다.";
    d.markdown = template === "notice" ? "## 현장체험학습 안내\n학부모님 안녕하세요. 학생들이 배움을 넓히는 현장체험학습을 준비하고 있습니다.\n\n| 구분 | 내용 |\n| --- | --- |\n| 일시 | [일시 입력] |\n| 장소 | [장소 입력] |\n| 준비물 | [준비물 입력] |\n\n## 안전 수칙\n- 이동할 때는 인솔 교사의 안내를 따릅니다.\n- 모둠 친구들과 함께 활동합니다.\n\n## 참가 신청\n[신청 방법과 기한 입력]" : template === "minutes" ? "## 회의 개요\n- 일시: [입력]\n- 장소: [입력]\n- 참석: [입력]\n\n## 논의 내용\n[실제 논의 내용을 입력해 주세요.]\n\n## 결정 사항\n[확정된 내용만 작성해 주세요.]\n\n| 후속 업무 | 담당 | 기한 |\n| --- | --- | --- |\n| [입력] | [입력] | [입력] |" : "## 운영 목적\n함께 참여하며 소통하는 학교 행사를 운영합니다.\n\n## 운영 일정\n[행사 일시와 장소 입력]\n\n| 단계 | 할 일 |\n| --- | --- |\n| 준비 | 계획 협의와 역할 분담 |\n| 운영 | 참가 안내와 활동 진행 |\n| 정리 | 결과 공유와 개선점 기록 |\n\n## 안전 점검\n- 장소와 이동 동선을 미리 확인합니다.\n- 비상 연락 및 대응 절차를 공유합니다.";
  }
  const examples: Record<string, { title: string; summary: string; markdown: string }> = {
    report: { title: "작은 독서 모임, 함께 시작하기", summary: "주말 60분, 한 권의 책으로 연결되는 4주 프로젝트", markdown: "## 1. 제안 배경\n혼자 읽기 어려웠던 책을 함께 읽고, 서로의 시선으로 생각을 넓힙니다. 아래 내용은 실행 방식을 보여주는 가상 예시입니다.\n\n## 2. 운영 방식\n- 대상: 독서 습관을 만들고 싶은 누구나\n- 규모: 4~6명\n- 시간: 주 1회, 60분\n- 장소·도서: 참가자 의견을 모아 확정\n\n## 3. 4주 로드맵\n| 주차 | 할 일 | 결과물 |\n| --- | --- | --- |\n| 1주 | 관심 주제 공유, 도서 선정 | 공동 독서 계획 |\n| 2주 | 인상 깊은 문장과 질문 나누기 | 질문 모음 |\n| 3주 | 다른 관점으로 토론하기 | 토의 노트 |\n| 4주 | 삶에 적용할 행동 정하기 | 실천 카드 |\n\n## 4. 역할과 준비물\n진행자는 질문을 준비하고 기록자는 Docs에 대화를 정리합니다. 역할은 매주 바꿉니다. 각자 책과 메모 도구를 준비합니다.\n\n## 5. 돌아보기\n모임 후 ‘새롭게 알게 된 것’, ‘다음에 바꿀 것’을 한 가지씩 남깁니다." },
    "study-notes": { title: "읽고, 질문하고, 연결하는 독서 노트", summary: "비문학 한 편을 깊이 읽는 30분 루틴", markdown: "## 읽기 전 · 5분\n제목과 목차를 살펴보고 궁금한 점을 세 가지 적습니다.\n\n## 읽는 중 · 15분\n| 기록할 것 | 나의 메모 |\n| --- | --- |\n| 저자의 핵심 주장 | [한 문장으로 정리] |\n| 주장을 뒷받침하는 근거 | [본문 위치와 함께 기록] |\n| 동의하거나 다른 생각이 드는 부분 | [이유 기록] |\n| 새로 알게 된 개념 | [나의 언어로 설명] |\n\n## 읽은 후 · 10분\n1. 다른 사람에게 이 글을 설명한다면 무엇부터 말할까요?\n2. 내가 아는 경험과 연결되는 부분은 무엇인가요?\n3. 더 확인해야 할 사실은 무엇인가요?\n\n## 스터디에서 나눌 질문\n[정답이 하나로 정해지지 않는 질문을 만들어 보세요.]\n\n## 이번 주의 작은 실천\n[읽은 내용을 바탕으로 시도할 행동 한 가지]" },
    "travel-plan": { title: "함께 만드는 1박 2일 여행", summary: "일정·예산·준비물을 나누는 여행 플래너", markdown: "## 여행 개요\n- 날짜: [함께 정하기]\n- 목적지: [후보 2~3곳 비교 후 결정]\n- 이동 방법: [대중교통 / 자가용]\n\n## 1일 차\n| 시간대 | 활동 | 확인할 것 |\n| --- | --- | --- |\n| 오전 | 출발과 이동 | 집합 장소, 승차권 |\n| 점심 | 현지 식사 | 식이 제한, 예약 |\n| 오후 | 산책 또는 전시 관람 | 운영 시간, 날씨 |\n| 저녁 | 숙소 체크인과 대화 | 체크인 시간, 준비물 |\n\n## 2일 차\n아침 식사 → 주변 산책 → 점심 → 귀가. 이동 사이에 30분 정도 여유를 둡니다.\n\n## 공동 예산\n| 항목 | 예상 비용 | 정산 방식 |\n| --- | --- | --- |\n| 교통 | [입력] | 각자 / 공동 |\n| 숙박 | [입력] | 인원수로 나누기 |\n| 식비·활동 | [입력] | 영수증 모아 정산 |\n\n## 출발 전 체크\n- 예약 취소 조건 확인\n- 날씨와 이동 경로 확인\n- 충전기, 개인 상비용품, 신분증 준비\n- 예약 담당과 정산 담당 정하기" },
    minutes: { title: "독서 모임 준비 회의록", summary: "결정 사항과 다음 할 일이 남는 회의 예시", markdown: "## 회의 개요\n가상 예시 · 첫 독서 모임의 운영 방식을 정하는 회의입니다. 실제 일정과 참가자 정보로 바꿔 사용하세요.\n\n## 주요 논의\n- 긴 완독 과제보다 매주 짧은 분량을 읽기로 제안했습니다.\n- 평일 저녁과 주말 오전 중 참여하기 편한 시간을 확인하기로 했습니다.\n\n## 결정 사항\n1. 첫 모임은 60분으로 진행합니다.\n2. 도서는 참가자 추천을 모아 투표로 정합니다.\n3. 질문과 기록은 공동 Docs 문서에 남깁니다.\n\n## 다음 할 일\n| 할 일 | 담당 역할 | 기한 |\n| --- | --- | --- |\n| 가능 시간 조사 | 진행 담당 | 모임 7일 전 |\n| 추천 도서 취합 | 자료 담당 | 모임 5일 전 |\n| 회의 링크와 기록 문서 준비 | 기록 담당 | 모임 2일 전 |\n\n## 다음 회의 안건\n선정 도서와 첫 모임 질문 확정" }
  };
  if (examples[template]) Object.assign(d, examples[template]);
  if (template === "tracker") { d.title = "독서 모임 오픈 프로젝트"; d.summary = "4주 준비 과정을 함께 관리하는 실행 시트"; d.columns = ["할 일", "담당 역할", "기한", "상태", "결과물"]; d.rows = [["관심 주제 모으기","기획","1주 차","완료","주제 후보 3개"],["참여 가능 시간 조사","운영","1주 차","진행 중","선호 시간대"],["함께 읽을 책 선정","자료","2주 차","예정","선정 도서 1권"],["모임 공간과 링크 준비","운영","2주 차","예정","참여 안내"],["첫 토의 질문 작성","진행","3주 차","예정","질문 5개"],["첫 모임과 회고","전체","4주 차","예정","회고 노트"]]; }
  if (template === "slides") { d.title = "우리 팀의 첫 Google 협업"; d.summary = "파일 찾는 시간을 줄이고 함께 만드는 시간을 늘리는 5장 가이드"; d.slides = [{title:"함께 만드는 일, 더 간단하게",body:"우리 팀의 Google 협업 가이드\n파일을 모으고 → 함께 쓰고 → 진행 상황을 공유합니다."},{title:"Drive · 자료가 모이는 한 곳",body:"프로젝트별 폴더를 만들고 최종 자료의 위치를 정합니다.\n예: 01_기획 / 02_작업 / 03_완성\n파일명에 날짜와 버전 규칙을 정해 보세요."},{title:"Docs · 대화가 남는 문서",body:"회의 전 안건을 적고, 회의 중 함께 기록합니다.\n검토할 부분에는 댓글로 질문을 남깁니다.\n끝에는 결정 사항과 다음 할 일을 정리합니다."},{title:"Sheets · 진행 상황을 한눈에",body:"할 일, 담당 역할, 기한, 상태를 한 행에 모읍니다.\n매주 진행 상태를 함께 업데이트합니다.\n일이 멈췄다면 도움이 필요한 지점을 기록합니다."},{title:"오늘 시작할 작은 약속",body:"① 공동 폴더 하나 만들기\n② 첫 회의록 함께 작성하기\n③ 할 일 세 가지와 담당 정하기\n공유 전 접근 권한을 확인하세요."}]; }
  return polishSample(d,template);
}

export function draftMarkdown(d: Draft, template: string): string {
  if (["lesson-package", "lesson-plan"].includes(template)) return `# ${d.title}\n\n## 학습 목표\n${d.objective}\n\n` + d.steps.map(s => `## ${s.stage} · ${s.process} (${s.minutes}분)\n${s.activities.map(a => "- " + a).join("\n")}`).join("\n\n");
  if (template === "worksheet") return `# ${d.title}\n\n학년: ____ 반: ____ 이름: __________\n\n${d.objective}\n\n` + d.activities.map((a,i) => `## ${i+1}. ${a.title}\n${a.prompt}\n\n${Array(a.lines).fill("________________________________________").join("\n\n")}`).join("\n\n");
  if (template === "slides") return d.slides.map(s => `# ${s.title}\n\n${s.body}`).join("\n\n---\n\n");
  if (template === "quiz") return `# ${d.title}\n\n` + d.questions.map((q,i) => `## ${i+1}. ${q.title} (${q.points}점)\n${q.choices.map((c,j) => `${j+1}. ${c}`).join("\n")}\n\n정답: ${q.correctAnswer}`).join("\n\n");
  if (template === "tracker") return `# ${d.title}\n\n| ${d.columns.join(" | ")} |\n| ${d.columns.map(() => "---").join(" | ")} |\n` + d.rows.map(r => `| ${r.join(" | ")} |`).join("\n");
  return `# ${d.title}\n\n${d.markdown}`;
}
