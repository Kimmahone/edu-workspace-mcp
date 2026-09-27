import {readFileSync} from 'node:fs';
import {resolveStandardCodes} from './standards.js';
type Topic={id:string;code:string;gradeBand:string;title:string;evidence:string[];assessmentPrompt:string};
type Dependency={topicId:string;prerequisiteId:string;strength:string;reason:string};
type Dataset={upstream:{package:string;version:string;repository:string;license:string};topics:Topic[];dependencies:Dependency[]};
let cached:Dataset|undefined;
function load(){return cached??=JSON.parse(readFileSync(new URL('../../data/curriculum/learning-map.json',import.meta.url),'utf8')) as Dataset;}
export const LEARNING_MAP_NOTE='세부 주제·평가 발문·선수관계는 DECK 학습 지도 데이터의 수업 설계 참고안입니다. 국가 교육과정의 공식 수업 순서는 아닙니다. 학년은 활용 예시이며 성취기준은 학년군 기준입니다.';
export function learningMapInfo(){const d=load();return {upstream:d.upstream,topics:d.topics.length,dependencies:d.dependencies.length,note:LEARNING_MAP_NOTE};}
export function learningContext(codes:string[]){
 const standards=resolveStandardCodes(codes),d=load(),byId=new Map(d.topics.map(t=>[t.id,t]));
 const topics=standards.flatMap(s=>d.topics.filter(t=>t.code===s.code).slice(0,2)).slice(0,20).map(topic=>({...topic,prerequisites:d.dependencies.filter(edge=>edge.topicId===topic.id).slice(0,3).flatMap(edge=>{const t=byId.get(edge.prerequisiteId);return t?[{id:t.id,code:t.code,title:t.title,strength:edge.strength,reason:edge.reason}]:[]})}));
 return {note:LEARNING_MAP_NOTE,topics};
}
