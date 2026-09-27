import { Worker } from "node:worker_threads";
import {checkDocument} from "./document-check.js";
export {MAX_FILE, checkDocument} from "./document-check.js";
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
