import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../node_modules/korean-elementary-learning-map-mcp/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('data/kr/manifest.json',root),'utf8'));
async function verified(name){const bytes=await readFile(new URL('data/kr/'+name,root));if(createHash('sha256').update(bytes).digest('hex')!==manifest.files[name].sha256)throw new Error('원천 파일 해시 불일치: '+name);return JSON.parse(bytes);}
const topics=(await verified('topics.json')).topics.map(t=>{
 const codes=[...new Set((t.standards??[]).map(s=>s.match(/\[[^\]]+\]$/)?.[0]).filter(Boolean))];
 if(codes.length!==1)throw new Error('성취기준 연결을 확인하세요: '+t.id);
 return {id:t.id,code:codes[0],gradeBand:t.gradeBand,title:t.titleKorean,evidence:t.evidence,assessmentPrompt:t.assessmentPrompt};
});
const dependencies=(await verified('dependencies.json')).dependencies.map(d=>({topicId:d.topicId,prerequisiteId:d.prerequisiteId,strength:d.strength,reason:d.reason}));
const ids=new Set(topics.map(t=>t.id));if(dependencies.some(d=>!ids.has(d.topicId)||!ids.has(d.prerequisiteId)))throw new Error('선수관계에 없는 주제 ID가 있습니다.');
const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
await writeFile(new URL('../data/curriculum/learning-map.json',import.meta.url),JSON.stringify({upstream:{package:pkg.name,version:pkg.version,repository:'https://github.com/taehyeonglim/korean-elementary-learning-map-mcp',license:pkg.license},topics,dependencies}));
console.log(`학습 주제 ${topics.length}개 · 선수관계 ${dependencies.length}개`);
