import {build} from 'esbuild';
import {zipSync} from 'fflate';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {practiceHtml} from '../server/practice.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const identity=JSON.parse(fs.readFileSync(path.join(root,'extension/identity.json'),'utf8'));
const dev=process.env.MIMIC_EXTENSION_DEV==='1';
const origins=[identity.dashboardOrigin,...(dev?['http://127.0.0.1:4319']:[])];
const out=path.join(root,'extension/build');fs.mkdirSync(out,{recursive:true});
await build({entryPoints:[path.join(root,'extension/panel.jsx')],outfile:path.join(out,'panel.js'),bundle:true,format:'esm',platform:'browser',target:'chrome125',minify:true});
fs.writeFileSync(path.join(out,'panel.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mimic</title><link rel="stylesheet" href="panel.css"></head><body><div id="root"></div><script type="module" src="panel.js"></script></body></html>');
await build({entryPoints:[path.join(root,'extension/background.js')],outfile:path.join(out,'background.js'),bundle:true,format:'esm',platform:'browser',target:'chrome120',minify:false,define:{__MIMIC_ALLOWED_ORIGINS__:JSON.stringify(origins),__MIMIC_PRACTICE_ORIGIN__:JSON.stringify(dev?'http://127.0.0.1:4319':identity.dashboardOrigin)}});
const manifest={manifest_version:3,name:'Mimic — Teach once. Run your busywork.',version:'4.0.0',minimum_chrome_version:'125',description:'Record browser workflows, map CSV inputs, and run batches with outcome checks, review checkpoints, and clear results.',key:identity.key,permissions:['debugger','storage','tabs','sidePanel'],host_permissions:[`${identity.dashboardOrigin}/*`],side_panel:{default_path:'panel.html'},icons:{16:'icon16.png',48:'icon48.png',128:'icon128.png'},background:{service_worker:'background.js',type:'module'},action:{default_title:'Open Mimic'},externally_connectable:{matches:origins.map(o=>`${o}/*`)}};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(out,'INSTALL.txt'),`Mimic Browser Companion\n\n1. Keep this folder in a permanent location.\n2. In Chrome, open chrome://extensions.\n3. Turn on Developer mode.\n4. Click Load unpacked and select this folder.\n5. Open ${identity.dashboardOrigin}.\n\nThe extension controls only the current tab you explicitly select or the workflow tab you ask it to open. Chrome shows a debugging indicator while recording or replaying. All recordings and command data stay in this Chrome profile. Removing the extension removes its data; export a backup first. No local server or Terminal process is required. Pin Mimic in Chrome, then click its icon to open the side panel.\n\nThis is an unpacked personal extension, not a Chrome Web Store listing.\n`);
for(const size of [16,48,128])fs.copyFileSync(path.join(root,`extension/icons/icon${size}.png`),path.join(out,`icon${size}.png`));
const files={};for(const name of ['manifest.json','background.js','panel.html','panel.js','panel.css','icon16.png','icon48.png','icon128.png','INSTALL.txt'])files[`mimic-browser-companion/${name}`]=new Uint8Array(fs.readFileSync(path.join(out,name)));
const downloads=path.join(root,'public/downloads');fs.mkdirSync(downloads,{recursive:true});
if(!dev){fs.writeFileSync(path.join(downloads,'mimic-browser-companion.zip'),zipSync(files,{level:9}));const storeFiles=Object.fromEntries(Object.entries(files).filter(([k])=>!k.endsWith('INSTALL.txt')).map(([k,v])=>[k.replace('mimic-browser-companion/',''),v]));fs.writeFileSync(path.join(downloads,'mimic-chrome-store.zip'),zipSync(storeFiles,{level:9}));}
fs.writeFileSync(path.join(root,'public/practice.html'),practiceHtml);
// The website and side panel share one task interface, including connection detection.
const webApp=path.join(root,'public/mimic-app');fs.mkdirSync(webApp,{recursive:true});
for(const name of ['panel.js','panel.css'])fs.copyFileSync(path.join(out,name),path.join(webApp,name));
console.log(`Built ${dev?'development':'production'} companion ${identity.extensionId}. Dashboard: ${identity.dashboardOrigin}`);
