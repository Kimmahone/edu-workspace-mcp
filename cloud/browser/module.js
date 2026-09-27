import * as CFB from 'cfb';
export const createRequire=()=>name=>{if(name==='cfb')return CFB;throw new Error('지원하지 않는 모듈입니다.');};
