import {id,now,webUrl,normalizeSteps,materialize,stepSchema,recordSchema,runSchema} from '../server/model.js';
import {installRecorder} from '../server/recorder.js';
import {targetAction} from './dom.js';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export class ChromeEngine {
  constructor(store){
    this.store=store;this.recording=null;this.activeRun=null;this.tabId=null;this.locked=false;this.lastActionAt=0;this.loaded=0;this.mainFrameId=null;this.contexts=new Map();this.events=Promise.resolve();
    chrome.debugger.onEvent.addListener((source,method,params)=>this.event(source,method,params));
    chrome.debugger.onDetach.addListener(source=>{if(source.tabId!==this.tabId)return;this.tabId=null;if(this.recording)this.finishRecording('The controlled tab was closed or disconnected. Captured steps were saved.').catch(()=>{});if(this.activeRun){this.activeRun.cancelled=true;this.activeRun.resume?.();}});
    chrome.tabs.onCreated.addListener(tab=>{if(this.recording&&tab.openerTabId===this.tabId){this.recording.warnings.push('A new tab opened. Its interactions are not recorded; use a separate command.');this.persist().catch(()=>{});}});
  }
  async persist(){if(this.recording)this.store.data.activeRecording=this.recording;else delete this.store.data.activeRecording;await this.store.save();}
  status(){return {recording:this.recording,activeRun:this.activeRun?this.store.data.runs.find(r=>r.id===this.activeRun.id):null,browserOpen:this.tabId!==null,busy:this.locked};}
  async send(method,params={}){if(this.tabId===null)throw new Error('The workflow tab is no longer connected.');return chrome.debugger.sendCommand({tabId:this.tabId},method,params);}
  async evaluate(fn,...args){const result=await this.send('Runtime.evaluate',{expression:`(${fn.toString()})(${args.map(v=>JSON.stringify(v)).join(',')})`,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error('The page did not accept this operation.');return result.result?.value;}
  async open(){
    await this.detach();
    const tab=await chrome.tabs.create({url:'about:blank',active:true});this.tabId=tab.id;
    try{await chrome.debugger.attach({tabId:tab.id},'1.3');await this.send('Page.enable');await this.send('Runtime.enable');const tree=await this.send('Page.getFrameTree');this.mainFrameId=tree.frameTree.frame.id;this.contexts.clear();}
    catch(error){this.tabId=null;throw new Error(`Chrome could not connect this tab. ${String(error.message).split('\n')[0]}`);}
  }
  async detach(){const tabId=this.tabId;this.tabId=null;if(tabId!==null)await chrome.debugger.detach({tabId}).catch(()=>{});}
  async navigate(url){const before=this.loaded;const result=await this.send('Page.navigate',{url:webUrl(url)});if(result.errorText)throw new Error(`Could not load this page: ${result.errorText}`);const start=Date.now();while(result.loaderId&&this.loaded===before){if(this.activeRun?.cancelled)throw new Error('Run cancelled.');if(Date.now()-start>30000)throw new Error('The page did not finish loading. Check the website and try again.');await sleep(70);}}
  async add(event){
    if(!this.recording||this.recording.status!=='recording')return;
    if(this.recording.steps.length>=250){this.recording.status='paused';this.recording.warnings.push('250-step limit reached. Finish this demonstration.');await this.persist();return;}
    const step=stepSchema.safeParse({...event,id:id()});
    if(step.success){this.recording.steps=normalizeSteps([...this.recording.steps,step.data]);this.lastActionAt=Date.now();}
    else if(!this.recording.warnings.includes('An unsupported action was omitted. Review the captured steps.'))this.recording.warnings.push('An unsupported action was omitted. Review the captured steps.');
    await this.persist();
  }
  enqueue(fn){const result=this.events.catch(()=>{}).then(fn);this.events=result;result.catch(()=>{});return result;}
  event(source,method,params){
    if(source.tabId!==this.tabId)return;
    if(method==='Page.loadEventFired')this.loaded++;
    if(method==='Runtime.executionContextCreated'){const c=params.context;if(c.auxData?.isDefault)this.contexts.set(c.id,c.auxData.frameId);}
    if(method==='Runtime.executionContextDestroyed')this.contexts.delete(params.executionContextId);
    if(method==='Runtime.bindingCalled'&&params.name==='__mimicBridge'&&this.recording&&this.contexts.get(params.executionContextId)===this.mainFrameId){
      try{if(params.payload.length>50000)return;const message=JSON.parse(params.payload);if(message.event)this.enqueue(()=>this.add(message.event));if(message.control==='stop')setTimeout(()=>this.finishRecording().catch(()=>{}),100);}catch{}
    }
    if(method==='Page.frameNavigated'&&this.recording&&!params.frame.parentId){
      const rec=this.recording;
      this.enqueue(async()=>{if(this.recording!==rec||rec.status!=='recording')return;try{const url=webUrl(params.frame.url);if(Date.now()-this.lastActionAt>2200&&rec.steps.at(-1)?.url!==url)await this.add({type:'navigate',label:`Open ${new URL(url).hostname}`,url,checkpoint:false,secret:false});}catch{}});
    }
    if(method==='Page.frameAttached'&&this.recording&&!this.recording.warnings.some(w=>w.startsWith('Embedded'))){this.recording.warnings.push('Embedded frames are present. Interactions inside them are not recorded.');this.persist().catch(()=>{});}
    if(method==='Page.domContentEventFired'&&this.recording)this.evaluate(paused=>window.__mimicSetPaused?.(paused),this.recording.status==='paused').catch(()=>{});
  }
  async startRecording(body){
    const input=recordSchema.parse(body);
    if(this.locked||this.recording||this.activeRun)throw new Error('Finish the current session first.');
    if(input.commandId&&!this.store.data.commands.some(c=>c.id===input.commandId))throw new Error('Command not found.');
    this.locked=true;
    try{
      await this.open();
      this.recording={id:id(),name:input.name,url:input.url,commandId:input.commandId,startedAt:now(),status:'recording',steps:[],warnings:[]};
      await this.add({type:'navigate',label:`Open ${new URL(input.url).hostname}`,url:input.url,checkpoint:false,secret:false});
      await this.send('Runtime.addBinding',{name:'__mimicBridge'});
      const source=`(()=>{if(window.top!==window)return;window.__mimicEvent=event=>window.__mimicBridge(JSON.stringify({event}));window.__mimicControl=control=>window.__mimicBridge(JSON.stringify({control}));(${installRecorder.toString()})();})()`;
      await this.send('Page.addScriptToEvaluateOnNewDocument',{source});
      await this.navigate(input.url);return this.recording;
    }catch(error){if(this.recording)await this.finishRecording('Starting the page did not complete.').catch(()=>{});await this.detach();throw error;}finally{this.locked=false;}
  }
  async pauseRecording(){
    if(!this.recording)throw new Error('No active demonstration.');
    if(this.recording.status==='recording'){
      await this.evaluate(async()=>{await window.__mimicFlush?.();});await this.events;
      this.recording.status='paused';this.recording.pausedAtUrl=await this.evaluate(()=>location.href);
    }else{
      this.recording.status='recording';
      const url=await this.evaluate(()=>location.href);
      if(url!==this.recording.pausedAtUrl)await this.add({type:'navigate',label:`Open ${new URL(url).hostname}`,url:webUrl(url),checkpoint:false,secret:false});
      delete this.recording.pausedAtUrl;
    }
    await this.evaluate(paused=>window.__mimicSetPaused?.(paused),this.recording.status==='paused');await this.persist();return this.recording;
  }
  async finishRecording(warning){
    if(!this.recording||this.recording.status==='saving')return null;
    await this.evaluate(async()=>{await window.__mimicFlush?.();}).catch(()=>{});await this.events;
    if(!this.recording||this.recording.status==='saving')return null;
    const rec=this.recording;rec.status='saving';if(warning)rec.warnings.push(warning);
    const demo={...rec,status:'saved',finishedAt:now(),durationMs:Date.now()-new Date(rec.startedAt).getTime(),steps:normalizeSteps(rec.steps)};
    this.store.data.demonstrations.unshift(demo);this.recording=null;
    await this.evaluate(()=>document.querySelector('[data-mimic-toolbar]')?.remove()).catch(()=>{});
    await this.detach();await this.persist();return demo;
  }
  async run(command,body){
    const input=runSchema.parse(body);const steps=materialize(command,input.values);
    if(this.locked||this.recording||this.activeRun)throw new Error('Finish the current session first.');
    this.locked=true;
    try{
      await this.open();
      const run={id:id(),commandId:command.id,commandName:command.name,mode:input.mode,status:'running',startedAt:now(),steps:steps.map(s=>({id:s.id,label:s.label,type:s.type,status:'pending'})),outputs:[],currentStep:0};
      this.store.data.runs.unshift(run);this.activeRun={id:run.id,cancelled:false,resume:null};await this.persist();
      this.execute(run,steps).catch(()=>{});return run;
    }finally{this.locked=false;}
  }
  async target(step,operation){const started=Date.now();while(Date.now()-started<12000){if(this.activeRun?.cancelled)throw new Error('Run cancelled.');let result;try{result=await this.evaluate(targetAction,step,operation);}catch{await sleep(100);continue;}if(result?.error)throw new Error(result.error);if(result&&!result.retry)return result;await sleep(120);}throw new Error(`Could not uniquely find “${step.label}”. Check the page or edit its selector.`);}
  async click(point){await this.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});}
  async execute(run,steps){
    try{
      for(let i=0;i<steps.length;i++){
        if(this.activeRun.cancelled)throw new Error('Run cancelled.');
        const step=steps[i],result=run.steps[i];run.currentStep=i;result.status='running';result.startedAt=now();await this.persist();
        if(step.type==='manual'||step.checkpoint||(run.mode==='test'&&['click','press'].includes(step.type))){
          result.status='paused';run.status='paused';run.message=step.type==='manual'?`Complete “${step.label}” in the workflow tab, then continue.`:`Ready to ${step.label.toLowerCase()}. Check the workflow tab before continuing.`;
          const waiting=new Promise(resolve=>{this.activeRun.resume=resolve;});await this.persist();await waiting;
          if(this.activeRun.cancelled)throw new Error('Run cancelled.');result.status='running';run.status='running';delete run.message;
        }
        if(step.type==='navigate')await this.navigate(step.url);
        if(step.type==='fill'){
          await this.target(step,'focus');
          if(step.value)await this.send('Input.insertText',{text:step.value});
          else{await this.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});await this.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});}
        }
        if(step.type==='select')await this.target(step,'select');
        if(step.type==='click')await this.click(await this.target(step,'locate'));
        if(step.type==='check'){const point=await this.target(step,'locate');if(point.checked!==(step.value==='true'))await this.click(point);}
        if(step.type==='press'){
          await this.target(step,'focus');const codes={Enter:13,Tab:9,Escape:27,ArrowDown:40,ArrowUp:38};
          const key={key:step.value,code:step.value,windowsVirtualKeyCode:codes[step.value],nativeVirtualKeyCode:codes[step.value]};
          await this.send('Input.dispatchKeyEvent',{type:'rawKeyDown',...key});
          if(step.value==='Enter')await this.send('Input.dispatchKeyEvent',{type:'char',text:'\r',...key});
          await this.send('Input.dispatchKeyEvent',{type:'keyUp',...key});
        }
        if(step.type==='extract'){const output=await this.target(step,'extract');run.outputs.push({label:step.label,text:output.text});}
        result.status='passed';result.finishedAt=now();await this.persist();
      }
      run.status='passed';
    }catch(error){run.status=this.activeRun?.cancelled?'cancelled':'failed';run.error=String(error.message||error).split('\n')[0].slice(0,400);const result=run.steps[run.currentStep];if(result&&result.status!=='passed')result.status=run.status;}
    finally{run.finishedAt=now();delete run.message;this.activeRun=null;await this.detach();await this.persist();}
  }
  continueRun(runId){if(this.activeRun?.id!==runId||!this.activeRun.resume)throw new Error('This run is not waiting for review.');const resume=this.activeRun.resume;this.activeRun.resume=null;resume();return {ok:true};}
  async cancelRun(runId){if(this.activeRun?.id!==runId)throw new Error('This run is no longer active.');this.activeRun.cancelled=true;this.activeRun.resume?.();await this.detach();return {ok:true};}
}
