import type { Draft } from './drafts.js';
import {designs,escape,rgb,type DesignId} from './design.js';
export type Box={x:number;y:number;w:number;h:number;fill?:string;stroke?:string;text?:string;size?:number;color?:string;bold?:boolean;radius?:boolean};
export type Scene={title:string;background:string;boxes:Box[]};
function wrap(s:string,max:number){const out:string[]=[];for(const line of s.split('\n')){let current='',width=0;for(const char of line){const n=/[\u0000-\u007f]/.test(char)?.54:1;if(width+n>max){out.push(current);current='';width=0;}current+=char;width+=n;}out.push(current);}return out;}
function paragraphs(text:string){return text.split('\n').map(x=>x.replace(/^[•·\-]\s*/, '').trim()).filter(Boolean).flatMap(x=>{const lines=wrap(x,23);const parts=[];for(let i=0;i<lines.length;i+=5)parts.push(lines.slice(i,i+5).join('\n'));return parts;});}
export function slideScenes(d:Draft,id:DesignId='navy'):Scene[]{
 const p=designs[id],scenes:Scene[]=[];
 d.slides.forEach((s,index)=>{
 const chunks=paragraphs(s.body??'');if(!chunks.length)chunks.push('');
 for(let start=0;start<chunks.length;){
 const cover=index===0&&start===0, take=cover?(chunks.slice(start,start+2).join('').length<100?2:1):3, group=chunks.slice(start,start+take),boxes:Box[]=[];
 const box=(b:Box)=>boxes.push(b),text=(value:string,x:number,y:number,w:number,h:number,size:number,color=p.ink,bold=false)=>box({text:value,x,y,w,h,size,color,bold});
 box({x:0,y:0,w:720,h:8,fill:p.accent});
 text('WORKSPACE LAB  /  '+p.name.toUpperCase(),36,23,550,20,9,cover?'#BBD6E2':p.muted,true);
 const titleLines=wrap(s.title+(start?' · 계속':''),cover?16:26),titleSize=cover?32:25;
 if(cover){
 text(titleLines.join('\n'),38,84,425,Math.min(150,titleLines.length*43+10),titleSize,'#FFFFFF',true);
 text(group.join('\n\n'),40,240,450,102,13,'#D8E6EF');
 box({x:545,y:85,w:120,h:120,fill:p.accent,radius:true});box({x:512,y:191,w:95,h:95,fill:'#DDE8DB',radius:true});box({x:614,y:220,w:44,h:44,fill:'#EABD68',radius:true});
 }else{
 text(titleLines.join('\n'),36,65,648,82,titleSize,p.ink,true);
 const width=(648-(group.length-1)*14)/group.length;
 group.forEach((body,k)=>{const x=36+k*(width+14);box({x,y:158,w:width,h:178,fill:k===0?p.pale:'#F5F7F9',radius:true});text(String(k+1+start).padStart(2,'0'),x+16,175,width-32,32,20,p.accent,true);text(body,x+16,222,width-32,103,group.length===1?19:14,p.ink);});
 }
 text(d.title,36,371,570,18,8,cover?'#AAC2D4':p.muted);text(String(scenes.length+1).padStart(2,'0'),653,369,35,22,11,cover?'#FFFFFF':p.ink,true);
 scenes.push({title:s.title,background:cover?p.ink:p.paper,boxes:boxes.map(fitBox)}); start+=group.length;
 }
 });return scenes;
}
function fitBox(b:Box):Box{if(b.text===undefined)return b;let size=b.size??14;while(size>8&&wrap(b.text,(b.w-14)/size).length*size*1.35>b.h-6)size--;return {...b,size,text:wrap(b.text,(b.w-14)/size).join('\n')};}
export function sceneSvg(scene:Scene){return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="405" viewBox="0 0 720 405"><rect width="720" height="405" fill="${scene.background}"/>${scene.boxes.map(b=>b.text!==undefined?`<text x="${b.x+2}" y="${b.y+(b.size??14)}" font-family="Noto Sans KR,Apple SD Gothic Neo,sans-serif" font-size="${b.size}" fill="${b.color}" font-weight="${b.bold?700:400}">${wrap(b.text,Math.max(3,(b.w-4)/(b.size??14))).map((s,i)=>`<tspan x="${b.x+2}" dy="${i?((b.size??14)*1.35):0}">${escape(s)}</tspan>`).join('')}</text>`:`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.radius?12:0}" fill="${b.fill??'none'}"/>`).join('')}</svg>`;}
export function slideRequests(scenes:Scene[],firstPageId?:string){
 const requests:any[]=[];
 scenes.forEach((scene,i)=>{
 const page=i===0&&firstPageId?firstPageId:`lab_page_${i}`;if(!(i===0&&firstPageId))requests.push({createSlide:{objectId:page,slideLayoutReference:{predefinedLayout:'BLANK'}}});requests.push({updatePageProperties:{objectId:page,pageProperties:{pageBackgroundFill:{solidFill:{color:{rgbColor:rgb(scene.background)}}}},fields:'pageBackgroundFill'}});
 scene.boxes.forEach((b,j)=>{
 const objectId=`lab_obj_${i}_${j}`;
 requests.push({createShape:{objectId,shapeType:b.text!==undefined?'TEXT_BOX':b.radius?'ROUND_RECTANGLE':'RECTANGLE',elementProperties:{pageObjectId:page,size:{width:{magnitude:b.w,unit:'PT'},height:{magnitude:b.h,unit:'PT'}},transform:{scaleX:1,scaleY:1,translateX:b.x,translateY:b.y,unit:'PT'}}}});
 requests.push({updateShapeProperties:{objectId,shapeProperties:{outline:{propertyState:'NOT_RENDERED'},...(b.fill?{shapeBackgroundFill:{solidFill:{color:{rgbColor:rgb(b.fill)}}}}:{}),...(b.text!==undefined?{contentAlignment:'TOP'}:{})},fields:'outline'+(b.fill?',shapeBackgroundFill':'')+(b.text!==undefined?',contentAlignment':'')}});
 if(b.text){requests.push({insertText:{objectId,text:b.text}},{updateTextStyle:{objectId,textRange:{type:'ALL'},style:{fontFamily:'Noto Sans KR',fontSize:{magnitude:b.size,unit:'PT'},bold:!!b.bold,foregroundColor:{opaqueColor:{rgbColor:rgb(b.color!)}}},fields:'fontFamily,fontSize,bold,foregroundColor'}},{updateParagraphStyle:{objectId,textRange:{type:'ALL'},style:{lineSpacing:120,spaceAbove:{magnitude:0,unit:'PT'},spaceBelow:{magnitude:0,unit:'PT'}},fields:'lineSpacing,spaceAbove,spaceBelow'}});}
 });
 });return requests;
}
