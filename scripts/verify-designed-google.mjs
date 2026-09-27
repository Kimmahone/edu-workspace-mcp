import {google} from 'googleapis';
import {getAuthorizedClient} from '../dist/auth/google-auth.js';
import {createFolder,moveFile} from '../dist/google/drive.js';
import {saveOutput} from '../dist/web/workspace.js';
import {sampleDraft} from '../dist/web/drafts.js';
import {writeFile,mkdir} from 'node:fs/promises';
await mkdir('outputs/designed-google',{recursive:true});
const folder=await createFolder('Workspace Lab · 디자인 결과물 '+new Date().toISOString().slice(0,10));
const results=[];
const auth=await getAuthorizedClient(),drive=google.drive({version:'v3',auth});
try{
 for(const [template,kind] of [['report','document'],['lesson-plan','document'],['slides','slides'],['tracker','sheet'],['quiz','quiz']]){
  const d=sampleDraft(template);
  const result=await saveOutput(kind,d,template,[],'navy');
  results.push({template,kind,...result});
  await writeFile('outputs/designed-google/results.json',JSON.stringify({folder,results},null,2));
  const id=result.documentId??result.presentationId??result.spreadsheetId??result.formId;
  await moveFile(id,folder.id);
  if(kind!=='quiz'){
    const file=await drive.files.export({fileId:id,mimeType:'application/pdf'},{responseType:'arraybuffer'});
    await writeFile(`outputs/designed-google/${template}.pdf`,Buffer.from(file.data));
  }
  if(kind==='sheet'){
   const sheet=await google.sheets({version:'v4',auth}).spreadsheets.get({spreadsheetId:id,includeGridData:true});
   await writeFile('outputs/designed-google/sheet-readback.json',JSON.stringify(sheet.data));
  }
  if(kind==='slides'){
   const slides=await google.slides({version:'v1',auth}).presentations.get({presentationId:id});
   await writeFile('outputs/designed-google/slides-readback.json',JSON.stringify(slides.data));
  }
  if(kind==='quiz'){
   const form=await google.forms({version:'v1',auth}).forms.get({formId:id});
   await writeFile('outputs/designed-google/forms-readback.json',JSON.stringify(form.data));
  }
  if(kind==='document'){
   const doc=await google.docs({version:'v1',auth}).documents.get({documentId:id});
   await writeFile(`outputs/designed-google/${template}-readback.json`,JSON.stringify(doc.data));
  }
  console.log(template+': verified');
 }
} finally {await writeFile('outputs/designed-google/results.json',JSON.stringify({folder,results},null,2));}
