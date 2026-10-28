import type { Page } from '@playwright/test';
import type { TabsContract } from '../../src/index.js';

export type TabsOptions = { activation?: 'automatic' | 'manual'; activationKey?: 'Enter' | 'Space';
  orientation?: 'horizontal' | 'vertical'; homeEnd?: boolean; initial?: number; defect?: string };
export function tabsHtml(options: TabsOptions = {}): string {
  const { activation = 'automatic', orientation = 'horizontal', initial = 1, defect = '' } = options;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><style>
    [hidden]{display:none!important} [role="tabpanel"]{min-height:40px;padding:10px}
    :focus{outline:3px solid blue}
  </style><body><div id="tabs" role="tablist" aria-label="Account sections" aria-orientation="${orientation}">
    ${[0, 1, 2].map(i => `<button id="tab-${i}" role="tab" aria-controls="panel-${i}" aria-selected="${i === initial}" tabindex="${i === initial ? 0 : -1}">Section ${i + 1}</button>`).join('')}
  </div>${[0, 1, 2].map(i => `<section id="panel-${i}" role="tabpanel" aria-labelledby="tab-${i}" tabindex="0" ${i === initial ? '' : 'hidden'}>Panel ${i + 1}</section>`).join('')}
  <button id="after">Continue</button><script>
    const root=document.getElementById('tabs'), tabs=[...root.children];
    const panels=[0,1,2].map(i=>document.getElementById('panel-'+i));
    const mode=${JSON.stringify(activation)}, direction=${JSON.stringify(orientation)}, defect=${JSON.stringify(defect)};
    let current=${initial}, selected=${initial}; window.keytrailKeys=[];
    document.addEventListener('keydown',e=>window.keytrailKeys.push(e.key));
    function activate(index){ selected=index; tabs.forEach((tab,i)=>tab.setAttribute('aria-selected',String(i===index))); panels.forEach((panel,i)=>panel.hidden=i!==index); }
    if(defect==='idref')tabs[0].setAttribute('aria-controls','panel-1');
    if(defect==='labelledby')panels[0].setAttribute('aria-labelledby','tab-2');
    if(defect==='duplicate-id')document.body.insertAdjacentHTML('beforeend','<span id="panel-0"></span>');
    if(defect==='multiple-selected')tabs[0].setAttribute('aria-selected','true');
    if(defect==='multiple-panels')panels[0].hidden=false;
    if(defect==='no-name')root.removeAttribute('aria-label');
    if(defect==='orientation')root.setAttribute('aria-orientation',direction==='horizontal'?'vertical':'horizontal');
    if(defect==='rtl')root.dir='rtl';
    if(defect==='disabled')tabs[0].disabled=true;
    if(defect==='activedescendant')root.setAttribute('aria-activedescendant','tab-1');
    if(defect==='extra-tab')root.insertAdjacentHTML('beforeend','<button role="tab" tabindex="-1">Extra</button>');
    if(defect==='missing-panel')panels[0].remove();
    if(defect==='panel-role')panels[0].setAttribute('role','region');
    root.addEventListener('keydown',e=>{
      if(e.key==='Tab'){if(defect==='exit')e.preventDefault();return;}
      if(e.key==='Enter'||e.key===' '){e.preventDefault();if(defect==='delayed')setTimeout(()=>activate(current),60);else if(defect!=='no-activation')activate(current);return;}
      const next=direction==='horizontal'?'ArrowRight':'ArrowDown';
      const prev=direction==='horizontal'?'ArrowLeft':'ArrowUp';
      if(![next,prev,'Home','End'].includes(e.key))return;
      e.preventDefault();
      if(defect==='wrong-arrow'&&e.key===next)return;
      if(defect==='no-home'&&e.key==='Home')return;
      if(defect==='popup'){window.open('about:blank');return;}
      if(defect==='navigation'){location.hash='changed';return;}
      if(defect==='dynamic'){root.insertAdjacentHTML('beforeend','<button role="tab" tabindex="-1">Added</button>');}
      let index=e.key==='Home'?0:e.key==='End'?2:current+(e.key===next?1:-1);
      index=defect==='no-wrap'?Math.max(0,Math.min(2,index)):(index+3)%3;
      const previous=selected;current=index;
      if(defect==='rerender'){const clone=tabs[index].cloneNode(true);tabs[index].replaceWith(clone);tabs[index]=clone;}
      if(defect!=='roving')tabs.forEach((tab,i)=>tab.tabIndex=i===index?0:-1);
      tabs[index].focus();
      if(defect==='focus-drift')setTimeout(()=>document.getElementById('after').focus(),250);
      if(mode==='automatic'){
        if(defect==='delayed')setTimeout(()=>activate(index),60);else activate(index);
      }else if(defect==='premature')activate(index);
      else if(defect==='late-premature')setTimeout(()=>activate(index),300);
      else if(defect==='transient-premature'){setTimeout(()=>activate(index),300);setTimeout(()=>activate(previous),800);}
    });
  </script></body></html>`;
}
export function tabsContract(page: Page, options: TabsOptions = {}): TabsContract {
  const items = [0, 1, 2].map(i => ({ tab: { id: `tab-${i}`, locator: page.locator(`#tab-${i}`) },
    panel: { id: `panel-${i}`, locator: page.locator(`section#panel-${i}`) } }));
  const initial = options.initial ?? 1;
  return { id: 'account-tabs', tablist: { id: 'tabs', locator: page.locator('#tabs') }, items,
    initialTabId: items[initial]!.tab.id, orientation: options.orientation ?? 'horizontal', nextTabStop: items[initial]!.panel,
    homeEnd: options.homeEnd ?? false, timeoutMs: 2000, scenarioTimeoutMs: 30000, observationWindowMs: 200,
    ...(options.activation === 'manual' ? { activation: 'manual', activationKey: options.activationKey ?? 'Enter' } : { activation: 'automatic' }) };
}
