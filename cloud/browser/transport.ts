let csrf='';
export const setCsrf=(value:string)=>{csrf=value;};
export async function transport(path:string,data?:unknown){
 const r=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(data)});
 const body=await r.json() as any;
 if(!r.ok)throw new Error(body.error??'연결하지 못했습니다.');return body;
}
export async function googleCall(operation:string,parameters:any={}){
 if(parameters.media?.body && typeof parameters.media.body!=='string'){
  let text='';for await(const chunk of parameters.media.body)text+=chunk.toString();parameters={...parameters,media:{...parameters.media,body:text}};
 }
 const response=await fetch('/api/cloud/google',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({operation,parameters})});
 if(response.ok&&response.headers.get('X-Document-Export')==='docx'){const blob=await response.blob();if(blob.size>20*1024*1024)throw new Error('20MB 이하 문서를 선택해 주세요.');return {data:await blob.arrayBuffer()};}
 const result=await response.json();if(!response.ok)throw new Error(result.error??'Google 연결을 확인해 주세요.');return {data:result};
}
export const getAuthorizedClient=async()=>({});
