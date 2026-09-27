export const MAX_FILE=20*1024*1024;
let active=0;
export async function documentJob(data:any):Promise<any>{
 if(active>=2)throw new Error('다른 문서를 처리 중입니다.');active++;
 try{return await new Promise((resolve,reject)=>{
  const worker=new Worker('/cloud/document-worker.js',{type:'module'});
  const finish=()=>{clearTimeout(timer);worker.terminate();};
  const timer=setTimeout(()=>{finish();reject(new Error('문서 처리 제한 시간(60초)을 넘었습니다. 문서를 나눠 주세요.'));},60000);
  worker.onmessage=({data})=>{finish();data.error?reject(new Error(data.error)):resolve(data.result);};
  worker.onerror=()=>{finish();reject(new Error('브라우저 문서 엔진을 시작하지 못했습니다. 새로고침해 주세요.'));};
  worker.postMessage(data);
 });}finally{active--;}
}
