import {z} from 'zod';
import {id,now,commandSchema,materialize} from '../server/model.js';

export function parseCsv(text){
  if(typeof text!=='string'||text.length>1_000_000)throw Error('Use a CSV smaller than 1 MB.');
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
    else if(c==='"'){if(cell||closed)throw Error('Invalid CSV quotes.');quoted=true;}
    else if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}}
    else{if(closed)throw Error('Unexpected text after a CSV quote.');cell+=c;}
    if(cell.length>12000)throw Error('A CSV cell exceeds 12,000 characters.');
  }
  if(quoted)throw Error('A CSV quote was not closed.');
  row.push(cell);if(row.some(v=>v!==''))rows.push(row);
  const headers=rows.shift()?.map((v,i)=>(i===0?v.replace(/^\uFEFF/,''):v).trim());
  if(!headers?.length||headers.length>100||headers.some(v=>!v)||new Set(headers).size!==headers.length)throw Error('CSV needs unique, nonempty column names (up to 100).');
  if(!rows.length||rows.length>100)throw Error('Use between 1 and 100 data rows.');
  if(rows.some(r=>r.length!==headers.length))throw Error('Every CSV row must have the same number of columns.');
  return {headers,rows};
}
export function csvResults(batch){
  const safe=v=>{const text=String(v??'');return '"'+(/^[\s]*[=+@\-\t\r]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';};
  return [['row','status','run_id','observed_output','note'],...batch.rows.map((r,i)=>[i+1,r.status,r.runId,r.output,r.note])].map(r=>r.map(safe).join(',')).join('\r\n');
}
export function recoverBatches(data){
  data.batches??=[];
  for(const batch of data.batches){
    if(['running','stopping'].includes(batch.status))batch.status='review';
    for(const row of batch.rows)if(row.status==='running'){
      const run=data.runs.find(r=>r.id===row.runId||r.batchId===batch.id&&r.batchRowId===row.id);
      row.runId=run?.id;
      row.status=run?.status==='passed'?'verified':'review';
      row.output=run?.outputs?.map(o=>o.text).join('\n')||'';
      row.note=row.status==='review'?'Interrupted. Inspect the target website before deciding what happened.':'';
    }
  }
}
const inputSchema=z.object({commandId:z.string().uuid(),csv:z.string().max(1_000_000),mapping:z.record(z.string().max(50),z.string().max(500))}).strict();
export class BatchRunner{
  constructor(store,engine,billing){this.store=store;this.engine=engine;this.billing=billing;this.active=null;this.locked=false;}
  async create(body){
    if(this.locked||this.active||this.engine.activeRun||this.engine.recording||this.engine.locked)throw Error('Finish the current session first.');
    this.locked=true;
    try{
      const input=inputSchema.parse(body),command=this.store.data.commands.find(c=>c.id===input.commandId);
      if(!command)throw Error('Workflow not found.');
      // Every row must end with a check after its last action, not merely a successful click.
      if(command.steps.at(-1)?.type!=='assert')throw Error('Add an outcome check as the final step in this workflow before batching.');
      const csv=parseCsv(input.csv),account=await this.billing.account();
      if(csv.rows.length>3&&account.plan!=='pro')throw Error('Free includes batches of 3 rows. Connect a Pro account for up to 100 rows.');
      const keys=new Set(command.parameters.map(p=>p.key));
      if(Object.keys(input.mapping).some(k=>!keys.has(k)))throw Error('Unknown workflow input in mapping.');
      const indexes=command.parameters.map(p=>{const index=csv.headers.indexOf(input.mapping[p.key]);if(index<0)throw Error(`Choose a column for ${p.label}.`);return index;});
      const rows=csv.rows.map(r=>{const values=Object.fromEntries(command.parameters.map((p,i)=>[p.key,r[indexes[i]]]));materialize(command,values);return {id:id(),values,status:'pending'};});
      const batch={id:id(),name:command.name,command:{...commandSchema.parse({name:command.name,description:command.description,steps:command.steps,parameters:command.parameters}),id:command.id},createdAt:now(),status:'ready',pro:csv.rows.length>3,rows};
      this.store.data.batches.unshift(batch);await this.store.save();return batch;
    }finally{this.locked=false;}
  }
  async start(batchId){
    const batch=this.find(batchId);
    if(this.active||this.locked||this.engine.activeRun||this.engine.recording||this.engine.locked)throw Error('Finish the current session first.');
    if(batch.rows.some(r=>r.status==='review'))throw Error('Resolve the uncertain row before continuing. It will never be retried automatically.');
    if(!batch.rows.some(r=>r.status==='pending'))throw Error('No pending rows remain.');
    this.active=batch.id;batch.status='running';await this.store.save();this.execute(batch).catch(()=>{});return batch;
  }
  find(batchId){const batch=this.store.data.batches.find(b=>b.id===batchId);if(!batch)throw Error('Batch not found.');return batch;}
  async execute(batch){
    try{
      for(const row of batch.rows){
        if(batch.status!=='running')break;
        if(row.status!=='pending')continue;
        if(batch.pro)await this.billing.reserve(row.id);
        // Persist intent before attaching/navigating. A crash becomes uncertain, never pending.
        row.status='running';await this.store.save();
        const run=await this.engine.run(batch.command,{values:row.values,mode:'run'},{batchId:batch.id,batchRowId:row.id});
        row.runId=run.id;await this.store.save();
        while(this.engine.activeRun?.id===run.id)await new Promise(r=>setTimeout(r,150));
        row.output=run.outputs.map(o=>o.text).join('\n');
        if(run.status==='passed'){row.status='verified';row.note='Expected outcome observed.';}
        else{row.status='review';row.note=run.error||'Result uncertain. Inspect the website.';batch.status='review';}
        await this.store.save();
      }
      if(batch.status==='running')batch.status='completed';
      if(batch.status==='stopping')batch.status='paused';
    }catch(error){const row=batch.rows.find(r=>r.status==='running');if(row){row.status='review';row.note=String(error.message).slice(0,400);}batch.status='review';batch.error=String(error.message).slice(0,400);}
    finally{this.active=null;await this.store.save();}
  }
  async stop(batchId){const batch=this.find(batchId);if(this.active!==batch.id)throw Error('This batch is not running.');batch.status='stopping';await this.store.save();return batch;}
  async resolve(batchId,body){
    const {rowId,decision,note}=z.object({rowId:z.string().uuid(),decision:z.enum(['skip','confirmed']),note:z.string().trim().min(5).max(500)}).strict().parse(body);
    const batch=this.find(batchId);if(this.active===batch.id)throw Error('Wait for the active row to stop.');
    const row=batch.rows.find(r=>r.id===rowId);if(row?.status!=='review')throw Error('This row is not awaiting review.');
    row.status=decision==='confirmed'?'confirmed':'skipped';row.note=note;batch.status='paused';delete batch.error;await this.store.save();return batch;
  }
}
