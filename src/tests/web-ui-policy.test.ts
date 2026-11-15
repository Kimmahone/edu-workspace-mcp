import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Browser-native module, also executed by this Node regression test.
import { aiAvailability, exportHelp } from '../../web/ui-policy.js';
// @ts-expect-error Browser-native template module.
import { guideMarkup } from '../../web/studio.js';
import { dashboardPlan } from '../web/sheet-design.js';
import { sampleDraft } from '../web/drafts.js';

const connected = { mode:'hosted', runtime:'cloudflare', access:'personal', connected:true, ai:{upstage:true,gemini:true,openai:false}, geminiFreeOnly:true };
test('AI controls follow the selected provider, session and free Gemini restriction',()=>{
  assert.equal(aiAvailability(connected,'upstage').refine,true);
  assert.equal(aiAvailability(connected,'gemini').generate,true);
  assert.equal(aiAvailability(connected,'gemini').refine,false);
  assert.equal(aiAvailability(connected,'openai').generate,false);
  assert.equal(aiAvailability({...connected,connected:false},'upstage').generate,false);
  assert.equal(aiAvailability({...connected,access:'public'},'upstage').generate,false);
  assert.equal(aiAvailability({...connected,geminiFreeOnly:false},'gemini').refine,true);
});
test('instructions distinguish native output types and private deployment access',()=>{
  assert.match(exportHelp('slides'),/PPTX.*Google 로그인/);
  assert.match(exportHelp('tracker'),/Excel.*Google 로그인/);
  assert.match(exportHelp('quiz'),/객관식 퀴즈/);
  assert.doesNotMatch(exportHelp('quiz'),/HWPX|PPTX/);
  assert.match(exportHelp('lesson-package'),/PPTX는 발표 부분만/);
  const guide=guideMarkup(connected);
  assert.match(guide,/본인 전용/);assert.match(guide,/Runtime variables and secrets/);
  assert.doesNotMatch(guide,/PostgreSQL|Classroom 권한 연결/);
  assert.doesNotMatch(guideMarkup({...connected,access:'public'}),/API 키는 어디/);
});
test('long merged spreadsheet headings keep wrapping and get enough height',()=>{
  const draft=sampleDraft('tracker');draft.title='긴 제목 '.repeat(30);draft.summary='줄바꿈을 유지해야 하는 긴 요약입니다. '.repeat(15);
  const requests=dashboardPlan(draft);
  for(const sheetId of [0,1]){
    const formats=requests.filter(r=>r.repeatCell?.range.sheetId===sheetId).map(r=>r.repeatCell);
    assert.equal(formats[0].cell.userEnteredFormat.wrapStrategy,'WRAP');
    // Subsequent header formatting must not clear wrapStrategy via a whole-format mask.
    for(const f of formats.slice(1))assert.notEqual(f.fields,'userEnteredFormat');
    const row=sheetId===0?2:1;
    const heights=requests.flatMap(r=>r.updateDimensionProperties?[r.updateDimensionProperties]:[]).filter(r=>r.range.sheetId===sheetId&&r.range.dimension==='ROWS'&&r.range.startIndex===row);
    assert.ok(heights.at(-1).properties.pixelSize>100);
  }
});
