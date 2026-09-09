import {createLibrary,libraryRequest} from './library.js';
import {ChromeEngine} from './engine.js';
import identity from './identity.json';
import {BatchRunner} from './batch.js';
import {Billing} from './billing.js';
import {quickstart,webUrl} from '../server/model.js';

const origins=__MIMIC_ALLOWED_ORIGINS__;
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
const ready=createLibrary(chrome.storage.local,identity.dashboardOrigin).then(store=>{const engine=new ChromeEngine(store),billing=new Billing();return {store,engine,billing,batch:new BatchRunner(store,engine,billing)};});
const errorMessage=error=>error.issues?error.issues.map(i=>i.message).join(' '):String(error.message||error).split('\n')[0].slice(0,700);
async function handle(message,sender){
  if(sender.id!==chrome.runtime.id&&!origins.includes(sender.origin||new URL(sender.url).origin))throw new Error('This website is not allowed to connect to Mimic.');
  if(message?.channel!=='mimic-v1'||typeof message.path!=='string'||!['GET','POST','PUT','DELETE'].includes(message.method)||JSON.stringify(message).length>2_000_000)throw new Error('Invalid request.');
  const {store,engine,billing,batch}=await ready;const {path,method,body}=message;
  if(path==='/state'&&method==='GET')return {...store.data,...engine.status(),token:'extension-managed',practiceUrl:`${identity.dashboardOrigin}/practice`,version:'4.0.2',connected:true,capabilities:['outcomes','repair-tests','batches','side-panel','visual-outcomes','current-tab'],batchActive:batch.active};
  if(path==='/tabs/current'&&method==='GET'){
    if(sender.id!==chrome.runtime.id)throw Error('Use the side panel to record your current tab.');
    const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    try{const url=webUrl(tab?.url);if(new URL(url).origin===identity.dashboardOrigin) return null;return {id:tab.id,url,title:tab.title?.slice(0,100)||new URL(url).hostname};}catch{return null;}
  }
  if(path==='/tab/focus'&&method==='POST')return engine.focusTab();
  if(path==='/account'&&method==='GET')return billing.account();
  if(path==='/account/connect'&&method==='POST')return billing.connect(body?.token);
  if(path==='/account/disconnect'&&method==='POST')return billing.disconnect();
  if(path==='/batches'&&method==='POST')return batch.create(body);
  const batchRoute=path.match(/^\/batches\/([^/]+)\/(start|stop|resolve)$/);
  if(batchRoute&&method==='POST')return batch[batchRoute[2]](batchRoute[1],body);
  if((batch.active||batch.locked)&&method!=='GET'&&!/^\/runs\//.test(path))throw Error('Finish or stop the batch first.');
  if(method==='POST'&&(path==='/import'||path.endsWith('/duplicate')||path==='/learn'&&!body?.commandId)){const account=await billing.account();if(store.data.commands.filter(c=>!c.sample).length>=(account.plan==='pro'?100:3))throw Error('Free includes 3 saved workflows. Connect Pro for up to 100.');}
  if(path==='/quickstart'&&method==='POST'){
    const command=quickstart(__MIMIC_PRACTICE_ORIGIN__);
    if(!store.data.commands.some(c=>c.id===command.id)){store.data.commands.unshift(command);await store.save();}
    return engine.run(command,{values:{title:'Less clicking. More living.',link:'https://example.com/a-good-idea',shelf:'Ideas'},mode:'run'});
  }
  if(path==='/recordings/current'&&method==='POST'){
    if(sender.id!==chrome.runtime.id)throw Error('Use the side panel to record your current tab.');
    if(!body||Object.keys(body).some(k=>!['name','tabId'].includes(k))||!Number.isInteger(body.tabId))throw Error('Choose the tab to record.');
    const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if(tab?.id!==body.tabId)throw Error('The active tab changed. Select it again before recording.');
    return engine.startRecording({name:body.name,url:webUrl(tab.url)},tab.id);
  }
  if(path==='/recordings/pick'&&method==='POST')return engine.pickResult();
  if(path==='/repairs/test'&&method==='POST')return engine.testRepair(body);
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
chrome.runtime.onMessage.addListener((message,sender,respond)=>{if(sender.id!==chrome.runtime.id)return;handle(message,sender).then(data=>respond({ok:true,data:JSON.parse(JSON.stringify(data))})).catch(error=>respond({ok:false,error:errorMessage(error)}));return true;});
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});
chrome.runtime.onInstalled.addListener(details=>{if(details.reason==='install')chrome.tabs.create({url:identity.dashboardOrigin+'/extension'});});
