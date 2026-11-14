import { createFarm } from '../../src/farm.ts';
import { combinedExpeditionId, expeditionOfferIds, type ExpeditionPort } from '../../src/ferry-expeditions.ts';
import { expeditionWallet, sendFerryExpedition } from '../../src/harbour-economy.ts';
import { renderFreightPanelInto } from '../../src/bay-freight-ui.ts';
import { captureFerryPanelView, restoreFerryPanelView } from '../../src/ferry-panel-view.ts';

/** Runs against a real document in the manual fixture, or a DOM runner without game assets. */
export function runFerryPanelViewChecks(host: HTMLElement): string[] {
  const results: string[] = [], document = host.ownerDocument;
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); results.push(message); };
  const farm = createFarm(); farm.boatOwned = true; farm.coins = 100; farm.produce.wheat = 30; farm.eggs = 20;
  let port: ExpeditionPort = 'mill', offer = 'mill-grain', dispatched = 0;
  const baseline = JSON.stringify(farm);
  const render = () => renderFreightPanelInto(host, farm.freight, {
    day: farm.day, coins: farm.coins, boatOwned: true, expeditionPort: port, expeditionOffer: offer,
    playerPort: 'home', openedPorts: ['home','grove'], products: [], carried: expeditionWallet(farm).bag, icon: () => '',
  });
  const details = (name: 'offers'|'port-details') => host.querySelector<HTMLDetailsElement>(`.expedition-${name}`)!;
  const button = (action: string, value: string) => [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find(control => control.dataset.action === action && control.dataset.value === value)!;
  const activate = (action: string, value: string) => {
    const control = button(action,value);
    if (!control) throw new Error(`Missing control: ${action}/${value}`);
    control.focus({preventScroll:true}); control.click();
  };
  const clicked = (event: Event) => {
    const control = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!control || !host.contains(control) || control.disabled) return;
    const {action,value=''} = control.dataset;
    if (action === 'expedition-offer') offer = value;
    else if (action === 'expedition-pair') {
      const ids = expeditionOfferIds(offer);
      offer = ids[1] === value ? ids[0] : combinedExpeditionId(ids[0],value)!;
    } else if (action === 'expedition-port') { port = value as ExpeditionPort; offer = 'salt-carrots'; }
    else if (action === 'expedition-send') { if (sendFerryExpedition(farm,value).ok) dispatched++; }
    else return;
    render();
  };
  host.addEventListener('click',clicked);
  try {
    render(); render();
    check(!details('offers').open && !details('port-details').open,'Closed disclosures stay closed on redraw');
    details('offers').open = true;
    activate('expedition-offer','mill-eggs');
    check(details('offers').open,'Selecting an order keeps the picker open');
    check(!details('port-details').open,'Selecting an order does not reveal port details');
    check(document.activeElement === button('expedition-offer','mill-eggs'),'Selecting an order retains its visible focus');
    check(offer === 'mill-eggs','Single selection remains the selected order');
    details('port-details').open = true;
    const scrollSelectors = ['.bay-freight-workspace','.expedition-card-scroll','.expedition-overview'];
    const scrollBefore = scrollSelectors.map((selector,index) => {
      const area = host.querySelector<HTMLElement>(selector)!; area.scrollTop = [73,120,24][index]; return area.scrollTop;
    });
    activate('expedition-pair','mill-grain');
    check(offer === 'pair:mill-eggs+mill-grain','Adding the second order keeps the first order');
    check(details('offers').open && details('port-details').open,'Pair selection preserves both disclosure states');
    check(document.activeElement === button('expedition-pair','mill-grain'),'Adding the second order retains focus on its remove action');
    check(scrollSelectors.every((selector,index) => host.querySelector<HTMLElement>(selector)!.scrollTop === scrollBefore[index]),'Pair selection preserves every inner scroll position');
    const firstInPicker = details('offers').querySelector<HTMLButtonElement>('[data-action="expedition-offer"][data-value="mill-eggs"]')!;
    firstInPicker.focus({preventScroll:true}); render();
    check(document.activeElement === details('offers').querySelector('[data-action="expedition-offer"][data-value="mill-eggs"]'),'The picker action keeps focus instead of its duplicate manifest action');
    activate('expedition-pair','mill-sale');
    check(offer === 'pair:mill-eggs+mill-sale','Replacing the second order keeps the first order');
    check(details('offers').open && document.activeElement === button('expedition-pair','mill-sale'),'Replacement leaves the picker open and focused');
    activate('expedition-pair','mill-sale');
    check(offer === 'mill-eggs' && document.activeElement === button('expedition-pair','mill-sale'),'Removing the second order retains the add action focus');
    activate('expedition-pair','mill-grain');
    const keepFirst = host.querySelector<HTMLButtonElement>('.expedition-selection button')!;
    keepFirst.focus({preventScroll:true}); keepFirst.click();
    check(offer === 'mill-eggs' && details('offers').open,'Keeping only the first order does not close the picker');
    check(document.activeElement === button('expedition-offer','mill-eggs'),'Removing via the manifest restores the matching visible first order');
    activate('expedition-pair','mill-grain');
    details('offers').open = false;
    const closedKeepFirst = host.querySelector<HTMLButtonElement>('.expedition-selection button')!;
    closedKeepFirst.focus({preventScroll:true}); closedKeepFirst.click();
    check(!details('offers').open,'Removing a manifest order does not reopen a deliberately closed picker');
    check(document.activeElement === details('offers').querySelector('summary'),'A hidden replacement gets visible summary focus instead');
    details('offers').open = true;
    button('expedition-offer','mill-eggs').focus({preventScroll:true});
    const remembered = captureFerryPanelView(host)!;
    host.innerHTML = '<button type="button">Другое меню</button>';
    render(); restoreFerryPanelView(host,remembered);
    check(details('offers').open && details('port-details').open,'Returning from another menu restores the open disclosures');
    check(document.activeElement === button('expedition-offer','mill-eggs'),'Returning restores visible focus to the prior order');
    offer = 'mill-grain'; render(); restoreFerryPanelView(host,remembered);
    check(button('expedition-send','mill-grain') !== undefined,'View restoration cannot change the current selected order');
    check(JSON.stringify(farm) === baseline && dispatched === 0,'Selection does not dispatch, spend, claim or advance the day');
    activate('expedition-send','mill-grain');
    check(dispatched === 1 && farm.freight.expeditions.active?.id === 'mill-grain','Only the explicit dispatch sends the currently selected order');
    check(!host.querySelector('.expedition-offers'),'A sent voyage does not restore a vanished order picker');
    check(document.activeElement === host.querySelector('.bay-freight-close'),'When dispatch disappears focus goes to the visible ferry close control');
  } finally { host.removeEventListener('click',clicked); }
  return results;
}
