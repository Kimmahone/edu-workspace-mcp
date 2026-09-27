/** Deliberately small allowlist: no arbitrary URL, permissions, deletion or sharing proxy. */
export function googleRequest(operation:string,p:any,token:string){
 const ident=(name:string)=>{if(typeof p[name]!=='string'||!/^[\w-]{1,200}$/.test(p[name]))throw new Error('Google 파일·수업 ID를 확인해 주세요.');return encodeURIComponent(p[name]);};
 let base='',pathname='',method='GET',body:any=p.requestBody;
 switch(operation){
 case 'drive.files.get':base='https://www.googleapis.com';pathname='/drive/v3/files/'+ident('fileId');break;
 case 'drive.files.export':base='https://www.googleapis.com';pathname='/drive/v3/files/'+ident('fileId')+'/export';if(p.mimeType!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document')throw new Error('DOCX 내보내기만 지원합니다.');break;
 case 'drive.files.copy':base='https://www.googleapis.com';pathname='/drive/v3/files/'+ident('fileId')+'/copy';method='POST';break;
 case 'drive.files.create':base='https://www.googleapis.com';pathname=p.media?'/upload/drive/v3/files':'/drive/v3/files';method='POST';break;
 case 'docs.documents.get':base='https://docs.googleapis.com';pathname='/v1/documents/'+ident('documentId');break;
 case 'docs.documents.batchUpdate':base='https://docs.googleapis.com';pathname='/v1/documents/'+ident('documentId')+':batchUpdate';method='POST';break;
 case 'slides.presentations.create':base='https://slides.googleapis.com';pathname='/v1/presentations';method='POST';break;
 case 'slides.presentations.batchUpdate':base='https://slides.googleapis.com';pathname='/v1/presentations/'+ident('presentationId')+':batchUpdate';method='POST';break;
 case 'sheets.spreadsheets.create':base='https://sheets.googleapis.com';pathname='/v4/spreadsheets';method='POST';break;
 case 'sheets.spreadsheets.batchUpdate':base='https://sheets.googleapis.com';pathname='/v4/spreadsheets/'+ident('spreadsheetId')+':batchUpdate';method='POST';break;
 case 'forms.forms.create':base='https://forms.googleapis.com';pathname='/v1/forms';method='POST';break;
 case 'forms.forms.get':base='https://forms.googleapis.com';pathname='/v1/forms/'+ident('formId');break;
 case 'forms.forms.batchUpdate':base='https://forms.googleapis.com';pathname='/v1/forms/'+ident('formId')+':batchUpdate';method='POST';break;
 case 'classroom.courses.list':base='https://classroom.googleapis.com';pathname='/v1/courses';p={...p,teacherId:'me',courseStates:['ACTIVE'],pageSize:100};break;
 case 'classroom.courses.courseWork.create':base='https://classroom.googleapis.com';pathname='/v1/courses/'+ident('courseId')+'/courseWork';method='POST';body={...body,state:'DRAFT',workType:'ASSIGNMENT'};break;
 case 'classroom.courses.courseWork.patch':base='https://classroom.googleapis.com';pathname='/v1/courses/'+ident('courseId')+'/courseWork/'+ident('id');method='PATCH';p={...p,updateMask:'state'};body={state:'PUBLISHED'};break;
 default:throw new Error('허용되지 않은 Google 작업입니다.');
 }
 const url=new URL(pathname,base);
 for(const k of ['fields','mimeType','includeTabsContent','teacherId','courseStates','pageSize','updateMask'])if(p[k]!==undefined)url.searchParams.set(k,String(p[k]));
 const headers:Record<string,string>={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 let encoded=body?JSON.stringify(body):undefined;
 if(p.media){
  if(operation!=='drive.files.create'||p.media.mimeType!=='text/html'||typeof p.media.body!=='string'||body?.mimeType!=='application/vnd.google-apps.document')throw new Error('문서 형식이 올바르지 않습니다.');
  const boundary='workspace_'+crypto.randomUUID();headers['Content-Type']='multipart/related; boundary='+boundary;url.searchParams.set('uploadType','multipart');
  encoded=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(body)}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${p.media.body}\r\n--${boundary}--`;
 }
 return new Request(url,{method,headers,body:method==='GET'?undefined:encoded,redirect:'manual'});
}
