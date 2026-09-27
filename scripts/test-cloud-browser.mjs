import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import CFB from 'cfb';
import {deflateRawSync} from 'node:zlib';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CLOUD_TEST_URL??'http://127.0.0.1:3211');
 await page.waitForSelector('.idea-composer',{timeout:30000});
 const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>초등 독서 모임</w:t></w:r></w:p></w:body></w:document>');
 const docx=await zip.generateAsync({type:'base64',compression:'DEFLATE'});
 const container=CFB.utils.cfb_new();const header=Buffer.alloc(256);header.write('HWP Document File');header.writeUInt32LE(0x05000300,32);header.writeUInt32LE(1,36);CFB.utils.cfb_add(container,'FileHeader',header);CFB.utils.cfb_add(container,'DocInfo',deflateRawSync(Buffer.alloc(4)));
 const text=Buffer.from('우리 반 과학 관찰\r','utf16le'),ph=Buffer.alloc(22);ph.writeUInt32LE(text.length/2,0);ph.writeUInt16LE(1,12);ph.writeUInt16LE(1,16);
 const record=(tag,bytes)=>{const h=Buffer.alloc(4);h.writeUInt32LE(tag|(tag!==66?1<<10:0)|(bytes.length<<20));return Buffer.concat([h,bytes]);};
 CFB.utils.cfb_add(container,'BodyText/Section0',deflateRawSync(Buffer.concat([record(66,ph),record(67,text),record(68,Buffer.alloc(8)),record(69,Buffer.alloc(36))])));const hwp=Buffer.from(CFB.write(container,{type:'buffer'})).toString('base64');
 const result=await page.evaluate(async({docx,hwp})=>{
  const runtime=await import('/cloud/runtime.js');
  const status=await runtime.api('/api/status');
  const docxResult=await runtime.api('/api/documents/parse',new File([Uint8Array.from(atob(docx),c=>c.charCodeAt(0))],'sample.docx'));
  const hwpResult=await runtime.api('/api/documents/parse',new File([Uint8Array.from(atob(hwp),c=>c.charCodeAt(0))],'sample.hwp'));
  const hwpPatch=await runtime.api('/api/documents/patch',{original:hwp,markdown:hwpResult.markdown.replace('과학 관찰','독서 기록'),kind:'hwp'});
  const hwpReadBack=await runtime.api('/api/documents/parse',new File([Uint8Array.from(atob(hwpPatch.file),c=>c.charCodeAt(0))],'patched.hwp'));
  const original='# 브라우저 검증\n\n안녕하세요. 우리 반 독서 기록입니다.\n\n|책|생각|\n|---|---|\n|우주 여행|별을 만나요|';
  const made=await runtime.api('/api/documents/hwpx',{markdown:original,title:'검증',design:'navy'});
  const file=Uint8Array.from(atob(made.file),c=>c.charCodeAt(0));
  const parsed=await runtime.api('/api/documents/parse',new File([file],'test.hwpx'));
  const patched=await runtime.api('/api/documents/patch',{original:made.file,markdown:parsed.markdown.replace('독서 기록','과학 기록'),kind:'hwpx'});
  const diff=await runtime.api('/api/documents/compare',{first:made.file,second:patched.file});
  const sample=await runtime.api('/api/sample?template=worksheet');
  const hwpx=await runtime.api('/api/draft/hwpx',{draft:sample.draft,template:'worksheet',design:'blue',standardCodes:sample.education.standardCodes});
  const preview=await runtime.api('/api/design-preview',{draft:sample.draft,template:'worksheet',design:'blue'});
  return {hwpPatchWarnings:hwpPatch.warnings,hwpPatched:hwpReadBack.markdown,docx:docxResult.markdown,hwp:hwpResult.markdown,mode:status.runtime,templates:status.templates.length,kind:parsed.kind,markdown:parsed.markdown,changed:diff.changes.length,applied:patched.applied,designedBytes:hwpx.file.length,preview:preview.html.length};
 },{docx,hwp});
 console.log(JSON.stringify(result,null,2));
 assert.ok(result.docx.includes('독서 모임'));assert.ok(result.hwp.includes('과학 관찰'));assert.ok(result.hwpPatched.includes('독서 기록'));
 assert.equal(result.mode,'cloudflare');assert.equal(result.kind,'hwpx');assert.ok(result.markdown.includes('독서 기록'));assert.ok(result.changed>0);assert.ok(result.designedBytes>1000);assert.ok(result.preview>1000);assert.deepEqual(errors,[]);
 await page.screenshot({path:'.cloud-build/cloud-preview.png',fullPage:true});
 const state=new Map(),operations=[];
 await page.route('**/api/status',route=>route.fulfill({json:{runtime:'cloudflare',mode:'hosted',connected:true,csrf:'test',models:{gemini:'gemini-flash-latest',openai:'gpt-6-luna'},ai:{gemini:false,openai:false},dailyLimit:20}}));
 await page.route('**/api/cloud/state',async route=>{const d=route.request().postDataJSON();let value;if(d.action==='get')value=state.get(d.key);if(d.action==='put')state.set(d.key,d.value);if(d.action==='take'){value=state.get(d.key);state.delete(d.key);}if(d.action==='claim'){value=!state.has(d.key);if(value)state.set(d.key,true);}if(d.action==='remove')state.delete(d.key);await route.fulfill({json:{value}});});
 await page.route('**/api/cloud/google',async route=>{
  const d=route.request().postDataJSON();operations.push(d);let result={};
  if(d.operation==='drive.files.create')result={id:'document123'};
  if(d.operation==='drive.files.get')result={name:'Google 문서',mimeType:'application/vnd.google-apps.document',capabilities:{canDownload:true}};
  if(d.operation==='drive.files.export'){await route.fulfill({body:Buffer.from(docx,'base64'),contentType:'application/octet-stream',headers:{'X-Document-Export':'docx'}});return;}
  if(d.operation==='docs.documents.get')result={body:{content:[{startIndex:1,endIndex:20,paragraph:{elements:[{startIndex:1,endIndex:20,textRun:{content:'제목',textStyle:{bold:true}}}]}}]}};
  if(d.operation==='slides.presentations.create')result={presentationId:'slides123',slides:[]};
  if(d.operation==='sheets.spreadsheets.create')result={spreadsheetId:'sheet123',spreadsheetUrl:'https://docs.google.com/spreadsheets/d/sheet123/edit'};
  if(d.operation==='forms.forms.create')result={formId:'form123'};
  if(d.operation==='forms.forms.get')result={items:[],responderUri:'https://docs.google.com/forms/d/form123/viewform'};
  await route.fulfill({json:result});
 });
 const saves=await page.evaluate(async()=>{
  const {api}=await import('/cloud/runtime.js');await api('/api/status');const receipts=[];
  for(const [template,kind] of [['report','document'],['slides','slides'],['tracker','sheet'],['quiz','quiz']]){const {draft,education}=await api('/api/sample?template='+template);const prepared=await api('/api/save/prepare',{draft,template,kinds:[kind],standardCodes:education?.standardCodes??[],design:'navy'});const receipt=await api('/api/save/commit',{id:prepared.id});const again=await api('/api/save/commit',{id:prepared.id});if(JSON.stringify(receipt)!==JSON.stringify(again))throw new Error('중복 저장 결과 불일치');receipts.push(receipt);}
  const exported=await api('/api/documents/google',{url:'https://docs.google.com/document/d/document123/edit'});
  return {receipts,exported};
 });
 assert.ok(saves.exported.markdown.includes('독서 모임'));
 assert.ok(saves.receipts.every(r=>r.outputs.every(o=>o.status==='done')));
 assert.equal(operations.filter(x=>x.operation==='drive.files.create').length,1);
 assert.ok(operations.find(x=>x.operation==='drive.files.create').parameters.media.body.includes('<table'));
 assert.ok(operations.find(x=>x.operation==='docs.documents.batchUpdate').parameters.requestBody.requests.some(x=>x.updateDocumentStyle));
 assert.ok(operations.find(x=>x.operation==='slides.presentations.batchUpdate').parameters.requestBody.requests.length>30);
 assert.ok(operations.find(x=>x.operation==='sheets.spreadsheets.batchUpdate').parameters.requestBody.requests.length>10);
 assert.ok(operations.find(x=>x.operation==='forms.forms.batchUpdate').parameters.requestBody.requests.some(x=>x.updateSettings?.settings.quizSettings.isQuiz));
 console.log('Browser Google mock: Docs, Slides, Sheets, Forms designs, single-use saves and DOCX export passed.');
}finally{await browser.close();}
