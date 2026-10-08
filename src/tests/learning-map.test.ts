import test from 'node:test';
import assert from 'node:assert/strict';
import {elementaryExamples} from '../web/elementary-examples.js';
import {sampleDraft,validateDraft,requestSchema} from '../web/drafts.js';
import {resolveStandardCodes,gradeBandOf,searchStandards} from '../curriculum/standards.js';
import {learningContext,learningMapInfo} from '../curriculum/learning-map.js';
import {generateDraft} from '../web/ai.js';
import {webConfig} from '../web/config.js';

test('six elementary examples cover grades 1–6 with matching standards and distinct subject content',()=>{
 assert.deepEqual(Object.values(elementaryExamples).map(x=>x.grade).sort(),[1,2,3,4,5,6]);
 const titles=new Set<string>();
 for(const [template,meta]of Object.entries(elementaryExamples)){
  const draft=validateDraft(sampleDraft(template),template);titles.add(draft.title);
  assert.ok(!JSON.stringify(draft).includes('소화'));assert.ok(draft.summary.includes(`${meta.grade}학년`));
  for(const s of resolveStandardCodes(meta.standardCodes)){assert.equal(s.subject,meta.subject);assert.equal(s.gradeBand,gradeBandOf(meta.grade));}
  assert.ok(learningContext(meta.standardCodes).topics.length>0);
 }
 assert.equal(titles.size,6);
});
test('learning map uses the pinned dataset; topic and prerequisite IDs resolve and searches respect grade/subject',()=>{
 const info=learningMapInfo();assert.equal(info.topics,1956);assert.equal(info.dependencies,1894);
 const result=searchStandards({query:'분수',grade:3,subject:'수학'});assert.ok(result.total>0);
 for(const s of result.standards){assert.equal(s.subject,'수학');assert.equal(s.gradeBand,'3-4');}
 const context=learningContext(['[4수01-09]']);assert.ok(context.topics.some(t=>t.prerequisites.length));
 for(const t of context.topics){assert.equal(t.code,'[4수01-09]');assert.ok(t.evidence.length);assert.ok(t.assessmentPrompt);}
 assert.throws(()=>learningContext(['[없는기준]']));
});
test('latest Flash alias and selected learning map reach Gemini; quota failure never falls back to paid GPT',async()=>{
 const config=webConfig({GEMINI_API_KEY:'test',OPENAI_API_KEY:'test',GEMINI_NO_TRAINING_CONFIRMED:'true'});assert.equal(config.geminiModel,'gemini-flash-latest');
 const input=requestSchema.parse({template:'worksheet',prompt:'분수 학습지 만들기',provider:'gemini',grade:3,subject:'수학',audience:'초등 수업',standardCodes:['[4수01-09]'],noPersonalData:true,aiProcessingConsent:true});
 let body:any;
 await generateDraft(input,config,async(_url,init)=>{body=JSON.parse(String(init?.body));return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(sampleDraft('worksheet'))}));});
 assert.equal(body.model,'gemini-flash-latest');const prompt=JSON.parse(body.input);assert.ok(prompt.learningMap.topics.length);assert.equal(prompt.standards[0].code,'[4수01-09]');
 let calls=0;await assert.rejects(generateDraft(input,config,async url=>{calls++;assert.ok(String(url).includes('generativelanguage.googleapis.com'));return new Response('',{status:429});}),/한도/);assert.equal(calls,1);
});
