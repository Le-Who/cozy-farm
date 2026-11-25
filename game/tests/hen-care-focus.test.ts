import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { henCareResultFocus } from '../src/hen-care-focus.ts'

const setup = (action = 'pet', value = '0') => {
  const progress = { tabIndex: 0, classes: [] as string[], classList: { add(name: string) { progress.classes.push(name) } } }
  const selected = { dataset: { value: '0' } }
  const state = { current: { disabled: true } as {disabled: boolean} | null, selected: selected as typeof selected | null, progress: progress as typeof progress | null }
  const root = { querySelector(selector: string) { return selector.startsWith('.hen-friend-select') ? state.selected : selector === '.hen-friend-progress progress' ? state.progress : state.current } }
  const previous = { disabled: false, dataset: { action, value } }
  return { root: root as unknown as HTMLElement, previous: previous as HTMLButtonElement, progress, state }
}

test('completed pet or treat returns the same named readonly progress without another tab stop', () => {
  for (const [action,value] of [['pet','0'],['hen-treat','0:carrot']]) {
    const f=setup(action,value)
    assert.equal(henCareResultFocus(f.root,f.previous),f.progress)
    assert.equal(f.progress.tabIndex,-1)
    assert.deepEqual(f.progress.classes,['hen-care-focus'])
  }
  const done=setup('hen-treat','0:apple');done.state.current=null
  assert.equal(henCareResultFocus(done.root,done.previous),done.progress)
})

test('enabled actions, unrelated actions, stale selection and incomplete views keep the existing fallback', () => {
  for(const [action,value] of [['hen-friend-select','0'],['hen-walk-start','0'],['pet','5'],['pet','0:carrot'],['hen-treat','0:bread']]){
    const f=setup(action,value);assert.equal(henCareResultFocus(f.root,f.previous),undefined)
  }
  for(const mutate of [
    (f:ReturnType<typeof setup>)=>{f.previous.disabled=true},
    (f:ReturnType<typeof setup>)=>{f.state.current!.disabled=false},
    (f:ReturnType<typeof setup>)=>{f.state.current=null},
    (f:ReturnType<typeof setup>)=>{f.state.selected!.dataset.value='1'},
    (f:ReturnType<typeof setup>)=>{f.state.selected=null},
    (f:ReturnType<typeof setup>)=>{f.state.progress=null},
  ]) {const f=setup();mutate(f);assert.equal(henCareResultFocus(f.root,f.previous),undefined);assert.deepEqual(f.progress.classes,[])}
})

test('focus-only wiring is a scoped fallback after fresh enabled identity, with no activation or gameplay', () => {
  const read=(file:string)=>readFileSync(new URL(file,import.meta.url),'utf8')
  const source=read('../src/hen-care-focus.ts'), main=read('../src/main.ts'), css=read('../src/hen-friendship.css')
  assert.doesNotMatch(source,/innerHTML|textContent|createElement|addEventListener|localStorage|saveFarm|perform\(|\.click\(|disabled\s*=/)
  assert.match(main,/replacement \?\? depletedSeedTile \?\? incubatorRoute \?\? \(panel === 'hen-friendship' \? henCareResultFocus\(dialogContent, focused\) : undefined\) \?\? closeButton/)
  assert.match(main,/nextFocus\.focus\(\{ preventScroll: true \}\)/)
  assert.match(css,/\.hen-friend-progress \.hen-care-focus:focus-visible\{outline:3px solid var\(--plum\);outline-offset:2px\}/)
})

test('redraw keeps an enabled identity first, then the exact panel fallback, without activating anything', () => {
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const start=main.indexOf("  if (focused && panel !== 'bay-freight'")
  assert.ok(start>0)
  const recovery=stripTypeScriptTypes(main.slice(start,main.indexOf('\n}\n',start)))
  assert.doesNotMatch(recovery,/\.click\(|perform\(|saveFarm|endDay\(/)
  for(const [panel,action,replacement,hasRoute,hasProgress,expected,seed] of [
    ['hen-friendship','pet',true,false,true,'same'],
    ['hen-friendship','pet',false,false,true,'progress'],
    ['hen-friendship','pet',false,false,false,'close'],
    ['coop','incubate-egg',true,true,true,'same'],
    ['coop','incubate-egg',false,true,true,'route'],
    ['coop','incubate-egg',false,false,true,'close'],
    ['coop','feed',false,true,true,'close'],
    ['seeds','choose-seed',true,false,false,'same',{}],
    ['seeds','choose-seed',false,false,false,'seed',{}],
    ['seeds','choose-seed',false,false,false,'close',{count:1}],
    ['inventory','choose-seed',false,false,false,'seed',{}],
    ['inventory','choose-seed',false,false,false,'close',{tab:'harvest'}],
    ['seeds','choose-seed',false,false,false,'close',{crop:'carrot'}],
    ['rest','pet',false,true,true,'close'],
  ] as const){
    const effects:string[]=[]
    const control=(label:string,chosen=action)=>({dataset:{action:chosen,crop:seed?.crop??'beetroot'},focus(options:{preventScroll:boolean}){
      assert.equal(options.preventScroll,true);effects.push(label)
    },click(){assert.fail('focus recovery must not activate anything')}})
    const current=control('same'),progress=control('progress'),route=control('route'),tile=control('seed','preview-seed')
    let careQueries=0,routeQueries=0,seedQueries=0
    const dialogContent={querySelectorAll:(selector:string)=>{assert.equal(selector,'button:not(:disabled)');return replacement?[current]:[]},
      querySelector:(selector:string)=>{
        if(selector==='.seed-picker-tile[aria-pressed="true"]'){seedQueries++;return tile}
        assert.equal(selector,'.coop-primary [data-action="visit-rest"]');routeQueries++;return hasRoute?route:null
      }}
    runInNewContext(recovery,{panel,focused:control('previous'),focusedSeedCrop:undefined,focusKey:(b:ReturnType<typeof control>)=>JSON.stringify(b.dataset),
      previewSeed:'beetroot',bagTab:seed?.tab??'seeds',farm:{seeds:{beetroot:seed?.count??0}},
      closeButton:control('close'),dialogContent,henCareResultFocus(){careQueries++;return hasProgress?progress:undefined}})
    assert.deepEqual(effects,[expected]);assert.equal(careQueries,panel==='hen-friendship'&&!replacement?1:0)
    assert.equal(seedQueries,Number(expected==='seed'))
    if(panel!=='coop'||action!=='incubate-egg')assert.equal(routeQueries,0)
    else if(!replacement)assert.equal(routeQueries,1)
  }
})
