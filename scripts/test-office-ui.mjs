import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state=new Map(),exports=[];let creates=0;
 await page.route('**/api/status',r=>r.fulfill({json:{runtime:'cloudflare',mode:'hosted',access:'personal',connected:true,csrf:'fixture',ai:{gemini:true,upstage:true,openai:false},geminiFreeOnly:true,models:{gemini:'gemini-flash-latest',upstage:'solar-mini4'},dailyLimit:20}}));
 await page.route('**/api/cloud/state',async r=>{const d=r.request().postDataJSON();let value;if(d.action==='get')value=state.get(d.key);if(d.action==='put')state.set(d.key,d.value);if(d.action==='take'){value=state.get(d.key);state.delete(d.key);}if(d.action==='claim'){value=!state.has(d.key);state.set(d.key,true);}if(d.action==='remove')state.delete(d.key);await r.fulfill({json:{value}});});
 await page.route('**/api/cloud/google',async r=>{
  const d=r.request().postDataJSON();let result={};
  if(d.operation==='slides.presentations.create'){creates++;result={presentationId:'slide-fixture',slides:[]};}
  if(d.operation==='sheets.spreadsheets.create'){creates++;result={spreadsheetId:'sheet-fixture',spreadsheetUrl:'https://docs.google.com/spreadsheets/d/sheet-fixture/edit'};}
  if(d.operation==='drive.files.export'){exports.push(d.parameters.mimeType);await r.fulfill({body:Buffer.from('synthetic-export'),headers:{'X-Document-Export':'binary'},contentType:'application/octet-stream'});return;}
  await r.fulfill({json:result});
 });
 for(const [template,ext,mime] of [['slides','pptx','presentationml.presentation'],['tracker','xlsx','spreadsheetml.sheet']]){
  await page.goto('http://127.0.0.1:3211/#create/'+template);
  await page.locator('#sample').click();await page.locator('#download-office').waitFor();
  assert.equal(await page.locator('#download-hwpx').count(),0);assert.equal(await page.locator('#download-md').count(),0);
  assert.equal(await page.locator('#provider option[value=gemini]').count(),1);assert.equal(await page.locator('#provider option[value=upstage]').count(),1);assert.equal(await page.locator('#provider option[value=openai]').count(),0);
  await page.locator('#download-office').click();await page.locator('#confirm-dialog[open]').waitFor();
  const downloaded=page.waitForEvent('download');await page.locator('#confirm-dialog button[value=save]').click();const file=await downloaded;assert.ok(file.suggestedFilename().endsWith('.'+ext));assert.ok(exports.at(-1).endsWith(mime));
  const count=creates;const again=page.waitForEvent('download');await page.locator('#download-office').click();await again;assert.equal(creates,count);
 }
 await page.goto('http://127.0.0.1:3211/#create/worksheet');await page.locator('#sample').click();await page.locator('#download-hwpx').waitFor();assert.equal(await page.locator('#download-office').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: Slides/PPTX, Sheets/XLSX, worksheet/HWPX, provider choices, confirmation and retry without duplicate creation. Google export responses mocked.');
}finally{await browser.close();}
