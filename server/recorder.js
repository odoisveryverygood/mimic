// This function is injected into the dedicated demonstration browser only.
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
  let queue = Promise.resolve(), lastEnterAt = 0;
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
  window.__mimicFlush = async () => { capture(document.activeElement); await queue; };
  document.addEventListener('change', e => { if (e.isTrusted) capture(e.target); }, true);
  document.addEventListener('focusout', e => { if (e.isTrusted) capture(e.target); }, true);
  document.addEventListener('click', e => {
    if (!e.isTrusted || e.target.closest('[data-mimic-toolbar]')) return;
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
  }, true);
  document.addEventListener('keydown', e => {
    if (!e.isTrusted || e.target.closest('[data-mimic-toolbar]') || !['Enter','Escape','ArrowDown','ArrowUp'].includes(e.key)) return;
    if (blocked(e.target)) return;
    if (e.target.matches('select,input[type="checkbox"],input[type="radio"]')) return;
    capture(e.target);
    // Enter on a native button generates a click, already captured above.
    if (e.key === 'Enter' && e.target.closest('button,a,[role="button"]')) return;
    if (e.key === 'Enter') lastEnterAt = Date.now();
    emit('press', e.target, e.key, {label:`Press ${e.key} in ${label(e.target)}`,checkpoint:e.key === 'Enter'});
  }, true);
  const toolbar = () => {
    if (document.querySelector('[data-mimic-toolbar]')) return;
    const host = document.createElement('div'); host.dataset.mimicToolbar = 'true';
    const shadow = host.attachShadow({mode:'closed'});
    shadow.innerHTML = '<style>:host{all:initial;position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:2147483647}div{display:flex;align-items:center;gap:16px;padding:13px 18px;border-radius:16px;background:#242722;color:#fff;font:13px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 40px #0003;white-space:nowrap}i{width:8px;height:8px;border-radius:50%;background:#ef7658}small{color:#c5c8bd}button{border:0;border-radius:8px;background:#ef7658;color:#fff;padding:8px 12px;cursor:pointer;font:inherit}</style><div><i></i><b>Mimic is listening</b><small>Alt / Option + click to capture text</small><button>Finish demonstration</button></div>';
    shadow.querySelector('button').onclick = async () => { await window.__mimicFlush(); await window.__mimicControl('stop'); };
    window.__mimicSetPaused = paused => {
      shadow.querySelector('b').textContent = paused ? 'Mimic is paused' : 'Mimic is listening';
      shadow.querySelector('i').style.background = paused ? '#a6ae9c' : '#ef7658';
      if (!paused) { privateFields = new WeakSet(); values = new WeakMap(); }
    };
    document.documentElement.appendChild(host);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', toolbar); else toolbar();
}
