import {test,expect,reach} from './fixtures.mjs';
import {assertDialogJourney,JourneyAssertionError} from './artifacts/keytrail/index.js';
function contract(page, wrong = false) {
  const trigger={id:'open',locator:page.getByRole('button',{name:'Edit profile',exact:true})};
  const input={id:'name',locator:page.getByLabel('Display name')};
  const close={id:'close',locator:page.getByRole('button',{name:'Close',exact:true})};
  return {id:'profile',trigger,dialog:{id:'dialog',locator:page.getByRole('dialog',{name:'Edit profile',exact:true})},
    openKey:'Enter',initialFocus:input,tabOrder:[input,close],closeKey:'Escape',returnFocus:wrong?input:trigger};
}
for(const library of ['zag','aria','bootstrap']) {
 test(`${library}: native opening and Escape return`, async({page,appURL})=>{
  await page.goto(`${appURL}/?example=dialog-${library}`);
  const c=contract(page);await expect(c.trigger.locator).toBeVisible();await reach(page,c.trigger.locator);await page.keyboard.press('Enter');
  await expect(c.initialFocus.locator).toBeFocused();await page.keyboard.press('Escape');await expect(c.trigger.locator).toBeFocused();
 });
 test(`${library}: declared contract or recorded compatibility limitation`,async({page,appURL},info)=>{
  await page.goto(`${appURL}/?example=dialog-${library}`);await expect(contract(page).trigger.locator).toBeVisible();
  if(library==='zag') expect((await assertDialogJourney(page,info,contract(page))).outcome).toBe('passed');
  else {
    try {await assertDialogJourney(page,info,contract(page));throw new Error('unexpected pass')}
    catch(error){expect(error).toBeInstanceOf(JourneyAssertionError);expect(error.code).toBe(library==='aria'?'MODAL_MISMATCH':'FOCUS_MISMATCH');
      const first=error.result.checks.find(c=>c.status==='fail'||c.status==='blocked');expect(first?.checkId).toBe(library==='aria'?'D02.modal':'D04.forward.002');}
  }
 });
 if(library==='zag') test(`${library}: incorrect return contract does not pass`,async({page,appURL},info)=>{
  await page.goto(`${appURL}/?example=dialog-${library}`);await expect(contract(page).trigger.locator).toBeVisible();
  try {await assertDialogJourney(page,info,contract(page,true));throw new Error('unexpected pass')}
  catch(error){expect(error).toBeInstanceOf(JourneyAssertionError);expect(['FOCUS_MISMATCH','TARGET_NOT_FOUND']).toContain(error.code)}
 });
}
