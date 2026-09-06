import {ArrowRight,Check,Chrome,Download,ExternalLink,ShieldCheck} from 'lucide-react';
import {dashboardUrl} from './transport';

export function CompanionSetup({connected}:{connected:boolean}){
  return <div className="companion-setup">
    <div className="companion-intro"><span><Chrome size={24}/></span><div><b>One small extension. No local server.</b><p>The dashboard lives on Vercel. The companion records and replays your workflows in Chrome.</p></div></div>
    <a className="btn primary full" href="/downloads/mimic-browser-companion.zip" download><Download size={16}/>Download the Chrome companion</a>
    <ol className="setup-steps"><li><span>1</span><div><b>Unzip it somewhere permanent</b><p>Extract the download. Keep the <code>mimic-browser-companion</code> folder in Documents or Applications.</p></div></li><li><span>2</span><div><b>Open Chrome’s extension page</b><p>Paste <code>chrome://extensions</code> in Chrome’s address bar and turn on <strong>Developer mode</strong>.</p></div></li><li><span>3</span><div><b>Choose “Load unpacked”</b><p>Select the extracted <code>mimic-browser-companion</code> folder. Chrome shows the permissions this personal extension needs.</p></div></li><li><span>4</span><div><b>Open this dashboard in Chrome</b><p><a href={dashboardUrl} target="_blank" rel="noreferrer">{dashboardUrl.replace('https://','')}<ExternalLink size={11}/></a> detects the companion automatically. Pin the extension for a shortcut back here.</p></div></li></ol>
    <div className={`setup-status ${connected?'connected':''}`}>{connected?<Check size={17}/>:<Chrome size={17}/>}<b>{connected?'Connected. You’re ready to teach your first command.':'Waiting for the companion in this browser…'}</b></div>
    <div className="setup-privacy"><ShieldCheck size={16}/><p>Commands stay in this Chrome profile. The extension controls the workflow tab you open, and Chrome shows an indicator while it’s connected. This is a personal unpacked extension; no Web Store installation or account is required.</p></div>
  </div>;
}
