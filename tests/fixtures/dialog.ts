import type { Page } from '@playwright/test';
import type { DialogContract, Target } from '../../src/contracts/types.js';

export const variants = ['ordinary', 'single', 'heading', 'alternate', 'wrong-initial', 'escape-focus',
  'bad-reverse', 'no-close', 'no-return', 'no-name', 'delayed', 'rerender', 'navigation', 'popup', 'native-alert', 'escape-return'] as const;
export type Variant = typeof variants[number];
export function dialogHtml(variant: Variant = 'ordinary'): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>KeyTrail synthetic fixture</title>
  <style>[hidden]{display:none!important}body{font:18px system-ui;padding:2rem}button,input{margin:.5rem;padding:.5rem}[role=dialog]{border:2px solid #176c57;padding:1rem;max-width:30rem}:focus{outline:3px solid #2563eb}</style></head>
  <body><h1>Profile fixture</h1><button id="open">Edit profile</button><button id="alternative" hidden>Continue</button>
  <section id="dialog" role="dialog" aria-modal="true" aria-labelledby="title" hidden>
  <h2 id="title" tabindex="-1">Edit profile</h2><label id="label">Display name <input id="name" value="Example"></label>
  <button id="save" type="button">Save</button><button id="close" type="button">Close</button></section><button id="outside">Outside</button>
  <script>
  const mode=${JSON.stringify(variant)};
  const find=id=>document.getElementById(id);
  const box=find('dialog');
  window.keytrailKeys=[];
  document.addEventListener('keydown',e=>window.keytrailKeys.push(e.key));
  if(mode==='single'){find('label').remove();find('save').remove();}
  if(mode==='no-name')box.removeAttribute('aria-labelledby');
  function order(){return mode==='single'?[find('close')]:[find('name'),find('save'),find('close')];}
  function close(){
    if(mode==='no-close')return;
    box.hidden=true;
    if(mode==='no-return')return;
    if(mode==='alternate'){find('alternative').hidden=false;find('open').remove();find('alternative').focus();}
    else find('open').focus();
  }
  find('open').addEventListener('click',()=>{
    if(mode==='navigation'){location.hash='changed';return;}
    if(mode==='popup'){window.open('about:blank');return;}
    if(mode==='native-alert'){alert('Synthetic browser dialog');return;}
    const show=()=>{box.hidden=false;(mode==='wrong-initial'?find('save'):mode==='heading'?find('title'):order()[0]).focus();};
    if(mode==='delayed')setTimeout(show,75);else show();
  });
  find('close').addEventListener('click',close);
  box.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();close();return;}
    if(e.key!=='Tab')return;
    if(mode==='rerender' && document.activeElement.id==='name'){
      const old=find('name'),next=old.cloneNode(true);old.replaceWith(next);next.focus();
    }
    const items=order(),active=document.activeElement;
    if(mode==='bad-reverse'&&e.shiftKey){e.preventDefault();return;}
    if(!e.shiftKey && active===items.at(-1)){
      e.preventDefault();(mode==='escape-focus'||mode==='escape-return'?find('outside'):items[0]).focus();
      if(mode==='escape-return')setTimeout(()=>items[0].focus(),750);
    }else if(e.shiftKey&&active===items[0]){e.preventDefault();items.at(-1).focus();}
  });
  </script></body></html>`;
}
export function dialogContract(page: Page, variant: Variant = 'ordinary'): DialogContract {
  const target = (id: string): Target => ({ id, locator: page.locator('#'+id) });
  const trigger = target('open'), name = target('name'), save = target('save'), close = target('close');
  return { id: 'profile-dialog', trigger, dialog: target('dialog'), openKey: 'Enter', closeKey: 'Escape',
    initialFocus: variant === 'heading' ? target('title') : variant === 'single' ? close : name,
    tabOrder: variant === 'single' ? [close] : [name, save, close],
    returnFocus: variant === 'alternate' ? target('alternative') : trigger,
    timeoutMs: 2000, observationWindowMs: 200, scenarioTimeoutMs: 30000 };
}
