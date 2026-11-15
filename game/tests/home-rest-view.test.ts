import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createFarm,endDay,getBedStage,restoreCurrentFarm} from '../src/farm.ts'
import {getRestPreview} from '../src/rest-preview.ts'
import {renderRestPreview} from '../src/rest-preview-ui.ts'
import {renderFerryReturn} from '../src/ferry-return.ts'
import {sendFerryExpedition,receiveFerryExpedition} from '../src/harbour-economy.ts'
import {getClimate} from '../src/climate.ts'

const tags = (s:string) => s.replace(/<[^>]*>/g,' ')

test('compact preview exposes all actual bed groups, keeps its explanation and dry-bed route read-only', () => {
 const f=createFarm();f.beds=[{kind:'crop',crop:'carrot',growth:0,watered:true},{kind:'crop',crop:'pumpkin',growth:0,watered:true},{kind:'crop',crop:'carrot',growth:0,watered:false},{kind:'crop',crop:'carrot',growth:1,watered:false}]
 const before=structuredClone(f),html=renderRestPreview(f,true)
 assert.match(html,/Созреют<\/span><strong>1/);assert.match(html,/Растут<\/span><strong>1/)
 assert.match(html,/Без полива<\/span><strong>1/);assert.match(html,/Готовы<\/span><strong>1/)
 assert.ok(html.indexOf('rest-preview-stats')<html.indexOf('<details'))
 assert.match(html,/<summary>Полив и сбор<\/summary>/)
 assert.match(html,/data-action="focus-bed" data-value="2"/)
 assert.match(html,/не погибнут/);assert.match(html,/Созревший урожай останется на грядках/)
 assert.doesNotMatch(html,/data-action="sleep"/);assert.deepEqual(f,before)
 const expected=getRestPreview(f);endDay(f)
 assert.equal(getBedStage(f.beds[expected.ripening[0].index]),'ripe')
})

test('dry beds before rain are never described as growing and empty gardens are not a mandatory task', () => {
 const f=createFarm();f.day=Array.from({length:30},(_,i)=>i+1).find(d=>getClimate(d+1).weather==='rain')!
 f.beds=[{kind:'crop',crop:'carrot',growth:0,watered:false}]
 const html=renderRestPreview(f,true)
 assert.match(html,/Созреют<\/span><strong>0/);assert.match(html,/Без полива<\/span><strong>1/)
 assert.match(html,/Завтрашний дождь польёт грядки утром, но не заменит полив/)
 f.beds=[{kind:'empty'}];const empty=renderRestPreview(f,true)
 assert.match(empty,/Можно отдохнуть и без работы/);assert.doesNotMatch(empty,/<details|data-action/)
 f.beds=[{kind:'crop',crop:'carrot',growth:1,watered:false}];assert.doesNotMatch(renderRestPreview(f,true),/Политые посадки подрастут/)
})

test('compact ferry forecast retains the frozen manifest and actual date without claiming or changing discovery', () => {
 const f=createFarm();f.boatOwned=true;f.coins=50
 assert.ok(sendFerryExpedition(f,'mill-buy').ok)
 const goods=[{id:'handmade:round',name:'Булочка'}],before=structuredClone(f),html=renderFerryReturn(f,goods,true)
 assert.match(html,/Паром · в море/);assert.match(html,/Утро дня 2/);assert.match(html,/Мельничный посад/)
 const legacy=tags(renderFerryReturn(f,goods))
 for(const incoming of f.freight.expeditions.active!.incoming)assert.ok(html.includes(`×${incoming.quantity}`))
 assert.match(html,/Получение отдельно, после сна/)
 assert.ok(legacy.includes('Вернётся утром дня 2'))
 assert.equal((html.match(/data-action=/g)||[]).length,1);assert.match(html,/data-action="ferry-return"/)
 assert.doesNotMatch(html,/expedition-claim|sleep/);assert.deepEqual(f,before)
 endDay(f);const ready=structuredClone(f),arrived=renderFerryReturn(f,goods,true)
 assert.match(arrived,/груз ждёт/);assert.match(arrived,/Груз сохранится до получения/);assert.deepEqual(f,ready)
 assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
 assert.ok(receiveFerryExpedition(f).ok);assert.equal(renderFerryReturn(f,goods,true),'')
})

test('rest changes presentation only: explicit sleep branch and confirmation/day guards stay outside view', () => {
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const rest=main.slice(main.indexOf("    case 'rest':"),main.indexOf("    case 'journal':"))
 assert.doesNotMatch(rest,/saveFarm|endDay|localStorage|perform\(/)
 const summary=rest.indexOf('<summary>'),services=rest.indexOf('home-rest-services')
 assert.ok(summary>services)
 assert.ok(rest.indexOf("button('Открыть кухню'")>services)
 assert.ok(rest.indexOf("button('Улучшения'")>services)
 const css=readFileSync(new URL('../src/rest-preview.css',import.meta.url),'utf8')
 assert.match(css,/home-rest-details>summary\{[^}]*min-height:44px/)
 assert.doesNotMatch(css,/rest-before-morning[^}]*display:none/)
})
