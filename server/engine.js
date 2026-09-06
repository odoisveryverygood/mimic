import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { id, now, webUrl, normalizeSteps, materialize, stepSchema } from './model.js';
import { installRecorder } from './recorder.js';

export class Engine {
  constructor(store, options = {}) {
    this.store = store; this.options = options; this.recording = null; this.activeRun = null; this.context = null; this.page = null; this.locked = false;
  }
  status() { return { recording: this.recording, activeRun: this.activeRun ? this.store.data.runs.find(r => r.id === this.activeRun.id) : null, browserOpen: !!this.context, busy: this.locked }; }
  async openBrowser() {
    if (this.context) { await this.context.close().catch(() => {}); this.context = null; }
    const options = { headless: this.options.headless ?? false, viewport: null, acceptDownloads: false, args: ['--window-size=1180,850'] };
    const chrome = process.platform === 'darwin' && fs.existsSync('/Applications/Google Chrome.app');
    if (chrome) options.channel = 'chrome';
    this.context = await chromium.launchPersistentContext(path.join(this.store.directory, 'browser-profile'), options);
    this.context.setDefaultTimeout(12000);
    this.page = this.context.pages()[0] || await this.context.newPage();
    this.context.on('close', () => {
      this.context = null; this.page = null;
      if (this.recording && this.recording.status !== 'saving') this.finishRecording('Browser closed. Captured actions were saved.').catch(() => {});
    });
    return this.page;
  }
  async startRecording(input) {
    if (this.locked || this.recording || this.activeRun) throw new Error('Finish the current demonstration or run first.');
    this.locked = true;
    try {
      const page = await this.openBrowser();
      this.recording = { id:id(), name:input.name, commandId:input.commandId, url:input.url, startedAt:now(), status:'recording', steps:[], warnings:[] };
      const session = this.recording;
      let lastActionAt = 0;
      const add = event => {
        if (this.recording !== session || session.status !== 'recording') return;
        if (session.steps.length >= 250) { session.status = 'paused'; session.warnings.push('250-step limit reached. Finish this demonstration.'); return; }
        const parsed = stepSchema.safeParse({ ...event, id:id() });
        if (parsed.success) { session.steps = normalizeSteps([...session.steps, parsed.data]); lastActionAt = Date.now(); }
        else if (!session.warnings.includes('An unsupported interaction was skipped. Review the steps before learning.')) session.warnings.push('An unsupported interaction was skipped. Review the steps before learning.');
      };
      await this.context.exposeBinding('__mimicEvent', ({frame, page: sourcePage}, event) => {
        if (sourcePage !== page || frame !== page.mainFrame()) return;
        add(event);
      });
      await this.context.exposeBinding('__mimicControl', async ({page: sourcePage}, action) => {
        if (sourcePage === page && action === 'stop') setTimeout(() => this.finishRecording().catch(() => {}), 50);
      });
      await this.context.addInitScript(installRecorder);
      this.context.on('page', newPage => {
        if (newPage !== page && this.recording === session) {
          session.warnings.push('A new tab opened. Multi-tab workflows need separate commands; its actions are not recorded.');
        }
      });
      page.on('frameattached', () => {
        if (this.recording === session && !session.warnings.some(w => w.startsWith('Embedded'))) session.warnings.push('Embedded frames are present. Interactions inside frames are not recorded.');
      });
      page.on('domcontentloaded', () => {
        if (this.recording === session) page.evaluate(paused => window.__mimicSetPaused?.(paused),session.status === 'paused').catch(() => {});
      });
      page.on('framenavigated', frame => {
        if (frame !== page.mainFrame() || this.recording !== session || session.status !== 'recording') return;
        try {
          const url = webUrl(frame.url());
          // Links and form submissions navigate themselves during replay.
          if (!session.steps.length || (Date.now() - lastActionAt > 2200 && session.steps.at(-1)?.url !== url)) {
            add({type:'navigate',label:`Open ${new URL(url).hostname}`,url,checkpoint:false,secret:false});
          }
        } catch { session.warnings.push('A private or unsupported URL was not recorded.'); }
      });
      await page.goto(webUrl(input.url), { waitUntil:'domcontentloaded', timeout:30000 });
      if (!session.steps.length) add({type:'navigate',label:`Open ${new URL(input.url).hostname}`,url:input.url,checkpoint:false,secret:false});
      return session;
    } catch (error) {
      this.recording = null;
      throw new Error(`Could not start the browser: ${friendlyError(error)}`);
    } finally { this.locked = false; }
  }
  async pauseRecording() {
    if (!this.recording) throw new Error('No demonstration is recording.');
    if (this.recording.status === 'recording') {
      await this.page?.evaluate(async () => { await window.__mimicFlush?.(); }).catch(() => {});
      this.recording.status = 'paused';
      this.recording.pausedAtUrl = this.page?.url();
    } else if (this.recording.status === 'paused') {
      this.recording.status = 'recording';
      if (this.page && this.page.url() !== this.recording.pausedAtUrl) {
        try { const url=webUrl(this.page.url());this.recording.steps.push({id:id(),type:'navigate',label:`Open ${new URL(url).hostname}`,url,checkpoint:false,secret:false}); }
        catch { this.recording.warnings.push('The page after resuming has a private or unsupported URL.'); }
      }
      delete this.recording.pausedAtUrl;
    }
    await this.page?.evaluate(paused => window.__mimicSetPaused?.(paused),this.recording.status === 'paused').catch(() => {});
    return this.recording;
  }
  async finishRecording(warning) {
    if (!this.recording || this.recording.status === 'saving') return null;
    const session = this.recording;
    await this.page?.evaluate(async () => { await window.__mimicFlush?.(); }).catch(() => {});
    session.status = 'saving';
    if (warning) session.warnings.push(warning);
    const durationMs = Date.now() - new Date(session.startedAt).getTime();
    const demo = { ...session, status:'saved', finishedAt:now(), durationMs, steps:normalizeSteps(session.steps) };
    this.store.data.demonstrations.unshift(demo);
    this.store.save(); this.recording = null;
    await this.page?.evaluate(() => document.querySelector('[data-mimic-toolbar]')?.remove()).catch(() => {});
    return demo;
  }
  async run(command, input) {
    if (this.locked || this.recording || this.activeRun) throw new Error('Finish the current demonstration or run first.');
    const steps = materialize(command,input.values);
    this.locked = true;
    try {
      await this.openBrowser();
      const run = { id:id(), commandId:command.id, commandName:command.name, mode:input.mode, status:'running', startedAt:now(), steps:steps.map(s => ({id:s.id,label:s.label,type:s.type,status:'pending'})), outputs:[], currentStep:0 };
      this.store.data.runs.unshift(run); this.store.save();
      this.activeRun = { id:run.id, cancelled:false, resume:null };
      // Ownership stays with the engine until the final status has been persisted.
      this.execute(run,steps).catch(error => { run.status = 'failed'; run.error = friendlyError(error); run.finishedAt = now(); this.activeRun = null; this.store.save(); });
      return run;
    } finally { this.locked = false; }
  }
  async findTarget(step) {
    for (const selector of [step.selector, ...(step.alternatives || [])].filter(Boolean)) {
      const target = this.page.locator(selector);
      try { await target.waitFor({state:'visible',timeout:3000}); if (await target.count() === 1) return target; }
      catch {}
    }
    throw new Error(`Could not uniquely find “${step.label}”. The page may have changed. Edit this step or record a new demonstration.`);
  }
  async execute(run,steps) {
    try {
      for (let i=0; i<steps.length; i++) {
        if (this.activeRun.cancelled) throw new Error('Run cancelled.');
        const step = steps[i], result = run.steps[i];
        run.currentStep = i; result.status = 'running'; result.startedAt = now(); this.store.save();
        if (step.type === 'manual' || step.checkpoint || (run.mode === 'test' && ['click','press'].includes(step.type))) {
          result.status = 'paused'; run.status = 'paused';
          run.message = step.type === 'manual' ? `Complete “${step.label}” in the browser, then continue.` : `Ready to ${step.label.toLowerCase()}. Check the browser before continuing.`;
          this.store.save();
          await new Promise(resolve => { this.activeRun.resume = resolve; });
          if (this.activeRun.cancelled) throw new Error('Run cancelled.');
          result.status = 'running'; run.status = 'running'; delete run.message;
        }
        if (step.type === 'navigate') await this.page.goto(webUrl(step.url),{waitUntil:'domcontentloaded',timeout:30000});
        else if (step.type !== 'manual') {
          if (step.origin) {
            // Wait for navigation caused by the prior click before checking origin.
            await this.page.waitForURL(u => u.origin === step.origin, {timeout:12000});
          }
          const target = await this.findTarget(step);
          if (step.type === 'fill') await target.fill(step.value || '');
          if (step.type === 'select') await target.selectOption(step.value || '');
          if (step.type === 'check') await target.setChecked(step.value === 'true');
          if (step.type === 'click') await target.click();
          if (step.type === 'press') await target.press(step.value);
          if (step.type === 'assert') {
            const deadline=Date.now()+12000;let content='';
            while(Date.now()<deadline){if(this.activeRun?.cancelled)throw new Error('Run cancelled.');content=(await target.innerText()).trim();if(content.includes(step.value))break;await new Promise(r=>setTimeout(r,100));}
            if(!content.includes(step.value))throw new Error('Outcome check failed.');run.outputs.push({label:step.label,text:content});
          }
          if (step.type === 'extract') {
            const content = (await target.innerText()).trim().slice(0,20000);
            run.outputs.push({label:step.label, text:content});
          }
        }
        result.status = 'passed'; result.finishedAt = now(); this.store.save();
      }
      run.status = 'passed';
    } catch (error) {
      run.status = this.activeRun?.cancelled ? 'cancelled' : 'failed';
      run.error = friendlyError(error);
      const current = run.steps[run.currentStep]; if (current && current.status !== 'passed') current.status = run.status;
    } finally {
      run.finishedAt = now(); delete run.message; this.activeRun = null; this.store.save();
    }
  }
  continueRun(runId) {
    if (this.activeRun?.id !== runId || !this.activeRun.resume) throw new Error('This run is not waiting for you.');
    const resume = this.activeRun.resume; this.activeRun.resume = null; resume();
  }
  async cancelRun(runId) {
    if (this.activeRun?.id !== runId) throw new Error('This run is no longer active.');
    this.activeRun.cancelled = true;
    this.activeRun.resume?.();
    await this.context?.close().catch(() => {});
  }
  async shutdown() {
    if (this.recording) await this.finishRecording('Server stopped.');
    if (this.activeRun) await this.cancelRun(this.activeRun.id);
    await this.context?.close().catch(() => {});
  }
}

function friendlyError(error) {
  const message = String(error?.message || error);
  if (message.includes('Executable doesn\'t exist')) return 'No supported browser was found. Install Google Chrome or run npx playwright install chromium in the app folder.';
  if (/Target.*closed|browser.*closed/i.test(message)) return 'The browser was closed before the workflow finished.';
  // Playwright call logs can contain filled values. Only return the first line.
  return message.split('\n')[0].slice(0,500);
}
