import {google} from 'googleapis';
import {getAuthorizedClient} from '../auth/google-auth.js';
import {withGoogleRetry} from '../google/retry.js';
import type {Draft} from './drafts.js';
import {slideScenes,slideRequests} from './slide-design.js';
import {dashboardPlan} from './sheet-design.js';
import {designs,rgb,type DesignId} from './design.js';
export async function createDesignedSlides(d:Draft,id:DesignId){
 const auth=await getAuthorizedClient(),api=google.slides({version:'v1',auth});
 const made=await withGoogleRetry(()=>api.presentations.create({requestBody:{title:d.title}}),{idempotent:false});
 const presentationId=made.data.presentationId!;
 const requests=slideRequests(slideScenes(d,id),made.data.slides?.[0]?.objectId??undefined);
 // Keep batches bounded; the file is already created and should never be recreated on failure.
 const result={presentationId,title:d.title,url:`https://docs.google.com/presentation/d/${presentationId}/edit`};
 try{for(let start=0;start<requests.length;start+=180)await withGoogleRetry(()=>api.presentations.batchUpdate({presentationId,requestBody:{requests:requests.slice(start,start+180)}}),{idempotent:false});}
 catch{return {...result,warning:'발표 파일은 만들어졌지만 내용·디자인 적용이 일부 완료되지 않았습니다. 위 파일을 열어 확인하세요. 다시 저장하면 별도 파일이 생성됩니다.'};}
 return result;
}
export async function createDesignedSheet(d:Draft,id:DesignId){
 const auth=await getAuthorizedClient(),api=google.sheets({version:'v4',auth});
 const made=await withGoogleRetry(()=>api.spreadsheets.create({requestBody:{properties:{title:d.title,locale:'ko_KR',timeZone:'Asia/Seoul'},sheets:[{properties:{sheetId:0,title:'대시보드',gridProperties:{hideGridlines:true,rowCount:100,columnCount:12},tabColorStyle:{rgbColor:rgb(designs[id].accent)}}},{properties:{sheetId:1,title:'실행 보드',gridProperties:{hideGridlines:true,frozenRowCount:4,rowCount:Math.max(100,d.rows.length+10),columnCount:Math.max(10,d.columns.length)},tabColorStyle:{rgbColor:rgb(designs[id].ink)}}}]}}),{idempotent:false});
 const spreadsheetId=made.data.spreadsheetId!;
 const result={spreadsheetId,title:d.title,url:made.data.spreadsheetUrl!};
 try{await withGoogleRetry(()=>api.spreadsheets.batchUpdate({spreadsheetId,requestBody:{requests:dashboardPlan(d,id)}}),{idempotent:false});}
 catch{return {...result,warning:'시트 파일은 만들어졌지만 데이터·대시보드 적용을 완료하지 못했습니다. 위 파일을 확인하세요. 다시 저장하면 별도 파일이 생성됩니다.'};}
 return result;
}
export async function createDesignedQuiz(d:Draft,templateId?:string){
 const auth=await getAuthorizedClient(),api=google.forms({version:'v1',auth});
 let formId:string;
 if(templateId){
  const drive=google.drive({version:'v3',auth});
  const meta=await drive.files.get({fileId:templateId,fields:'id,mimeType'});
  if(meta.data.mimeType!=='application/vnd.google-apps.form')throw new Error('Forms 디자인 원본은 Google 설문지여야 합니다.');
  const copied=await withGoogleRetry(()=>drive.files.copy({fileId:templateId,requestBody:{name:d.title},fields:'id'}),{idempotent:false});formId=copied.data.id!;
 }else{formId=(await withGoogleRetry(()=>api.forms.create({requestBody:{info:{title:d.title}}}),{idempotent:false})).data.formId!;}
 try{
 const current=await api.forms.get({formId}),requests:any[]=[];
 // Copy keeps the theme; remove only copied example items, never the original template.
 for(let i=(current.data.items?.length??0)-1;i>=0;i--)requests.push({deleteItem:{location:{index:i}}});
 requests.push({updateFormInfo:{info:{title:d.title,description:`${d.summary}\n\n${d.questions.length}문항 · 총 ${d.questions.reduce((s,q)=>s+q.points,0)}점\n보기에서 가장 적절한 답을 선택하세요. 제출 전 모든 문항을 확인해 주세요.`},updateMask:'title,description'}},{updateSettings:{settings:{quizSettings:{isQuiz:true},emailCollectionType:'DO_NOT_COLLECT'},updateMask:'quizSettings.isQuiz,emailCollectionType'}});
 let index=0;
 d.questions.forEach((q,i)=>{
  if(i%5===0)requests.push({createItem:{item:{title:`SECTION ${String(Math.floor(i/5)+1).padStart(2,'0')}  /  ${i+1}–${Math.min(i+5,d.questions.length)}번`,description:'질문을 읽고 자신의 생각으로 답해 보세요.',...(i===0?{textItem:{}}:{pageBreakItem:{}})},location:{index:index++}}});
  const grading:any={pointValue:q.points,correctAnswers:{answers:[{value:q.correctAnswer}]}};
  if(q.explanation){grading.whenRight={text:q.explanation};grading.whenWrong={text:q.explanation};}
  requests.push({createItem:{item:{title:`${String(i+1).padStart(2,'0')}. ${q.title}`,description:`${q.points}점 · 하나의 답을 선택하세요`,questionItem:{question:{required:true,choiceQuestion:{type:'RADIO',options:q.choices.map(value=>({value})),shuffle:false},grading}}},location:{index:index++}}});
 });
 await withGoogleRetry(()=>api.forms.batchUpdate({formId,requestBody:{requests}}),{idempotent:false});
 const verified=await api.forms.get({formId});
 return {formId,title:d.title,editUrl:`https://docs.google.com/forms/d/${formId}/edit`,responderUrl:verified.data.responderUri,warning:templateId?'지정한 설문 양식의 테마를 복제했습니다. 배포 전 응답·공개 설정을 확인하세요.':'문항·섹션·해설을 적용했습니다. 테마 색상과 글꼴은 Forms의 테마 맞춤설정에서 선택하거나 디자인 원본을 연결하세요.'};
 }catch{return {formId,title:d.title,editUrl:`https://docs.google.com/forms/d/${formId}/edit`,warning:'설문 파일은 만들어졌지만 문항·정답 설정을 완료하지 못했습니다. 위 파일을 확인한 뒤 사용하세요. 다시 저장하면 별도 파일이 생성됩니다.'};}
}
