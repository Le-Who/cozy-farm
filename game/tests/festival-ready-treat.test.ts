import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as farmModel from '../src/farm.ts'
import * as fruitArt from '../src/festival-fruit.ts'
import { getFestivalFishingRoute } from '../src/festival-fishing-route.ts'
import { getFestivalHarvestRoute } from '../src/festival-harvest-route.ts'
import { getFestivalShoreRoute } from '../src/festival-shore-route.ts'
import { ruCount } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(relative:string)=>readFileSync(new URL(relative,import.meta.url),'utf8')
const opening=JSON.parse(read('./fixtures/home-progress-actions.json')) as {name:string;args:unknown[]}[]
const main=read('../src/main.ts'), source=read('../src/bay-festival-ui.ts')
const evaluate=(script:string,scope:object)=>runInNewContext(stripTypeScriptTypes(script),scope)
// Render the real SSR template without starting Vite, watched caches, or a browser.
const render:typeof import('../src/bay-festival-ui.ts').renderFestivalPanel = evaluate(
  source.slice(source.indexOf('export type FestivalViewOptions'))
    .replace('export function renderFestivalPanel','function renderFestivalPanel')
    .replaceAll('import.meta.env.BASE_URL','"/"')+';renderFestivalPanel',
  {...farmModel,...fruitArt,getFestivalFishingRoute,getFestivalHarvestRoute,getFestivalShoreRoute,ruCount}
)
const contributionBranch=main.slice(main.indexOf("    case 'festival-contribute':"),main.indexOf("    case 'festival-finish':"))

function earnedTreat() {
  const player=commissionPlayer(opening.slice(0,opening.findIndex(row=>row.name==='serveVillageMeal')+1))
  player.act('beginFestival','harvest')
  player.fruit('apple',3)
  player.visit('village')
  for(let i=0;i<3;i++)player.act('contributeFestival','fruit','apple')
  player.act('contributeFestival','participation','harvest')
  player.night()
  for(let attempt=0;attempt<3;attempt++){
    for(const i of [1,5,6,7,10,12,15]){
      const action=farmModel.getBedAction(player.state,i)
      if(action.kind==='harvest')player.act('workBed',i)
      if(action.kind==='water'){
        if(!player.state.water)player.act('refillWater')
        player.act('workBed',i)
      }
    }
    const {carrot,beetroot,pumpkin,cabbage,leafyGreens}=player.state.produce
    if(carrot&&beetroot&&pumpkin&&cabbage&&leafyGreens)break
    player.night()
  }
  player.visit('village')
  for(const id of ['carrot','beetroot','pumpkin'])player.act('contributeFestival','roots',id)
  for(const id of ['cabbage','leafyGreens'])player.act('contributeFestival','greens',id)
  assert.equal(farmModel.getFestivalStatus(player.state).active?.waitingNight,true)
  assert.doesNotMatch(render(player.state),/data-value="treat\|orchardTart"/)
  player.night()
  player.visit('village')
  assert.equal(player.state.day,13)
  assert.equal(player.actions,118)
  return player
}

type Choice={action:string;value:string;disabled:boolean}
function treat(farm:farmModel.FarmState){
  const html=render(farm)
  const row=html.match(/<li class="festival-requirement"[^>]*>(?:(?!<\/li>)[\s\S])*?data-value="treat\|[^"]+"[\s\S]*?<\/li>/)?.[0]
  assert.ok(row,'live treat row')
  const [primary,other]=row.split('<details class="festival-alternatives">')
  assert.ok(other,'the disclosure remains present')
  assert.doesNotMatch(row,/<details[^>]*\bopen\b/)
  const controls=(body:string):Choice[]=>[...body.matchAll(/<button[^>]+data-action="([^"]+)" data-value="([^"]+)"([^>]*)>/g)].map(
    ([,action,value,flags])=>({action,value,disabled:/\bdisabled\b/.test(flags)}))
  return {primary:controls(primary),other:controls(other)}
}
const live=(choice:Choice)=>choice.action==='festival-contribute'&&!choice.disabled
const active=(farm:farmModel.FarmState)=>farmModel.getFestivalStatus(farm).active!
const reopen=(farm:farmModel.FarmState)=>farmModel.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
function click(farm:farmModel.FarmState,choice:Choice) {
  assert.equal(choice.action,'festival-contribute')
  let result:farmModel.ActionResult|undefined, actions=0
  evaluate('switch(action){'+contributionBranch+'}',{
    ...choice,farm,contributeFestival:farmModel.contributeFestival,
    perform(run:()=>farmModel.ActionResult){actions++;result=run();return result.ok},
    playBaySound(){}
  })
  assert.equal(actions,1)
  assert.ok(result)
  return result
}
const original=['round','folded','long','appleJam','farmhouseBread','orchardPreserves','orchardTart'].map(id=>'treat|'+id)

test('a carried fruit tart is a directly reachable first Harvest Festival contribution',t=>{
  const {state:farm,actions}=earnedTreat(), before=structuredClone(farm)
  const view=treat(farm), all=[...view.primary,...view.other]
  t.diagnostic(JSON.stringify({day:farm.day,actions,visible:view.primary.filter(live).map(row=>row.value),underDisclosure:view.other.filter(live).map(row=>row.value),total:all.length}))
  assert.equal(farm.dishes.orchardTart,1)
  assert.deepEqual(view.primary.filter(live).map(row=>row.value),['treat|orchardTart'])
  assert.equal(view.primary[0]?.value,'treat|orchardTart')
  assert.deepEqual(all.map(row=>row.value).sort(),[...original].sort())
  assert.equal(view.primary.length,4)
  assert.equal(view.other.length,3)
  assert.deepEqual(all.filter(row=>row.action==='festival-source').map(row=>row.value),original.slice(0,-1))
  assert.deepEqual(farm,before,'rendering is not a contribution')
  const distant=reopen(farm)
  assert.ok(farmModel.sail(distant,'home').ok)
  assert.deepEqual(treat(distant).primary.filter(live),[],'a different island does not enable a contribution')
  const away=structuredClone(distant)
  assert.equal(click(distant,view.primary[0]).ok,false)
  assert.deepEqual(distant,away)
})

test('both earned alternatives remain separate, actual payment and reward happen once',t=>{
  const player=earnedTreat()
  player.fruit('apple',2)
  player.visit('village')
  player.act('cookDish','appleJam',{family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']})
  const opening=structuredClone(player.state)
  const valid=treat(player.state).primary.filter(live)
  t.diagnostic(JSON.stringify({day:opening.day,actions:player.actions,visible:valid.map(row=>row.value)}))
  assert.deepEqual(valid.map(row=>row.value),['treat|appleJam','treat|orchardTart'])
  for(const [selected,untouched]of [[valid[0],valid[1]],[valid[1],valid[0]]]){
    let f=reopen(opening)
    const before=structuredClone(f), id=selected.value==='treat|appleJam'?'appleJam':'orchardTart'
    const keep=id==='appleJam'?'orchardTart':'appleJam'
    assert.ok(click(f,selected).ok)
    assert.equal(active(f).requirements[0].delivered,1)
    assert.equal(f.dishes[id],before.dishes[id]-1)
    assert.equal(f.dishes[keep],before.dishes[keep])
    assert.equal(f.coins,before.coins)
    f=reopen(f)
    assert.deepEqual(treat(f).primary.filter(live).map(row=>row.value),[untouched.value])
    const contributed=structuredClone(f)
    assert.equal(click(f,selected).ok,false)
    assert.deepEqual(f,contributed)
    assert.ok(click(f,untouched).ok)
    assert.equal(active(f).waitingNight,true)
    assert.equal(f.coins,before.coins)
    assert.equal(farmModel.finishFestival(f).ok,false)
    assert.ok(farmModel.sail(f,'home').ok)
    assert.ok(farmModel.endDay(f).ok)
    assert.ok(farmModel.sail(f,'village').ok)
    const reward=active(f).reward
    assert.ok(farmModel.finishFestival(f).ok)
    assert.equal(f.coins,before.coins+reward)
    assert.equal(farmModel.finishFestival(f).ok,false)
    assert.equal(f.coins,before.coins+reward)
    t.diagnostic(JSON.stringify({first:id,retainedUntilSecond:keep,payout:reward,day:f.day,rejectedRepeat:true}))
  }
})

test('Back still reopens only the original help disclosure and returns keyboard focus, not a spend action',()=>{
  const player=earnedTreat(), before=structuredClone(player.state), view=treat(player.state)
  const previousHelp=view.other.find(row=>row.action==='festival-source'&&row.value==='treat|orchardPreserves')
  assert.ok(previousHelp)
  const details={open:false}, calls:string[]=[]
  const make=(row:Choice,hidden=false)=>({
    dataset:{action:row.action,value:row.value},
    closest(selector:string){assert.equal(selector,'details.festival-alternatives');return hidden?details:null},
    getClientRects(){return !hidden||details.open?[1]:[]},
    focus(){calls.push(row.value)}
  })
  const controls=[...view.primary.map(row=>make(row)),...view.other.map(row=>make(row,true))]
  const chosen=controls.find(button=>button.dataset.value===previousHelp.value)!
  const ctx={
    previous:{panel:'festival',focus:JSON.stringify(Object.entries(chosen.dataset)),marketNextOpen:[],scroll:81},
    panelRenderVersion:5,panel:'festival',stockSourceItem(){throw Error('a festival key is not a warehouse item')},
    dialogContent:{scrollTop:0,querySelectorAll(s:string){return s.includes('festival-source')?controls.filter(b=>b.dataset.action==='festival-source'):[]}},
    dialog:{open:true,querySelectorAll(){return controls}},
    requestAnimationFrame(fn:()=>void){fn()},reserveOnReturn:undefined
  }
  const focus=main.slice(main.indexOf('function focusKey('),main.indexOf('// The route key is rebuilt'))
  const start=main.indexOf("  if(previous.panel==='festival')")
  const end=main.indexOf('    else if (restFeedReturn) {',start)
  assert.ok(start>0&&end>start)
  evaluate(focus+main.slice(start,end)+'});',ctx)
  assert.equal(details.open,true)
  assert.equal(ctx.dialogContent.scrollTop,81)
  assert.deepEqual(calls,['treat|orchardPreserves'])
  assert.deepEqual(player.state,before)
})
