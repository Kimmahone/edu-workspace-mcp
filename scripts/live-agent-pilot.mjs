import { mkdir, mkdtemp, writeFile, lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loginRemote, remoteSession, disconnectRemote, sessionPath, DEFAULT_REMOTE_URL } from '../dist/remote/session.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const scopes=['documents.readonly','forms.body.readonly','forms.responses.readonly','spreadsheets.readonly','presentations.readonly'].map(value=>'https://www.googleapis.com/auth/'+value);
const origin=new URL(DEFAULT_REMOTE_URL).origin;
function exactScopes(value) {const actual=typeof value==='string'?value.trim().split(/\s+/):[];return actual.length===5 && new Set(actual).size===5 && scopes.every(scope=>actual.includes(scope));}
function documentId(value) {
 if(/^[A-Za-z0-9_-]{10,200}$/.test(value))return value;
 const url=new URL(value);const match=url.pathname.match(/^\/document\/d\/([A-Za-z0-9_-]{10,200})(?:\/|$)/);
 if(url.protocol!=='https:' || url.hostname!=='docs.google.com' || url.username || url.password || !match)throw new Error();
 return match[1];
}
function data(result) {
 if(result.structuredContent && typeof result.structuredContent==='object')return result.structuredContent;
 const block=result.content?.find(value=>value.type==='text');return block?JSON.parse(block.text):{};
}
async function call(session,name,args={}) {
 const client=new Client({name:'edu-workspace-live-pilot',version:'1.1.2'});
 const transport=new StreamableHTTPClientTransport(new URL(DEFAULT_REMOTE_URL),{requestInit:{headers:{Authorization:'Bearer '+session.accessToken}},reconnectionOptions:{maxRetries:0,maxReconnectionDelay:1000,initialReconnectionDelay:1000,reconnectionDelayGrowFactor:1}});
 try {await client.connect(transport);return await client.callTool({name,arguments:args});}
 finally {await client.close().catch(()=>{});}
}
async function health() {
 let response;
 try {response=await fetch(origin+'/healthz',{redirect:'error',signal:AbortSignal.timeout(10000)});}
 catch {throw new Error('LIVE_PILOT_SERVER_UNREACHABLE');}
 if(!response.ok) {
  await response.body?.cancel();
  throw new Error(response.status===404?'LIVE_PILOT_SERVER_NOT_DEPLOYED':'LIVE_PILOT_SERVER_NOT_READY');
 }
 let value;try {value=await response.json();}catch {throw new Error('LIVE_PILOT_SERVER_NOT_READY');}
 if(value.ready!==true || value.freeOnly!==true)throw new Error('LIVE_PILOT_SERVER_NOT_READY');
}
async function revoked(session) {
 if(session.expiresAt<=Date.now()+30000)return false;
 const response=await fetch(origin+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+session.accessToken,'content-type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'edu-workspace-live-pilot',version:'1.1.2'}}}),redirect:'error',signal:AbortSignal.timeout(15000)});
 await response.body?.cancel();return response.status===401;
}
async function main() {
 const argv=process.argv.slice(2);
 if(argv.length>1 || argv.some(value=>!['--help','--check-server'].includes(value)))throw new Error();
 if(argv.includes('--help')) {console.log('사용자가 직접 실행하는 두 계정 실증 검사입니다. 기존 앱·Google JSON·운영자 secret을 읽지 않습니다. Google 로그인과 권한 동의는 사용자가 직접 진행합니다. --check-server는 자격증명 없이 서버 준비 상태만 확인합니다.');return;}
 if(argv.includes('--check-server')) {await health();console.log('SERVER_READY_FREE_ONLY');return;}
 if(!process.stdin.isTTY || !process.stdout.isTTY) {console.error('Mac 터미널에서 npm run pilot:live를 사용자 직접 실행하세요.');process.exitCode=1;return;}
 await health();
 const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 const base=join(root,'.live-pilot');await mkdir(base,{recursive:true,mode:0o700});
 const info=await lstat(base);if(!info.isDirectory() || info.isSymbolicLink() || (info.mode&0o077)!==0 || info.uid!==process.getuid?.())throw new Error();
 const run=await mkdtemp(join(base,'run-'));
 const report={schemaVersion:1,evidenceKind:'live-partial',version:manifest.version,serverUrl:DEFAULT_REMOTE_URL,startedAt:new Date().toISOString(),checks:{authorizationCodeExchanged:false,freshGoogleRefresh:false,documentRead:false,mcpRefreshRotation:false,multiUserIsolation:false,disconnectVerified:false,freeCpuVerified:false,hostInstallVerified:false,publicPolicyVerified:false,freeLimitStopVerified:false,costExpiryStopVerified:false,expiredDataCleanupVerified:false,cleanupScheduleVerified:false},details:{documentContentStored:false,secretValuesPrinted:false,distinctAccountsHumanConfirmed:false},failedStage:null,disconnectPending:[]};
 const reader=createInterface({input:process.stdin,output:process.stdout});
 const sessions={};const active=new Set();let stage='INPUT';
 const checkpoint=async()=>{report.currentStage=stage;report.lastUpdatedAt=new Date().toISOString();await writeFile(join(base,'latest-verification.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});};
 const select=async user=>{const folder=join(run,user);await mkdir(folder,{recursive:true,mode:0o700});const metadata=await lstat(folder);if(!metadata.isDirectory() || metadata.isSymbolicLink() || (metadata.mode&0o077)!==0 || metadata.uid!==process.getuid?.())throw new Error();process.env.EDU_WORKSPACE_REMOTE_URL=DEFAULT_REMOTE_URL;process.env.EDU_WORKSPACE_REMOTE_DIRECTORY=folder;process.env.EDU_WORKSPACE_REMOTE_PROFILE='default';};
 try {
  const id=documentId((await reader.question('첫 번째 계정만 접근할 수 있는 민감정보 없는 Google Docs 시험 문서 URL 또는 ID: ')).trim());
  stage='LOGIN_A';console.log('첫 번째 시험 계정으로 Google 로그인과 읽기 5개 동의를 직접 진행하세요.');
  await select('a');await loginRemote();active.add('a');sessions.a=await remoteSession();stage='STATUS_A';console.log('MCP_CODE_EXCHANGE_A_OK');
  const statusA=await call(sessions.a,'workspace_get_auth_status');if(statusA.isError || !exactScopes(data(statusA).scope))throw new Error();
  report.checks.authorizationCodeExchanged=true;await checkpoint();console.log('LOGIN_A_EXACT_FIVE_SCOPES_OK');
  stage='READ_A';let read=await call(sessions.a,'docs_read_document',{documentId:id});if(read.isError || data(read).documentId!==id)throw new Error();
  report.checks.documentRead=true;report.checks.freshGoogleRefresh=true;read=undefined;await checkpoint();console.log('DOCUMENT_READ_AND_FRESH_GOOGLE_REFRESH_OK');
  stage='REFRESH_A';const before=sessions.a;const after=await remoteSession(undefined,undefined,undefined,{forceRefresh:true});
  if(before.refreshToken===after.refreshToken)throw new Error();sessions.a=after;
  const rotatedRead=await call(after,'docs_read_document',{documentId:id});if(rotatedRead.isError)throw new Error();
  report.checks.mcpRefreshRotation=true;await checkpoint();console.log('MCP_REFRESH_ROTATION_OK');
  stage='LOGIN_B';console.log('서로 다른 두 번째 Google 시험 계정을 선택하고 같은 읽기 5개 동의를 직접 진행하세요.');
  await select('b');await loginRemote();active.add('b');sessions.b=await remoteSession();stage='STATUS_B';console.log('MCP_CODE_EXCHANGE_B_OK');
  const confirmed=(await reader.question('브라우저에서 첫 번째와 다른 Google 계정을 선택했나요? yes를 입력해야 사용자 분리 검사로 기록합니다: ')).trim().toLowerCase()==='yes';
  if(!confirmed || sessions.a.clientId===sessions.b.clientId)throw new Error();report.details.distinctAccountsHumanConfirmed=true;
  const statusB=await call(sessions.b,'workspace_get_auth_status');if(statusB.isError || !exactScopes(data(statusB).scope))throw new Error();
  stage='ISOLATION';const denied=await call(sessions.b,'docs_read_document',{documentId:id});
  if(denied.isError!==true || !['GOOGLE_PERMISSION_DENIED','GOOGLE_DOCUMENT_NOT_FOUND'].includes(data(denied).error))throw new Error();
  console.log('SECOND_ACCOUNT_PRIVATE_DOCUMENT_ACCESS_DENIED');
  stage='DISCONNECT_A';await select('a');const currentA=await remoteSession(undefined,undefined,undefined,{forceRefresh:true});
  const fileA=sessionPath();await disconnectRemote();active.delete('a');
  const fileGone=await lstat(fileA).then(()=>false,error=>error.code==='ENOENT');if(!fileGone || !await revoked(currentA))throw new Error();
  await select('b');const currentB=await remoteSession();const retained=await call(currentB,'workspace_get_auth_status');if(retained.isError || data(retained).authenticated!==true)throw new Error();
  report.checks.multiUserIsolation=true;await checkpoint();console.log('DISCONNECT_A_AND_ACCOUNT_B_ISOLATION_OK');
  stage='DISCONNECT_B';const freshB=await remoteSession(undefined,undefined,undefined,{forceRefresh:true});await disconnectRemote();active.delete('b');if(!await revoked(freshB))throw new Error();
  report.checks.disconnectVerified=true;await checkpoint();console.log('BOTH_PILOT_CONNECTIONS_DISCONNECTED');
 } catch {report.failedStage=stage;process.exitCode=1;console.error('LIVE_CHECK_FAILED_AT_'+stage);}
 finally {
  for(const user of active) {try {await select(user);await disconnectRemote();}catch{report.disconnectPending.push(user);}}
  reader.close();report.completedAt=new Date().toISOString();
  await writeFile(join(base,'latest-verification.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log('비밀값·문서 내용 없는 실제 결과: .live-pilot/latest-verification.json');
  console.log('Free CPU·만료 정리·실제 앱 설치·공개 정책 검증을 별도로 마친 뒤 공개 guard를 확인해야 합니다.');
 }
}
main().catch(error=>{
 const messages={
  LIVE_PILOT_SERVER_NOT_DEPLOYED:'서버가 아직 배포되지 않았습니다. operator:deploy의 배포 완료를 확인한 후 이 명령을 실행하세요.',
  LIVE_PILOT_SERVER_UNREACHABLE:'서버에 연결할 수 없습니다. 네트워크와 배포 결과를 확인한 후 다시 실행하세요.',
  LIVE_PILOT_SERVER_NOT_READY:'서버가 무료 운영 준비 상태가 아닙니다. 배포 결과와 요금 검토 만료를 확인하세요.'
 };
 const code=Object.hasOwn(messages,error?.message)?error.message:'LIVE_PILOT_NOT_READY_OR_INVALID_INPUT';
 console.error(code);if(messages[code])console.error(messages[code]);process.exitCode=1;
});
