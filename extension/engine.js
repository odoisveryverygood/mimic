import {id,now,webUrl,normalizeSteps,materialize,stepSchema,recordSchema,runSchema} from '../server/model.js';
import {installRecorder} from '../server/recorder.js';
import {repairTestSchema,digest,repairFrame} from '../server/repair-model.js';
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
  async send(method,params={}){if(this.tabId===null)throw new Error('The workflow tab is no longer connected.');return chrome.debugger.sendCommand({tabId:this.tabId,...(method==='Runtime.evaluate'&&this.repairSessionId?{sessionId:this.repairSessionId}:{})},method,params);}
  async evaluate(fn,...args){const result=await this.send('Runtime.evaluate',{expression:`(${fn.toString()})(${args.map(v=>JSON.stringify(v)).join(',')})`,awaitPromise:true,returnByValue:true,...(this.repairContextId?{contextId:this.repairContextId,timeout:2000}:{})});if(result.exceptionDetails)throw new Error('The page did not accept this operation.');return result.result?.value;}
  async open(existingTabId){
    await this.detach();
    const tab=existingTabId===undefined?await chrome.tabs.create({url:'about:blank',active:true}):await chrome.tabs.get(existingTabId);this.tabId=tab.id;
    try{await chrome.debugger.attach({tabId:tab.id},'1.3');this.contexts.clear();await this.send('Page.enable');await this.send('Runtime.enable');const tree=await this.send('Page.getFrameTree');this.mainFrameId=tree.frameTree.frame.id;}
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
    if(method==='Target.attachedToTarget'&&this.repairTesting&&params.targetInfo.type==='iframe'){
      const session={tabId:this.tabId,sessionId:params.sessionId};
      this.repairAttach=(async()=>{for(const [command,args] of [['Page.enable',{}],['Runtime.enable',{}],['Network.enable',{}],['Network.setBlockedURLs',{urls:['*']}],['Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]}]])await chrome.debugger.sendCommand(session,command,args);this.repairSessionId=params.sessionId;await chrome.debugger.sendCommand(session,'Runtime.runIfWaitingForDebugger');})();this.repairAttach.catch(()=>{});
    }
    if(method==='Fetch.requestPaused'&&this.repairTesting)chrome.debugger.sendCommand(source,'Fetch.failRequest',{requestId:params.requestId,errorReason:'BlockedByClient'}).catch(()=>{});
    if(method==='Page.javascriptDialogOpening'&&this.repairTesting)this.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});
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
  async startRecording(body,existingTabId){
    const input=recordSchema.parse(body);
    if(this.locked||this.recording||this.activeRun)throw new Error('Finish the current session first.');
    if(input.commandId&&!this.store.data.commands.some(c=>c.id===input.commandId))throw new Error('Command not found.');
    this.locked=true;
    try{
      await this.open(existingTabId);
      this.recording={id:id(),name:input.name,url:input.url,commandId:input.commandId,startedAt:now(),status:'recording',steps:[],warnings:[]};
      await this.add({type:'navigate',label:`Open ${new URL(input.url).hostname}`,url:input.url,checkpoint:false,secret:false});
      await this.send('Runtime.addBinding',{name:'__mimicBridge'});
      const source=`(()=>{if(window.top!==window)return;window.__mimicEvent=event=>window.__mimicBridge(JSON.stringify({event}));window.__mimicControl=control=>window.__mimicBridge(JSON.stringify({control}));(${installRecorder.toString()})();})()`;
      await this.send('Page.addScriptToEvaluateOnNewDocument',{source});
      if(existingTabId===undefined)await this.navigate(input.url);else {const current=await this.evaluate(()=>location.href);if(current!==input.url)throw Error('The tab changed. Select it again before recording.');await this.send('Runtime.evaluate',{expression:source});}return this.recording;
    }catch(error){if(this.recording)await this.finishRecording('Starting the page did not complete.').catch(()=>{});await this.detach();throw error;}finally{this.locked=false;}
  }
  async pickResult(){
    if(!this.recording||this.recording.status!=='recording')throw Error('Resume the recording before choosing a result.');
    if(!await this.evaluate(()=>window.__mimicPickResult?.()))throw Error('This page is not ready. Finish loading it and try again.');
    await chrome.tabs.update(this.tabId,{active:true});return {ok:true};
  }
  async focusTab(){if(this.tabId===null)throw Error('No active task tab.');await chrome.tabs.update(this.tabId,{active:true});return {ok:true};}
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
    await this.evaluate(()=>window.__mimicCleanup?.()).catch(()=>{});
    await this.detach();await this.persist();return demo;
  }
  async run(command,body,correlation={}){
    const input=runSchema.parse(body);const steps=materialize(command,input.values);
    if(this.locked||this.recording||this.activeRun)throw new Error('Finish the current session first.');
    this.locked=true;
    try{
      await this.open();
      const run={...correlation,id:id(),commandId:command.id,commandName:command.name,mode:input.mode,status:'running',startedAt:now(),steps:steps.map(s=>({id:s.id,label:s.label,type:s.type,status:'pending'})),outputs:[],currentStep:0};
      this.store.data.runs.unshift(run);this.activeRun={id:run.id,cancelled:false,resume:null};await this.persist();
      this.execute(run,steps).catch(()=>{});return run;
    }finally{this.locked=false;}
  }
  async testRepair(body){
    const input=repairTestSchema.parse(body);
    if(this.locked||this.recording||this.activeRun)throw new Error('Finish the current browser session first.');
    this.locked=true;
    try{
      await this.open();this.repairTesting=true;this.repairSessionId=null;this.repairAttach=null;
      await this.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'iframe',exclude:false}]});
      await this.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
      await this.send('Network.enable');await this.send('Network.setBlockedURLs',{urls:['*']});
      const run={id:id(),commandId:input.caseId,commandName:input.name,mode:'run',kind:'repair',phase:input.phase,sourceHash:await digest(input.html),testHash:await digest(JSON.stringify([input.selector,input.expected,input.click])),status:'running',startedAt:now(),currentStep:0,steps:[{id:id(),type:'assert',label:'Regression outcome',status:'running'}],outputs:[]};
      this.store.data.runs.unshift(run);this.activeRun={id:run.id,cancelled:false,resume:null};await this.persist();
      this.executeRepair(run,input).catch(()=>{});return run;
    }catch(error){await this.detach();this.repairTesting=false;throw error;}finally{this.locked=false;}
  }
  async executeRepair(run,input){
    const testTab=this.tabId;
    let deadline;
    try{
      // The browser sandbox prevents popup, top-navigation, storage and form access.
      // Close the dedicated test tab on timeout, including a script that never yields.
      deadline=setTimeout(()=>chrome.tabs.remove(testTab).catch(()=>{}),30000);
      await this.send('Page.setDocumentContent',{frameId:this.mainFrameId,html:repairFrame(input.html)});
      const started=Date.now();let child;
      while(!child&&!this.repairAttach&&Date.now()-started<5000){const tree=await this.send('Page.getFrameTree');child=tree.frameTree.childFrames?.find(f=>f.frame.url==='about:srcdoc');if(!child)await sleep(50);}
      if(this.repairAttach){await this.repairAttach;const tree=await chrome.debugger.sendCommand({tabId:this.tabId,sessionId:this.repairSessionId},'Page.getFrameTree');child=tree.frameTree;}
      if(!child)throw new Error('The isolated test frame did not load.');
      const world=await chrome.debugger.sendCommand({tabId:this.tabId,...(this.repairSessionId?{sessionId:this.repairSessionId}:{})},'Page.createIsolatedWorld',{frameId:child.frame.id,worldName:'mimic-repair-verifier'});this.repairContextId=world.executionContextId;
      if(input.click)await this.click(await this.target({selector:input.click,label:'Regression click'},'locate'));
      const result=await this.target({selector:input.selector,value:input.expected,label:'Expected regression result'},'assert');
      run.outputs.push({label:'Observed outcome',text:result.text});run.status='passed';run.steps[0].status='passed';
    }catch(error){run.status=this.activeRun?.cancelled?'cancelled':'failed';run.error=String(error.message||error).slice(0,500);run.steps[0].status=run.status;}
    finally{clearTimeout(deadline);run.finishedAt=now();this.activeRun=null;this.repairContextId=null;this.repairSessionId=null;this.repairAttach=null;await chrome.tabs.remove(testTab).catch(()=>{});await this.detach();this.repairTesting=false;await this.persist();}
  }
  async target(step,operation){const started=Date.now();while(Date.now()-started<12000){if(this.activeRun?.cancelled)throw new Error('Run cancelled.');let result;try{result=await this.evaluate(targetAction,step,operation,!!this.repairContextId);}catch{await sleep(100);continue;}if(result?.error)throw new Error(result.error);if(result&&!result.retry)return result;await sleep(120);}throw new Error(operation==='assert'?`Outcome check failed: expected “${step.value}” at ${step.selector}.`:`Could not uniquely find “${step.label}”. Check the page or edit its selector.`);}
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
        if(step.type==='assert'){const output=await this.target(step,'assert');run.outputs.push({label:step.label,text:output.text});}
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
