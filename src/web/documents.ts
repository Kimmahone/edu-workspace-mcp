import { Worker } from "node:worker_threads";
export const MAX_FILE = 20 * 1024 * 1024;
/** Check ZIP central directory sizes before the parser allocates decompressed entries. */
export function checkDocument(input: Uint8Array) {
  if (input.length < 4 || input.length > MAX_FILE) throw new Error("유효한 20MB 이하 문서를 선택해 주세요.");
  const b = Buffer.from(input);
  if (b.readUInt16LE(0) !== 0x4b50) return;
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (b.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("올바른 ZIP 기반 문서가 아닙니다.");
  const count = b.readUInt16LE(end + 10), offset = b.readUInt32LE(end + 16);
  if (count > 3000 || count === 65535) throw new Error("문서 내부 파일 수가 너무 많습니다.");
  let pos = offset, total = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || b.readUInt32LE(pos) !== 0x02014b50) throw new Error("문서 압축 구조가 올바르지 않습니다.");
    const size = b.readUInt32LE(pos + 24); total += size;
    if (size > 40 * 1024 * 1024 || total > 80 * 1024 * 1024) throw new Error("압축을 푼 문서가 너무 큽니다.");
    pos += 46 + b.readUInt16LE(pos + 28) + b.readUInt16LE(pos + 30) + b.readUInt16LE(pos + 32);
  }
}
let active = 0;
export async function documentJob<T = any>(data: { action: string; input?: Uint8Array; other?: Uint8Array; markdown?: string; kind?: string; design?: "navy" | "blue" | "warm" }): Promise<T> {
  if (data.input) checkDocument(data.input);
  if (data.other) checkDocument(data.other);
  if (active >= 2) throw new Error("다른 문서를 처리 중입니다. 잠시 뒤 다시 시도해 주세요.");
  active++;
  try {
    return await new Promise<T>((resolve, reject) => {
      const workerUrl = new URL(import.meta.url.endsWith(".ts") ? "../../dist/web/document-worker.js" : "./document-worker.js", import.meta.url);
      const worker = new Worker(workerUrl, { workerData: data, resourceLimits: { maxOldGenerationSizeMb: 384 } });
      const timer = setTimeout(() => { void worker.terminate(); reject(new Error("문서 처리 제한 시간(60초)을 넘었습니다. 문서를 나눠 주세요.")); }, 60000);
      worker.once("message", ({ result, error }) => { clearTimeout(timer); void worker.terminate(); error ? reject(new Error(error)) : resolve(result); });
      worker.once("error", () => { clearTimeout(timer); reject(new Error("문서 처리 중 오류가 발생했습니다.")); });
      worker.once("exit", code => { clearTimeout(timer); if (code !== 0) reject(new Error("문서 처리 작업이 종료되었습니다.")); });
    });
  } finally { active--; }
}
