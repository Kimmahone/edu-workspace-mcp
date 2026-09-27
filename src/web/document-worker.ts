import { hwpxOptions, type DesignId } from "./design.js";
import { parentPort, workerData } from "node:worker_threads";
import { parse, markdownToHwpx, patchHwpx, patchHwp, compare, blocksToMarkdown } from "kordoc";
const data = workerData as { action: string; input?: Uint8Array; other?: Uint8Array; markdown?: string; kind?: string; design?: DesignId };
async function run() {
  if (data.action === "generate") { const warnings:string[]=[]; return { file: new Uint8Array(await markdownToHwpx(data.markdown!, data.design?{...hwpxOptions(data.markdown!,data.design),warnings}:undefined)), warnings }; }
  if (data.action === "patch") {
    const result = await (data.kind === "hwp" ? patchHwp : patchHwpx)(data.input!, data.markdown!);
    if (!result.success || !result.data) throw new Error(result.error ?? "서식 보존 수정을 완료하지 못했습니다.");
    return { file: result.data, warnings: result.skipped.map(x => x.reason), applied: result.applied, verification: result.verification };
  }
  if (data.action === "compare") {
    const result = await compare(Uint8Array.from(data.input!).buffer, Uint8Array.from(data.other!).buffer);
    const changes = result.diffs.filter(d => d.type !== "unchanged");
    return { stats: result.stats, truncated: changes.length > 100, changes: changes.slice(0,100).map(d => ({ type: d.type, before: d.before ? blocksToMarkdown([d.before]).slice(0,4000) : "", after: d.after ? blocksToMarkdown([d.after]).slice(0,4000) : "" })) };
  }
  const result = await parse(Buffer.from(data.input!));
  if (!result.success) throw new Error(result.error);
  if (!["hwp", "hwp3", "hwpx", "docx"].includes(result.fileType)) throw new Error("HWP, HWPX, DOCX 문서만 지원합니다.");
  if (result.markdown.length > 200000) throw new Error("문서 본문이 너무 깁니다. 문서를 나눠 주세요.");
  return { markdown: result.markdown, kind: result.fileType, warnings: result.warnings?.map(x => x.message) ?? [] };
}
run().then(result => parentPort?.postMessage({ result })).catch(() => parentPort?.postMessage({ error: "문서를 처리하지 못했습니다. 암호·손상 여부와 지원 형식을 확인해 주세요." }));
