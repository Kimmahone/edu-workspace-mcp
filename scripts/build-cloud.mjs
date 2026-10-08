import {build} from 'esbuild';
import {readFile,writeFile,mkdir,cp,rm,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
const require=createRequire(import.meta.url),root=process.cwd();
const aliases={stream:'stream-browserify',zlib:'browserify-zlib',path:'path-browserify',buffer:'buffer/',process:'process/browser'};
const plugin={name:'browser-boundaries',setup(b){
 b.onResolve({filter:/^(node:)?crypto$/},()=>({path:path.join(root,'cloud/browser/crypto.js')}));
 b.onResolve({filter:/^googleapis$/},()=>({path:path.join(root,'cloud/browser/google.ts')}));
 b.onResolve({filter:/auth\/google-auth\.js$/},()=>({path:path.join(root,'cloud/browser/transport.ts')}));
 b.onResolve({filter:/\/documents\.js$/},a=>a.importer.includes('/src/web/')?({path:path.join(root,'cloud/browser/documents.ts')}):null);
 b.onResolve({filter:/^(node:)?(stream|zlib|path|buffer|process)$/},a=>({path:require.resolve(aliases[a.path.replace(/^node:/,'')])}));
 b.onResolve({filter:/^(node:)?(fs(\/promises)?|os|child_process|url)$/},()=>({path:path.join(root,'cloud/browser/unsupported.js')}));
 b.onResolve({filter:/^(node:)?module$/},()=>({path:path.join(root,'cloud/browser/module.js')}));
 b.onResolve({filter:/(image-ocr-|parser-M77PHHCS|^sharp$|^puppeteer-core$)/},()=>({path:path.join(root,'cloud/browser/unsupported.js')}));
 b.onLoad({filter:/src\/curriculum\/(standards|learning-map)\.ts$/},async a=>{
  let s=await readFile(a.path,'utf8');
  const name=a.path.endsWith('standards.ts')?'elementary-2022':'learning-map';
  const data=await readFile(`data/curriculum/${name}.json`,'utf8');
  s=s.replace(/import \{\s*readFileSync\s*\} from [^;]+;/,'');
  s=s.replace(/JSON\.parse\(readFileSync\(DATA_URL, "utf8"\)\)/,`(${data})`);
  s=s.replace(/JSON\.parse\(readFileSync\(new URL\('[^']+',import.meta.url\),'utf8'\)\)/,`(${data})`);
  return {contents:s,loader:'ts'};
 });
}};
await rm('.cloud-build',{recursive:true,force:true});await mkdir('.cloud-build/public',{recursive:true});
await cp('web','.cloud-build/public',{recursive:true,filter:source=>!path.basename(source).startsWith('.')});
await cp('cloud/headers','.cloud-build/public/_headers');
const guide=new MarkdownIt().render(await readFile('docs/CLOUDFLARE_PERSONAL.md','utf8')).replace('<h2>4. API 키 연결</h2>','<h2 id="api-keys">4. API 키 연결</h2>').replace('<h2>3. Google 연결 — 본인만 로그인</h2>','<h2 id="cloudflare">3. Google 연결 — 본인만 로그인</h2>');
const shell=content=>`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>개인용 웹앱 안내 · Workspace Lab</title><link rel="stylesheet" href="/style.css"><style>main{max-width:900px;margin:40px auto;padding:32px;background:white;border-radius:24px;line-height:1.9}h2{margin-top:36px}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#f1f3f4}a{color:#0b57d0;text-decoration:underline}code{overflow-wrap:anywhere}</style><main><a href="/">← Workspace Lab</a>${content}</main></html>`;
await writeFile('.cloud-build/public/setup.html',shell(guide));
await writeFile('.cloud-build/public/privacy.html',shell(`<h1>개인용 웹앱 데이터 안내</h1><p>Workspace Lab · 최종 업데이트 2026-10-08<br>운영자: 김정준 · 문의·삭제 요청: <a href="mailto:kimjj0709@gmail.com">kimjj0709@gmail.com</a></p>
<h2>Google 데이터와 보관</h2><p>Google 로그인에서 본인 계정 식별자·이메일·API 토큰을 받습니다. 사용자가 선택한 문서와 초안을 읽기·변환·저장에 이용합니다. 문서 읽기·수정·비교·HWPX 생성은 접속한 기기의 브라우저에서 Kordoc으로 처리합니다. 문서 원본은 서버에 저장하지 않습니다. Google에 저장할 때 사용자가 확인한 자료를 Google 공식 API로 전송합니다. Classroom 연결 시 수업 조회와 확인한 과제 작성·게시만 제공합니다. 학생 명단·성적 조회는 웹앱에서 제공하지 않습니다.</p><p>Google 토큰·로그인 정보·작업 기록은 서버 시크릿으로 AES-GCM 암호화하여 Cloudflare D1에 저장합니다. 로그인은 8시간, 저장 확인 자료는 최대 15분, 작업 기록은 최대 7일 뒤 만료됩니다. 작성 중 자료는 브라우저 메모리에 있으며 편집본 보관 파일로 직접 저장할 수 있습니다.</p>
<h2>AI 제공자와 전송 동의</h2><p>AI 없이 예시 편집·문서 변환·Google 저장을 사용할 수 있습니다. AI 생성·다듬기는 요청문과 현재 초안을 선택한 제공자에게 전송합니다. 화면에서 제공자·전송 내용을 공개하고 별도 동의를 받은 후 호출합니다. Google 계정 이메일·OAuth 토큰은 AI 입력에 포함하지 않습니다. Google 원본·집계·익명화·파생 데이터도 학습 금지 대상입니다.</p><ul><li>OpenAI API: 직접 <code>https://api.openai.com/v1/responses</code>로 요청합니다. 운영자가 해당 API 조직의 학습 데이터 공유 비활성 설정을 확인한 경우에만 활성화합니다. API 요금제는 ChatGPT 구독과 별개입니다. <code>store=false</code>로 응답 저장을 요청하지 않으며, 학습 금지는 별도의 API 데이터 정책·설정에 따릅니다. 보안·남용 모니터링 보관이 있을 수 있고 Zero Data Retention을 보장하거나 주장하지 않습니다.</li><li>Google Gemini API: 학습에 입력을 사용하는 무료 서비스 경로는 서버에서 차단합니다. 학습에 사용하지 않는 Paid Service 적용을 운영자가 별도로 확인한 경우에만 직접 <code>https://generativelanguage.googleapis.com/v1beta/interactions</code>를 사용합니다. 자동 결제 전환은 없으며 현재 개인용 배포에서 Gemini는 비활성입니다.</li></ul><p>모델 중개 서비스·게이트웨이·모델 허브·오프라인 모델은 이 웹앱에 연결하지 않습니다. 외부 AI로의 전송은 사용자에게 보이는 요청 기능 처리에만 이용하며 범용 모델 학습·개선, 광고 또는 판매를 위해 사용하거나 전송하지 않습니다. 학생 개인정보·비공개 학교 자료는 입력하지 마세요.</p>
<h2>Google Limited Use 준수</h2><p lang="en">The use of raw or derived user data received from Google Workspace APIs will adhere to the Google Workspace API User Data and Developer Policy and the Google API Services User Data Policy, including the Limited Use requirements. Google Workspace user data is never used, transferred or sold to create, train or improve foundational or generalized AI/ML models.</p><p><a href="https://developers.google.com/workspace/workspace-api-user-data-developer-policy">Google Workspace API User Data and Developer Policy</a> · <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a></p>
<h2>접근 철회와 삭제</h2><p>로그아웃은 현재 기기 서버 세션만 삭제하며 Google 파일은 삭제하지 않습니다. Google 계정의 서드 파티 앱 설정에서 접근을 철회할 수 있습니다. 생성한 Google 파일은 Drive에서 직접 관리합니다. 서버 계정·작업 기록 삭제는 위 문의처로 요청할 수 있습니다. 로컬 Edu Workspace MCP의 별도 처리 방식은 <a href="https://edu.jeld.kr/privacy.html">MCP 개인정보처리방침</a>을 확인하세요.</p>`));

const entryPoints=['cloud/browser/document-worker.ts'];
try{await readFile('cloud/browser/runtime.ts');entryPoints.push('cloud/browser/runtime.ts');}catch{}
const bundle=await build({metafile:true,entryPoints,outdir:'.cloud-build/public/cloud',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,plugins:[plugin],inject:['cloud/browser/globals.js'],define:{global:'globalThis'},logLevel:'info'});
await cp('THIRD_PARTY_NOTICES.md','.cloud-build/public/THIRD_PARTY_NOTICES.md');
const packageDirs=new Set(Object.keys(bundle.metafile.inputs).filter(p=>p.startsWith('node_modules/')).map(p=>{const start=p.lastIndexOf('node_modules/')+13,parts=p.slice(start).split('/');return p.slice(0,start)+parts.slice(0,parts[0].startsWith('@')?2:1).join('/');}));
let licenses='Workspace Lab browser dependencies — licenses and notices\n';
for(const directory of [...packageDirs].sort()){
 const info=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
 licenses+=`\n\n=== ${info.name} ${info.version} (${info.license??'see license'}) ===\n`;
 for(const file of await readdir(directory))if(/^(licen[sc]e|copying|notice)(\.|$)/i.test(file))try{licenses+='\n'+await readFile(path.join(directory,file),'utf8');}catch{}
}
await writeFile('.cloud-build/public/cloud/LICENSES.txt',licenses);
await writeFile('.cloud-build/browser-meta.json',JSON.stringify(bundle.metafile,null,2));
console.log('Cloudflare static bundle ready (no environment files included).');
