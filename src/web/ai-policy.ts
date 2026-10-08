/** Fail closed before any user input reaches a provider. No automatic paid-tier switch. */
export function assertAiDataPolicy(provider: string, config: { geminiNoTrainingConfirmed?: boolean; openaiNoTrainingConfirmed?: boolean }) {
  if (provider === "gemini" && !config.geminiNoTrainingConfirmed) {
    throw new Error("무료 Gemini에는 Google 자료를 보낼 수 없습니다. 학습에 사용하지 않는 Paid Service 설정을 운영자가 확인한 뒤 이용할 수 있습니다. 예시 편집 또는 GPT를 이용해 주세요.");
  }
  if (provider === "openai" && !config.openaiNoTrainingConfirmed) {
    throw new Error("OpenAI API 데이터 학습 공유 비활성 설정을 운영자가 확인한 뒤 이용할 수 있습니다. 예시 편집은 계속 사용할 수 있습니다.");
  }
}
