import {createLibrary,libraryRequest} from './library.js';
import {ChromeEngine} from './engine.js';
import identity from './identity.json';

const origins=__MIMIC_ALLOWED_ORIGINS__;
const ready=createLibrary(chrome.storage.local,identity.dashboardOrigin).then(store=>({store,engine:new ChromeEngine(store)}));
const errorMessage=error=>error.issues?error.issues.map(i=>i.message).join(' '):String(error.message||error).split('\n')[0].slice(0,700);
async function handle(message,sender){
  if(!origins.includes(sender.origin||new URL(sender.url).origin))throw new Error('This website is not allowed to connect to Mimic.');
  if(message?.channel!=='mimic-v1'||typeof message.path!=='string'||!['GET','POST','PUT','DELETE'].includes(message.method)||JSON.stringify(message).length>2_000_000)throw new Error('Invalid request.');
  const {store,engine}=await ready;const {path,method,body}=message;
  if(path==='/state'&&method==='GET')return {...store.data,...engine.status(),token:'extension-managed',practiceUrl:`${identity.dashboardOrigin}/practice`,version:'1.1.0',connected:true};
  if(path==='/recordings'&&method==='POST')return engine.startRecording(body);
  if(path==='/recordings/pause'&&method==='POST')return engine.pauseRecording();
  if(path==='/recordings/stop'&&method==='POST')return engine.finishRecording();
  const run=path.match(/^\/commands\/([^/]+)\/run$/);
  if(run&&method==='POST'){const c=store.data.commands.find(c=>c.id===run[1]);if(!c)throw new Error('Command not found.');return engine.run(c,body);}
  const control=path.match(/^\/runs\/([^/]+)\/(continue|cancel)$/);
  if(control&&method==='POST')return control[2]==='continue'?engine.continueRun(control[1]):engine.cancelRun(control[1]);
  return libraryRequest(store,engine,path,method,body);
}
chrome.runtime.onMessageExternal.addListener((message,sender,respond)=>{
  handle(message,sender).then(data=>respond({ok:true,data:JSON.parse(JSON.stringify(data))})).catch(error=>respond({ok:false,error:errorMessage(error)}));return true;
});
chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:identity.dashboardOrigin}));
chrome.runtime.onInstalled.addListener(()=>chrome.tabs.create({url:identity.dashboardOrigin}));
