import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as culinary from '../src/culinary.ts'
import * as planning from '../src/recipe-planning.ts'
import * as bookmarks from '../src/recipe-draft.ts'
import { traitIds } from '../src/climate.ts'
import { traitLabel } from '../src/ru.ts'
import { signatureBookCapacity } from '../src/signature-book.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const main=read('../src/main.ts'), ui=read('../src/culinary-ui.ts')
const opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
function cut(text:string,from:string,to:string) {
  const start=text.indexOf(from),end=text.indexOf(to,start+from.length)
  assert.ok(start>=0&&end>start, from)
  return text.slice(start,end)
}
const source=stripTypeScriptTypes([
  cut(main,'function rememberCurrentRecipeDraft(', 'const recipeBook ='),
  cut(main,'function kitchenReadyDishes()', 'function familyRecipeName('),
  'function act(action,value,control={dataset:{}}){switch(action){',
  cut(main,"    case 'recipe-family':","    case 'family-signature':"),
  cut(main,"    case 'family-signature':","    case 'market-category':"),
  cut(main,"    case 'resume-recipe-draft':","    case 'signature-home':"),
  '}};({act,kitchenFamilies})',
].join('\n'))
const render=runInNewContext(stripTypeScriptTypes((
  cut(ui,'export const ingredientArt=', 'export function cookeryResultPicture')+
  cut(ui,'function recipeDraftCard(', 'function recipeBookSupper(')+
  cut(ui,'export function signatureStudio(', 'const coveChoiceSummary')
).replaceAll('export ','')+';({recipeDraftCard,signatureStudio})'),
  {...F,...culinary,...planning,...bookmarks,traitIds,traitLabel,signatureBookCapacity})
const art={icon:()=>'',stock:()=>''}
function household(prepareBerries:boolean){
  const p=commissionPlayer(opening)
  p.visit('home')
  if (prepareBerries) {
    // Extra voluntarily grown food in the alternate arm, not a granted quota.
    const plot=[['strawberry',0],['blueberry',2],['wheat',3]] as const
    for (const [fruit,index] of plot) {
      if(!p.state.seeds[fruit])p.act('buySeeds',fruit)
      p.act('selectSeed',fruit)
      p.act('workBed',index)
    }
    for(let n=0;n<4;n++){
      for(const [,index] of plot){
        const a=F.getBedAction(p.state,index)
        if(a.kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',index)}
        else if(a.kind==='harvest')p.act('workBed',index)
      }
      if (plot.every(([fruit])=>p.state.produce[fruit]>0)) break
      p.night()
    }
  }
  while(p.state.day<17) p.night()
  p.fruit('apple',1);p.fruit('pear',1);p.visit('home')
  assert.deepEqual([p.state.day,p.state.coins,p.actions],prepareBerries?[17,55,128]:[17,68,115])
  return p.state
}
function mount(farm:F.FarmState){
  const saves:string[]=[]
  function button(label:string,action:string,enabled=true,opts:{value?:string}={}) {
    return '<button data-action="'+action+'" data-value="'+(opts.value??'')+'"'+(enabled?'':' disabled')+'>'+label+'</button>'
  }
  const ctx={
    ...F,...culinary,...planning,...bookmarks,farm,panel:'recipes',dialog:{open:true},dialogContent:{scrollTop:0},panelHistory:[],
    signatureBase:'preserves',signatureSlots:[null,null],signatureSlot:0,signatureRepeatId:undefined,cookingFish:'seaBass',
    kitchenGroups:['tart','preserves','dishes'],kitchenGroup:'tart',kitchenTart:'orchardTart',kitchenPreserves:'appleJam',kitchenDish:'grilledFish',
    dishIcons:Object.fromEntries(F.dishIds.map(id=>[id,id])),signatureFamily:undefined,recipeCards:()=>'',button,icon:art.icon,
    picked:undefined,openPanel(next:string){ctx.panel=next},drawPanel(){},saveFarm(){saves.push(JSON.stringify(farm))}
  }
  const route=runInNewContext(source,ctx)
  function enterBerryTemplate(){
    ctx.panel='kitchen'
    assert.match(route.kitchenFamilies(),/data-action="recipe-family" data-family="tart" data-value="mixed"/)
    route.act('recipe-family','mixed',{dataset:{family:'tart'}})
    assert.match(route.kitchenFamilies(),/data-action="family-signature" data-value="berries">Выбрать ягоды/)
    route.act('family-signature','berries')
  }
  const studio=()=>render.signatureStudio(farm,ctx.signatureBase,ctx.signatureSlots,ctx.signatureSlot,art) as string
  return {ctx,act:route.act as (action:string,value?:string,control?:unknown)=>void,saves,enterBerryTemplate,studio}
}
const current=(f:F.FarmState)=>{const loaded=F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)));assert.ok(loaded);return loaded}
const exact=(a:F.FarmState,b:F.FarmState)=>assert.deepEqual({...a,recipeDraft:undefined},{...b,recipeDraft:undefined},'no stock/economy/day/travel changes')
const draftAsRecipe=(ui:ReturnType<typeof mount>)=>({
  base:ui.ctx.signatureBase as 'tart'|'preserves',
  ingredients:JSON.parse(JSON.stringify(ui.ctx.signatureSlots)),
})
function original(ui:ReturnType<typeof mount>){
  ui.act('new-signature','preserves')
  ui.act('signature-fruit','apple')
  ui.act('signature-fruit','pear')
  const saved=ui.ctx.farm.recipeDraft!
  assert.equal(ui.saves.length,2)
  assert.equal(bookmarks.recipeDraftKey(saved),'preserves|0|apple:ordinary|pear:ordinary')
  assert.ok(F.getSignatureAction(ui.ctx.farm,draftAsRecipe(ui)).available)
  return structuredClone(saved)
}

test('earned D17 optional family tart only selects portions; an unrelated prior apple-and-pear plan survives cold reopen',()=>{
  for (const ready of [false,true]) {
    const f=household(ready), before=structuredClone(f), cook=mount(f), saved=original(cook), token=bookmarks.recipeDraftKey(saved)
    cook.enterBerryTemplate()
    assert.equal(cook.saves.length,2,'opening a template is not an ingredient change')
    assert.equal(F.getSignatureAction(f,draftAsRecipe(cook)).available,ready)
    assert.match(cook.studio(),/data-action="signature-slot" data-value="1" aria-pressed="false"/)
    cook.act('signature-slot','1')
    assert.match(cook.studio(),/data-action="signature-slot" data-value="1" aria-pressed="true"/)
    assert.deepEqual(current(f).recipeDraft,saved,'slot-only navigation cannot replace the saved recipe')
    cook.act('signature-base','tart')
    assert.deepEqual(current(f).recipeDraft,saved,'pressing the already selected base is also not a composition change')
    assert.equal(cook.saves.length,2)
    exact(f,before)
    const reloaded=current(f), resumed=mount(reloaded)
    assert.match(render.recipeDraftCard(reloaded,art),/data-action="resume-recipe-draft" data-value="preserves\|0\|apple:ordinary\|pear:ordinary"/)
    resumed.act('resume-recipe-draft',token)
    assert.deepEqual(draftAsRecipe(resumed),{base:'preserves',ingredients:saved.slots})
    assert.equal(resumed.saves.length,0)
    exact(reloaded,before)
  }
})

test('same remembered composition still owns active slot; deliberate berry edit can replace it and cook separately',()=>{
  const f=household(true), before=structuredClone(f), cook=mount(f)
  original(cook)
  cook.act('signature-slot','1')
  assert.equal(cook.saves.length,3)
  assert.equal(bookmarks.recipeDraftKey(current(f).recipeDraft!),'preserves|1|apple:ordinary|pear:ordinary')
  cook.act('signature-slot','1')
  assert.equal(cook.saves.length,3,'no duplicate focus save')
  cook.enterBerryTemplate()
  cook.act('signature-slot','1');assert.equal(cook.saves.length,3)
  cook.act('signature-fruit','strawberry')
  assert.equal(cook.saves.length,4)
  assert.equal(bookmarks.recipeDraftKey(current(f).recipeDraft!),'tart|0|strawberry:ordinary|strawberry:ordinary')
  exact(f,before)
  const result={family:'decorate',processing:'chunky',fruit:[{ingredientId:'strawberry',x:0,y:0,angle:0}],steps:['place-fruit','sprinkle-sugar']} as const
  assert.ok(F.completeSignature(f,draftAsRecipe(cook),result).ok)
  assert.equal(f.recipeDraft,undefined)
  assert.deepEqual([f.produce.strawberry,f.produce.blueberry,f.produce.wheat,f.eggs,f.fruit.apple,f.fruit.pear,f.coins],
    [before.produce.strawberry-2,before.produce.blueberry,before.produce.wheat-1,before.eggs-1,1,1,before.coins])
})
