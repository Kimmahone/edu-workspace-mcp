/** Column proportions follow the meaning of the fields, across HTML, Docs and HWPX. */
export function tableWeights(headers: string[]): number[] {
  const key = headers.map(s => s.trim()).join('|');
  if (key === '학습 목표|수업 시간') return [.82, .18];
  if (key === '단계|활동|시간') return [.18, .67, .15];
  if (key === '단계 · 시간|학습 과정|교수·학습 활동') return [.15, .22, .63];
  return headers.map(() => 1 / headers.length);
}
