import {assertAiDataPolicy} from '../src/web/ai-policy';
import {State,nonce} from './state';
import {googleRequest} from './google';
type Secrets={APP_SECRET?:string;GOOGLE_WEB_CLIENT_ID?:string;GOOGLE_WEB_CLIENT_SECRET?:string;GEMINI_API_KEY?:string;OPENAI_API_KEY?:string};
type Env=Cloudflare.Env & Secrets & {GEMINI_NO_TRAINING_CONFIRMED?:string;OPENAI_NO_TRAINING_CONFIRMED?:string};
type Session={csrf:string;user:{id:string;email:string};access:string;refresh?:string;expires:number};
const TTL=8*3600000;
const json=(data:unknown,status=200)=>Response.json(data,{status});
class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
const fail=(status:number,message:string):never=>{throw new HttpError(status,message);};
const cookie=(name:string,value:string,age=28800)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const cookies=(r:Request,name:string)=>new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]{64})(?:;|$)`).exec(r.headers.get('cookie')??'')?.[1];
async function bounded(r:Request,limit=1024*1024){if(!r.body)return '';const reader=r.body.getReader();let length=0;const chunks:Uint8Array[]=[];for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();fail(413,'요청이 너무 큽니다.');}chunks.push(value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);}
async function input(r:Request){if(!r.headers.get('content-type')?.startsWith('application/json'))fail(415,'JSON 요청이 필요합니다.');try{return JSON.parse(await bounded(r));}catch(e){if(e instanceof HttpError)throw e;return fail(400,'입력을 확인해 주세요.');}}
async function oauth(env:Env,params:Record<string,string>){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:env.GOOGLE_WEB_CLIENT_ID!,client_secret:env.GOOGLE_WEB_CLIENT_SECRET!}),signal:AbortSignal.timeout(20000)});if(!r.ok)fail(401,'Google 연결이 만료되었거나 설정이 맞지 않습니다. 다시 로그인해 주세요.');return r.json() as Promise<any>;}
async function token(env:Env,store:State,sid:string,session:Session){if(session.expires>Date.now()+60000)return session.access;if(!session.refresh)fail(401,'Google에 다시 로그인해 주세요.');const t=await oauth(env,{grant_type:'refresh_token',refresh_token:session.refresh!});const current=await store.get<Session>('session:'+sid);if(!current)fail(401,'로그아웃되었습니다.');await store.put('session:'+sid,{...current,access:t.access_token,expires:Date.now()+t.expires_in*1000},TTL);return t.access_token;}
async function handle(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url),route=url.pathname;
 if(route==='/healthz')return json({ok:true,hosting:'cloudflare-free',documents:'browser'});
 if(!route.startsWith('/api/')&&!route.startsWith('/auth/'))return env.ASSETS.fetch(request);
 const configured=!!(env.DB&&env.APP_SECRET&&env.APP_SECRET.length>=32&&env.OWNER_EMAIL&&env.GOOGLE_WEB_CLIENT_ID&&env.GOOGLE_WEB_CLIENT_SECRET);
 const store=configured?new State(env.DB,env.APP_SECRET!):null;
 const sid=cookies(request,'__Host-workspace'),session=sid&&store?await store.get<Session>('session:'+sid):undefined;
 if(route==='/api/status'&&request.method==='GET')return json({runtime:'cloudflare',mode:'hosted',connected:!!session,user:session?.user,csrf:session?.csrf??'',ai:{gemini:!!env.GEMINI_API_KEY&&env.GEMINI_NO_TRAINING_CONFIRMED==='true',openai:!!env.OPENAI_API_KEY&&env.OPENAI_NO_TRAINING_CONFIRMED==='true'},models:{gemini:env.GEMINI_MODEL,openai:env.OPENAI_MODEL},formsThemeConnected:!!env.FORMS_TEMPLATE_ID,formsTemplateId:session?env.FORMS_TEMPLATE_ID:undefined,dailyLimit:20,setupRequired:!configured,documentRuntime:'browser'});
 if(!configured||!store)fail(503,'개인용 로그인 설정이 아직 필요합니다. 시작 가이드의 Cloudflare 설정을 완료해 주세요. 예시·한글 문서실은 로그인 없이 사용할 수 있습니다.');
 const state=store!;
 if(route==='/auth/google'&&request.method==='GET'){
  const ip=request.headers.get('CF-Connecting-IP')??'local';await state.quota('login:'+ip,30);
  const loginId=nonce(),verifier=nonce(),challenge=nonce();await state.put('oauth:'+challenge,{loginId,verifier},600000);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  const pkce=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const scope=['openid','email','https://www.googleapis.com/auth/drive.file',...(url.searchParams.get('classroom')==='1'?['https://www.googleapis.com/auth/classroom.courses.readonly','https://www.googleapis.com/auth/classroom.coursework.students']:[])].join(' ');
  target.search=new URLSearchParams({client_id:env.GOOGLE_WEB_CLIENT_ID!,redirect_uri:url.origin+'/auth/callback',response_type:'code',scope,state:challenge,code_challenge:pkce,code_challenge_method:'S256',access_type:'offline',prompt:'consent',include_granted_scopes:'true'}).toString();
  return new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':cookie('__Host-workspace-login',loginId,600)}});
 }
 if(route==='/auth/callback'&&request.method==='GET'){
  const challenge=url.searchParams.get('state')??'',code=url.searchParams.get('code')??'';if(!/^[a-f0-9]{64}$/.test(challenge)||!code||code.length>4096)fail(400,'로그인 요청이 올바르지 않습니다.');
  const pending=await state.take('oauth:'+challenge);if(!pending||pending.loginId!==cookies(request,'__Host-workspace-login'))fail(401,'로그인 요청이 만료되었습니다.');
  const t=await oauth(env,{grant_type:'authorization_code',code,code_verifier:pending.verifier,redirect_uri:url.origin+'/auth/callback'});
  const userResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+t.access_token},signal:AbortSignal.timeout(20000)});
  if(!userResponse.ok)fail(401,'Google 계정을 확인하지 못했습니다.');const user=await userResponse.json() as any;
  if(!user.sub||user.email_verified!==true||user.email?.toLowerCase()!==env.OWNER_EMAIL.toLowerCase())fail(403,'이 앱은 소유자 본인만 사용할 수 있습니다.');
  const newId=nonce();await state.put('session:'+newId,{csrf:nonce(),user:{id:user.sub,email:user.email},access:t.access_token,refresh:t.refresh_token,expires:Date.now()+t.expires_in*1000},TTL);
  if(sid)await state.remove('session:'+sid);const h=new Headers({Location:'/'});h.append('Set-Cookie',cookie('__Host-workspace',newId));h.append('Set-Cookie',cookie('__Host-workspace-login','',0));return new Response(null,{status:302,headers:h});
 }
 if(!session||!sid)fail(401,'본인 Google 계정으로 로그인해 주세요.');
 if(request.method!=='POST')fail(405,'POST 요청이 필요합니다.');
 if(request.headers.get('origin')!==url.origin||request.headers.get('x-csrf-token')!==session!.csrf)fail(403,'화면을 새로고침하고 다시 시도해 주세요.');
 if(session!.user.email.toLowerCase()!==env.OWNER_EMAIL.toLowerCase())fail(403,'이 앱의 소유자 계정으로 다시 로그인해 주세요.');
 const owner=session!.user.id;
 if(route==='/api/logout'){await state.remove('session:'+sid);const r=json({ok:true});r.headers.set('Set-Cookie',cookie('__Host-workspace','',0));return r;}
 if(route==='/api/cloud/state'){
  const d=await input(request);if(typeof d.key!=='string'||! /^(history|save-running|(?:prepared|receipt|classroom|classroom-result):[a-f0-9]{64}|assignment:[\w-]{1,200}:[\w-]{1,200})$/.test(d.key))fail(400,'잘못된 작업 키입니다.');
  const key='user:'+owner+':'+d.key;await state.quota('state:'+owner,3000);
  if(d.action==='get')return json({value:await state.get(key)});
  if(d.action==='take')return json({value:await state.take(key)});
  if(d.action==='remove'){await state.remove(key);return json({ok:true});}
  if(d.action==='claim')return json({value:await state.claim(key,5*60000)});
  if(d.action==='put'){if(JSON.stringify(d.value).length>256000)fail(413,'저장할 작업이 너무 큽니다.');const ttl=Math.min(Math.max(Number(d.ttl)||900000,1000),7*86400000);await state.put(key,d.value,ttl);return json({ok:true});}
  fail(400,'지원하지 않는 저장 작업입니다.');
 }
 if(route==='/api/cloud/ai'){
  const provider=request.headers.get('x-ai-provider');if(!['gemini','openai'].includes(provider??''))fail(400,'AI를 선택해 주세요.');
  try{assertAiDataPolicy(provider!,{geminiNoTrainingConfirmed:env.GEMINI_NO_TRAINING_CONFIRMED==='true',openaiNoTrainingConfirmed:env.OPENAI_NO_TRAINING_CONFIRMED==='true'});}catch(e){fail(403,e instanceof Error?e.message:'AI 데이터 처리 설정을 확인해 주세요.');}
  const key=provider==='gemini'?env.GEMINI_API_KEY:env.OPENAI_API_KEY;if(!key)fail(422,'AI 키가 연결되지 않았습니다.');
  const d=await input(request);if(d.aiProcessingConsent!==true)fail(400,'선택한 AI 제공자에게 입력을 보내는 데 동의해 주세요.');const lock='ai:'+owner;if(!await state.claim(lock,120000))fail(429,'다른 AI 요청을 처리 중입니다.');
  try{
   await state.quota('ai:'+owner,20);
   const isGemini=provider==='gemini';
   // Construct a new payload: never accept tools, background jobs, arbitrary URLs or client model overrides.
   const payload=isGemini?{model:env.GEMINI_MODEL,system_instruction:d.system_instruction,input:d.input,store:false,response_format:d.response_format,generation_config:{max_output_tokens:12000}}:{model:env.OPENAI_MODEL,instructions:d.instructions,input:d.input,store:false,max_output_tokens:12000,text:d.text};
   if(typeof payload.input!=='string'||payload.input.length>150000)fail(400,'AI 입력이 너무 크거나 올바르지 않습니다.');
   const r=await fetch(isGemini?'https://generativelanguage.googleapis.com/v1beta/interactions':'https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',...(isGemini?{'x-goog-api-key':key!}:{Authorization:'Bearer '+key})},body:JSON.stringify(payload),signal:AbortSignal.timeout(90000),redirect:'manual'});
   if(!r.ok){await r.body?.cancel();return json({error:'AI 제공자 한도 또는 연결을 확인해 주세요. 다른 AI로 자동 전환하지 않습니다.'},r.status);}
   return new Response(r.body,{headers:{'Content-Type':'application/json'}});
  }finally{await state.remove(lock);}
 }
 if(route==='/api/cloud/google'){
  const d=await input(request);if(!d.parameters||typeof d.parameters!=='object')fail(400,'Google 요청 형식을 확인해 주세요.');
  await state.quota('google:'+owner,500);const access=await token(env,state,sid!,session!);
  const upstream=googleRequest(d.operation,d.parameters,access),r=await fetch(upstream,{signal:AbortSignal.timeout(60000)});
  if(!r.ok){await r.body?.cancel();return json({error:`Google 요청을 완료하지 못했습니다 (${r.status}). 권한과 Drive의 생성 결과를 확인해 주세요.`},r.status);}
  if(d.operation==='drive.files.export')return new Response(r.body,{headers:{'Content-Type':'application/octet-stream','X-Document-Export':'docx'}});
  return new Response(r.body,{headers:{'Content-Type':'application/json'}});
 }
 return fail(404,'요청한 기능을 찾을 수 없습니다.');
}
export default {
 async fetch(request:Request,env:Env){
  // Dashboard variables survive Git deployments; absent settings use safe defaults.
  env={...env,OWNER_EMAIL:env.OWNER_EMAIL??'',GEMINI_MODEL:env.GEMINI_MODEL||'gemini-flash-latest',OPENAI_MODEL:env.OPENAI_MODEL||'gpt-6-luna',GEMINI_FREE_TIER_CONFIRMED:env.GEMINI_FREE_TIER_CONFIRMED??'false',FORMS_TEMPLATE_ID:env.FORMS_TEMPLATE_ID??''};
  let response:Response;try{response=await handle(request,env);}catch(e){response=json({error:e instanceof HttpError?e.message:'작업을 완료하지 못했습니다. 무료 사용량 한도 또는 연결 설정을 확인해 주세요.'},e instanceof HttpError?e.status:422);}
  const h=new Headers(response.headers);h.set('Cache-Control','no-store');h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');h.set('X-Frame-Options','DENY');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");return new Response(response.body,{status:response.status,headers:h});
 },
 async scheduled(_event:ScheduledController,env:Env){if(env.APP_SECRET)await new State(env.DB,env.APP_SECRET).cleanup();}
} satisfies ExportedHandler<Env>;
