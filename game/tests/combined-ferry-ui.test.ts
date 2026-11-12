import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createFarm } from '../src/farm.ts';
import { combinedExpeditionId } from '../src/ferry-expeditions.ts';
import { sendFerryExpedition } from '../src/harbour-economy.ts';
import { isGuardedAction } from '../src/action-click-guard.ts';

test('paired manifest names both orders, previews total cargo, and exposes explicit single-order cancellation', async () => {
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom'});
 try {
  const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts');
  const farm=createFarm();farm.boatOwned=true;farm.coins=100;farm.produce.wheat=30;farm.eggs=20;
  const id=combinedExpeditionId('mill-grain','mill-eggs')!;
  const ctx={day:1,coins:100,boatOwned:true,expeditionPort:'mill',expeditionOffer:id,playerPort:'home',openedPorts:['home','grove'],products:[],carried:{wheat:30,eggs:20},icon:()=>''};
  const before=structuredClone(farm),html=renderFreightPanel(farm.freight,ctx);
  assert.match(html,/Два заказа в одном рейсе/);assert.match(html,/Зерно для пекаря/);assert.match(html,/Яйца для свежей выпечки/);
  assert.match(html,/Оставить только первый заказ/);assert.match(html,/Есть 30 · останется 26/);assert.match(html,/Есть 20 · останется 16/);
  assert.match(html,/Булочка ×2/);assert.match(html,/Загрузить 2 заказа и отправить/);assert.deepEqual(farm,before);
  assert.ok(sendFerryExpedition(farm,id).ok);const sent=structuredClone(farm),active=renderFreightPanel(farm.freight,ctx);
  assert.doesNotMatch(active,/data-action="expedition-pair"/);assert.doesNotMatch(active,/Оставить только первый/);assert.match(active,/Уже погружено/);assert.deepEqual(farm,sent);
  for(const action of ['expedition-pair','expedition-offer','expedition-send','expedition-claim'])assert.ok(isGuardedAction(action));
 } finally { await server.close(); }
});

test('the paid local catch previews its real price and does not claim a personal fishing or kitchen contribution', async () => {
 const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom'});
 try {
  const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts');
  const farm=createFarm();farm.boatOwned=true;farm.coins=60;farm.freight.expeditions.discovered.push('salt');
  const ctx={day:1,coins:60,boatOwned:true,expeditionPort:'salt',expeditionOffer:'salt-fish',playerPort:'home',openedPorts:['home','grove'],products:[{id:'seaBass',name:'Морской окунь',icon:'fish'}],carried:{},icon:()=>''};
  const before=structuredClone(farm),html=renderFreightPanel(farm.freight,ctx);
  assert.match(html,/Местный улов для гавани/);assert.match(html,/28 монет/);assert.match(html,/Останется 32/);assert.match(html,/Морской окунь ×2/);
  assert.match(html,/Покупка не считается личным уловом/);assert.doesNotMatch(html,/Морковь и улов помогут открыть кухню/);assert.deepEqual(farm,before);
 } finally {await server.close();}
});
