// Kordoc's file hashes and legacy document ciphers only; no signing/ECDH bundle.
import createHash from 'create-hash';
import cipher from 'browserify-cipher';
import pbkdf2 from 'pbkdf2';
export {createHash};
export const createCipheriv=cipher.createCipheriv,createDecipheriv=cipher.createDecipheriv,pbkdf2Sync=pbkdf2.pbkdf2Sync;
export function timingSafeEqual(a,b){if(a.length!==b.length)throw new Error('버퍼 길이가 다릅니다.');let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
