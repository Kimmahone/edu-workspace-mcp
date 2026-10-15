import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, writeFile, rename, unlink, lstat } from 'node:fs/promises';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
export const DEFAULT_REMOTE_URL='https://edu-workspace-mcp-agent.kimjj0709.workers.dev/mcp';
export const REMOTE_SCOPE='workspace.readonly offline_access';
export type RemoteSession={serverUrl:string;clientId:string;redirectUri:string;accessToken:string;refreshToken:string;expiresAt:number};
export function remoteUrl() {
 const u=new URL(process.env.EDU_WORKSPACE_REMOTE_URL??DEFAULT_REMOTE_URL);
 if(u.protocol!=='https:' || u.username || u.password || u.search || u.hash || u.pathname!=='/mcp') throw new Error('원격 MCP 주소는 query 없는 HTTPS /mcp 주소여야 합니다.');
 return u;
}
export function sessionPath() {
 const profile=process.env.EDU_WORKSPACE_REMOTE_PROFILE??'default';
 if(!['default','codex','claude','claude-desktop','cursor'].includes(profile)) throw new Error('지원하지 않는 원격 Agent profile입니다.');
 const directory=process.env.EDU_WORKSPACE_REMOTE_DIRECTORY??path.join(os.homedir(),'.edu-workspace-mcp-agent','remote');
 if(!path.isAbsolute(directory))throw new Error('원격 Agent 저장 폴더는 절대 경로여야 합니다.');
 return path.join(directory,profile+'.json');
}
async function readSession(file: string,server: string) {
 try {
  const info=await lstat(file);if(info.isSymbolicLink() || !info.isFile() || info.size>32768) throw new Error();
  const data=JSON.parse(await readFile(file,'utf8')) as RemoteSession;
  if(data.serverUrl!==server || typeof data.clientId!=='string' || typeof data.accessToken!=='string' || typeof data.refreshToken!=='string' || typeof data.expiresAt!=='number' || typeof data.redirectUri!=='string') throw new Error();
  return data;
 } catch(error) {if((error as NodeJS.ErrnoException).code==='ENOENT') return undefined;throw new Error('원격 Agent 연결 파일을 안전하게 읽지 못했습니다. 기존 Google 인증 파일은 사용하지 않았습니다.');}
}
export async function withSessionLock<T>(file: string,run:()=>Promise<T>,timeout=10000): Promise<T> {
 await mkdir(path.dirname(file),{recursive:true,mode:0o700});
 const directory=await lstat(path.dirname(file));if(!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Agent 저장 폴더를 안전하게 사용할 수 없습니다.');
 const lock=file+'.lock';const owner=randomUUID();const start=Date.now();
 for(;;) {
  try {await writeFile(lock,owner,{flag:'wx',mode:0o600});break;}
  catch(error) {if((error as NodeJS.ErrnoException).code!=='EEXIST') throw error;if(Date.now()-start>timeout) throw new Error('다른 Agent 앱이 인증을 갱신 중입니다. 잠시 뒤 다시 시도하세요. 종료된 앱의 lock은 직접 확인해야 합니다.');await new Promise(resolve=>setTimeout(resolve,100));}
 }
 try {return await run();} finally {if(await readFile(lock,'utf8').catch(()=>undefined)===owner) await unlink(lock);}
}
export async function saveSession(file: string,value: RemoteSession) {
 const temp=file+'.'+randomUUID()+'.tmp';
 try {await writeFile(temp,JSON.stringify(value),{mode:0o600,flag:'wx'});await rename(temp,file);}
 finally {await unlink(temp).catch(()=>{});}
}
async function jsonResponse(response: Response) {
 if(!response.ok){await response.body?.cancel();throw new Error(response.status===429?'무료 사용 한도에 도달했습니다. 유료로 전환하지 않습니다.':response.status===503?'무료 운영 검증 또는 서버 설정이 완료되지 않았습니다.':'원격 인증 요청이 완료되지 않았습니다. 다시 login을 실행하세요.');}
 const reader=response.body?.getReader();const parts:Uint8Array[]=[];let size=0;
 if(reader) try {for(;;){const value=await reader.read();if(value.done)break;size+=value.value.byteLength;if(size>16384)throw new Error('인증 응답이 너무 큽니다.');parts.push(value.value);}}finally{await reader.cancel().catch(()=>{});}
 const text=Buffer.concat(parts).toString('utf8');
 const data:unknown=JSON.parse(text);if(!data || typeof data!=='object' || Array.isArray(data))throw new Error('인증 응답 형식이 올바르지 않습니다.');
 return data as Record<string,unknown>;
}
export function validateRemoteTokens(data: Record<string,unknown>) {
 const scope=new Set(typeof data.scope==='string'?data.scope.split(/\s+/):[]);
 if(!scope.has('workspace.readonly') || [...scope].some(s=>!['workspace.readonly','offline_access'].includes(s)) || (typeof data.token_type!=='string' || data.token_type.toLowerCase()!=='bearer') || typeof data.access_token!=='string' || data.access_token.length>4096 || typeof data.refresh_token!=='string' || data.refresh_token.length>4096 || typeof data.expires_in!=='number' || data.expires_in<=0 || data.expires_in>300) throw new Error('원격 MCP 토큰의 권한·수명을 검증하지 못했습니다.');
 return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:Date.now()+data.expires_in*1000};
}
export async function remoteSession(file=sessionPath(),server=remoteUrl().href,send:typeof fetch=fetch,options:{forceRefresh?:boolean}={}) {
 return withSessionLock(file,async()=>{
  const saved=await readSession(file,server);if(!saved) throw new Error('사용자 Google 연결이 필요합니다. edu-workspace-mcp login을 직접 실행하세요.');
  if(!options.forceRefresh && saved.expiresAt>Date.now()+60000) return saved;
  const origin=new URL(server).origin;
  const result=await jsonResponse(await send(origin+'/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:saved.refreshToken,client_id:saved.clientId,resource:server}),redirect:'error',signal:AbortSignal.timeout(20000)}));
  const next={...saved,...validateRemoteTokens(result)};await saveSession(file,next);return next;
 });
}
export async function remoteStatus() {
 const saved=await readSession(sessionPath(),remoteUrl().href);
 return {authenticated:Boolean(saved),profile:'workspace-readonly',mode:'remote',tokenPath:sessionPath(),message:saved?'원격 Agent 연결 정보가 있습니다. 실제 서버·Google 읽기는 별도 확인이 필요합니다.':'login을 사용자 직접 실행하세요.'};
}
export async function loginRemote(options:{openBrowser?:boolean}={}) {
 const target=remoteUrl();const origin=target.origin;const file=sessionPath();
 const health=await jsonResponse(await fetch(origin+'/healthz',{redirect:'error',signal:AbortSignal.timeout(10000)}));
 if(health.freeOnly!==true || health.ready!==true) throw new Error('무료 운영 및 서버 인증 준비가 완료되지 않아 로그인하지 않았습니다.');
 const verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url'),state=randomBytes(32).toString('base64url');
 let authorizeUrl='';let used=false;let resolveCode:(code:string)=>void;let rejectCode:(error:Error)=>void;
 const received=new Promise<string>((resolve,reject)=>{resolveCode=resolve;rejectCode=reject;});
 const callback=createServer((req,res)=>{
  res.setHeader('content-type','text/html; charset=utf-8');res.setHeader('cache-control','no-store');res.setHeader('referrer-policy','no-referrer');res.setHeader('content-security-policy',"default-src 'none'; frame-ancestors 'none'");
  const base='http://127.0.0.1:'+port;
  if(req.method!=='GET' || req.headers.host!==new URL(base).host){res.writeHead(400);res.end('올바르지 않은 요청입니다.');return;}
  const u=new URL(req.url??'/',base);
  if(u.pathname==='/' && !used){res.writeHead(302,{Location:authorizeUrl});res.end();return;}
  const actual=u.searchParams.get('state')??'';const issuer=u.searchParams.get('iss');const a=createHash('sha256').update(actual).digest(),b=createHash('sha256').update(state).digest();
  if(u.pathname!=='/oauth2callback' || used || !timingSafeEqual(a,b) || issuer!==origin || u.searchParams.getAll('state').length!==1 || u.searchParams.getAll('iss').length!==1){res.writeHead(400);res.end('만료되었거나 올바르지 않은 연결입니다.');return;}
  if(u.searchParams.has('error')){used=true;res.writeHead(400);res.end('연결을 취소했습니다.');rejectCode(new Error('사용자가 연결을 취소했습니다.'));return;}
  if(u.searchParams.getAll('code').length!==1){res.writeHead(400);res.end('올바르지 않은 연결입니다.');return;}
  used=true;const code=u.searchParams.get('code');res.end('<!doctype html><meta charset="utf-8"><title>Edu Workspace Agent 연결</title><p>브라우저 연결을 받았습니다. 실행한 앱으로 돌아가 결과를 확인하세요.</p>');
  if(!code || code.length>4096) rejectCode(new Error('연결을 완료하지 못했습니다.'));else resolveCode(code);
 });
 let port=0;
 await new Promise<void>((resolve,reject)=>{callback.once('error',reject);callback.listen(0,'127.0.0.1',()=>{const a=callback.address();if(a && typeof a==='object')port=a.port;resolve();});});
 const timer=setTimeout(()=>rejectCode(new Error('로그인 대기 시간이 끝났습니다. 다시 실행하세요.')),600000);
 try {
  const redirectUri=`http://127.0.0.1:${port}/oauth2callback`;
  const registered=await jsonResponse(await fetch(origin+'/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_name:'Edu Workspace MCP Agent',redirect_uris:[redirectUri],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none',scope:REMOTE_SCOPE}),redirect:'error',signal:AbortSignal.timeout(15000)}));
  if(typeof registered.client_id!=='string' || registered.client_secret) throw new Error('공개 MCP 앱 등록을 확인하지 못했습니다.');
  const url=new URL(origin+'/authorize');url.search=new URLSearchParams({client_id:registered.client_id,response_type:'code',redirect_uri:redirectUri,resource:target.href,scope:REMOTE_SCOPE,state,code_challenge:challenge,code_challenge_method:'S256'}).toString();authorizeUrl=url.href;
  const start=`http://127.0.0.1:${port}/`;
  console.log('Google 계정 선택·동의는 사용자가 직접 진행하세요. 브라우저가 열리지 않으면 이 주소를 여세요: '+start);
  if(options.openBrowser!==false) {const args=process.platform==='darwin'?['open',[start]]:process.platform==='win32'?['cmd',['/d','/c','start','',start]]:['xdg-open',[start]];spawn(args[0] as string,args[1] as string[],{stdio:'ignore',shell:false}).on('error',()=>{});}
  const code=await received;
  const data=await jsonResponse(await fetch(origin+'/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:redirectUri,client_id:registered.client_id,resource:target.href}),redirect:'error',signal:AbortSignal.timeout(20000)}));
  await withSessionLock(file,()=>saveSession(file,{serverUrl:target.href,clientId:registered.client_id as string,redirectUri,...validateRemoteTokens(data)}));
  return {message:'원격 MCP 인증 정보를 저장했습니다. doctor와 지정한 Google 문서 읽기로 실제 연결을 확인하세요.',tokenPath:file};
 } finally {clearTimeout(timer);callback.closeAllConnections();await new Promise<void>(resolve=>callback.close(()=>resolve()));}
}
export async function disconnectRemote(localOnly=false) {
 const file=sessionPath();
 if(!localOnly){const saved=await remoteSession();const response=await fetch(new URL(saved.serverUrl).origin+'/mcp/disconnect',{method:'POST',headers:{Authorization:'Bearer '+saved.accessToken},redirect:'error',signal:AbortSignal.timeout(15000)});await jsonResponse(response);}
 await withSessionLock(file,async()=>{await unlink(file).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});});
 return {tokenPath:file,message:localOnly?'이 profile의 로컬 MCP 토큰만 제거했습니다. 서버 접근은 별도 철회가 필요합니다.':'이 Agent의 서버 접근을 해제하고 로컬 MCP 토큰을 제거했습니다. Google 프로젝트 전체 동의는 철회하지 않았습니다.'};
}
