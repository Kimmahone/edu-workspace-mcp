// Human runs login first. This script creates only one synthetic Doc and Sheet.
// Authentication is handled by the built Agent, never by opening/copying OAuth files here.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.join(root,'.live-pilot');
const stateFile=path.join(directory,'edit-verification.json');
const server='https://edu-workspace-mcp-agent.kimjj0709.workers.dev';
const health=await (await fetch(server+'/healthz',{signal:AbortSignal.timeout(15000)})).json();
if(health.ready!==true || health.freeOnly!==true || health.docsSheetsEdit!==true) {
 console.error('EDIT_SERVER_NOT_READY: 편집 서버 배포와 현재 무료 조건 확인이 먼저 필요합니다. Google 로그인은 시작하지 않았습니다.');
 process.exit(1);
}
if(process.argv.includes('--preflight')) {console.log('편집 서버·무료 운영 상태 확인. Google 로그인·동의는 본인이 직접 진행하세요.');process.exit(0);}
await mkdir(directory,{recursive:true});
let state;
try {state=JSON.parse(await readFile(stateFile,'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;state={evidenceKind:'live-partial',version:'1.2.0',startedAt:new Date().toISOString(),operations:{},checks:{}};}
const save=()=>writeFile(stateFile,JSON.stringify(state,null,2)+'\n',{mode:0o600});
const env=Object.fromEntries(Object.entries(process.env).filter(([key,value])=>value!==undefined && !key.startsWith('EDU_WORKSPACE_')));
Object.assign(env,{EDU_WORKSPACE_SCOPE_PROFILE:'workspace-edit',EDU_WORKSPACE_REMOTE_PROFILE:'default',EDU_WORKSPACE_REMOTE_URL:server+'/mcp'});
const transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'dist/cli.js'),'serve','--workspace-edit'],env,stderr:'pipe'});
transport.stderr?.on('data',()=>{});
const client=new Client({name:'edu-agent-edit-pilot',version:'1.2.0'});
const data=result=>result.structuredContent??JSON.parse(result.content.find(item=>item.type==='text').text);
async function call(name,args) {
 const result=await client.callTool({name,arguments:args});
 if(result.isError)throw new Error(String(data(result).error??'GOOGLE_PILOT_FAILED'));
 return data(result);
}
async function write(name,args,slot) {
 // Store the ID before sending. An interrupted create reuses the same ID and is rejected rather than duplicated.
 state.operations[slot]??=randomUUID();await save();
 return call(name,{...args,requestId:state.operations[slot]});
}
const textOf=value=>{const text=[];const walk=item=>{if(!item||typeof item!=='object')return;if(item.textRun?.content)text.push(item.textRun.content);for(const child of Object.values(item))if(child&&typeof child==='object')Array.isArray(child)?child.forEach(walk):walk(child);};walk(value);return text.join('');};
try {
 await client.connect(transport);
 const auth=await call('workspace_get_auth_status',{});
 if(auth.authenticated!==true || auth.profile!=='workspace-edit' || auth.writeEnabled!==true || auth.freeOnly!==true)throw new Error('GOOGLE_EDIT_CONSENT_REQUIRED');
 state.checks.writeGoogleAuthorization=true;await save();
 if(state.evidenceKind==='live-write-success') {console.log(JSON.stringify({alreadyVerified:true,documentUrl:state.documentUrl,spreadsheetUrl:state.spreadsheetUrl}));}
 else {
  if(!state.documentId) {
   const result=await write('docs_create_document',{title:'MCP 생성·편집 검증 '+state.startedAt.slice(0,10)},'createDoc');
   state.documentId=result.documentId;state.documentUrl=result.url;await save();
  }
  let doc=await call('docs_read_document',{documentId:state.documentId});
  if(!doc.revisionId)throw new Error('DOCUMENT_REVISION_REQUIRED');
  const initial='MCP 문서 생성 및 편집 시험입니다.';
  const updated='MCP 문서 생성과 기존 내용 수정이 확인되었습니다.';
  if(!textOf(doc).includes(initial) && !textOf(doc).includes(updated)) {
   const tabId=doc.tabs?.[0]?.documentTab?.tabProperties?.tabId??doc.tabs?.[0]?.tabProperties?.tabId;
   await write('docs_batch_update',{documentId:state.documentId,requiredRevisionId:doc.revisionId,requests:[{insertText:{location:{index:1,...(tabId?{tabId}:{})},text:initial+'\n'}}]},'insertDoc');
   doc=await call('docs_read_document',{documentId:state.documentId});
  }
  if(!textOf(doc).includes(updated)) {
   await write('docs_batch_update',{documentId:state.documentId,requiredRevisionId:doc.revisionId,requests:[{replaceAllText:{containsText:{text:initial,matchCase:true},replaceText:updated}}]},'editDoc');
  }
  doc=await call('docs_read_document',{documentId:state.documentId});
  if(!textOf(doc).includes(updated))throw new Error('DOCUMENT_READ_BACK_FAILED');
  state.checks.documentCreateAndEdit=true;await save();
  if(!state.spreadsheetId) {
   const result=await write('sheets_create_spreadsheet',{title:'MCP 시트 생성·편집 검증 '+state.startedAt.slice(0,10),sheetTitle:'검증'},'createSheet');
   state.spreadsheetId=result.spreadsheetId;state.spreadsheetUrl=result.url;await save();
  }
  if(!state.checks.spreadsheetCreateAndEdit) {
   await write('sheets_write_values',{spreadsheetId:state.spreadsheetId,range:'검증!A1:B2',values:[['항목','값'],['검증',1]]},'insertValues');
   await write('sheets_write_values',{spreadsheetId:state.spreadsheetId,range:'검증!B2',values:[[2]]},'editValues');
   const sheets=await call('sheets_list_sheets',{spreadsheetId:state.spreadsheetId});
   const sheetId=sheets.sheets[0].properties.sheetId;
   await write('sheets_batch_update',{spreadsheetId:state.spreadsheetId,requests:[{repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:2},cell:{userEnteredFormat:{textFormat:{bold:true},backgroundColor:{red:0.85,green:0.93,blue:0.88}}},fields:'userEnteredFormat'}}]},'formatSheet');
   const result=await call('sheets_read_values',{spreadsheetId:state.spreadsheetId,range:'검증!A1:B2'});
   if(result.values?.[1]?.[1]!==2)throw new Error('SPREADSHEET_READ_BACK_FAILED');
   state.checks.spreadsheetCreateAndEdit=true;await save();
  }
  const repeated=await client.callTool({name:'docs_create_document',arguments:{title:'MCP 생성·편집 검증 '+state.startedAt.slice(0,10),requestId:state.operations.createDoc}});
  if(!repeated.isError || data(repeated).error!=='REQUEST_ALREADY_USED')throw new Error('DUPLICATE_WRITE_NOT_BLOCKED');
  state.checks.writeDuplicateDenied=true;state.evidenceKind='live-write-success';state.completedAt=new Date().toISOString();await save();
  console.log(JSON.stringify({googleEditConnected:true,documentCreateAndEdit:true,spreadsheetCreateAndEdit:true,duplicateCreateBlocked:true,documentUrl:state.documentUrl,spreadsheetUrl:state.spreadsheetUrl,documentContentsStored:false}));
 }
} catch(error) {
 state.lastFailure={at:new Date().toISOString(),code:/^[A-Z0-9_]+$/.test(error.message)?error.message:'EDIT_PILOT_FAILED'};await save();
 console.error(state.lastFailure.code+' — 자동으로 새 문서·시트를 다시 만들지 않았습니다.');process.exitCode=1;
} finally {await client.close().catch(()=>{});}
