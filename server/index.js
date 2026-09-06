import express from 'express';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createStore } from './store.js';
import { Engine } from './engine.js';
import { id, now, commandSchema, recordSchema, runSchema, learn } from './model.js';
import { practiceHtml } from './practice.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.MIMIC_PORT || 4318);
const base = `http://127.0.0.1:${port}`;
const token = randomBytes(32).toString('hex');
const store = createStore(process.env.MIMIC_DATA_DIR || path.join(root,'.mimic'),base);
const engine = new Engine(store,{headless:process.env.MIMIC_HEADLESS === '1'});
const app = express();
app.disable('x-powered-by');
app.use((req,res,next) => {
  if (![ `127.0.0.1:${port}`,`localhost:${port}` ].includes(req.headers.host)) return res.status(403).json({error:'Local connections only.'});
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control','no-store');
    if (req.headers.origin && ![base,`http://localhost:${port}`].includes(req.headers.origin)) return res.status(403).json({error:'This origin is not allowed.'});
    if (!['GET','HEAD'].includes(req.method) && req.headers['x-mimic-token'] !== token) return res.status(403).json({error:'Refresh Mimic and try again.'});
  }
  next();
});
app.use(express.json({limit:'2mb'}));
const command = req => {
  const item = store.data.commands.find(c => c.id === req.params.id);
  if (!item) throw Object.assign(new Error('Command not found.'),{status:404});
  return item;
};
const idleCommand = req => {
  const item = command(req);
  if (store.data.runs.find(r => r.id === engine.activeRun?.id)?.commandId === item.id || engine.recording?.commandId === item.id) throw new Error('Finish this command’s active session before editing it.');
  return item;
};
app.get('/api/state', (req,res) => res.json({ ...store.data, ...engine.status(), token, practiceUrl:`${base}/practice`, version:'1.0.0' }));
app.post('/api/recordings', async (req,res) => {
  const input = recordSchema.parse(req.body);
  if (input.commandId && !store.data.commands.some(c=>c.id===input.commandId)) throw new Error('Command not found.');
  res.json(await engine.startRecording(input));
});
app.post('/api/recordings/pause', async (req,res) => res.json(await engine.pauseRecording()));
app.post('/api/recordings/stop', async (req,res) => res.json(await engine.finishRecording()));
app.post('/api/learn', (req,res) => {
  const input = z.object({demonstrationIds:z.array(z.string().uuid()).min(1).max(20), name:z.string().trim().min(1).max(100), commandId:z.string().uuid().optional()}).strict().parse(req.body);
  const demos = input.demonstrationIds.map(id => store.data.demonstrations.find(d=>d.id===id));
  if (demos.some(d=>!d)) throw new Error('A demonstration is missing.');
  const learned = learn(demos,input.name);
  let item;
  if (input.commandId) {
    req.params.id=input.commandId; item=idleCommand(req);
    Object.assign(item,learned,{updatedAt:now(), demonstrationIds:input.demonstrationIds,sample:false});
  } else { item={...learned,id:id(),createdAt:now(),updatedAt:now(),demonstrationIds:input.demonstrationIds,sample:false};store.data.commands.unshift(item); }
  for (const demo of demos) demo.commandId=item.id;
  store.save();res.json(item);
});
app.put('/api/commands/:id', (req,res) => { const item=idleCommand(req);Object.assign(item,commandSchema.parse(req.body),{updatedAt:now()});store.save();res.json(item); });
app.delete('/api/commands/:id', (req,res) => { const item=idleCommand(req);store.data.commands=store.data.commands.filter(c=>c.id!==item.id);store.save();res.json({ok:true}); });
app.post('/api/commands/:id/duplicate', (req,res) => { const item={...structuredClone(command(req)),id:id(),name:`${command(req).name.slice(0,90)} (copy)`,createdAt:now(),updatedAt:now(),demonstrationIds:[]};store.data.commands.unshift(item);store.save();res.json(item); });
app.get('/api/commands/:id/export', (req,res) => { const c=command(req);res.setHeader('Content-Disposition',`attachment; filename="mimic-command.json"`);res.json({format:'mimic-command',version:1,command:{name:c.name,description:c.description,steps:c.steps,parameters:c.parameters}}); });
app.post('/api/import', (req,res) => { const doc=z.object({format:z.literal('mimic-command'),version:z.literal(1),command:commandSchema}).strict().parse(req.body);const c={...doc.command,id:id(),createdAt:now(),updatedAt:now(),demonstrationIds:[],sample:false};store.data.commands.unshift(c);store.save();res.json(c); });
app.get('/api/backup', (req,res) => {res.setHeader('Content-Disposition','attachment; filename="mimic-library.json"');res.json(store.data);});
app.post('/api/commands/:id/run', async (req,res) => {const c=command(req);res.json(await engine.run(c,runSchema.parse(req.body)));});
app.post('/api/runs/:id/continue', (req,res) => {engine.continueRun(req.params.id);res.json({ok:true});});
app.post('/api/runs/:id/cancel', async (req,res) => {await engine.cancelRun(req.params.id);res.json({ok:true});});
app.delete('/api/demonstrations/:id', (req,res) => {if(store.data.commands.some(c=>c.demonstrationIds.includes(req.params.id)))throw new Error('This demonstration belongs to a command. Delete that command first.');store.data.demonstrations=store.data.demonstrations.filter(d=>d.id!==req.params.id);store.save();res.json({ok:true});});
app.get('/practice', (req,res) => res.type('html').send(practiceHtml));
app.use('/api', (req,res) => res.status(404).json({error:'Endpoint not found.'}));
if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite');
  const vite = await createServer({root,server:{middlewareMode:true},appType:'spa'});
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root,'dist')));
  app.get('/{*path}',(req,res)=>res.sendFile(path.join(root,'dist','index.html')));
}
app.use((error,req,res,next) => {
  const message = error instanceof z.ZodError ? error.issues.map(i=>i.message).join(' ') : error.message || 'Something went wrong.';
  res.status(error.status || 400).json({error:message.slice(0,1000)});
});
const server=app.listen(port,'127.0.0.1',()=>console.log(`Mimic is ready at ${base}`));
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Open ${base} or choose MIMIC_PORT.`:error.message);process.exit(1);});
let shuttingDown=false;
async function shutdown(){if(shuttingDown)return;shuttingDown=true;await engine.shutdown();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
