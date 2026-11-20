import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import {buySeeds,createFarm,cropDefinitions,selectSeed,workBed} from '../src/farm.ts'
import {renderSeedPicker} from '../src/seed-picker-ui.ts'
import {seedChoice} from '../src/seed-choice.ts'

test('buying an empty packet by keyboard focuses its fresh choice without selecting or planting',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const code=stripTypeScriptTypes("switch('buy-seeds'){"+main.slice(main.indexOf("    case 'buy-seeds':"),main.indexOf("    case 'garden-save-seeds':"))+'}')
  for(const mode of ['keyboard','pointer','stale','rejected']){
    const farm=createFarm(), crop='blueberry', seedPickerBed=13, old=seedChoice(farm,crop,seedPickerBed).token
    if(mode==='rejected')farm.coins=0
    const control={closest:(s:string)=>s==='.seed-picker-primary'?{}:null}
    const close={},doc={activeElement:control as object}, choice={dataset:{value:''},focus:()=>{doc.activeElement=choice}}
    const before=structuredClone(farm)
    runInNewContext(code,{control,crop,farm,panel:'seeds',dialog:{open:true},previewSeed:crop,seedPickerBed,seedChoice,buySeeds,
      event:{detail:mode==='pointer'?1:0},document:doc,playBaySound:()=>{},
      dialogContent:{querySelector:(s:string)=>{assert.match(s,/choose-seed/);return choice}},
      perform:(act:()=>{ok:boolean})=>{if(!act().ok)return false;doc.activeElement=close
        choice.dataset.value=mode==='stale'?old:seedChoice(farm,crop,seedPickerBed).token;return true},
    })
    assert.equal(doc.activeElement,mode==='keyboard'?choice:mode==='rejected'?control:close)
    const expected=structuredClone(before);buySeeds(expected,crop);assert.deepEqual(farm,expected)
    assert.equal(farm.selectedSeed,'carrot');assert.equal(farm.beds[seedPickerBed].kind,'tilled')
  }
})

test('bag seed purchase returns the keyboard to the same replenished crop, not Close or another spending action',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const between=(from:string,to:string)=>main.slice(main.indexOf(from),main.indexOf(to,main.indexOf(from)))
  const handlers=between("    case 'buy-seeds':","    case 'garden-save-seeds':")
  const restore=between("  if (focused && panel !== 'bay-freight'",'\n}\n\n// A map shortcut')
  const host=stripTypeScriptTypes(between('function button(label:', 'function quantity(')+between('function focusKey(', '// The route key')+
    '\nfunction restore(focused){const focusedSeedCrop=undefined;'+restore+'}\nfunction buy(){switch("buy-seeds"){'+handlers+'}}')
  for(const route of ['keyboard','pointer','no-focus','other-tab','other-panel']){
    const farm=createFarm(),crop='beetroot'
    assert.ok(selectSeed(farm,crop).ok);assert.ok(workBed(farm,13).ok);assert.ok(selectSeed(farm,'carrot').ok)
    assert.equal(farm.seeds[crop],0)
    const document={activeElement:null as Control|null}, icon=()=>''
    class Control {
      dataset:Record<string,string>;primary:boolean
      constructor(dataset:Record<string,string>,primary=false){this.dataset=dataset;this.primary=primary}
      focus(options:{preventScroll:boolean}){assert.equal(options.preventScroll,true);document.activeElement=this}
      closest(selector:string){return this.primary&&selector==='.seed-picker-primary'?this:null}
    }
    const closeButton=new Control({action:'close'});let controls:Control[]=[]
    const dialogContent={scrollTop:180,querySelectorAll:()=>controls,querySelector:(selector:string)=>{
      assert.equal(selector,'.seed-picker-primary [data-action="choose-seed"]:not(:disabled)')
      return controls.find(c=>c.primary&&c.dataset.action==='choose-seed')??null
    }}
    const ctx:any={cropDefinitions,icon,numberFormat:new Intl.NumberFormat('ru'),farm,crop,dialogContent,document,closeButton,
      panel:'inventory',bagTab:'seeds',dialog:{open:true},event:{detail:route==='pointer'?1:0},previewSeed:crop,seedPickerBed:undefined,
      seedChoice,buySeeds,playBaySound(){},perform(action:()=>{ok:boolean}){
        const focused=document.activeElement
        assert.ok(action().ok);if(route==='other-tab')ctx.bagTab='harvest';if(route==='other-panel')ctx.panel='seeds'
        render();if(focused!==closeButton)ctx.restore(focused);return true
      }}
    runInNewContext(host,ctx)
    function render(){
      const html=renderSeedPicker(farm,crop,undefined,{icon,button:ctx.button})
      const primary=html.match(/class="seed-picker-primary">(<button[^>]*>)/)![1]
      controls=[...html.matchAll(/<button\b[^>]*>/g)].filter(([tag])=>!tag.includes(' disabled')).map(([tag])=>new Control(
        Object.fromEntries([...tag.matchAll(/data-(action|crop|value)="([^"]*)"/g)].map(([,k,v])=>[k,v])),tag===primary))
    }
    render();ctx.control=controls.find(c=>c.primary);assert.equal(ctx.control.dataset.action,'buy-seeds')
    document.activeElement=route==='no-focus'?closeButton:ctx.control
    const expected=structuredClone(farm);assert.ok(buySeeds(expected,crop).ok);ctx.buy()
    assert.deepEqual(farm,expected);assert.equal(dialogContent.scrollTop,180)
    assert.equal(document.activeElement?.dataset.action,route==='keyboard'?'choose-seed':'close',route)
    if(route==='keyboard')assert.equal(document.activeElement?.dataset.value,seedChoice(farm,crop).token)
  }
})
