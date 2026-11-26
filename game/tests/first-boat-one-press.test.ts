import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as Cook from '../src/cookery-model.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { getIslandJourneys } from '../src/journey.ts'
import { initialExpeditionPreview } from '../src/ferry-expeditions.ts'
import { firstFerryCargoOffer } from '../src/ferry-smaller-cargo.ts'
import { expeditionWallet } from '../src/harbour-economy.ts'
import { getCapeJourneyStatus } from '../src/cape-journey-status.ts'
import { ruPlural } from '../src/ru.ts'
import type { CookeryResult } from '../src/culinary.ts'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const source = read('../src/main.ts')
const opening: {name: string; args: unknown[]}[] = JSON.parse(read('./fixtures/home-progress-actions.json'))
function exact(a: string, b: string) {
  const i = source.indexOf(a), j = source.indexOf(b, i + a.length)
  assert.ok(i >= 0 && j > i, a)
  return source.slice(i, j)
}
const orientation = stripTypeScriptTypes(exact("  if (next === 'archive' || next === 'boat') {", "  if (next !== panel && next !== 'festival')"))
const renderBoat = stripTypeScriptTypes(exact('function button(', 'function row(') +
  "switch ('boat') {" + exact("    case 'boat': {", "    case 'dock-project':").replaceAll('import.meta.env.BASE_URL', "'/'") + '}')
const activate = stripTypeScriptTypes('async function action(action,value) { switch(action) {' +
  exact("    case 'buy-boat':", "    case 'store-tree':") + '}}; action')
const cookery = read('../src/cookery.ts')
const finishStart = cookery.indexOf('  function doFinish()'), finishEnd = cookery.indexOf("  finish.addEventListener('click', doFinish",finishStart)
assert.ok(finishStart >= 0 && finishEnd > finishStart)
const finish = stripTypeScriptTypes(cookery.slice(finishStart,finishEnd) + '\ndoFinish();')
const exactGuard = stripTypeScriptTypes(read('../src/action-click-guard.ts')
  .replace(/\bexport /g, '') + '; installActionClickGuard')

function readyFarm() {
  const farm = F.createFarm()
  for (const {name,args} of opening.slice(0,12)) {
    const action = (F as unknown as Record<string,(farm: F.FarmState, ...args: unknown[]) => {ok: boolean;message: string}>)[name]
    const result = action(farm,...args)
    assert.ok(result.ok, name + ': ' + result.message)
  }
  const saves: string[] = []
  for (const next of ['archive','boat'])
    runInNewContext(orientation,{ next, farm, saveFarm: () => saves.push(JSON.stringify(farm)), status() {} })
  assert.equal(saves.length,2)
  assert.equal(getDiscoveryTask(farm,farm.orientation)?.id,'first-cooking')
  const model = Cook.createCookeryModel('decorate')
  for (let i=0;i<3;i++) assert.ok(Cook.placeCookeryFruit(model,i,{x:(i-1)*.4,y:.3}))
  for (let i=-5;i<=5;i++) {
    const y=i*.15, half=Math.sqrt(1-y*y)*.9
    Cook.beginCookeryStroke(model,{x:-half,y})
    Cook.moveCookeryStroke(model,{x:0,y})
    Cook.moveCookeryStroke(model,{x:half,y})
    Cook.endCookeryStroke(model)
  }
  const errors: string[] = []
  runInNewContext(finish,{model,completeCookery:Cook.completeCookery,contextLost:false,destroyed:false,loaded:true,
    physicallySettled:true,drag:null,options:{recipe:{},onComplete:(result:CookeryResult)=>F.completeSignature(farm,
      {base:'tart',ingredients:[{id:'apple',quantity:2}]},result).ok},
    fruitId:()=> 'apple',fruitTrait:()=>undefined,normalizeAngle:(a:number)=>a,
    playBaySound(){},sync(){},announce:(message:string)=>errors.push(message),exitButton:{setAttribute(){}}})
  assert.deepEqual(errors,[])
  assert.equal(model.stage,'finished')
  assert.deepEqual([farm.day,farm.island,farm.coins,farm.boatOwned,farm.culinary.serial,farm.produce.wheat],[2,'home',58,false,1,2])
  assert.equal(getDiscoveryTask(farm,farm.orientation)?.id,'boat')
  return F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
}

class Button {
  dataset: {action: string; value?: string}
  disabled: boolean
  constructor(dataset: {action: string; value?: string}, disabled = false) { this.dataset=dataset; this.disabled=disabled }
  closest(selector: string) { return selector === 'button' ? this : null }
  matches() { return false }
}

type Click = {target: Button, detail: number, timeStamp: number, clientX: number, clientY: number, isTrusted: boolean,
  prevented: boolean, stopped: boolean, preventDefault():void, stopImmediatePropagation():void}

function bay(farm: F.FarmState, destination: F.IslandId = 'grove') {
  let cardOpen = true
  const saves: F.FarmState[] = [], actions: string[] = [], focus: string[] = []
  const content = { innerHTML: '' }
  const selection = initialExpeditionPreview(farm.freight.expeditions)
  function buttons() {
    // Re-render the real card for every fresh physical hit, as the purchase redraws it.
    runInNewContext(renderBoat,{...F,farm,getIslandJourneys,getCapeJourneyStatus,expeditionWallet,firstFerryCargoOffer,ruPlural,
      selectedExpeditionPort:selection.port,selectedExpeditionOffer:selection.offer,boatIsland:destination,dialogContent:content,
      icon:()=>'',requestAnimationFrame:()=>{},pastryShape:'round',escapeHtml:String,journeyDetailsOpen:false,
      requirementLink:()=>'',numberFormat:new Intl.NumberFormat('ru-RU')})
    const nav = content.innerHTML.match(/<nav class="island-places"[^>]*>([\s\S]*?)<\/nav>/)![1]
    return [...nav.matchAll(/<button\b([^>]*)>/g)].map(([, attrs])=>new Button({
      action:attrs.match(/data-action="([^"]+)"/)![1],
      value:attrs.match(/data-value="([^"]+)"/)?.[1],
    },/\sdisabled(?:\s|$)/.test(attrs)))
  }
  const handler = runInNewContext(activate,{...F,farm,fieldViewButton:{getAttribute:()=>'false'},fieldLayout:{matches:false},
    closeDialog:()=>{cardOpen=false; actions.push('close')},
    toggleFieldView(){ assert.fail('not in field view') },
    canvas:{focus:()=>focus.push('world')},playBaySound(){},openPanel:()=>{assert.fail('Grove is not village')},
    island:{async crossIsland(commit:()=>boolean){ actions.push('cross'); assert.ok(commit()) }},
    // Reuse the exact reducer and the real action branches; the seam records rather than writing a player save.
    perform(apply:()=>{ok:boolean}) {
      const result=apply()
      if (result.ok) { saves.push(structuredClone(farm)); if (cardOpen) buttons() }
      return result.ok
    },
  }) as (action: string, value?: string)=>Promise<void>
  const capture = new Map<string,(event:any)=>void>(), keys = new Map<string,(event:any)=>void>()
  const root = {contains:(target:unknown)=>target instanceof Button,addEventListener:(type:string, callback:(event:any)=>void)=>capture.set(type,callback),
    ownerDocument:{addEventListener:(type:string, callback:(event:any)=>void)=>keys.set(type,callback)}}
  ;(runInNewContext(exactGuard,{ Element:Button }) as (root: unknown)=>void)(root)
  function primary() { return buttons().filter(b=>!b.disabled)[0] }
  async function click(target: Button, timeStamp: number, clientX: number, clientY: number, detail = 1) {
    assert.ok(cardOpen && target && !target.disabled)
    const event: Click = {target,timeStamp,clientX,clientY,detail,isTrusted:true,prevented:false,stopped:false,
      preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}}
    capture.get('click')!(event)
    assert.equal(event.prevented,event.stopped)
    if (!event.stopped) await handler(target.dataset.action,target.dataset.value)
    return event.stopped
  }
  function key(type: string, target: Button, repeat: boolean) {
    const event = {key:'Enter',target,repeat,stopped:false,preventDefault(){},stopImmediatePropagation(){this.stopped=true}}
    keys.get(type)!(event)
    return event.stopped
  }
  return {primary, buttons, click, key, saves, actions, focus, get cardOpen(){return cardOpen}}
}

test('Day 2 boat payment cannot ride through a same-point repeat to the newly mounted departure', async t => {
  const farm=readyFarm(), ui=bay(farm)
  const before=JSON.stringify(farm)
  assert.deepEqual(ui.buttons().map(b=>b.dataset.action),['buy-boat'])
  assert.equal(JSON.stringify(farm),before,'preview never pays or travels')
  assert.equal(await ui.click(ui.primary(),1000,100,100),false)
  assert.deepEqual([farm.coins,farm.boatOwned,farm.island,ui.saves.length],[22,true,'home',1])
  assert.equal(ui.primary().dataset.action,'sail')
  assert.equal(ui.primary().dataset.value,'grove')
  const blocked=await ui.click(ui.primary(),1090,100,100,2)
  t.diagnostic(JSON.stringify({day:farm.day,afterRepeat:{blocked,island:farm.island,coins:farm.coins,writes:ui.saves.length,actions:ui.actions}}))
  assert.equal(blocked,true,'the same physical gesture must not also depart')
  assert.deepEqual([farm.island,farm.coins,ui.saves.length,ui.cardOpen],['home',22,1,true])
  assert.equal(await ui.click(ui.primary(),1580,100,100),false)
  assert.deepEqual([farm.day,farm.island,farm.coins,ui.saves.length],[2,'grove',22,2])
  assert.deepEqual(ui.actions,['close','cross'])
  assert.deepEqual(ui.focus,['world'])
  assert.deepEqual([farm.fruit.pear,farm.saltGatheredToday,farm.freight.expeditions.active],[0,false,null])
  assert.match(getDiscoveryTask(farm,farm.orientation)!.action.target,/^visit-tree$/)
  assert.ok(F.pickFruit(farm,0).ok)
  assert.deepEqual([farm.fruit.pear,farm.coins],[2,22],'first pear is a separate action, not a landing grant')
})

test('distinct fast departure still works and holding the purchase key cannot activate a successor', async () => {
  const farm=readyFarm(), ui=bay(farm)
  assert.equal(await ui.click(ui.primary(),1000,100,100),false)
  assert.equal(await ui.click(ui.primary(),1090,120,100),false,'a distinct hit is not held behind a global 500ms lock')
  assert.deepEqual([farm.island,farm.coins,ui.saves.length],['grove',22,2])
  const byKey=readyFarm(), keys=bay(byKey)
  assert.equal(keys.key('keydown',keys.primary(),false),false)
  assert.equal(await keys.click(keys.primary(),1000,0,0,0),false)
  const close=new Button({action:'close'})
  assert.equal(keys.key('keydown',close,true),true,'held Enter cannot activate the neutral redraw fallback')
  assert.equal(keys.key('keydown',keys.primary(),true),true,'or the replacement route')
  keys.key('keyup',close,false)
  assert.equal(keys.key('keydown',keys.primary(),false),false)
  assert.equal(await keys.click(keys.primary(),1100,0,0,0),false,'fresh keyboard activation is explicit')
  assert.deepEqual([byKey.island,byKey.coins,keys.saves.length],['grove',22,2])
})
