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
await writeFile('.cloud-build/public/privacy.html',shell('<h1>개인용 웹앱 데이터 안내</h1><p>문서 읽기·수정·비교·HWPX 생성은 접속한 기기의 브라우저에서 Kordoc으로 처리합니다. 문서 원본은 서버에 저장하지 않습니다.</p><p>Google 로그인 시 본인 이메일을 확인하며 Google 토큰은 서버 시크릿으로 암호화해 D1에 저장합니다. 로그인은 8시간, 저장 작업 기록은 최대 7일 후 만료됩니다.</p><p>AI 생성을 누르면 요청과 초안이 선택한 Gemini 또는 OpenAI에 전달됩니다. Google 저장을 누르면 자료가 Google에 전달됩니다. 학교·학생 비공개 정보는 입력 전 소속 기관 지침을 확인하세요.</p><p>작성 중인 자료는 브라우저 메모리에만 있습니다. 로그아웃은 현재 기기 세션을 삭제합니다. Google 파일은 삭제하지 않습니다.</p>'));

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
