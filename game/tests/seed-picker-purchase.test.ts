import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import {buySeeds,createFarm} from '../src/farm.ts'
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
