import test from "node:test";
import assert from "node:assert/strict";
import { google } from "googleapis";
import { MemoryStore, seal, unseal } from "../web/store.js";
import { webConfig } from "../web/config.js";
import { googleContext } from "../auth/context.js";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { renderMarkdown } from "../web/render.js";
import { sampleDraft, validateDraft, requestSchema } from "../web/drafts.js";
import { generateDraft } from "../web/ai.js";
import { checkDocument, documentJob } from "../web/documents.js";
import { createWebServer } from "../web/server.js";
import { WebAuth } from "../web/auth.js";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
function httpFetch(url: string, options: { headers?: Record<string, string>; method?: string; body?: string } = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, options, response => {
      const chunks: Buffer[] = []; response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve(new Response(response.statusCode === 204 ? null : Buffer.concat(chunks), { status: response.statusCode, headers: Object.fromEntries(Object.entries(response.headers).filter(([,v]) => v !== undefined).map(([k,v]) => [k, Array.isArray(v) ? v.join(", ") : v!])) })));
    }); req.on("error", reject); req.end(options.body);
  });
}

test("encrypted tokens reject tampering and wrong keys; state consumption is atomic", async () => {
  const secret = "x".repeat(32), value = seal({ token: "private" }, secret);
  assert.ok(!value.includes("private")); assert.deepEqual(unseal(value, secret), { token: "private" });
  assert.throws(() => unseal(value, "y".repeat(32)));
  const store = new MemoryStore(); await store.put("once", 42, 10000);
  const results = await Promise.all(Array.from({ length: 10 }, () => store.take("once")));
  assert.equal(results.filter(x => x === 42).length, 1);
  assert.equal((await Promise.all(Array.from({ length: 10 }, () => store.claim("lock", true, 1000)))).filter(Boolean).length, 1);
});
test("hosted requires secure explicit config and local binds loopback", () => {
  assert.throws(() => webConfig({ APP_MODE: "hosted" }));
  assert.throws(() => webConfig({ APP_ORIGIN: "http://192.168.1.1:3210" }));
  assert.throws(() => webConfig({ PORT: "NaN" })); assert.throws(() => webConfig({ AI_DAILY_LIMIT: "-1" }));
});
test("concurrent Google users stay isolated; empty web context never falls back to local tokens", async () => {
  const first = new google.auth.OAuth2("one"), second = new google.auth.OAuth2("two");
  const values = await Promise.all([first, second].map((client, i) => googleContext.run({ client, owner: String(i) }, async () => {
    await new Promise(resolve => setTimeout(resolve, 15 - i * 5)); return getAuthorizedClient();
  })));
  assert.equal(values[0], first); assert.equal(values[1], second);
  await assert.rejects(googleContext.run({ client: null, owner: "unauthorized" }, () => getAuthorizedClient()), /연결/);
});
test("Markdown preview preserves tables but removes executable and remote content", () => {
  const result = renderMarkdown('<script>alert(1)</script><img src="https://evil.test/x"><iframe src="https://evil.test"></iframe><table><tr><td colspan="2" onclick="bad()">내용</td></tr></table>');
  assert.match(result, /colspan="2"/); assert.ok(!/script|img|iframe|onclick|evil/.test(result));
});
test("draft validation prevents invalid quiz answers and ragged sheet rows", () => {
  const quiz = sampleDraft("quiz"); quiz.questions[0].correctAnswer = "없는 보기";
  assert.throws(() => validateDraft(quiz, "quiz"));
  const sheet = sampleDraft("tracker"); sheet.rows[0].pop(); assert.throws(() => validateDraft(sheet, "tracker"));
});
test("both AI adapters validate structured output and never return provider secrets", async () => {
  const draft = sampleDraft("notice"), config = webConfig({ GEMINI_API_KEY: "gemini-secret", OPENAI_API_KEY: "openai-secret" });
  for (const provider of ["gemini", "openai"] as const) {
    const input = requestSchema.parse({ template: "notice", prompt: "안내문 만들기", provider, noPersonalData: true });
    let sent: any;
    const fake: typeof fetch = async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(provider === "gemini" ? { status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(draft) }] }] } : { status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(draft) }] }] }));
    };
    const result = await generateDraft(input, config, fake); assert.equal(result.draft.title, draft.title);
    assert.equal(sent.store, false);
    assert.equal(sent.model, provider === "openai" ? "gpt-6-luna" : "gemini-flash-latest");
    assert.ok(!JSON.stringify(result).includes("secret"));
    await assert.rejects(generateDraft(input, config, async () => new Response("", { status: 429 })), /한도/);
  }
});
test("kordoc worker generates, reads, patches and compares Korean HWPX", { timeout: 60000 }, async () => {
  const markdown = "# 수업 안내\n\n오늘은 과학 수업입니다.\n\n| 항목 | 내용 |\n| --- | --- |\n| 준비물 | 색연필 |";
  const generated = await documentJob({ action: "generate", markdown });
  const parsed = await documentJob({ action: "parse", input: generated.file });
  assert.equal(parsed.kind, "hwpx"); assert.match(parsed.markdown, /색연필/);
  const patched = await documentJob({ action: "patch", input: generated.file, markdown: parsed.markdown.replace("색연필", "싸인펜"), kind: "hwpx" });
  const reparsed = await documentJob({ action: "parse", input: patched.file }); assert.match(reparsed.markdown, /싸인펜/);
  const diff = await documentJob({ action: "compare", input: generated.file, other: patched.file }); assert.ok(diff.stats.modified > 0);
  assert.throws(() => checkDocument(new Uint8Array([1])));
  const oversized = Buffer.from(generated.file); const central = oversized.indexOf(Buffer.from([0x50,0x4b,0x01,0x02])); oversized.writeUInt32LE(0xffffffff, central + 24);
  assert.throws(() => checkDocument(oversized), /너무 큽니다/);
});
test("HTTP enforces session, Origin, CSRF and consumes save approval once", async t => {
  let saves = 0;
  const config = webConfig({ PORT: "3299" });
  const app = await createWebServer(config, new MemoryStore(), { save: async () => { saves++; await new Promise(r => setTimeout(r, 20)); return { documentId: "test", title: "test", url: "https://docs.google.com/document/d/test/edit", pageSize: "A4" }; }, localAuth: async () => ({ authenticated: true } as any) });
  await new Promise<void>(resolve => app.server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { await new Promise<void>(resolve => app.server.close(() => resolve())); await app.store.close(); });
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const favicon = await httpFetch(base + "/favicon.ico", { headers: { Host: "127.0.0.1:3299" } });
  assert.equal(favicon.status, 204); assert.equal(favicon.headers.get("set-cookie"), null);
  const first = await httpFetch(base + "/api/status", { headers: { Host: "127.0.0.1:3299" } });
  const status = await first.json() as any, cookie = first.headers.get("set-cookie")!.split(";")[0];
  const headers = { Host: "127.0.0.1:3299", Origin: config.origin, Cookie: cookie, "X-CSRF-Token": status.csrf, "Content-Type": "application/json" };
  assert.equal((await httpFetch(base + "/api/status")).status, 403);
  assert.equal((await httpFetch(base + "/api/preview", { method: "POST", headers: { ...headers, Origin: "https://evil.test" }, body: JSON.stringify({ markdown: "Hi" }) })).status, 403);
  assert.equal((await httpFetch(base + "/api/preview", { method: "POST", headers: { ...headers, "X-CSRF-Token": "bad" }, body: JSON.stringify({ markdown: "Hi" }) })).status, 403);
  const prepared = await httpFetch(base + "/api/save/prepare", { method: "POST", headers, body: JSON.stringify({ draft: sampleDraft("notice"), template: "notice", kinds: ["document"] }) }).then(r => r.json()) as any;
  const commits = await Promise.all([1,2].map(() => httpFetch(base + "/api/save/commit", { method: "POST", headers, body: JSON.stringify({ id: prepared.id }) })));
  assert.equal(saves, 1); assert.ok(commits.some(r => r.status === 200));
  const again = await httpFetch(base + "/api/save/commit", { method: "POST", headers, body: JSON.stringify({ id: prepared.id }) }).then(r=>r.json()) as any;
  assert.equal(again.outputs[0].status, "done"); assert.equal(saves, 1);
});
test("hosted users cannot access document jobs or another user's preparation", async t => {
  const store = new MemoryStore(), config = webConfig({ APP_MODE: "hosted", APP_ORIGIN: "https://app.example.test", APP_SECRET: "a".repeat(32), DATABASE_URL: "unused", GOOGLE_WEB_CLIENT_ID: "client", GOOGLE_WEB_CLIENT_SECRET: "secret" });
  const app = await createWebServer(config, store);
  await new Promise<void>(resolve => app.server.listen(0,"127.0.0.1",resolve));
  t.after(async () => { await new Promise<void>(resolve => app.server.close(()=>resolve())); await store.close(); });
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const r = await httpFetch(base + '/api/status', { headers: { Host: 'app.example.test' } });
  const status = await r.json() as any, cookie = r.headers.get('set-cookie')!.split(';')[0];
  assert.ok(r.headers.get('set-cookie')!.includes('Secure'));
  for (const path of ['/studio.js','/setup','/assets/google/docs.svg','/assets/examples/report.hwpx','/api/sample?template=travel-plan']) {
    assert.equal((await httpFetch(base + path, { headers: { Host: 'app.example.test' } })).status, 200, path);
  }
  assert.equal((await httpFetch(base + '/assets/examples/private-file.hwpx', { headers: { Host: 'app.example.test' } })).status, 404);
  const headers = { Host: 'app.example.test', Origin: config.origin, Cookie: cookie, 'X-CSRF-Token': status.csrf, 'Content-Type': 'application/json' };
  assert.equal((await httpFetch(base + '/api/documents/hwpx', { method:'POST', headers, body: JSON.stringify({ markdown: 'test' }) })).status, 401);
  const id = cookie.split('=')[1]; await store.put(`session:${id}`, { csrf: status.csrf, user: { id: 'alice', email: 'a@example.test' } }, 100000);
  const p = await httpFetch(base + '/api/save/prepare', { method:'POST', headers, body: JSON.stringify({ template:'notice', draft: sampleDraft('notice'), kinds:['document'] }) }).then(r=>r.json()) as any;
  await store.put(`session:${id}`, { csrf: status.csrf, user: { id: 'bob', email: 'b@example.test' } }, 100000);
  assert.equal((await httpFetch(base + '/api/save/commit', { method:'POST', headers, body: JSON.stringify({id:p.id}) })).status,409);
});
test("Classroom creates a draft and requires a separate one-time publish confirmation", async t => {
  let creates = 0, publishes = 0;
  const client = new google.auth.OAuth2();
  client.request = (async (options: any) => {
    const url = String(options.url);
    if (options.method === "POST" && url.endsWith("/courseWork")) {
      creates++; assert.equal(options.data.state, "DRAFT"); return { data: { id: "assignment1", title: "검증 과제", state: "DRAFT" } };
    }
    if (options.method === "PATCH") { publishes++; assert.equal(options.data.state, "PUBLISHED"); return { data: { state: "PUBLISHED", title: "검증 과제" } }; }
    return { data: { courses: [{ id: "course1", name: "검증 수업", courseState: "ACTIVE" }] } };
  }) as any;
  const original = WebAuth.prototype.client; WebAuth.prototype.client = async () => client;
  const config = webConfig({ PORT: "3297" }), app = await createWebServer(config, new MemoryStore());
  await new Promise<void>(resolve => app.server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { WebAuth.prototype.client = original; await new Promise<void>(resolve => app.server.close(() => resolve())); await app.store.close(); });
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const response = await httpFetch(base + "/api/status", { headers: { Host: "127.0.0.1:3297" } });
  const status = await response.json() as any;
  const headers = { Host: "127.0.0.1:3297", Origin: config.origin, Cookie: response.headers.get("set-cookie")!.split(";")[0], "X-CSRF-Token": status.csrf, "Content-Type": "application/json" };
  const post = async (path: string, data: unknown) => { const r = await httpFetch(base + path, { method: "POST", headers, body: JSON.stringify(data) }); return { status: r.status, body: await r.json() as any }; };
  const unauthorized = await post('/api/classroom/prepare', { action:'create', courseId:'someone-else',title:'검증 과제',description:'안내' }); assert.equal(unauthorized.status,403);
  const prepared = await post('/api/classroom/prepare', { action:'create',courseId:'course1',title:'검증 과제',description:'안내' });
  assert.equal(creates,0); assert.equal(publishes,0);
  const created = await post('/api/classroom/commit',{id:prepared.body.id}); assert.equal(created.body.state,'DRAFT'); assert.equal(creates,1); assert.equal(publishes,0);
  await post('/api/classroom/commit',{id:prepared.body.id}); assert.equal(creates,1);
  const unowned = await post('/api/classroom/prepare',{action:'publish',courseId:'course1',courseWorkId:'unowned'}); assert.equal(unowned.status,403);
  const publish = await post('/api/classroom/prepare',{action:'publish',courseId:'course1',courseWorkId:'assignment1'}); assert.equal(publishes,0);
  const result = await post('/api/classroom/commit',{id:publish.body.id}); assert.equal(result.body.state,'PUBLISHED');
  await post('/api/classroom/commit',{id:publish.body.id}); assert.equal(publishes,1);
});
