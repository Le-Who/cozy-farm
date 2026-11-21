import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { bedWorkKind, isCurrentBedWork, planBedWork } from '../src/bed-work-intent.ts'
import { renderSeedPicker } from '../src/seed-picker-ui.ts'
import { seedChoice } from '../src/seed-choice.ts'

const read=(file:string)=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
const main=read('main.ts'), island=read('island.ts')
function part(source:string,from:string,to:string){
  const first=source.indexOf(from),end=source.indexOf(to,first+1);assert.ok(first>=0&&end>first)
  return source.slice(first,end)
}
const script=stripTypeScriptTypes([
  part(main,'function button(', 'function quantity('),part(main,'function focusKey(', '// The route key'),
  part(main,'function activateTarget(', '  island.visit(target)\n  switch')+'}',
  part(island,'  function advanceWork(', '  function paintBursts('),
  part(island,'    setViewMode(', '    guideHomeVisitorToBed(').trim().replace(/^setViewMode/, 'function setViewMode').replace(/,$/,''),
  'function restore(focused){const focusedSeedCrop=undefined;'+part(main,"  if (focused && panel !== 'bay-freight'",'\n}\n\n// A map shortcut')+'}',
  'function confirm(value){switch("choose-seed"){'+part(main,"    case 'choose-seed':","    case 'sell':")+'}}',
].join('\n'))

test('queued planting of the last seed keeps the open standalone and bag chooser on that crop',()=>{
  for(const [panel,affordable] of [['seeds',true],['seeds',false],['inventory',true],['inventory',false]] as const){
    const farm=F.createFarm(),crop='beetroot',tile=13
    if(!affordable)for(const other of ['tomato','tomato','carrot'] as const)assert.ok(F.buySeeds(farm,other).ok)
    assert.ok(F.selectSeed(farm,crop).ok)
    const before=structuredClone(farm),oldToken=seedChoice(farm,crop).token
    const expected=structuredClone(farm);assert.ok(F.workBed(expected,tile).ok)
    assert.equal(expected.seeds[crop],0)
    const document={activeElement:null as Control|null}
    class Control {
      readonly dataset:Record<string,string>;readonly tag:string
      constructor(dataset:Record<string,string>,tag=''){this.dataset=dataset;this.tag=tag}
      focus(options:{preventScroll:boolean}){assert.ok(options.preventScroll);document.activeElement=this}
    }
    const closeButton=new Control({action:'close'})
    let controls:Control[]=[], markup=''
    const dialogContent={
      querySelectorAll:()=>controls.filter(c=>!c.tag.includes(' disabled')),
      querySelector:(s:string)=>{
        assert.match(s,/seed-picker-tile/)
        return controls.find(c=>c.dataset.action==='preview-seed'&&c.tag.includes('aria-pressed="true"'))??null
      },
    }
    const orders:unknown[]=[],silent=()=>{}
    const context:any={...F,farm,previewSeed:crop,seedPickerBed:undefined,bagTab:'seeds',panel:undefined,dialog:{open:false},
      closeButton,document,dialogContent,bedWorkKind,isCurrentBedWork,planBedWork,seedChoice,
      areas:Array(20).fill({center:{x:0,y:0},stop:{x:0,y:0}}),workOrders:orders,gesture:undefined,farmer:{x:0,y:0},state:farm,
      WORK_MS:{plant:200},bursts:[],impactByBed:new Map(),viewMode:'world',reconcileFrames:silent,icon:()=>'',numberFormat:new Intl.NumberFormat('ru'),
      island:{isCrossing:()=>false,workBed(index:number,next:Function,commit:Function){orders.push({index,next,commit})}},
      bedTools:{plant:'seeds'},bedWorkSound:()=>undefined,playBaySound:silent,
      chooseSeed(){assert.fail('expired button confirmed a seed')},
      perform(action:()=>{ok:boolean}){
        const focused=document.activeElement;assert.ok(action().ok);render();context.restore(focused);return true
      },
    }
    runInNewContext(script,context)
    function render(){
      markup=renderSeedPicker(farm,crop,undefined,{icon:context.icon,button:context.button})
      controls=[...markup.matchAll(/<button\b[^>]*>/g)].map(([tag])=>new Control(
        Object.fromEntries([...tag.matchAll(/data-(action|crop|value)="([^"]*)"/g)].map(([,key,value])=>[key,value])),tag))
    }
    context.activateTarget({kind:'bed',index:tile})
    assert.equal(orders.length,1);context.advanceWork(0,false)
    context.setViewMode('dialog');assert.equal(context.gesture?.kind,'plant','the admitted planting stays live in dialog mode')
    context.panel=panel;context.dialog.open=true;render()
    const choose=controls.find(c=>c.dataset.action==='choose-seed')!
    assert.equal(choose.dataset.value,oldToken)
    choose.focus({preventScroll:true})
    context.advanceWork(120,false)
    assert.match(markup,/в наличии: 0/)
    assert.doesNotMatch(markup,/data-action="choose-seed"/)
    assert.equal(controls.find(c=>c.dataset.action==='buy-seeds')?.tag.includes(' disabled'),!affordable)
    context.confirm(oldToken)
    assert.deepEqual(farm,expected,'exactly the already-authorized sow, no purchase or seed change')
    assert.equal(context.dialog.open,true)
    assert.deepEqual(document.activeElement?.dataset,{action:'preview-seed',value:crop},panel)
  }
})
