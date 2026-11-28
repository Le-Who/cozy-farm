import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,workBed,buySeeds,restoreCurrentFarm,sellMarketItem,endDay,berryCropIds,cropIds,needsSeedChoice,transplantCrop} from '../src/farm.ts'
import {saveGardenPlan,followGardenPlan} from '../src/garden-plans.ts'
import {seedChoice,chooseSeedForBed} from '../src/seed-choice.ts'
import {seedSavingQuote,saveCropSeeds} from '../src/seed-saving.ts'
import {ActivationKeyGuard,isGuardedAction} from '../src/action-click-guard.ts'
import {renderSeedPicker} from '../src/seed-picker-ui.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

function planned(){
  const farm=createFarm(),crops=Array(16).fill(null);crops[13]='wheat'
  assert.ok(saveGardenPlan(farm,0,{name:'Хлебный уголок',crops},0).ok)
  assert.ok(followGardenPlan(farm,0,1).ok)
  return farm
}

test('a changed manual packet visibly confirms in the open picker; repeats, failures and bed returns keep their presentation',()=>{
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const host=source.slice(source.indexOf('function perform('),source.indexOf('const bedTools ='))
    + source.slice(source.indexOf('function chooseSeed('),source.indexOf('function activateTarget('))
  function select(farm:ReturnType<typeof createFarm>,bed?:number,token=seedChoice(farm,'cabbage',bed).token){
    const feedback={textContent:'',hidden:true,dataset:{tone:''},classList:{toggle:(key:string,on:boolean)=>{assert.equal(key,'sr-only');srOnly=on}}}
    let srOnly:boolean|undefined,closed=false,focused:number|undefined
    const state={farm,seedPickerBed:bed,previewSeed:'carrot',activeTool:'hoe',token,chooseSeedForBed,
      dialog:{open:true},dialogFeedback:feedback,dialogFeedbackTimer:0,window:{clearTimeout(){},setTimeout(){return 1}},
      saveFarm(){},refresh(){},playBaySound(){},closeDialog(){closed=true},island:{focusTarget(target:{index:number}){focused=target.index}}}
    runInNewContext(stripTypeScriptTypes(host)+"\nchooseSeed('cabbage',token)",state)
    return {srOnly,closed,focused,feedback}
  }
  const farm=createFarm(),before=structuredClone(farm)
  const changed=select(farm)
  assert.equal(changed.srOnly,false);assert.equal(changed.feedback.hidden,false)
  assert.match(changed.feedback.textContent,/Выбраны семена: капуста/);assert.equal(changed.closed,false)
  assert.equal(changed.focused,undefined);assert.deepEqual(farm,{...before,selectedSeed:'cabbage'})
  assert.equal(select(farm).srOnly,true,'same seed, no state change')
  const plan=planned();plan.selectedSeed='cabbage'
  assert.equal(select(plan).srOnly,false,'leaving a plan changes the sow mode even for the same packet')
  assert.equal(plan.gardenPlans.active,null)
  const failed=select(farm,undefined,'stale')
  assert.equal(failed.srOnly,false);assert.equal(failed.feedback.dataset.tone,'bad');assert.equal(failed.closed,false)
  const atBed=select(createFarm(),13)
  assert.equal(atBed.srOnly,true);assert.equal(atBed.closed,true);assert.equal(atBed.focused,13)
})

test('browsing another in-stock crop and making its packet preserve the mixed garden plan',()=>{
  const farm=planned();assert.ok(workBed(farm,9,0).ok)
  const before=structuredClone(farm),choice=seedChoice(farm,'carrot',13)
  assert.equal(choice.available,true);assert.equal(choice.planned,false)
  assert.match(choice.label,/ручного посева/);assert.match(choice.detail,/выключит посев по плану/)
  assert.deepEqual(farm,before,'preview has no mutation')
  assert.ok(saveCropSeeds(farm,seedSavingQuote(farm,'carrot')!.token).ok)
  assert.deepEqual(farm.gardenPlans,before.gardenPlans);assert.equal(farm.selectedSeed,before.selectedSeed)
  assert.deepEqual(farm.beds,before.beds)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})

test('an explicit manual choice pauses the plan without planting or spending a seed',()=>{
  const farm=planned(),before=structuredClone(farm)
  assert.ok(chooseSeedForBed(farm,'cabbage',13,seedChoice(farm,'cabbage',13).token).ok)
  const expected=structuredClone(before);expected.selectedSeed='cabbage';expected.gardenPlans.active=null;expected.gardenPlans.revision++
  assert.deepEqual(farm,expected)
  assert.equal(chooseSeedForBed(farm,'__proto__',13,'invalid').ok,false);assert.deepEqual(farm,expected)
})

test('returning with the planned crop keeps the plan and a separate ordinary sow uses it',()=>{
  const farm=planned(),before=structuredClone(farm),choice=seedChoice(farm,'wheat',13)
  assert.equal(choice.planned,true);assert.equal(choice.label,'К грядке по плану')
  assert.ok(chooseSeedForBed(farm,'wheat',13,seedChoice(farm,'wheat',13).token).ok);assert.deepEqual(farm,before)
  assert.ok(workBed(farm,13,0).ok)
  assert.deepEqual(farm.beds[13],{kind:'crop',crop:'wheat',growth:0,watered:false})
  assert.equal(farm.seeds.wheat,before.seeds.wheat-1);assert.deepEqual(farm.gardenPlans,before.gardenPlans)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})

test('restocking missing planned seeds by purchase or own harvest cannot itself choose or sow',()=>{
  for(const source of ['buy','harvest']){
    const farm=planned();farm.seeds.wheat=0
    const before=structuredClone(farm)
    assert.equal(seedChoice(farm,'wheat',13).available,false)
    assert.equal(chooseSeedForBed(farm,'wheat',13,seedChoice(farm,'wheat',13).token).ok,false);assert.deepEqual(farm,before)
    if(source==='buy')assert.ok(buySeeds(farm,'wheat').ok)
    else {assert.ok(workBed(farm,4,0).ok);assert.ok(saveCropSeeds(farm,seedSavingQuote(farm,'wheat')!.token).ok)}
    assert.deepEqual(farm.gardenPlans,before.gardenPlans);assert.equal(farm.selectedSeed,before.selectedSeed)
    assert.deepEqual(farm.beds[13],before.beds[13]);assert.equal(farm.seeds.wheat,3)
    const supplied=structuredClone(farm)
    assert.ok(chooseSeedForBed(farm,'wheat',13,seedChoice(farm,'wheat',13).token).ok);assert.deepEqual(farm,supplied)
  }
})

test('real UI routes browsing and buying separately from the guarded explicit choice',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const preview=main.slice(main.indexOf("    case 'preview-seed':"),main.indexOf("    case 'choose-seed':"))
  assert.match(preview,/previewSeed=value as CropId;drawPanel\(\)/)
  assert.doesNotMatch(preview,/chooseSeed\(|selectSeed\(|perform\(/)
  const buy=main.slice(main.indexOf("    case 'buy-seeds':"),main.indexOf("    case 'garden-shop':"))
  assert.doesNotMatch(buy,/chooseSeed\(|selectSeed\(|closeDialog\(/)
  const picker=readFileSync(new URL('../src/seed-picker-ui.ts',import.meta.url),'utf8')
  assert.match(picker,/aria-pressed="\$\{previewSeed === crop\}"/)
  assert.match(picker,/art.button\(label, 'choose-seed'/)
  assert.match(main,/renderSeedPicker\(farm, previewSeed, seedPickerBed/)
  for(const action of ['preview-seed','choose-seed','buy-seeds','save-crop-seeds'])assert.ok(isGuardedAction(action))
})

 test('a stale planned-return choice can never become a manual selection',()=>{
  for(const change of ['plan','day','island','stock','bed']){
    const farm=planned(),shown=seedChoice(farm,'wheat',13)
    assert.equal(shown.planned,true)
    if(change==='plan'){const crops=Array(16).fill('carrot');assert.ok(saveGardenPlan(farm,0,{name:'Другой замысел',crops},2).ok);assert.ok(followGardenPlan(farm,0,3).ok)}
    if(change==='day')farm.day++
    if(change==='island')farm.island='grove'
    if(change==='stock')farm.seeds.wheat++
    const before=structuredClone(farm)
    assert.equal(chooseSeedForBed(farm,'wheat',change==='bed'?14:13,shown.token).ok,false,change)
    assert.deepEqual(farm,before,change)
  }
})

test('keyboard preview of the tenth stocked packet reaches its sticky selector in both seed pickers',()=>{
  const earned=createFarm()
  assert.ok(workBed(earned,9).ok);assert.ok(sellMarketItem(earned,'produce:carrot',3).ok);assert.ok(endDay(earned).ok)
  for(const crop of berryCropIds)assert.ok(buySeeds(earned,crop).ok)
  assert.equal(cropIds.filter(crop=>earned.seeds[crop]>0).length,10)
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const branch=stripTypeScriptTypes("switch('preview-seed'){"+main.slice(main.indexOf("    case 'preview-seed':"),main.indexOf("    case 'choose-seed':"))+'}')
  const paths = [
    ['seeds','harvest',0,true,true,'selector'],
    ['inventory','seeds',0,true,true,'selector'],
    ['seeds','seeds',1,true,true,'tile'],
    ['inventory','seeds',1,true,true,'tile'],
    ['seeds','seeds',0,false,true,'close'],
    ['inventory','seeds',0,false,true,'close'],
    ['seeds','seeds',0,true,false,'heading'],
    ['inventory','seeds',0,true,false,'heading'],
    ['inventory','harvest',0,true,true,'original'],
    ['kitchen','seeds',0,true,true,'original'],
  ] as const
  for(const [panel,bagTab,detail,owned,stock,expected] of paths){
    const farm=structuredClone(stock?earned:createFarm()),before=structuredClone(farm),original={},tile={},close={}
    const document={activeElement:owned?original:close}
    const art={icon:()=>'',button:(label:string,action:string,enabled:boolean,options:{value?:string})=>`<button data-action="${action}" data-value="${options.value??''}"${enabled?'':' disabled'}>${label}</button>`}
    const html=renderSeedPicker(farm,'raspberry',undefined,art)
    const selects=html.match(/class="seed-picker-primary"><button data-action="choose-seed" data-value="([^"]+)"/)
    if(stock)assert.equal(selects?.[1],seedChoice(farm,'raspberry').token)
    assert.deepEqual([...html.matchAll(/data-action="preview-seed" data-value="([^"]+)"/g)].map(match=>match[1]),cropIds)
    const selector={focus(options:{preventScroll:boolean}){assert.equal(options.preventScroll,true);document.activeElement=selector}}
    const heading={tabIndex:0,getClientRects:()=>[1],focus(options:{preventScroll:boolean}){assert.equal(options.preventScroll,true);document.activeElement=heading}}
    const context={farm,cropIds,value:'raspberry',previewSeed:'carrot',panel,bagTab,dialog:{open:true},event:{detail},control:original,document,
      drawPanel(){if(owned)document.activeElement=tile},
      dialogContent:{querySelector(css:string){
        if (css==='.seed-picker-primary [data-action="choose-seed"]:not(:disabled)') return selects?selector:null
        if (css==='.seed-picker-primary :is([data-action="buy-seeds"],[data-action="save-crop-seeds"]):not(:disabled)') {
          const primary=html.match(/class="seed-picker-primary">([\s\S]*?)<\/div>/)?.[1]??''
          return /data-action="(?:buy-seeds|save-crop-seeds)"[^>]*(?<! disabled)>/.test(primary)?{}:null
        }
        assert.equal(css,'.seed-picker-current h2');return heading
      }},
    }
    runInNewContext(branch,context)
    assert.equal(context.previewSeed,expected==='original'?'carrot':'raspberry')
    assert.deepEqual(farm,before,'preview never purchases, changes sow mode or plants')
    assert.equal(document.activeElement,{selector,tile,close,original,heading}[expected],[panel,bagTab,detail,owned,stock].join('/'))
    if(expected==='heading')assert.equal(heading.tabIndex,-1)
    if(expected==='selector') for(const key of ['Enter',' ']){
      const guard=new ActivationKeyGuard()
      assert.equal(guard.blocks({key,repeat:false},isGuardedAction('preview-seed')),false)
      assert.equal(guard.blocks({key,repeat:true},isGuardedAction('choose-seed')),true,'held preview key may not confirm')
      guard.release(key)
      assert.equal(guard.blocks({key,repeat:false},isGuardedAction('choose-seed')),false,'a fresh confirm remains available')
    }
  }
})

test('Back from transplant cannot restore a stale planned seed shortcut to the now-occupied bed',()=>{
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const between=(a:string,b:string)=>{const start=source.indexOf(a),end=source.indexOf(b,start+1);assert.ok(start>=0&&end>start);return source.slice(start,end)}
  const script=stripTypeScriptTypes(between('function goBack(', 'let harbourScene:')
    +between('function chooseSeed(', 'function activateTarget(')
    +"\n;({goBack,choose(value){switch('choose-seed'){"+between("    case 'choose-seed':","    case 'sell':")+"}}})")
  for(const occupied of [true,false]){
    const farm=createFarm(),bed=13,crop='blueberry',crops=Array(16).fill(null);crops[bed]=crop
    assert.ok(saveGardenPlan(farm,0,{name:'Ягодный уголок',crops},0).ok)
    assert.ok(followGardenPlan(farm,0,1).ok);assert.equal(needsSeedChoice(farm,bed),true)
    assert.ok(buySeeds(farm,crop).ok);assert.equal(farm.beds[bed].kind,'tilled')
    const oldToken=seedChoice(farm,crop,bed).token
    const beforeTab=renderSeedPicker(farm,crop,bed,{icon:()=>'',button:(label:string)=>label})
    assert.match(beforeTab,/К грядке по плану/)
    if(occupied)assert.ok(transplantCrop(farm,9,bed).ok)
    const before=structuredClone(farm),history=[{panel:'seeds',seedPickerBed:bed,previewSeed:crop,signatureSlots:[],marketNextOpen:[],scroll:94}]
    let closed=0,markup='';const visits:number[]=[]
    const ctx={farm,panel:'transplant',panelHistory:history,panelRenderVersion:1,dialog:{open:true,querySelectorAll:()=>[]},
      dialogContent:{scrollTop:0,querySelector:()=>null,querySelectorAll:()=>[]},seedPickerBed:undefined as number|undefined,previewSeed:'carrot' as typeof crop|'carrot',
      recipeBook:{load(){}},restoreFerryPanelView(){},requestAnimationFrame:(f:()=>void)=>f(),
      openPanel(panel:string){
        ctx.panel=panel
        markup=renderSeedPicker(farm,ctx.previewSeed,ctx.seedPickerBed,{icon:()=>'',button:(label:string)=>label})
      },
      seedChoice,chooseSeedForBed,perform:(act:()=>{ok:boolean})=>act().ok,closeDialog(){closed++;ctx.dialog.open=false},
      island:{focusTarget:(target:{index:number})=>visits.push(target.index)},
    }
    const ui=runInNewContext(script,ctx)
    ui.goBack(true)
    assert.equal(ctx.panel,'seeds');assert.equal(ctx.dialogContent.scrollTop,94)
    assert.deepEqual(farm,before,'Back is only navigation')
    ui.choose(oldToken)
    assert.equal(closed,occupied?0:1,'the old choice must not send the player to an occupied bed')
    assert.deepEqual(visits,occupied?[]:[bed])
    assert.equal(ctx.seedPickerBed,occupied?undefined:bed)
    assert.equal(markup.includes('К грядке по плану'),!occupied)
    assert.deepEqual(farm,before,'a stale or planned return never selects or sows')
  }
})


test('earned empty last crop leads one Tab from the neutral preview to a real refill, with no spend or changed rare seed contract',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const branch=stripTypeScriptTypes("switch('preview-seed'){"+main.slice(main.indexOf("    case 'preview-seed':"),main.indexOf("    case 'choose-seed':"))+'}')
  function focus(farm:ReturnType<typeof createFarm>,crop:typeof cropIds[number],panel='seeds',detail=0){
    const before=structuredClone(farm),focusCalls:string[]=[]
    const original={},tile={},document={activeElement:original}
    const art={icon:()=>'',button:(label:string,action:string,enabled:boolean,options:{value?:string})=>
      `<button data-action="${action}" data-value="${options.value??''}"${enabled?'':' disabled'}>${label}</button>`}
    const html=renderSeedPicker(farm,crop,undefined,art)
    const primary=html.match(/class="seed-picker-primary">([\s\S]*?)<\/div>/)?.[1]??''
    const enabled=[...primary.matchAll(/<button[^>]*data-action="([^"]+)"[^>]*>/g)].filter(([tag])=>!tag.includes(' disabled'))
    const lastFocus=enabled[0]?.[1]
    const action={focus(opts:{preventScroll:boolean}){assert.ok(opts.preventScroll);focusCalls.push(lastFocus);document.activeElement=action}}
    const heading={tabIndex:0,getClientRects:()=>[1],focus(opts:{preventScroll:boolean}){assert.ok(opts.preventScroll);focusCalls.push('heading');document.activeElement=heading}}
    const context={farm,cropIds,value:crop,previewSeed:'carrot',panel,bagTab:'seeds',dialog:{open:true},event:{detail},control:original,document,
      drawPanel(){document.activeElement=tile},
      dialogContent:{querySelector(css:string){
        if (css==='.seed-picker-primary [data-action="choose-seed"]:not(:disabled)')return lastFocus==='choose-seed'?action:null
        if (css==='.seed-picker-primary :is([data-action="buy-seeds"],[data-action="save-crop-seeds"]):not(:disabled)')
          return lastFocus==='buy-seeds'||lastFocus==='save-crop-seeds'?action:null
        assert.equal(css,'.seed-picker-current h2');return heading
      }}
    }
    runInNewContext(branch,context)
    assert.equal(context.previewSeed,crop)
    assert.deepEqual(farm,before)
    if(document.activeElement===heading){
      assert.equal(heading.tabIndex,-1)
      // The static heading is before the unchanged primary button in authored
      // DOM order. Browser Tab behavior is qualified separately, not by this VM.
      assert.ok(html.indexOf('<h2>')<html.indexOf('class="seed-picker-primary"'))
    }
    return {focusCalls,lastFocus,html}
  }
  const p=earned416Mixed(true)
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.seeds.raspberry,p.state.variants.raspberry?.frost],[552,196,60,2,1])
  assert.deepEqual(focus(p.state,'raspberry').focusCalls,['choose-seed'])
  p.act('workBed',0,0);p.act('workBed',1,0)
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.seeds.raspberry],[554,196,60,0])
  for(const panel of ['seeds','inventory']){
    const result=focus(p.state,'raspberry',panel)
    assert.deepEqual(result.focusCalls,['heading'])
    assert.equal(result.lastFocus,'buy-seeds')
    assert.doesNotMatch(result.html,/data-action="save-crop-seeds"/)
    assert.deepEqual(focus(p.state,'raspberry',panel,1).focusCalls,[])
  }
  const poor=createFarm();assert.ok(buySeeds(poor,'pumpkin').ok);assert.ok(buySeeds(poor,'cabbage').ok)
  assert.equal(poor.coins,4)
  assert.deepEqual(focus(poor,'raspberry').focusCalls,[])
  assert.equal(focus(poor,'raspberry').lastFocus,undefined)
  const dual=earned416Mixed(false).state,comparison=focus(dual,'leafyGreens')
  assert.deepEqual(comparison.focusCalls,['heading'])
  assert.match(comparison.html,/data-action="save-crop-seeds"/)
  const exchange=structuredClone(dual), quote=seedSavingQuote(exchange,'leafyGreens')!
  assert.ok(saveCropSeeds(exchange,quote.token).ok)
  assert.deepEqual([exchange.coins,exchange.produce.leafyGreens,exchange.seeds.leafyGreens,exchange.variants.leafyGreens?.rainbow],[56,3,3,2])
})
