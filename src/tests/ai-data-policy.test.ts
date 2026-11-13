import {test} from "node:test";
import assert from "node:assert/strict";
import {generateDraft} from "../web/ai.js";
import {webConfig} from "../web/config.js";
import {requestSchema} from "../web/drafts.js";
test("missing provider policy confirmation or free-tier consent prevents outbound requests",async()=>{
 for(const provider of ["gemini","openai"] as const){
  const input=requestSchema.parse({template:"notice",prompt:"Google 문서에서 가져온 합성 내용",provider,noPersonalData:true,aiProcessingConsent:true});
  let outgoing=0;
  await assert.rejects(generateDraft(input,webConfig({GEMINI_API_KEY:"test",OPENAI_API_KEY:"test",GEMINI_FREE_TIER_CONFIRMED:"true"}),async()=>{outgoing++;return new Response("{}");}),/확인|동의/);
  assert.equal(outgoing,0);
 }
});
test("personal-data acknowledgement cannot replace explicit AI transfer consent",()=>{
 assert.throws(()=>requestSchema.parse({template:"notice",prompt:"안내문 작성",noPersonalData:true}));
 assert.throws(()=>requestSchema.parse({template:"notice",prompt:"안내문 작성",noPersonalData:true,aiProcessingConsent:false}));
});

test("free Gemini accepts a consented fresh prompt but blocks previous drafts",async()=>{
 const {assertAiDataPolicy}=await import('../web/ai-policy.js');
 const config={geminiFreeTierConfirmed:true};
 assert.doesNotThrow(()=>assertAiDataPolicy('gemini',config,{freeTierConsent:true}));
 assert.throws(()=>assertAiDataPolicy('gemini',config,{freeTierConsent:true,previous:{title:'existing document'}}),/새 초안/);
 assert.throws(()=>assertAiDataPolicy('gemini',{}, {freeTierConsent:true}),/설정/);
});
