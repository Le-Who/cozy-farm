import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {commissionPlayer} from './fixtures/commission-player.ts';
import {contributeFestival, finishFestival, getArchive, getFestivalStatus, restoreFarm} from '../src/farm.ts';

test('a harvested frost apple can occupy one of the three original places and appear at the finished festival', async () => {
  // This opening reaches the harbour and two real shared meals from a new farm.
  const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'));
  const p=commissionPlayer(opening), server=await createServer({
    root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,
    server:{middlewareMode:true,ws:false},appType:'custom',
  });
  try {
    const {renderFestivalPanel}=await server.ssrLoadModule('/src/bay-festival-ui.ts');
    const render=(celebrated?:string)=>renderFestivalPanel(p.state,{celebrated,itemIcon:(name:string,trait:string)=>`<i data-icon="${name}" data-trait="${trait}"></i>`});
    const day=p.state.day;
    p.act('beginFestival','harvest');
    assert.deepEqual(p.state.fruit,{apple:0,pear:0,peach:0});
    assert.ok(p.state.variants.apple?.rainbow);
    const untouched=structuredClone(p.state);
    assert.equal(contributeFestival(p.state,'fruit').ok,false,'unspecified alternative must not consume an exhibit');
    assert.deepEqual(p.state,untouched);
    assert.equal(getFestivalStatus(p.state).active!.requirements.find(r=>r.id==='fruit')?.available,1,'only one of the owned exhibit types may be donated');
    p.visit('home');p.act('pickFruit',0);
    for (const slot of [1,6,15]) p.act('workBed',slot);
    p.visit('grove');p.act('pickFruit',0);p.visit('village');
    assert.equal(p.state.variants.apple?.frost,1);
    const fruitGroup=()=>getFestivalStatus(p.state).active!.requirements.find(r=>r.id==='fruit')!;
    assert.equal(fruitGroup().quantity,3);assert.equal(fruitGroup().available,3);
    const oldWarehouse=structuredClone(p.state);
    delete oldWarehouse.discoveries.apple!.frost;
    assert.ok(contributeFestival(oldWarehouse,'fruit','exhibit:apple:frost').ok);
    assert.ok(restoreFarm(oldWarehouse),'a real withdrawn last fruit without an old album flag still saves after exhibiting');
    const before=render();
    assert.match(before,/data-value="fruit\|exhibit:apple:frost"[^>]*>.*?Выставить: морозное яблоко/s);
    assert.doesNotMatch(before,/data-value="fruit\|exhibit:peach/);
    p.act('contributeFestival','participation','harvest');
    p.act('contributeFestival','fruit','apple'); assert.equal(p.state.festivals.active!.materialValue,4);
    const held=structuredClone(p.state.fruit),money=p.state.coins;
    const [,group,alt]=before.match(/data-value="(fruit)\|(exhibit:apple:frost)"/)!;
    p.act('contributeFestival',group,alt);
    assert.deepEqual(p.state.fruit,held);assert.equal(p.state.variants.apple?.frost??0,0);
    assert.equal(fruitGroup().delivered,2);assert.equal(p.state.festivals.active!.materialValue,12);assert.equal(p.state.coins,money);
    const selected=structuredClone(p.state);
    assert.match(render(),/На праздничном столе: <b>морозное яблоко/);assert.doesNotMatch(render(),/data-value="fruit\|exhibit:/);
    for(const id of ['exhibit:apple:frost','exhibit:apple:rainbow'])assert.equal(contributeFestival(p.state,'fruit',id).ok,false);
    assert.deepEqual(p.state,selected);assert.equal(frostDiscovery(p.state),true);
    const malformed=structuredClone(selected);malformed.festivals.active!.exhibit!.item='peach';
    assert.equal(restoreFarm(malformed),undefined,'cannot exhibit a never-discovered variant after reload');
    p.act('contributeFestival','fruit','pear');
    const next=()=>{assert.equal(finishFestival(p.state).ok,false);p.night();p.visit('village')};
    next();
    for(let i=0;i<3;i++)p.act('contributeFestival','roots','carrot');
    for(let i=0;i<2;i++)p.act('contributeFestival','greens','leafyGreens');
    next();
    p.act('contributeFestival','treat','orchardTart');
    p.visit('home');p.act('pickFruit',0);p.act('cookDish','appleJam');p.visit('village');p.act('contributeFestival','treat','appleJam');
    next();
    const view=getFestivalStatus(p.state).active!,coins=p.state.coins;
    assert.equal(p.state.day,day+3);assert.equal(view.honorarium,24);assert.equal(view.reward,view.materialValue+24);
    p.act('finishFestival');assert.equal(p.state.coins-coins,view.reward);
    assert.deepEqual(p.state.festivals.harvestExhibit,{item:'apple',trait:'frost'});assert.equal(frostDiscovery(p.state),true);
    assert.match(render('harvest'),/data-icon="apple" data-trait="frost".*?На праздничном столе: <b>морозное яблоко/s);
    assert.match(render(),/На праздничном столе: <b>морозное яблоко/);
    assert.doesNotMatch(render('lights'),/морозное яблоко/);
    const paid=structuredClone(p.state);assert.equal(finishFestival(p.state).ok,false);assert.deepEqual(p.state,paid);
    console.info(`Earned farm: ${p.actions} commands, days ${day}→${p.state.day}, original 3 fruit slots, market reimbursement ${view.materialValue} + ${view.honorarium} = ${view.reward}.`);
  } finally {await server.close();}
});

function frostDiscovery(farm:Parameters<typeof getArchive>[0]){
  return getArchive(farm,'orchard').find(series=>series.id==='apple')?.items.find(item=>item.id==='frost')?.discovered;
}
