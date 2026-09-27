import {googleCall} from './transport.js';
function resource(path:string):any{return new Proxy(()=>{}, {get:(_target,key)=>resource(`${path}.${String(key)}`),apply:(_target,_this,args)=>googleCall(path,args[0])});}
export const google={drive:()=>resource('drive'),docs:()=>resource('docs'),slides:()=>resource('slides'),sheets:()=>resource('sheets'),forms:()=>resource('forms'),classroom:()=>resource('classroom')};
