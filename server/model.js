import { z } from 'zod';

export const id = () => globalThis.crypto.randomUUID();
export const now = () => new Date().toISOString();
export function webUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS URL without embedded credentials.');
  if ([...url.searchParams.keys()].some(k => /^(password|passwd|token|access_token|api_key|secret|code)$/i.test(k))) throw new Error('Remove private credentials or authentication codes from this URL.');
  return url.href;
}
const text = z.string().max(12000);
const url = z.string().max(8000).refine(v => { try { webUrl(v); return true; } catch { return false; } }, 'Use a web URL without credentials.');
export const stepSchema = z.object({
  id: z.string().max(80), type: z.enum(['navigate', 'click', 'fill', 'select', 'check', 'press', 'extract', 'manual', 'assert']),
  label: z.string().min(1).max(300), selector: z.string().max(3000).optional(),
  alternatives: z.array(z.string().max(3000)).max(5).optional(),
  value: text.optional(), valueTemplate: text.optional(), url: url.optional(), origin: z.string().max(500).optional(),
  parameter: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/).optional(),
  checkpoint: z.boolean().default(false), secret: z.boolean().default(false),
}).strict().superRefine((s, ctx) => {
  if (s.type === 'navigate' && !s.url) ctx.addIssue({ code: 'custom', message: 'Navigation needs a URL.' });
  if (!['navigate', 'manual'].includes(s.type) && !s.selector) ctx.addIssue({ code: 'custom', message: 'This step needs an element selector.' });
  if (s.type === 'assert' && !s.value?.trim()) ctx.addIssue({ code:'custom', message:'Outcome checks need expected text.' });
  if (s.valueTemplate && s.type !== 'assert') ctx.addIssue({code:'custom',message:'Only outcome checks can use text templates.'});
  if (s.type === 'press' && !['Enter', 'Tab', 'Escape', 'ArrowDown', 'ArrowUp'].includes(s.value || '')) ctx.addIssue({ code: 'custom', message: 'Unsupported key.' });
  if (s.secret && s.value) ctx.addIssue({ code: 'custom', message: 'Private fields cannot store values.' });
  if (s.secret && s.type !== 'manual') ctx.addIssue({ code: 'custom', message: 'Private fields must be manual steps.' });
  if (s.type === 'check' && !['true','false'].includes(s.value || '')) ctx.addIssue({ code:'custom',message:'Checkbox values must be true or false.' });
  if (s.parameter && !['fill', 'select', 'check', 'navigate'].includes(s.type)) ctx.addIssue({ code: 'custom', message: 'Only input and navigation steps can be parameterized.' });
});
export const parameterSchema = z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/), label: z.string().min(1).max(100), default: text.default(''), examples: z.array(text).max(20).default([]) }).strict();
export const commandSchema = z.object({
  name: z.string().trim().min(1).max(100), description: z.string().max(500).default(''),
  steps: z.array(stepSchema).min(1).max(250), parameters: z.array(parameterSchema).max(100),
}).strict().superRefine((c, ctx) => {
  const keys = new Set(c.parameters.map(p => p.key));
  if (keys.size !== c.parameters.length) ctx.addIssue({ code: 'custom', message: 'Input names must be unique.' });
  if (new Set(c.steps.map(s => s.id)).size !== c.steps.length) ctx.addIssue({ code: 'custom', message: 'Step IDs must be unique.' });
  if (c.steps.some(s => s.parameter && !keys.has(s.parameter))) ctx.addIssue({ code: 'custom', message: 'A step refers to a missing input.' });
  for (const s of c.steps) for (const m of (s.valueTemplate || '').matchAll(/\{\{([^{}]+)\}\}/g)) if (!keys.has(m[1])) ctx.addIssue({code:'custom',message:'An outcome check refers to a missing input.'});
  if (c.steps[0]?.type !== 'navigate') ctx.addIssue({ code: 'custom', message: 'The first step must open a web page.' });
});
export const recordSchema = z.object({name: z.string().trim().min(1).max(100), url, commandId: z.string().uuid().optional()}).strict();
export const runSchema = z.object({ values: z.record(z.string().max(50), text).default({}), mode: z.enum(['test','run']).default('test') }).strict();
export function normalizeSteps(steps) {
  const output = [];
  for (const original of steps) {
    const s = stepSchema.parse(original);
    const previous = output.at(-1);
    if (previous && ['fill', 'select', 'check'].includes(s.type) && previous.type === s.type && previous.selector === s.selector) output[output.length - 1] = { ...s, id: previous.id };
    else output.push(s);
  }
  return output;
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 35) || 'input';
export function compatible(a, b) {
  return a.length === b.length && a.every((s, i) => s.type === b[i].type && (s.type === 'navigate' || s.selector === b[i].selector) && (s.type !== 'press' || s.value === b[i].value));
}
export function learn(demonstrations, name) {
  if (!demonstrations.length) throw new Error('Record a demonstration first.');
  const samples = demonstrations.map(d => normalizeSteps(d.steps));
  if (samples[0].length < 2) throw new Error('Demonstrate at least one action after opening the page.');
  if (samples.some(s => !compatible(samples[0], s))) throw new Error('These demonstrations take different paths. Record the same steps with different values, or create a separate command.');
  const steps = structuredClone(samples[0]);
  const parameters = [];
  for (const [i, step] of steps.entries()) {
    const values = [...new Set(samples.map(s => s[i].type === 'navigate' ? s[i].url : s[i].value ?? ''))];
    if (['fill', 'select', 'check'].includes(step.type) || (step.type === 'navigate' && values.length > 1)) {
      // With one example, fields are candidates. Repeated examples identify variation.
      if (samples.length > 1 && values.length === 1) continue;
      let key = slug(step.type === 'navigate' ? 'page_url' : step.label.replace(/^(Fill|Select|Enter)\s+/i, ''));
      if (!/^[a-z]/.test(key)) key = `input_${key}`;
      const base = key; let n = 2;
      while (parameters.some(p => p.key === key)) key = `${base}_${n++}`;
      step.parameter = key;
      parameters.push({ key, label: step.type === 'navigate' ? 'Page URL' : step.label.replace(/^(Fill|Select|Enter)\s+/i, ''), default: values.at(-1), examples: values.slice(0,20) });
    }
  }
  // Substitute complete, unambiguous input values in visually selected outcomes.
  // Keep the original text for review; templates are explicit so literal braces stay literal.
  for (const step of steps.filter(s=>s.type==='assert')) {
    const candidates=parameters.map(p=>({key:p.key,value:steps.find(s=>s.parameter===p.key)?.value})).filter(p=>p.value?.length>=3);
    const unique=candidates.filter(p=>candidates.filter(q=>q.value===p.value).length===1).sort((a,b)=>b.value.length-a.value.length);
    if (!unique.length) continue;
    const escaped=unique.map(p=>p.value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const pattern=new RegExp(`(?<![\\p{L}\\p{N}_])(${escaped.join('|')})(?![\\p{L}\\p{N}_])`,'gu');
    const template=step.value.replace(pattern,value=>`{{${unique.find(p=>p.value===value).key}}}`);
    if(template!==step.value)step.valueTemplate=template;
  }
  return commandSchema.parse({ name, description: `Learned from ${samples.length} demonstration${samples.length === 1 ? '' : 's'}.`, steps, parameters });
}
export function materialize(command, values) {
  const result = structuredClone(command.steps);
  const allowed = new Set(command.parameters.map(p=>p.key));
  if (Object.keys(values).some(k=>!allowed.has(k))) throw new Error('An input name is not part of this command. Check its listed inputs.');
  const origins = new Map();
  for (const s of result) if (s.parameter) {
    const p = command.parameters.find(p => p.key === s.parameter);
    const value = values[p.key] ?? p.default;
    if (s.type === 'navigate') {
      const originalOrigin = new URL(s.url).origin;
      s.url = webUrl(value); origins.set(originalOrigin,new URL(s.url).origin);
    }
    else s.value = value;
    if (s.type === 'check' && !['true','false'].includes(s.value)) throw new Error(`Use true or false for ${p.label}.`);
  }
  for (const s of result) if (s.origin && origins.has(s.origin)) s.origin = origins.get(s.origin);
  for (const s of result) if(s.valueTemplate) {
    s.value=s.valueTemplate.replace(/\{\{([^{}]+)\}\}/g,(_,key)=>{const p=command.parameters.find(p=>p.key===key);if(!p)throw Error('The outcome check uses an unknown input.');return values[key]??p.default;});
    if(!s.value.trim())throw Error('The outcome check needs nonempty text.');
  }
  return result;
}

// A separate built-in demo leaves every existing saved command untouched.
export function quickstart(base) {
  const c=starter(base);
  return {...c,id:'7202caba-746c-4ed3-9965-b5f2b1cc1460',name:'Save your first reading',description:'Watch Mimic fill a form, save it, and check the result.',steps:c.steps.map(s=>s.type==='extract'?{...s,type:'assert',label:'Check the saved reading',value:'Saved',valueTemplate:'Saved “{{title}}” to {{shelf}}.'}:{...s,checkpoint:false})};
}

export function starter(base) {
  return {
    id: id(), name: 'Save a reading', description: 'A small command to try on the practice site. Give it a title, a link, and a shelf.',
    createdAt: now(), updatedAt: now(), demonstrationIds: [], sample: true,
    parameters: [
      { key: 'title', label: 'Reading title', default: 'A better way to learn', examples: [] },
      { key: 'link', label: 'Reading URL', default: 'https://example.com/reading', examples: [] },
      { key: 'shelf', label: 'Shelf', default: 'Research', examples: ['Research','School','Ideas'] },
    ],
    steps: [
      {id:id(),type:'navigate',label:'Open the practice library',url:`${base}/practice`,checkpoint:false,secret:false},
      {id:id(),type:'fill',label:'Fill Reading title',selector:'#reading-title',value:'A better way to learn',parameter:'title',checkpoint:false,secret:false},
      {id:id(),type:'fill',label:'Fill Reading URL',selector:'#reading-url',value:'https://example.com/reading',parameter:'link',checkpoint:false,secret:false},
      {id:id(),type:'select',label:'Select Shelf',selector:'#shelf',value:'Research',parameter:'shelf',checkpoint:false,secret:false},
      {id:id(),type:'click',label:'Save reading',selector:'#save-reading',checkpoint:true,secret:false},
      {id:id(),type:'extract',label:'Read the confirmation',selector:'#confirmation',checkpoint:false,secret:false},
    ],
  };
}
