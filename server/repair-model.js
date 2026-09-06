import {z} from 'zod';
export const repairTestSchema=z.object({caseId:z.string().uuid(),name:z.string().min(1).max(160),html:z.string().min(1).max(200000),selector:z.string().min(1).max(1000).refine(s=>!!s.trim()),expected:z.string().min(1).max(1000).refine(s=>!!s.trim()),click:z.string().max(1000).default(''),phase:z.enum(['before','after'])}).strict();
export const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export function isolatedHtml(html){
  // The test document has an opaque origin and may only run inline scripts.
  // Requests are separately blocked by the browser engine, including navigation.
  return '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; form-action \'none\'; base-uri \'none\'; frame-src \'none\'; worker-src \'none\'">'+html;
}
export function repairFrame(html){
  const source=isolatedHtml(html).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return `<!doctype html><title>Mimic isolated repair test</title><style>html,body{margin:0;height:100%;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style><iframe sandbox="allow-scripts" srcdoc="${source}"></iframe>`;
}
