import {z} from 'zod';
import {recoverBatches} from './batch.js';
import {starter,id,now,commandSchema,learn} from '../server/model.js';

export async function createLibrary(storage,base) {
  const stored=await storage.get('library');
  const data=stored.library||{version:1,commands:[starter(base)],demonstrations:[],runs:[]};
  if(data.version!==1||!Array.isArray(data.commands)||!Array.isArray(data.demonstrations)||!Array.isArray(data.runs))throw new Error('The saved library is not readable. It has not been overwritten.');
  for(const run of data.runs)if(['running','paused','queued'].includes(run.status)){run.status='interrupted';run.finishedAt=now();run.error='Chrome restarted or the extension was reloaded. Start a fresh run.';}
  recoverBatches(data);
  if(data.activeRecording){
    const rec=data.activeRecording;
    data.demonstrations.unshift({...rec,status:'saved',finishedAt:now(),warnings:[...rec.warnings,'Chrome restarted. The actions captured so far were recovered.']});
    delete data.activeRecording;
  }
  let pending=Promise.resolve();
  const save=()=>{const snapshot=structuredClone(data);const result=pending.catch(()=>{}).then(()=>storage.set({library:snapshot}));pending=result;return result;};
  await save();
  return {data,save};
}

export async function libraryRequest(store,engine,path,method,body={}) {
  const {data,save}=store;
  const match=path.match(/^\/commands\/([^/]+)(?:\/(export|duplicate|run))?$/);
  if(match){
    const command=data.commands.find(c=>c.id===match[1]);
    if(!command)throw new Error('Command not found.');
    if(match[2]==='export'&&method==='GET')return {format:'mimic-command',version:1,command:commandSchema.parse({name:command.name,description:command.description,steps:command.steps,parameters:command.parameters})};
    if(match[2]==='duplicate'&&method==='POST'){
      const copy={...structuredClone(command),id:id(),name:`${command.name.slice(0,90)} (copy)`,createdAt:now(),updatedAt:now(),demonstrationIds:[]};data.commands.unshift(copy);await save();return copy;
    }
    if(!match[2]&&['PUT','DELETE'].includes(method)){
      if(engine.recording?.commandId===command.id||data.runs.find(r=>r.id===engine.activeRun?.id)?.commandId===command.id)throw new Error('Finish this command’s current session before editing.');
      if(method==='DELETE'){data.commands=data.commands.filter(c=>c.id!==command.id);await save();return {ok:true};}
      Object.assign(command,commandSchema.parse(body),{updatedAt:now()});await save();return command;
    }
  }
  if(path==='/learn'&&method==='POST'){
    const input=z.object({demonstrationIds:z.array(z.string().uuid()).min(1).max(20),name:z.string().trim().min(1).max(100),commandId:z.string().uuid().optional()}).strict().parse(body);
    const demos=input.demonstrationIds.map(id=>data.demonstrations.find(d=>d.id===id));
    if(demos.some(d=>!d))throw new Error('A demonstration is missing.');
    const result=learn(demos,input.name);let command;
    if(input.commandId){command=data.commands.find(c=>c.id===input.commandId);if(!command)throw new Error('Command not found.');if(engine.recording||engine.activeRun)throw new Error('Finish the current session before learning.');Object.assign(command,result,{updatedAt:now(),demonstrationIds:input.demonstrationIds,sample:false});}
    else{command={...result,id:id(),createdAt:now(),updatedAt:now(),demonstrationIds:input.demonstrationIds,sample:false};data.commands.unshift(command);}
    demos.forEach(d=>d.commandId=command.id);await save();return command;
  }
  if(path==='/import'&&method==='POST'){
    const doc=z.object({format:z.literal('mimic-command'),version:z.literal(1),command:commandSchema}).strict().parse(body);
    const command={...doc.command,id:id(),createdAt:now(),updatedAt:now(),demonstrationIds:[],sample:false};data.commands.unshift(command);await save();return command;
  }
  if(path==='/backup'&&method==='GET'){const backup=structuredClone(data);delete backup.activeRecording;return backup;}
  if(path.startsWith('/demonstrations/')&&method==='DELETE'){
    const demoId=path.split('/')[2];if(data.commands.some(c=>c.demonstrationIds.includes(demoId)))throw new Error('Delete the linked command before deleting its demonstration.');
    data.demonstrations=data.demonstrations.filter(d=>d.id!==demoId);await save();return {ok:true};
  }
  throw new Error('Unsupported request.');
}
