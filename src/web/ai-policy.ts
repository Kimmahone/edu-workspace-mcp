/** Provider policy is checked again on the server before sending user input. */
export function assertAiDataPolicy(provider: string, config: { geminiNoTrainingConfirmed?: boolean; geminiFreeTierConfirmed?: boolean; openaiNoTrainingConfirmed?: boolean }, input?: {freeTierConsent?:boolean; previous?:unknown}) {
 if(provider === 'gemini' && !config.geminiNoTrainingConfirmed) {
  if(!config.geminiFreeTierConfirmed) throw new Error('무료 Gemini 사용 설정이 필요합니다.');
  if(input?.freeTierConsent !== true || input?.previous !== undefined) throw new Error('무료 Gemini는 일반 주제로 새 초안을 만들 때만 사용할 수 있습니다. 기존 문서·개인정보를 입력하지 말고 데이터 이용 안내에 동의해 주세요.');
 }
 if(provider === 'openai' && !config.openaiNoTrainingConfirmed) throw new Error('OpenAI API 데이터 학습 공유 비활성 설정을 운영자가 확인한 뒤 이용할 수 있습니다.');
}
