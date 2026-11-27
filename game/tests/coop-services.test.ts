import test from 'node:test'
import assert from 'node:assert/strict'
import { groupCoopServices } from '../src/coop-services.ts'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'

function fixture(desktop:boolean) {
  const listeners=new Set<()=>void>(),body={}
  const media={matches:desktop,query:'',addEventListener(type:string,fn:()=>void){assert.equal(type,'change');listeners.add(fn)},removeEventListener(type:string,fn:()=>void){assert.equal(type,'change');listeners.delete(fn)}}
  const document={activeElement:body as unknown,defaultView:{matchMedia(query:string){media.query=query;return media}}}
  const focused=(action:string)=>({action,disabled:false,focusCalls:[] as unknown[],focus(options:unknown){this.focusCalls.push(options);document.activeElement=this}})
  const meet=focused('hen-friendship-open'),mix=focused('chicken-feed-open'),feed=focused('feed')
  const care={name:'care',buttons:[meet,mix],contains(node:unknown){return this.buttons.includes(node as typeof meet)}},primary={name:'primary',buttons:[feed],querySelector(){return null}},forecast={name:'forecast'},packing={name:'packing'},hens={name:'hens'}
  const panel={dataset:{} as Record<string,string>,children:[primary,forecast,care,packing,hens] as any[],
    querySelector(selector:string){return selector.includes('coop-primary')?primary:selector.includes('coop-care')?care:selector.includes('coop-forecast')?forecast:null},
    get firstElementChild(){return this.children[0]},
    prepend(node:unknown){this.insertBefore(node,this.firstElementChild)},
    insertBefore(node:any,before:any){if(node===before)return;this.children=this.children.filter(child=>child!==node);const index=before?this.children.indexOf(before):this.children.length;assert.ok(index>=0);this.children.splice(index,0,node);if(care.contains(document.activeElement))document.activeElement=body;root.scrollTop=0},
  }
  for(const item of [care,forecast])Object.defineProperty(item,'nextElementSibling',{get(){return panel.children[panel.children.indexOf(item)+1]??null}})
  const root={ownerDocument:document,scrollTop:90,attached:true,contains(node:unknown){return this.attached&&node===panel},querySelector(){return panel}}
  const change=(matches:boolean)=>{media.matches=matches;for(const fn of [...listeners])fn()}
  return {root,panel,care,primary,forecast,packing,hens,meet,mix,feed,document,media,listeners,change,names:()=>panel.children.map(n=>n.name)}
}

test('desktop reading order follows the unchanged daily-left column before right care',()=>{
  const f=fixture(true),stop=groupCoopServices(f.root as unknown as HTMLElement)
  assert.deepEqual(f.names(),['primary','forecast','care','packing','hens'])
  assert.equal(f.panel.dataset.coopServices,'true');assert.equal(f.listeners.size,1)
  assert.equal(f.media.query,'(min-width: 900px) and (min-height: 600px)')
  stop();assert.equal(f.listeners.size,0)
})

test('compact still moves the original whole care group first with all control identity/state intact',()=>{
  const f=fixture(false);f.mix.disabled=true
  const stop=groupCoopServices(f.root as unknown as HTMLElement)
  assert.deepEqual(f.names(),['care','primary','forecast','packing','hens'])
  assert.equal(f.panel.children[0],f.care);assert.deepEqual(f.care.buttons,[f.meet,f.mix]);assert.equal(f.mix.disabled,true)
  assert.equal(f.root.scrollTop,90)
  stop()
})

test('live breakpoint change keeps focused moved control and scroll; reverse keeps compact order',()=>{
  const f=fixture(false),stop=groupCoopServices(f.root as unknown as HTMLElement)
  f.document.activeElement=f.meet;f.root.scrollTop=73
  f.change(true)
  assert.deepEqual(f.names(),['primary','forecast','care','packing','hens'])
  assert.equal(f.document.activeElement,f.meet);assert.deepEqual(f.meet.focusCalls,[{preventScroll:true}]);assert.equal(f.root.scrollTop,73)
  f.change(false)
  assert.deepEqual(f.names(),['care','primary','forecast','packing','hens'])
  assert.equal(f.document.activeElement,f.meet);assert.equal(f.meet.focusCalls.length,2);assert.equal(f.root.scrollTop,73)
  f.change(false);assert.equal(f.meet.focusCalls.length,2,'same order never moves/refocuses')
  stop()
})

test('resize does not steal focus outside the moved care group',()=>{
  const f=fixture(true),stop=groupCoopServices(f.root as unknown as HTMLElement)
  f.document.activeElement=f.feed;f.change(false)
  assert.equal(f.document.activeElement,f.feed);assert.equal(f.feed.focusCalls.length,0)
  stop()
})

test('repeat mount replaces its listener; cleanup and stale detached panels cannot reorder',()=>{
  const f=fixture(false),old=groupCoopServices(f.root as unknown as HTMLElement),stop=groupCoopServices(f.root as unknown as HTMLElement)
  assert.equal(f.listeners.size,1);assert.deepEqual(f.names(),['care','primary','forecast','packing','hens'])
  old();assert.equal(f.listeners.size,1,'old cleanup must not detach new mount')
  f.root.attached=false;f.change(true);assert.deepEqual(f.names(),['care','primary','forecast','packing','hens'])
  stop();stop();assert.equal(f.listeners.size,0)
  f.root.attached=true;f.change(true);assert.deepEqual(f.names(),['care','primary','forecast','packing','hens'])
})

test('non-coop and incomplete roots are untouched',()=>{
  const noop=groupCoopServices({querySelector:()=>null} as unknown as HTMLElement);noop()
  const panel={dataset:{},querySelector:()=>null,prepend(){throw Error('must not move')}}
  groupCoopServices({querySelector:()=>panel} as unknown as HTMLElement)();assert.deepEqual(panel.dataset,{})
})

test('source keeps CSS placement/actions unchanged and disposes on redraw and dialog close',()=>{
  const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8'),source=read('../src/coop-services.ts'),css=read('../src/coop-services.css'),main=read('../src/main.ts')
  assert.doesNotMatch(source,/innerHTML|createElement|textContent|localStorage|\.click\(|tabIndex|setAttribute/)
  assert.match(css,/@media \(min-width: 900px\) and \(min-height: 600px\)/)
  assert.match(css,/> \.coop-primary \{ grid-column: 1; grid-row: 1;/)
  assert.match(css,/> \.coop-care \{ grid-column: 2; grid-row: 1 \/ 3;/)
  assert.match(main,/renderCoopPanel\(farm, \{icon,row,button,feedRow:flockFeedRow\}, desktopCoopFeed\.matches\)\s*disposeCoopServices = groupCoopServices\(dialogContent\)/)
  const draw=main.slice(main.indexOf('function drawPanel()'),main.indexOf('function openPanel('))
  assert.ok(draw.indexOf('stopCoopServices()')<draw.indexOf('dialogContent.innerHTML ='))
  assert.match(main,/dialog.addEventListener\('close', \(\) => \{[\s\S]*?if \(!dialog.open\) \{\s*stopCoopServices\(\)/)
})


test('actual main teardown clears the owned disposer before invoking it and does not retain a detached panel',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const owner=main.includes('let disposeCoopServices:')?'disposeCoopServices':'stopCoopServices'
  const start=main.indexOf(`let ${owner}`),end=main.indexOf('function drawPanel()',start)
  assert.ok(start>=0&&end>start)
  const scope:any={}
  runInNewContext(stripTypeScriptTypes(`${main.slice(start,end)}
    function install(dispose){${owner}=dispose}
    function retained(){return ${owner}}
    function teardown(){stopCoopServices()}`,{mode:'transform'}),scope)
  let calls=0
  scope.install(()=>{calls++;assert.equal(scope.retained(),undefined,'old DOM closure is released before callback')})
  scope.teardown();assert.equal(calls,1);assert.equal(scope.retained(),undefined)
  scope.teardown();assert.equal(calls,1,'empty teardown is safe')
  const later=()=>{}
  scope.install(()=>{scope.install(later)})
  scope.teardown();assert.equal(scope.retained(),later,'teardown cannot erase a new reentrant mount')
})
