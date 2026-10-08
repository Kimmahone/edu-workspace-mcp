import {templates,templateIds,sampleDraft,draftSchema,documentDraftSchema,requestSchema,validateDraft} from '../../src/web/drafts.js';
import {designs,designedMarkdown} from '../../src/web/design.js';
import {designPreview} from '../../src/web/design-preview.js';
import {renderMarkdown} from '../../src/web/render.js';
import {generateDraft} from '../../src/web/ai.js';
import {saveOutput,readGoogleDoc} from '../../src/web/workspace.js';
import {searchStandards,resolveStandardCodes,curriculumInfo,CURRICULUM_SUBJECTS,CURRICULUM_SOURCE_NOTE} from '../../src/curriculum/standards.js';
import {learningContext,learningMapInfo} from '../../src/curriculum/learning-map.js';
import {elementaryExamples} from '../../src/web/elementary-examples.js';
import {listCourses,createAssignmentDraft,publishAssignment} from '../../src/google/classroom.js';
import {documentJob} from './documents.js';
import {transport,setCsrf} from './transport.js';
let status:any;
const id=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const store={get:async(key:string)=> (await transport('/api/cloud/state',{action:'get',key})).value,put:async(key:string,value:any,ttl=15*60000)=>transport('/api/cloud/state',{action:'put',key,value,ttl}),take:async(key:string)=>(await transport('/api/cloud/state',{action:'take',key})).value,claim:async(key:string)=>(await transport('/api/cloud/state',{action:'claim',key})).value,remove:async(key:string)=>transport('/api/cloud/state',{action:'remove',key})};
const metadata=()=>({templates:templates.map(t=>({...t,...(elementaryExamples[t.id]?{prompt:elementaryExamples[t.id].prompt,education:elementaryExamples[t.id]}:{})})),designs,elementaryExamples,curriculum:{...curriculumInfo(),learningMap:learningMapInfo(),subjects:CURRICULUM_SUBJECTS},kordoc:'4.15.4'});
function checked(data:any){if(!templateIds.includes(data.template))throw new Error('지원하지 않는 양식입니다.');return validateDraft(draftSchema.parse(data.draft),data.template);}
export async function api(path:string,data?:any,raw=false):Promise<any>{
 const url=new URL(path,location.origin),route=url.pathname;
 if(route==='/api/status'){status=await transport(route);setCsrf(status.csrf);return {...status,...metadata()};}
 if(route==='/api/logout')return transport(route,{});
 if(route==='/api/sample'){const template=url.searchParams.get('template') as any;if(!templateIds.includes(template))throw new Error('양식을 선택해 주세요.');const education=elementaryExamples[template];return {draft:sampleDraft(template),education,standards:resolveStandardCodes(education?.standardCodes??[]),learningMap:learningContext(education?.standardCodes??[])};}
 if(route==='/api/standards')return {result:searchStandards({query:url.searchParams.get('q')??'',subject:url.searchParams.get('subject')||undefined,grade:Number(url.searchParams.get('grade'))||undefined,limit:50} as any),note:CURRICULUM_SOURCE_NOTE};
 if(route==='/api/learning-context')return learningContext(url.searchParams.getAll('code'));
 if(route==='/api/validate-draft')return {draft:checked(data),standards:resolveStandardCodes(data.standardCodes??[])};
 if(route==='/api/design-preview')return {html:designPreview(checked(data),data.template,data.design)};
 if(route==='/api/preview')return {html:renderMarkdown(data.markdown)};
 if(route==='/api/documents/parse')return documentJob({action:'parse',input:new Uint8Array(await data.arrayBuffer())});
 if(route==='/api/draft/hwpx'){
  checked(data);const standards=resolveStandardCodes(data.standardCodes??[]);
  const markdown=designedMarkdown(data.draft,data.template)+(standards.length?'\n\n## 참고 성취기준\n'+standards.map(s=>s.code+' '+(s.text??s.summary)).join('\n\n'):'');
  const result=await documentJob({action:'generate',markdown,design:data.design});return {...result,file:Buffer.from(result.file).toString('base64')};
 }
 if(route==='/api/documents/hwpx'){const r=await documentJob({action:'generate',markdown:data.markdown,design:data.design});return {...r,file:Buffer.from(r.file).toString('base64')};}
 if(route==='/api/documents/patch'){const r=await documentJob({action:'patch',input:Buffer.from(data.original,'base64'),markdown:data.markdown,kind:data.kind});return {...r,file:Buffer.from(r.file).toString('base64')};}
 if(route==='/api/documents/compare')return documentJob({action:'compare',input:Buffer.from(data.first,'base64'),other:Buffer.from(data.second,'base64')});
 if(!status?.connected)throw new Error('연결 및 이용 안내에서 본인 Google 계정으로 로그인해 주세요.');
 if(route==='/api/documents/google')return readGoogleDoc(data.url);
 if(route==='/api/generate')return generateDraft(requestSchema.parse(data),{geminiKey:'server-managed',openaiKey:'server-managed',geminiNoTrainingConfirmed:status.ai.gemini,openaiNoTrainingConfirmed:status.ai.openai,geminiModel:status.models.gemini,openaiModel:status.models.openai} as any,async(url,options)=>fetch('/api/cloud/ai',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':status.csrf,'X-AI-Provider':data.provider},body:JSON.stringify({...JSON.parse(String(options?.body)),aiProcessingConsent:data.aiProcessingConsent}),signal:options?.signal}));
 if(route==='/api/save/prepare'){
  const draft=documentDraftSchema.parse(data.draft);validateDraft(draft,data.template);resolveStandardCodes(data.standardCodes??[]);
  if(!data.kinds?.length||data.kinds.length>5||new Set(data.kinds).size!==data.kinds.length)throw new Error('저장 형식을 확인해 주세요.');
  for(const kind of data.kinds){const t=({worksheet:'worksheet',slides:'slides',quiz:'quiz',sheet:'tracker',document:data.template} as Record<string,string>)[kind];if(!t)throw new Error('지원하지 않는 저장 형식입니다.');validateDraft(draft,t);}
  const key=id();await store.put(`prepared:${key}`,{...data,draft});return {id:key,title:draft.title,kinds:data.kinds};
 }
 if(route==='/api/save/commit'){
  const key=`receipt:${data.id}`,prior=await store.get(key);if(prior)return prior;
  if(!await store.claim('save-running'))throw new Error('다른 저장 작업을 처리 중입니다. 최근 작업을 확인해 주세요.');
  try{
   const prepared=await store.take(`prepared:${data.id}`);if(!prepared)throw new Error('검토 시간이 만료되었거나 이미 처리했습니다. 최근 작업을 확인해 주세요.');
   const receipt={id:data.id,title:prepared.draft.title,created:new Date().toISOString(),outputs:prepared.kinds.map((kind:string)=>({kind,status:'pending'}))};
   const persist=()=>store.put(key,receipt,7*86400000);await persist();
   await store.put('history',[data.id,...(await store.get('history')??[])].slice(0,30),7*86400000);
   for(const output of receipt.outputs){output.status='running';await persist();try{output.result=await saveOutput(output.kind,prepared.draft,prepared.template,prepared.standardCodes,prepared.design,status.formsTemplateId);output.status='done';}catch{output.status='failed';output.message='Google Drive에서 생성 여부를 먼저 확인해 주세요. 자동으로 다시 만들지 않습니다.';}await persist();}return receipt;
  }finally{await store.remove('save-running');}
 }
 if(route==='/api/history'){const ids=await store.get('history')??[];return {items:(await Promise.all(ids.map((id:string)=>store.get(`receipt:${id}`)))).filter(Boolean)};}
 if(route==='/api/classroom/courses')return {courses:await listCourses()};
 if(route==='/api/classroom/prepare'){
  const course=(await listCourses()).find(c=>c.id===data.courseId);if(!course)throw new Error('담당 수업을 선택해 주세요.');
  const created=data.action==='publish'?await store.get(`assignment:${data.courseId}:${data.courseWorkId}`):null;
  if(data.action==='publish'&&!created)throw new Error('이 앱에서 만든 과제 초안만 게시할 수 있습니다.');
  if(!['create','publish'].includes(data.action))throw new Error('지원하지 않는 작업입니다.');
  const key=id(),title=created?.title??data.title;await store.put(`classroom:${key}`,{data,courseName:course.name,title});return {id:key,courseName:course.name,title,action:data.action};
 }
 if(route==='/api/classroom/commit'){
  const key=`classroom-result:${data.id}`,prior=await store.get(key);if(prior)return prior;
  const p=await store.take(`classroom:${data.id}`);if(!p)throw new Error('이미 처리했거나 만료되었습니다.');
  await store.put(key,{status:'running'},7*86400000);
  try{const result=p.data.action==='create'?await createAssignmentDraft(p.data):await publishAssignment(p.data.courseId,p.data.courseWorkId);await store.put(`assignment:${result.courseId}:${result.courseWorkId}`,{title:p.title},7*86400000);const receipt={status:'done',...result,courseName:p.courseName};await store.put(key,receipt,7*86400000);return receipt;}catch{await store.put(key,{status:'failed'},7*86400000);throw new Error('Classroom에서 생성·게시 여부를 확인해 주세요.');}
 }
 throw new Error('지원하지 않는 요청입니다.');
}
