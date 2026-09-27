import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions,Response as MFResponse} from 'miniflare';
import {State,nonce} from './state.js';
import {googleRequest} from './google.js';

test('Workers: private auth, CSRF, encrypted D1, atomic claims, quotas and restricted API proxy',async()=>{
 const bundle=await build({entryPoints:['cloud/worker.ts'],bundle:true,write:false,format:'esm',platform:'browser'});
 const secret='test-secret-'.repeat(4),owner='owner@example.test',sid=nonce(),csrf=nonce();let calls:any[]=[],loginEmail=owner;
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'test',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-27',d1Databases:{DB:'test'},bindings:{APP_SECRET:secret,OWNER_EMAIL:owner,GOOGLE_WEB_CLIENT_ID:'fake-client',GOOGLE_WEB_CLIENT_SECRET:'fake-secret',OPENAI_API_KEY:'fake-openai',GEMINI_API_KEY:'fake-gemini',GEMINI_FREE_TIER_CONFIRMED:'false',GEMINI_MODEL:'gemini-flash-latest',OPENAI_MODEL:'gpt-6-luna',FORMS_TEMPLATE_ID:''},outboundService:async(r:any)=>{if(r.url==='https://oauth2.googleapis.com/token')return new MFResponse(JSON.stringify({access_token:'test-google-access',refresh_token:'test-refresh',expires_in:3600}),{headers:{'Content-Type':'application/json'}});
 if(r.url==='https://openidconnect.googleapis.com/v1/userinfo')return new MFResponse(JSON.stringify({sub:'owner',email:loginEmail,email_verified:true}),{headers:{'Content-Type':'application/json'}});
 calls.push({url:r.url,body:r.method==='POST'?await r.json():undefined});return new MFResponse(JSON.stringify({status:'completed',output:[]}),{headers:{'Content-Type':'application/json'}});}}]}));
 try{
  const db=await mf.getD1Database('DB');await db.exec((await readFile('cloud/migrations/0001_state.sql','utf8')).replaceAll('\n',' '));
  const store=new State(db as any,secret);await store.put('session:'+sid,{csrf,user:{id:'owner',email:owner},access:'fake-access',expires:Date.now()+3600000},3600000);
  const req=(path:string,data:any,options:{auth?:boolean;csrf?:string;origin?:string}={})=>mf.dispatchFetch('https://app.example'+path,{method:'POST',headers:{'content-type':'application/json',origin:options.origin??'https://app.example',cookie:options.auth===false?'':`__Host-workspace=${sid}`,'x-csrf-token':options.csrf??csrf},body:JSON.stringify(data)});
  const status=await (await mf.dispatchFetch('https://app.example/api/status')).json() as any;assert.equal(status.connected,false);assert.equal(status.ai.gemini,false);assert.ok(!JSON.stringify(status).includes('fake-openai'));
  assert.equal((await req('/api/cloud/google',{},{auth:false})).status,401);
  assert.equal((await req('/api/cloud/google',{},{csrf:'wrong'})).status,403);
  assert.equal((await req('/api/cloud/google',{},{origin:'https://evil.example'})).status,403);
  assert.equal((await req('/api/cloud/state',{action:'get',key:'session:'+sid})).status,400);
  const record='prepared:'+nonce();assert.equal((await req('/api/cloud/state',{action:'put',key:record,value:{title:'private title'},ttl:60000})).status,200);
  const rows=await db.prepare('SELECT payload FROM state WHERE key=?').bind('user:owner:'+record).first<any>();assert.ok(!rows.payload.includes('private title'));
  const takes=await Promise.all([1,2].map(()=>req('/api/cloud/state',{action:'take',key:record}).then(r=>r.json())));assert.equal(takes.filter((x:any)=>x.value).length,1);
  const claims=await Promise.all([1,2,3].map(()=>store.claim('exclusive',60000)));assert.equal(claims.filter(Boolean).length,1);
  const quotas=await Promise.allSettled(Array.from({length:21},()=>store.quota('counter',20)));assert.equal(quotas.filter(x=>x.status==='fulfilled').length,20);
  assert.equal((await req('/api/cloud/google',{operation:'drive.files.delete',parameters:{fileId:'abc'}})).status,422);assert.equal(calls.length,0);
  const denied=await mf.dispatchFetch('https://app.example/api/cloud/ai',{method:'POST',headers:{origin:'https://app.example',cookie:`__Host-workspace=${sid}`,'x-csrf-token':csrf,'content-type':'application/json','x-ai-provider':'gemini'},body:'{}'});assert.equal(denied.status,403);assert.equal(calls.length,0);
  const ai=await mf.dispatchFetch('https://app.example/api/cloud/ai',{method:'POST',headers:{origin:'https://app.example',cookie:`__Host-workspace=${sid}`,'x-csrf-token':csrf,'content-type':'application/json','x-ai-provider':'openai'},body:JSON.stringify({model:'expensive-model',input:'test',instructions:'test',tools:[{type:'web_search'}],max_output_tokens:999999,store:true})});assert.equal(ai.status,200);await ai.text();assert.equal(calls.length,1);assert.equal(calls[0].body.model,'gpt-6-luna');assert.equal(calls[0].body.max_output_tokens,12000);assert.equal(calls[0].body.store,false);assert.equal(calls[0].body.tools,undefined);
  const start=await mf.dispatchFetch('https://app.example/auth/google',{redirect:'manual'});assert.equal(start.status,302);
  const authUrl=new URL(start.headers.get('location')!);assert.equal(authUrl.searchParams.get('code_challenge_method'),'S256');assert.ok(authUrl.searchParams.get('scope')?.includes('drive.file'));
  const oauthCookie=start.headers.get('set-cookie')!.split(';')[0];const callback='https://app.example/auth/callback?state='+authUrl.searchParams.get('state')+'&code=fake-code';
  const finish=await mf.dispatchFetch(callback,{redirect:'manual',headers:{cookie:oauthCookie}});assert.equal(finish.status,302);assert.equal(finish.headers.get('location'),'/');
  assert.equal((await mf.dispatchFetch(callback,{redirect:'manual',headers:{cookie:oauthCookie}})).status,401);
  loginEmail='another@example.test';const deniedStart=await mf.dispatchFetch('https://app.example/auth/google',{redirect:'manual'});const deniedState=new URL(deniedStart.headers.get('location')!).searchParams.get('state');
  const deniedLogin=await mf.dispatchFetch('https://app.example/auth/callback?state='+deniedState+'&code=fake-code',{redirect:'manual',headers:{cookie:deniedStart.headers.get('set-cookie')!.split(';')[0]}});assert.equal(deniedLogin.status,403);
  await store.put('expired',{secret:'x'},-1);await store.cleanup();assert.equal(await store.get('expired'),undefined);
 }finally{await mf.dispose();}
});
test('Google request mapping preserves content and limits destinations',async()=>{
 const req=googleRequest('drive.files.create',{requestBody:{name:'표 문서',mimeType:'application/vnd.google-apps.document'},media:{mimeType:'text/html',body:'<table><tr><td>한글</td></tr></table>'},fields:'id'},'test');assert.equal(new URL(req.url).hostname,'www.googleapis.com');assert.ok((await req.text()).includes('<table>'));
 assert.throws(()=>googleRequest('drive.files.get',{fileId:'../escape'},'test'));
 const slides=googleRequest('slides.presentations.batchUpdate',{presentationId:'abcd',requestBody:{requests:[{createSlide:{objectId:'slide1'}}]}},'test');assert.equal(slides.method,'POST');assert.equal(new URL(slides.url).pathname,'/v1/presentations/abcd:batchUpdate');
});
