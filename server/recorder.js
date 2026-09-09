// Bundled recorder injected only into the tab the user explicitly selects.
export function installRecorder() {
  if (window.top !== window || window.__mimicInstalled) return;
  window.__mimicInstalled = true;
  const blocked = el => el.matches('input[type="password"],input[type="file"]') || /password|passwd|secret|token|api.?key|credit.?card|card.?number|cvv|cvc|one.?time|otp|ssn/i.test([el.name,el.id,el.autocomplete,el.getAttribute('aria-label')].join(' '));
  const label = el => (el.labels?.[0]?.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.innerText || el.name || el.id || el.tagName.toLowerCase()).trim().slice(0,160);
  const selectors = el => {
    const all = [];
    const add = s => { try { if (document.querySelectorAll(s).length === 1) all.push(s); } catch {} };
    if (el.dataset.testid) add(`[data-testid=${JSON.stringify(el.dataset.testid)}]`);
    if (el.id) add(`#${CSS.escape(el.id)}`);
    if (el.name) add(`${el.tagName.toLowerCase()}[name=${JSON.stringify(el.name)}]`);
    if (el.getAttribute('aria-label')) add(`[aria-label=${JSON.stringify(el.getAttribute('aria-label'))}]`);
    let node = el, parts = [];
    while (node && node !== document.documentElement && parts.length < 10) {
      const tag = node.tagName.toLowerCase();
      if (node.id) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
      const siblings = node.parentElement ? [...node.parentElement.children].filter(s => s.tagName === node.tagName) : [];
      parts.unshift(`${tag}${siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node)+1})` : ''}`);
      node = node.parentElement;
    }
    add(parts.join(' > '));
    return [...new Set(all)].slice(0,5);
  };
  let queue = Promise.resolve(), lastEnterAt = 0, picking = false, paused = false;
  const controller = new AbortController();
  const listen = (event, fn) => document.addEventListener(event, fn, {capture:true, signal:controller.signal});
  const outline = document.createElement('div');
  outline.dataset.mimicToolbar='true';
  outline.style.cssText='position:fixed;pointer-events:none;border:3px solid #fb763e;background:#fb763e18;border-radius:6px;z-index:2147483646;display:none;box-sizing:border-box;';
  const setPicking = value => { picking=value; if(!value)outline.style.display='none'; const host=document.querySelector('[data-mimic-toolbar-host]'); if(host)host.dispatchEvent(new CustomEvent('mimic-pick',{detail:value})); };
  window.__mimicPickResult=()=>{if(paused)return false;setPicking(true);return true;};
  listen('mousemove',e=>{if(!picking||e.target.closest('[data-mimic-toolbar]'))return;const r=e.target.getBoundingClientRect();Object.assign(outline.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});});
  window.__mimicCleanup=()=>{controller.abort();outline.remove();document.querySelector('[data-mimic-toolbar-host]')?.remove();delete window.__mimicInstalled;delete window.__mimicFlush;delete window.__mimicSetPaused;delete window.__mimicPickResult;delete window.__mimicCleanup;};
  const emit = (type, el, value, extra = {}) => {
    const choices = selectors(el);
    const event = { type, label: `${type === 'fill' ? 'Fill ' : type === 'select' ? 'Select ' : type === 'extract' ? 'Read ' : ''}${label(el)}`, selector: choices[0], alternatives: choices.slice(1), value, origin: location.origin, checkpoint: false, secret: false, ...extra };
    queue = queue.then(() => window.__mimicEvent(event)).catch(() => {});
    return queue;
  };
  let privateFields = new WeakSet();
  let values = new WeakMap();
  const capture = el => {
    if (!el?.matches('input,textarea,select,[contenteditable="true"]')) return;
    if (blocked(el)) {
      if (!privateFields.has(el)) { privateFields.add(el); emit('manual', el, undefined, { label: `Complete private field: ${label(el)}`, checkpoint:true, secret:true }); }
      return;
    }
    const value = el.matches('[contenteditable="true"]') ? el.innerText : el.type === 'checkbox' || el.type === 'radio' ? String(el.checked) : el.value;
    if (values.get(el) === value) return;
    values.set(el,value);
    emit(el.tagName === 'SELECT' ? 'select' : ['checkbox','radio'].includes(el.type) ? 'check' : 'fill', el, value);
  };
  window.__mimicFlush = async () => { if(!paused&&!picking)capture(document.activeElement); await queue; };
  listen('change', e => { if (e.isTrusted && !paused && !picking) capture(e.target); });
  listen('focusout', e => { if (e.isTrusted && !paused && !picking) capture(e.target); });
  listen('click', e => {
    if (!e.isTrusted || e.target.closest('[data-mimic-toolbar]')) return;
    if (picking) {
      e.preventDefault(); e.stopImmediatePropagation();
      const text=(e.target.innerText||e.target.textContent||'').trim().slice(0,12000);
      if(!text||blocked(e.target)||e.target.matches('input,textarea,select,[contenteditable="true"]'))return;
      emit('assert',e.target,text,{label:'Check the visible result'});setPicking(false);return;
    }
    if(paused)return;
    capture(document.activeElement);
    if (e.altKey) {
      e.preventDefault(); e.stopImmediatePropagation();
      emit('extract', e.target, undefined); return;
    }
    const el = e.target.closest('button,a,[role="button"],summary,[role="tab"],[role="menuitem"]');
    if (!el || el.matches('input,select,textarea')) return;
    // Enter in a form field triggers an implicit button click. Replay only Enter.
    if (e.detail === 0 && Date.now() - lastEnterAt < 500) return;
    emit('click', el, undefined, {checkpoint: /save|send|submit|publish|delete|remove|purchase|buy|order|confirm|pay|sign.?up|register/i.test(label(el)) || el.type === 'submit'});
  });
  listen('keydown', e => {
    if(picking){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();setPicking(false);}return;}
    if(paused)return;
    if (!e.isTrusted || e.target.closest('[data-mimic-toolbar]') || !['Enter','Escape','ArrowDown','ArrowUp'].includes(e.key)) return;
    if (blocked(e.target)) return;
    if (e.target.matches('select,input[type="checkbox"],input[type="radio"]')) return;
    capture(e.target);
    // Enter on a native button generates a click, already captured above.
    if (e.key === 'Enter' && e.target.closest('button,a,[role="button"]')) return;
    if (e.key === 'Enter') lastEnterAt = Date.now();
    emit('press', e.target, e.key, {label:`Press ${e.key} in ${label(e.target)}`,checkpoint:e.key === 'Enter'});
  });
  const toolbar = () => {
    if (document.querySelector('[data-mimic-toolbar-host]')) return;
    const host = document.createElement('div'); host.dataset.mimicToolbar = 'true';host.dataset.mimicToolbarHost='true';
    const shadow = host.attachShadow({mode:'closed'});
    shadow.innerHTML = '<style>:host{all:initial;position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:2147483647}div{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid #ffffff24;border-radius:14px;background:#1d201f;color:#fff;font:13px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 40px #0003;white-space:nowrap}i{width:8px;height:8px;border-radius:50%;background:#fb763e}small{color:#bec5c1}button{border:1px solid #ffffff30;border-radius:8px;background:transparent;color:#fff;padding:9px 12px;cursor:pointer;font:inherit}button:last-child{background:#fb763e;color:#191c1a;border:0;font-weight:600}@media(max-width:650px){small{display:none}b{font-size:11px}div{gap:8px}}</style><div><i></i><b>Recording your steps</b><small>Do the task as usual.</small><button id="pick">Pick success</button><button id="finish">Finish</button></div>';
    shadow.querySelector('#finish').onclick = async () => { await window.__mimicFlush(); await window.__mimicControl('stop'); };
    shadow.querySelector('#pick').onclick = () => { if(!paused)setPicking(!picking); };
    host.addEventListener('mimic-pick',e=>{shadow.querySelector('b').textContent=e.detail?'Click the result on the page':'Recording your steps';shadow.querySelector('small').textContent=e.detail?'Escape to cancel.':'Do the task as usual.';shadow.querySelector('#pick').textContent=e.detail?'Cancel pick':'Pick success';});
    window.__mimicSetPaused = value => {
      paused=value;setPicking(false);
      shadow.querySelector('b').textContent = paused ? 'Recording paused' : 'Recording your steps';
      shadow.querySelector('i').style.background = paused ? '#a6ae9c' : '#fb763e';
      if (!paused) { privateFields = new WeakSet(); values = new WeakMap(); }
    };
    document.documentElement.appendChild(outline);
    document.documentElement.appendChild(host);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', toolbar); else toolbar();
}
