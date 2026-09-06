import identity from '../extension/identity.json';
// The schema and starter command are shared with the Node and extension runtimes.
// @ts-expect-error This shared JavaScript module is checked by the model tests.
import {starter} from '../server/model.js';
import type {State} from './types';

export const isCloud=import.meta.env.MODE==='cloud';
export const dashboardUrl=identity.dashboardOrigin;
type Runtime={lastError?:{message?:string};sendMessage:(id:string,message:unknown,cb:(response:{ok:boolean;data:unknown;error?:string}|undefined)=>void)=>void};
const runtime=()=>((globalThis as unknown as {chrome?:{runtime?:Runtime}}).chrome?.runtime);
let connectedBefore=false;
const preview:State={version:'1.1.0',commands:[starter(identity.dashboardOrigin)],demonstrations:[],runs:[],recording:null,activeRun:null,browserOpen:false,busy:false,token:'',practiceUrl:`${identity.dashboardOrigin}/practice`,connected:false};

export async function api(path:string,body?:unknown,method='POST',token=''):Promise<any>{
  if(!isCloud){const response=await fetch(`/api${path}`,{method,headers:{'Content-Type':'application/json','X-Mimic-Token':token},body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed.');return result;}
  const rt=runtime();
  if(!rt?.sendMessage)throw new Error('Open Mimic in Chrome and install the browser companion to connect.');
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('The browser companion did not respond. Reconnect it and try again.')),path==='/state'?2000:45000);
    try{rt.sendMessage(identity.extensionId,{channel:'mimic-v1',path,method,body},response=>{clearTimeout(timeout);const error=rt.lastError;if(error||!response)return reject(new Error('The browser companion is not connected. Open Mimic in Chrome with the extension installed.'));if(!response.ok)return reject(new Error(response.error||'The browser operation failed.'));resolve(response.data);});}
    catch{clearTimeout(timeout);reject(new Error('Open Mimic in Chrome and install the browser companion.'));}
  });
}
export async function readState():Promise<State>{
  if(!isCloud)return api('/state',undefined,'GET');
  try{const state=await api('/state',undefined,'GET');connectedBefore=true;return state;}
  catch(error){if(connectedBefore)throw error;return preview;}
}
export function downloadJson(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
