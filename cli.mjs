#!/usr/bin/env node
const base=process.env.MIMIC_URL||'http://127.0.0.1:4318';
const [action,...args]=process.argv.slice(2);
try {
  const response=await fetch(`${base}/api/state`);
  if(!response.ok)throw new Error('Cannot read the Mimic library.');
  const state=await response.json();
  const post=async(route,body={})=>{const r=await fetch(`${base}/api${route}`,{method:'POST',headers:{'Content-Type':'application/json','X-Mimic-Token':state.token},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw new Error(result.error);return result;};
  if(action==='list') {
    for(const c of state.commands)console.log(`${c.id}  ${c.name}\n  Inputs: ${c.parameters.map(p=>`--${p.key}`).join(' ')||'(none)'}`);
  } else if(action==='run') {
    const commandId=args.shift();if(!commandId)throw new Error('Supply a command ID from node cli.mjs list.');
    let mode='test';const values={};
    for(let i=0;i<args.length;i++){if(args[i]==='--regular'){mode='run';continue}if(!args[i].startsWith('--')||i+1===args.length)throw new Error('Use --input_name "value" pairs.');values[args[i].slice(2)]=args[++i];}
    const run=await post(`/commands/${encodeURIComponent(commandId)}/run`,{values,mode});
    console.log(`Started ${mode} ${run.id}. Open ${base} to review checkpoints and results.`);
  } else if(action==='continue'||action==='cancel') {
    if(!args[0])throw new Error('Supply a run ID.');
    await post(`/runs/${encodeURIComponent(args[0])}/${action}`);console.log(action==='continue'?'Step continued.':'Run cancelled.');
  } else if(action==='status') {
    console.log(JSON.stringify({recording:state.recording?{name:state.recording.name,steps:state.recording.steps.length}:null,activeRun:state.activeRun,recentRuns:state.runs.slice(0,5)},null,2));
  } else console.log('Mimic CLI\n\n  node cli.mjs list\n  node cli.mjs run COMMAND_ID --input_name "value" [--regular]\n  node cli.mjs status\n  node cli.mjs continue RUN_ID\n  node cli.mjs cancel RUN_ID\n\nStart the local app first with npm start. Test mode is the default.');
}catch(error){console.error(error.cause?.code==='ECONNREFUSED'?'Mimic is not running. Start it with npm start, then try again.':error.message);process.exitCode=1}
