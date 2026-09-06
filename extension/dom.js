// Runs as a fixed, bundled function in the one tab Mimic opened for this session.
// Imported workflows supply data, never JavaScript source.
export function targetAction(step,operation,isolatedRepair=false) {
  if(window.top!==window&&!isolatedRepair)return {error:'Embedded frames are not supported.'};
  if(step.origin&&location.origin!==step.origin)return {retry:true};
  let el;
  for(const selector of [step.selector,...(step.alternatives||[])]){
    try{
      const matches=document.querySelectorAll(selector);
      const visible=[...matches].filter(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none';});
      if(visible.length!==1)continue;
      const node=visible[0],rect=node.getBoundingClientRect(),style=getComputedStyle(node);
      if(rect.width&&rect.height&&style.visibility!=='hidden'&&style.display!=='none'){el=node;break;}
    }catch{}
  }
  if(!el)return {retry:true};
  el.scrollIntoView({block:'center',inline:'center'});
  if(operation==='locate'){
    const rect=el.getBoundingClientRect();
    const x=Math.max(0,Math.min(innerWidth-1,rect.x+rect.width/2)),y=Math.max(0,Math.min(innerHeight-1,rect.y+rect.height/2));
    const hit=document.elementFromPoint(x,y);
    if(!hit||!(hit===el||el.contains(hit)))return {retry:true};
    return {x,y,checked:el.checked};
  }
  if(operation==='focus'){
    if(el.disabled||el.readOnly)return {error:'This field is disabled or read-only.'};
    el.focus();
    if(el.isContentEditable){const range=document.createRange();range.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}
    else if(typeof el.select==='function')el.select();
    return {ok:true};
  }
  if(operation==='select'){
    if(el.tagName!=='SELECT')return {error:'This target is no longer a select control.'};
    if(![...el.options].some(o=>o.value===step.value))return {error:'That option does not exist in this menu.'};
    el.value=step.value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return {ok:true};
  }
  if(operation==='assert'){const text=(el.innerText||'').trim().slice(0,20000);return text.includes(step.value)?{text}: {retry:true};}
  if(operation==='extract')return {text:(el.innerText||'').trim().slice(0,20000)};
  return {error:'Unsupported browser action.'};
}
