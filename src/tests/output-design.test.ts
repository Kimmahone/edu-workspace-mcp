import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownToHwpx,hwpxToProfile,parseHwpx} from 'kordoc';
import {sampleDraft} from '../web/drafts.js';
import {designedDocument,designedMarkdown,hwpxOptions} from '../web/design.js';
import {slideScenes,slideRequests} from '../web/slide-design.js';
import {dashboardPlan} from '../web/sheet-design.js';
import {printLayoutRequests} from '../google/docs.js';

test('document themes escape content and give teaching activities most of the table width',()=>{
 const draft=sampleDraft('lesson-plan');draft.title='<img src=x onerror=alert(1)>';
 const html=designedDocument(draft,'lesson-plan','warm');
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
 assert.ok(html.includes('#633D2A'));assert.ok(html.includes('width:63%'));
 const doc:any={body:{content:[{startIndex:1,table:{rows:2,tableRows:[{tableCells:['단계 · 시간','학습 과정','교수·학습 활동'].map(content=>({content:[{paragraph:{elements:[{textRun:{content}}]}}]}))}]}}]}};
 const widths=printLayoutRequests(doc,{repeatTableHeaders:true}).flatMap(r=>r.updateTableColumnProperties?[r.updateTableColumnProperties.tableColumnProperties!.width!.magnitude!]:[]);
 assert.equal(widths.length,3);assert.ok(widths[2]>widths[0]+widths[1]);
 assert.equal(printLayoutRequests(doc).filter(r=>r.updateTableColumnProperties).length,0);
});
test('sheet text cannot become formulas; dashboard has chart, dropdown and live formulas',()=>{
 const draft=sampleDraft('tracker');draft.rows[0][0]='=IMPORTXML("https://example.invalid","//x")';
 const requests=dashboardPlan(draft,'blue');
 const first=requests[0].updateCells.rows[4].values[0].userEnteredValue;
 assert.equal(first.stringValue,draft.rows[0][0]);assert.equal(first.formulaValue,undefined);
 assert.ok(requests.some(r=>r.addChart));assert.ok(requests.some(r=>r.setDataValidation));
 const formulas=requests.flatMap(r=>(r.updateCells?.rows??[]).flatMap((row:any)=>(row.values??[]).map((c:any)=>c.userEnteredValue?.formulaValue).filter(Boolean)));
 assert.ok(formulas.some((f:string)=>f.includes('COUNTIF')));assert.ok(formulas.some((f:string)=>f.includes('IFERROR')));
});
test('long slide content is paginated without discarding text and shapes stay on the page',()=>{
 const draft=sampleDraft('slides');draft.slides=[{title:'긴 내용을 담은 발표',body:Array.from({length:12},(_,i)=>`자료${i} 근거와 활동을 설명하는 문장입니다.`).join('\n')}];
 const scenes=slideScenes(draft,'navy');assert.ok(scenes.length>1);
 const text=scenes.flatMap(s=>s.boxes.map(b=>b.text??'')).join('').replace(/\s/g,'');
 for(let i=0;i<12;i++)assert.ok(text.includes(`자료${i}근거와활동을설명하는문장입니다.`));
 for(const scene of scenes)for(const box of scene.boxes)assert.ok(box.x>=0&&box.y>=0&&box.x+box.w<=720&&box.y+box.h<=405);
 const requests=slideRequests(scenes,'existing_new_blank_page');
 assert.ok(!requests.some(r=>r.deleteObject));assert.ok(!JSON.stringify(requests).includes('TEXT_AUTOFIT'));
});
test('Kordoc HWPX retains Korean content, colored header cells and semantic column widths',async()=>{
 const draft=sampleDraft('lesson-plan'),markdown=designedMarkdown(draft,'lesson-plan');
 const file=await markdownToHwpx(markdown,hwpxOptions(markdown,'warm'));
 const profile=await hwpxToProfile(Buffer.from(file));
 const table=profile.tables.find(t=>t.anchor_text==='단계시간');assert.ok(table);
 const widths=table.col_widths_hwpunit!.map(Number);assert.ok(widths[2]>widths[0]+widths[1]);
 assert.ok(JSON.stringify(table.used_border_fills).toUpperCase().includes('#633D2A'));
 const parsed=await parseHwpx(new Uint8Array(file).buffer);assert.ok(JSON.stringify(parsed).includes('독서'));
});
