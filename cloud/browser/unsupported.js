const unsupported=()=>{throw new Error('이 기능은 브라우저 문서실에서 지원하지 않습니다. 로컬 앱을 사용해 주세요.');};
export const readFile=unsupported, readFileSync=unsupported, realpathSync=unsupported, writeFile=unsupported, mkdir=unsupported, mkdtemp=unsupported, rm=unsupported, execFileSync=unsupported;
export const existsSync=()=>false, platform=()=> 'browser', tmpdir=unsupported;
export const fileURLToPath=v=>String(v), pathToFileURL=v=>new URL(v,location.href);
export const parseImageDocument=unsupported,parsePdfDocument=unsupported;
export default unsupported;
