import {designSchema,designs,designedMarkdown} from "./design.js";
import {designPreview} from "./design-preview.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { VERSION } from "kordoc";
import { webConfig, type WebConfig } from "./config.js";
import { MemoryStore, PostgresStore, type Store } from "./store.js";
import { WebAuth, nonce } from "./auth.js";
import { templates, templateIds, sampleDraft, draftSchema, documentDraftSchema, requestSchema, validateDraft, type Draft } from "./drafts.js";
import { generateDraft } from "./ai.js";
import { renderMarkdown } from "./render.js";
import { documentJob, MAX_FILE } from "./documents.js";
import {assertAiDataPolicy} from "./ai-policy.js";
import { saveOutput, outputKinds, readGoogleDoc, type OutputKind } from "./workspace.js";
import { googleContext } from "../auth/context.js";
import { getAuthStatus } from "../auth/google-auth.js";
import { searchStandards, resolveStandardCodes, CURRICULUM_SOURCE_NOTE, CURRICULUM_SUBJECTS, curriculumInfo } from "../curriculum/standards.js";
import {learningContext,learningMapInfo} from '../curriculum/learning-map.js';
import {elementaryExamples} from './elementary-examples.js';
import { listCourses, createAssignmentDraft, publishAssignment, type AssignmentDraftInput } from "../google/classroom.js";
import { privacyPage } from "./privacy.js";

type Receipt = { id: string; title: string; created: string; outputs: Array<{ kind: string; status: "pending" | "running" | "done" | "failed"; result?: unknown; message?: string }> };
type Prepared = { draft: Draft; template: string; kinds: OutputKind[]; standardCodes: string[]; design: "navy" | "blue" | "warm" };
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function json(res: ServerResponse, value: unknown, status = 200) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(value)); }
async function body(req: IncomingMessage, limit = 1024 * 1024) {
  const parts: Buffer[] = []; let bytes = 0;
  for await (const chunk of req) { bytes += chunk.length; if (bytes > limit) throw new HttpError(413, "요청 용량이 너무 큽니다."); parts.push(Buffer.from(chunk)); }
  return Buffer.concat(parts);
}
async function input(req: IncomingMessage, limit?: number) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw new HttpError(415, "JSON 요청이 필요합니다.");
  try { return JSON.parse((await body(req, limit)).toString()); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, "요청 형식이 올바르지 않습니다."); }
}
const conversionSchema = z.object({ design: designSchema.optional(), markdown: z.string().min(1).max(200_000), title: z.string().min(1).max(200).default("문서") });
const base64 = z.string().max(Math.ceil(MAX_FILE / 3) * 4).regex(/^[A-Za-z0-9+/]*={0,2}$/);
const standardCodesSchema = z.array(z.string().max(30)).max(10).default([]);
const saveSchema = z.object({ draft: documentDraftSchema, template: z.enum([...templateIds, "conversion"]), kinds: z.array(z.enum(outputKinds)).min(1).max(5), standardCodes: standardCodesSchema, design: designSchema });
const publicFiles: Record<string, { file: string; type: string }> = { "/": { file: "index.html", type: "text/html" }, "/setup": { file: "setup.html", type: "text/html" }, "/studio.js": { file: "studio.js", type: "text/javascript" }, "/app.js": { file: "app.js", type: "text/javascript" }, "/style.css": { file: "style.css", type: "text/css" } };

export async function createWebServer(config: WebConfig, suppliedStore?: Store, dependencies: { save?: typeof saveOutput; generate?: typeof generateDraft; localAuth?: typeof getAuthStatus } = {}) {
  const store = suppliedStore ?? (config.hosted ? new PostgresStore(config.databaseUrl!, config.secret) : new MemoryStore());
  if (store instanceof PostgresStore) await store.init();
  const auth = new WebAuth(config, store);
  async function quota(owner: string, group: string, limit: number) {
    const day = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < limit; i++) if (await store.claim(`quota:${owner}:${group}:${day}:${i}`, true, 48 * 3600000)) return;
    throw new HttpError(429, "오늘의 사용 한도에 도달했습니다. 예시 편집과 기존 결과 다운로드는 계속 사용할 수 있습니다.");
  }
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (config.hosted) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    try {
      const url = new URL(req.url ?? "/", config.origin), route = url.pathname;
      if (route === "/healthz" && req.method === "GET") return json(res, { ok: true });
      if (req.headers.host !== new URL(config.origin).host) throw new HttpError(403, "허용되지 않은 앱 주소입니다.");
      if (route === "/privacy" && req.method === "GET") { res.setHeader("Content-Type", "text/html; charset=utf-8"); return res.end(privacyPage(config)); }
      const assetMatch = /^\/assets\/(google|illustrations|examples)\/([a-z0-9-]+)\.(svg|png|json|md|hwpx|pdf)$/.exec(route);
      if (assetMatch && req.method === "GET") {
        const types: Record<string,string> = { pdf: "application/pdf", svg: "image/svg+xml", png: "image/png", json: "application/json", md: "text/markdown; charset=utf-8", hwpx: "application/vnd.hancom.hwpx" };
        try {
          const content = await readFile(new URL(`../../web${route}`, import.meta.url));
          res.setHeader("Content-Type", types[assetMatch[3]]);
          if (["hwpx", "md", "json", "pdf"].includes(assetMatch[3])) res.setHeader("Content-Disposition", `attachment; filename="${assetMatch[2]}.${assetMatch[3]}"`);
          return res.end(content);
        } catch { throw new HttpError(404, "에셋을 찾을 수 없습니다."); }
      }
      if (route === "/favicon.ico" && req.method === "GET") { res.writeHead(204); return res.end(); }
      if (!publicFiles[route] && !route.startsWith("/api/") && !route.startsWith("/auth/")) throw new HttpError(404, "요청한 페이지가 없습니다.");
      if (req.method === "GET" && publicFiles[route]) {
        const asset = publicFiles[route]; res.setHeader("Content-Type", asset.type + "; charset=utf-8");
        return res.end(await readFile(new URL(`../../web/${asset.file}`, import.meta.url)));
      }
      const session = await auth.session(req, res);
      const owner = config.hosted ? session.value.user?.id : "local";
      if (!["GET", "HEAD"].includes(req.method ?? "")) {
        if (req.headers.origin !== config.origin || req.headers["x-csrf-token"] !== session.value.csrf) throw new HttpError(403, "화면을 새로고침하고 다시 시도해 주세요.");
      }
      if (route === "/api/status" && req.method === "GET") {
        const local = !config.hosted ? await (dependencies.localAuth ?? getAuthStatus)().catch(() => undefined) : undefined;
        return json(res, { mode: config.hosted ? "hosted" : "local", csrf: session.value.csrf, user: session.value.user, connected: config.hosted ? Boolean(session.value.user) : Boolean(local?.authenticated), ai: { gemini: Boolean(config.geminiKey) && config.geminiNoTrainingConfirmed, openai: Boolean(config.openaiKey) && config.openaiNoTrainingConfirmed }, models: { gemini: config.geminiModel, openai: config.openaiModel }, kordoc: VERSION, templates:templates.map(t=>({...t,...(elementaryExamples[t.id]?{prompt:elementaryExamples[t.id].prompt,education:elementaryExamples[t.id]}: {})})), designs, elementaryExamples, curriculum: {...curriculumInfo(), learningMap:learningMapInfo(), subjects:CURRICULUM_SUBJECTS}, formsThemeConnected: Boolean(config.formsTemplateId), dailyLimit: config.aiDailyLimit });
      }
      if (route === "/auth/google" && req.method === "GET" && config.hosted) { res.writeHead(302, { Location: await auth.start(session.id, url.searchParams.get("classroom") === "1") }); return res.end(); }
      if (route === "/auth/callback" && req.method === "GET" && config.hosted) {
        await auth.finish(z.string().length(64).parse(url.searchParams.get("state")), z.string().min(1).max(4096).parse(url.searchParams.get("code")), session.id, res);
        res.writeHead(302, { Location: "/" }); return res.end();
      }
      if (route === "/api/logout" && req.method === "POST") { await store.remove(`session:${session.id}`); auth.cookie(res, "", true); return json(res, { ok: true }); }
      if (route === "/api/sample" && req.method === "GET") {
        const template=z.enum(templateIds).parse(url.searchParams.get('template')),education=elementaryExamples[template];
        return json(res,{draft:sampleDraft(template),education,standards:resolveStandardCodes(education?.standardCodes??[]),learningMap:learningContext(education?.standardCodes??[])});
      }
      if (route === "/api/validate-draft" && req.method === "POST") {
        const data = z.object({ template: z.enum(templateIds), draft: draftSchema, standardCodes: standardCodesSchema }).parse(await input(req));
        return json(res, { draft: validateDraft(data.draft, data.template), standards: resolveStandardCodes(data.standardCodes) });
      }
      if (route === "/api/standards" && req.method === "GET") {
        const filters=z.object({subject:z.enum(CURRICULUM_SUBJECTS).optional(),grade:z.coerce.number().int().min(1).max(6).optional()}).parse({subject:url.searchParams.get('subject')||undefined,grade:url.searchParams.get('grade')||undefined});
        return json(res,{result:searchStandards({query:(url.searchParams.get('q')??'').slice(0,100),...filters,limit:50}),note:CURRICULUM_SOURCE_NOTE});
      }
      if(route==='/api/learning-context'&&req.method==='GET')return json(res,learningContext(z.array(z.string().max(30)).max(10).parse(url.searchParams.getAll('code'))));
      if (route === "/api/design-preview" && req.method === "POST") {
        const data=z.object({draft:draftSchema,template:z.enum(templateIds),design:designSchema}).parse(await input(req));
        validateDraft(data.draft,data.template);
        return json(res,{html:designPreview(data.draft,data.template,data.design)});
      }
      if (route === "/api/preview" && req.method === "POST") {
        const data = conversionSchema.parse(await input(req)); return json(res, { html: renderMarkdown(data.markdown) });
      }
      if (config.hosted && !owner) throw new HttpError(401, "Google 로그인 후 이용해 주세요.");
      const ownerKey = createHash("sha256").update(owner!).digest("hex");
      if (route === "/api/classroom/courses" && req.method === "GET") {
        const client = await auth.client(session.id, session.value);
        return json(res, { courses: await googleContext.run({ client, owner: ownerKey }, () => listCourses()) });
      }
      if (route === "/api/classroom/prepare" && req.method === "POST") {
        const data = z.discriminatedUnion("action", [
          z.object({ action: z.literal("create"), courseId: z.string().min(1).max(100), title: z.string().min(1).max(200), description: z.string().max(10000), dueAt: z.string().datetime({ offset: true }).optional(), maxPoints: z.number().min(0).max(1000).optional(), materials: z.array(z.object({ title: z.string().min(1).max(200), url: z.string().url().max(1000).refine(s => new URL(s).protocol === "https:") })).max(10).default([]) }),
          z.object({ action: z.literal("publish"), courseId: z.string().min(1).max(100), courseWorkId: z.string().min(1).max(100) })
        ]).parse(await input(req));
        const client = await auth.client(session.id, session.value);
        const courses = await googleContext.run({ client, owner: ownerKey }, () => listCourses());
        const course = courses.find(c => c.id === data.courseId);
        if (!course) throw new HttpError(403, "담당하는 수업을 선택해 주세요.");
        let assignmentTitle = data.action === "create" ? data.title : "";
        if (data.action === "publish") {
          const created = await store.get<{ title: string }>(`assignment:${ownerKey}:${data.courseId}:${data.courseWorkId}`);
          if (!created) throw new HttpError(403, "이 앱에서 만든 과제 초안만 게시할 수 있습니다.");
          assignmentTitle = created.title;
        }
        const id = nonce(); await store.put(`classroom:${ownerKey}:${id}`, { data, courseName: course.name, title: assignmentTitle }, 15 * 60000);
        return json(res, { id, courseName: course.name, title: assignmentTitle, action: data.action });
      }
      if (route === "/api/classroom/commit" && req.method === "POST") {
        const { id } = z.object({ id: z.string().regex(/^[a-f0-9]{64}$/) }).parse(await input(req));
        const receiptKey = `classroom-result:${ownerKey}:${id}`;
        const prior = await store.get(receiptKey); if (prior) return json(res, prior);
        const prepared = await store.take<{ data: AssignmentDraftInput & { action: "create" | "publish"; courseWorkId?: string }; title: string; courseName: string }>(`classroom:${ownerKey}:${id}`);
        if (!prepared) throw new HttpError(409, "확인 요청이 만료되었거나 이미 처리 중입니다. Classroom에서 상태를 확인해 주세요.");
        const client = await auth.client(session.id, session.value);
        await store.put(receiptKey, { status: "running" }, 7 * 86400000);
        try {
          const result = await googleContext.run({ client, owner: ownerKey }, () => prepared.data.action === "create" ? createAssignmentDraft(prepared.data) : publishAssignment(prepared.data.courseId, prepared.data.courseWorkId!));
          await store.put(`assignment:${ownerKey}:${result.courseId}:${result.courseWorkId}`, { title: prepared.title }, 7 * 86400000);
          const receipt = { status: "done", ...result, courseName: prepared.courseName };
          await store.put(receiptKey, receipt, 7 * 86400000); return json(res, receipt);
        } catch {
          const receipt = { status: "failed", error: "작업 결과를 확정하지 못했습니다. Classroom에서 과제 상태를 확인한 뒤 다시 시도해 주세요." };
          await store.put(receiptKey, receipt, 7 * 86400000); return json(res, receipt, 422);
        }
      }
      if (route === "/api/generate" && req.method === "POST") {
        const data = requestSchema.parse(await input(req));
        assertAiDataPolicy(data.provider, config);
        if (!(data.provider === "gemini" ? config.geminiKey : config.openaiKey)) throw new HttpError(422, "선택한 AI의 API 키가 설정되지 않았습니다. 예시로 먼저 시작해 주세요.");
        if (!await store.claim(`ai-running:${ownerKey}`, true, 120000)) throw new HttpError(429, "이 계정의 다른 AI 요청을 처리 중입니다.");
        try { await quota(ownerKey, "ai", config.aiDailyLimit); return json(res, await (dependencies.generate ?? generateDraft)(data, config)); }
        finally { await store.remove(`ai-running:${ownerKey}`); }
      }
      if (route === "/api/documents/parse" && req.method === "POST") {
        await quota(ownerKey, "documents", 100); const data = await body(req, MAX_FILE);
        return json(res, await documentJob({ action: "parse", input: data }));
      }
      if (route === "/api/draft/hwpx" && req.method === "POST") {
        const data=z.object({draft:draftSchema,template:z.enum(templateIds),design:designSchema,standardCodes:standardCodesSchema}).parse(await input(req));
        validateDraft(data.draft,data.template); await quota(ownerKey,"documents",100);
        const standards=resolveStandardCodes(data.standardCodes);
        const markdown=designedMarkdown(data.draft,data.template)+(standards.length?'\n\n## 참고 성취기준\n'+standards.map(s=>s.code+' '+(s.text??s.summary)).join('\n\n'):'');
        const result=await documentJob({action:"generate",markdown,design:data.design});
        return json(res,{file:Buffer.from(result.file).toString("base64"),warnings:result.warnings});
      }
      if (route === "/api/documents/hwpx" && req.method === "POST") {
        const data = conversionSchema.parse(await input(req)); await quota(ownerKey, "documents", 100);
        const result = await documentJob({ action: "generate", markdown: data.markdown, design: data.design });
        return json(res, { file: Buffer.from(result.file).toString("base64"), warnings: result.warnings });
      }
      if (route === "/api/documents/patch" && req.method === "POST") {
        const data = z.object({ original: base64, markdown: z.string().min(1).max(200000), kind: z.enum(["hwp", "hwpx"]) }).parse(await input(req, 30 * 1024 * 1024));
        await quota(ownerKey, "documents", 100);
        const result = await documentJob({ action: "patch", input: Buffer.from(data.original, "base64"), markdown: data.markdown, kind: data.kind });
        return json(res, { ...result, file: Buffer.from(result.file).toString("base64") });
      }
      if (route === "/api/documents/compare" && req.method === "POST") {
        const data = z.object({ first: base64, second: base64 }).parse(await input(req, 55 * 1024 * 1024));
        await quota(ownerKey, "documents", 100);
        return json(res, await documentJob({ action: "compare", input: Buffer.from(data.first, "base64"), other: Buffer.from(data.second, "base64") }));
      }
      if (route === "/api/documents/google" && req.method === "POST") {
        const data = z.object({ url: z.string().min(1).max(500) }).parse(await input(req));
        await quota(ownerKey, "documents", 100);
        const client = await auth.client(session.id, session.value);
        return json(res, await googleContext.run({ client, owner: ownerKey }, () => readGoogleDoc(data.url)));
      }
      if (route === "/api/save/prepare" && req.method === "POST") {
        const data = saveSchema.parse(await input(req)); validateDraft(data.draft, data.template);
        resolveStandardCodes(data.standardCodes);
        await quota(ownerKey, "save", 100);
        if (new Set(data.kinds).size !== data.kinds.length) throw new HttpError(400, "저장 형식이 중복되었습니다.");
        for (const kind of data.kinds) validateDraft(data.draft, { worksheet: "worksheet", slides: "slides", quiz: "quiz", sheet: "tracker", document: data.template }[kind]);
        const id = nonce(); await store.put(`prepared:${ownerKey}:${id}`, data, 15 * 60000);
        return json(res, { id, title: data.draft.title, kinds: data.kinds });
      }
      if (route === "/api/save/commit" && req.method === "POST") {
        const { id } = z.object({ id: z.string().length(64).regex(/^[a-f0-9]+$/) }).parse(await input(req));
        const key = `receipt:${ownerKey}:${id}`;
        const existing = await store.get<Receipt>(key); if (existing) return json(res, existing);
        const saveLock = `save-running:${ownerKey}`;
        if (!await store.claim(saveLock, true, 5 * 60000)) throw new HttpError(409, "다른 저장 작업을 처리 중입니다. 완료된 뒤 다시 눌러 주세요.");
        try {
        const data = await store.take<Prepared>(`prepared:${ownerKey}:${id}`);
        if (!data) throw new HttpError(409, "이미 저장 중이거나 검토 시간이 만료되었습니다. 최근 작업을 확인해 주세요.");
        const client = dependencies.save ? null : await auth.client(session.id, session.value);
        const receipt: Receipt = { id, title: data.draft.title, created: new Date().toISOString(), outputs: data.kinds.map(kind => ({ kind, status: "pending" })) };
        await store.put(key, receipt, 7 * 86400000);
        const historyKey = `history:${ownerKey}`;
        const history = await store.get<string[]>(historyKey) ?? [];
        await store.put(historyKey, [id, ...history].slice(0, 50), 7 * 86400000);
        await googleContext.run({ client, owner: ownerKey }, async () => {
          for (const output of receipt.outputs) {
            output.status = "running"; await store.put(key, receipt, 7 * 86400000);
            try { output.result = await (dependencies.save ?? saveOutput)(output.kind as OutputKind, data.draft, data.template, data.standardCodes, data.design, config.formsTemplateId); output.status = "done"; }
            catch { output.status = "failed"; output.message = "저장을 완료하지 못했습니다. Google Drive에 파일이 생겼는지 확인한 뒤 필요한 항목만 다시 저장해 주세요."; }
            await store.put(key, receipt, 7 * 86400000);
          }
        });
        return json(res, receipt);
        } finally { await store.remove(saveLock); }
      }
      if (route === "/api/history" && req.method === "GET") {
        const ids = await store.get<string[]>(`history:${ownerKey}`) ?? [];
        return json(res, { items: (await Promise.all(ids.map(id => store.get(`receipt:${ownerKey}:${id}`)))).filter(Boolean) });
      }
      throw new HttpError(404, "요청한 기능을 찾을 수 없습니다.");
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : 422;
      const message = error instanceof z.ZodError ? "입력 항목과 파일 형식을 확인해 주세요." : error instanceof Error && !("response" in error) ? error.message : "Google 연결 또는 파일 접근 권한을 확인해 주세요.";
      json(res, { error: message }, status);
    }
  });
  server.requestTimeout = 120000; server.headersTimeout = 15000;
  return { server, store };
}
