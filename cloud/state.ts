const encoder=new TextEncoder();
export const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const encode=(b:Uint8Array)=>btoa(Array.from(b,x=>String.fromCharCode(x)).join(''));
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export class State {
 constructor(private db:D1Database,private secret:string){}
 private async key(){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(this.secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
 private async seal(value:unknown,key:string){const iv=crypto.getRandomValues(new Uint8Array(12));return encode(iv)+'.'+encode(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(key)},await this.key(),encoder.encode(JSON.stringify(value)))));}
 private async open<T>(value:string,key:string){const [iv,data]=value.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:encoder.encode(key)},await this.key(),decode(data)))) as T;}
 async get<T=any>(key:string){const row=await this.db.prepare('SELECT payload FROM state WHERE key=? AND expires>?').bind(key,Date.now()).first<{payload:string}>();return row?this.open<T>(row.payload,key):undefined;}
 async put(key:string,value:unknown,ttl:number){await this.db.prepare('INSERT INTO state VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,expires=excluded.expires').bind(key,await this.seal(value,key),Date.now()+ttl).run();}
 async take<T=any>(key:string){const r=await this.db.prepare('DELETE FROM state WHERE key=? RETURNING payload,expires').bind(key).first<{payload:string;expires:number}>();return r&&r.expires>Date.now()?this.open<T>(r.payload,key):undefined;}
 async remove(key:string){await this.db.prepare('DELETE FROM state WHERE key=?').bind(key).run();}
 async claim(key:string,ttl:number){const r=await this.db.prepare('INSERT INTO state VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,expires=excluded.expires WHERE state.expires<=? RETURNING key').bind(key,await this.seal(true,key),Date.now()+ttl,Date.now()).first();return !!r;}
 async quota(key:string,limit:number){const today=new Date().toISOString().slice(0,10);const r=await this.db.prepare('INSERT INTO quota(key,day,used) VALUES(?,?,1) ON CONFLICT(key,day) DO UPDATE SET used=used+1 WHERE used<? RETURNING used').bind(key,today,limit).first();if(!r)throw new Error('오늘의 앱 사용 한도에 도달했습니다. 내일 다시 이용해 주세요.');}
 async cleanup(){await this.db.batch([this.db.prepare('DELETE FROM state WHERE expires<=?').bind(Date.now()),this.db.prepare('DELETE FROM quota WHERE day<?').bind(new Date(Date.now()-3*86400000).toISOString().slice(0,10))]);}
}
