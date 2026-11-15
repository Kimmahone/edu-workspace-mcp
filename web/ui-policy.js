// Shared display rules; never infer a successful provider call from key presence.
export function aiAvailability(status, provider) {
  if (status.access === 'public') return { generate: false, refine: false, reason: '이 공개 웹앱은 AI 생성을 제공하지 않습니다. 예시를 직접 편집해 주세요.' };
  if (status.mode === 'hosted' && !status.connected) return { generate: false, refine: false, reason: 'Google 로그인 후 AI를 사용할 수 있습니다. 연결 및 이용 안내에서 로그인해 주세요.' };
  if (!status.ai?.[provider]) return { generate: false, refine: false, reason: '선택한 AI가 연결되지 않았습니다. 연결 및 이용 안내를 확인해 주세요.' };
  if (provider === 'gemini' && status.geminiFreeOnly) return { generate: true, refine: false, reason: '무료 Gemini는 새 초안 전용입니다. 기존 초안 다듬기는 연결된 Solar 등 다른 AI를 선택하세요.' };
  return { generate: true, refine: true, reason: 'AI 호출에는 제공자의 사용량 한도와 요금이 적용됩니다. 결과의 사실과 정답을 확인해 주세요.' };
}
export function exportHelp(template) {
  if (template === 'slides') return 'Google Slides에 저장하거나 PowerPoint (.pptx)로 내려받습니다. PPTX 다운로드도 Google 로그인이 필요하며 Drive에 원본을 만듭니다.';
  if (template === 'tracker') return 'Google Sheets에 저장하거나 Excel (.xlsx)로 내려받습니다. Excel 다운로드도 Google 로그인이 필요하며 Drive에 원본을 만듭니다.';
  if (template === 'quiz') return 'Google Forms에 객관식 퀴즈로 저장합니다. 저장 후 Forms에서 정답·공개·응답 설정을 확인하고 응답 링크를 공유하세요.';
  if (template === 'lesson-package') return '선택한 자료를 각각 Google 파일로 저장합니다. HWPX·Markdown은 꾸러미 본문 합본, PPTX는 발표 부분만 담습니다. PPTX는 Google 로그인이 필요합니다.';
  return 'Google Docs에 저장하거나 한글 (.hwpx)·Markdown (.md)으로 내려받습니다. JSON은 이 앱에서 다시 편집할 때 쓰는 보관 파일입니다.';
}
