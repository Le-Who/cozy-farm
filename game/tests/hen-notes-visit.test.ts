import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {createContext, Script} from 'node:vm'
import {canIntroduceHenToVisitor, petChicken, restoreCurrentFarm} from '../src/farm.ts'
import {henFriends, renderHenFriendship, treatHen} from '../src/hen-friendship.ts'
import {renderChickenFeedMixes} from '../src/chicken-feed.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read = (file:string) => readFileSync(new URL(file,import.meta.url),'utf8')
const main = read('../src/main.ts')
function between(first:string,next:string,section:string) {
  const start=main.indexOf(first,main.indexOf(section)), end=main.indexOf(next,start+first.length)
  assert.ok(start>=0 && end>start)
  return main.slice(start,end)
}
const script = (source:string) => new Script(stripTypeScriptTypes(source))
const branch = (first:string,next:string,section:string,input:string) => script(`switch(${input}){${between(first,next,section)}}`)
const actions = branch("    case 'hen-friend-select':", "    case 'chicken-feed-open':", 'async event =>', 'receivedAction')
const pet = branch("    case 'pet':", "    case '", 'async event =>', 'receivedAction')
const petTarget = branch("    case 'hen':", "    case 'salt':", 'function activateTarget(', 'target.kind')
const redraw = script(`{${between('  const guideGardenOpen','  panelRenderVersion++','function drawPanel()')}
  switch(panel){${between("    case 'hen-friendship':","    case 'coop':",'function drawPanel()')}}
}`)
const entry = script(between('  drawPanel()\n  dialogContent.scrollTop = 0','  if (reopenScroll','function openPanel('))
const outcome = script(between('function refresh()','const bedTools','function refresh()'))

// Execute the production branches/reducer and feedback. Only the DOM/modal, sound and timer are stand-ins.
function newlyHatched() {
  const p=commissionPlayer(JSON.parse(read('./fixtures/home-progress-actions.json')).slice(0,39))
  p.act('specializeFacility','hatchery');p.act('pickFruit',0);p.act('incubateEgg')
  p.night();p.night()
  const farm=p.state, id=farm.flockSize-1
  assert.equal(farm.day,6);assert.equal(id,4);assert.equal(farm.hatchDay,null)
  let html='', notes:{open:boolean}|null=null, saves=0
  const messages:string[]=[], tones:{hidden:boolean}[]=[]
  const dialogContent={
    set innerHTML(value:string) {
      html=value
      const details=html.match(/<details class="hen-friend-notes"([^>]*)>/)
      notes=details?{open:/\bopen\b/.test(details[1])}:null
    }, scrollTop:0,
    querySelector(query:string) {
      if(query==='.hen-friend-notes')return notes
      if(query==='.hen-friend-select[aria-pressed="true"]'){
        const selected=html.match(/data-action="hen-friend-select" data-value="(\d+)" aria-pressed="true"/)?.[1]
        return selected?{dataset:{value:selected}}:null
      }
      return null
    },
  }
  const dialog={open:true,showModal(){this.open=true}}
  const ctx=createContext({
    farm,dialog,dialogContent,panel:'coop',selectedFriendHen:id,henGesture:'stroke',
    renderHenFriendship,renderChickenFeedMixes,henFriends,treatHen,petChicken,canIntroduceHenToVisitor,icon:()=>'',
    island:{henWalkStatus:()=>null,henWalkAvailable:()=>true,henFieldTarget:()=>undefined,render(){}},
    panelHistory:[], playBaySound(){}, status(){}, saveFarm(){saves++},
    window:{clearTimeout(){},setTimeout(){return 1}},dialogFeedbackTimer:undefined,
    dialogFeedback:{classList:{toggle(key:string,hidden:boolean){assert.equal(key,'sr-only');tones.push({hidden})}},
      set textContent(message:string){messages.push(message)},dataset:{}},
    openPanel: (next:string) => open(next),
    drawPanel() { if(ctx.panel==='coop')dialogContent.innerHTML='<section>Курятник</section>'; else redraw.runInContext(ctx) },
    activateTarget(target:{kind:string,index:number}){ctx.target=target;petTarget.runInContext(ctx)},
  })
  outcome.runInContext(ctx)
  function open(next:string){ctx.panel=next;entry.runInContext(ctx)}
  function click(action:string,value=''){ctx.receivedAction=action;ctx.value=value;(action==='pet'?pet:actions).runInContext(ctx)}
  click('hen-friendship-open')
  assert.match(html,/<h2>Пуговка<\/h2>/)
  return {farm,id,click,open,draw:()=>ctx.drawPanel(),dialog,
    get notes(){assert.ok(notes);return notes},get html(){return html},get saves(){return saves},messages,tones}
}

test('the newly hatched hen keeps her open notes while an earned treat reveals the new memory',()=>{
  const ui=newlyHatched(), {farm,id}=ui
  assert.equal(ui.notes.open,false)
  ui.click('pet',String(id));assert.equal(farm.henFriendship.hens[id].points,1)
  assert.match(ui.html,/Новая заметка при 3 шагах дружбы/)
  ui.notes.open=true
  const before=structuredClone(farm), saves=ui.saves, feedback=ui.messages.length, openNotes=ui.notes
  ui.click('hen-treat',`${id}:apple`)
  before.fruit.apple--
  before.henFriendship.hens[id]={points:3,treatedOn:farm.day,tasted:['apple']}
  assert.deepEqual(farm,before,'same price, unlocked memory and no extra state changes')
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
  assert.notEqual(ui.notes,openNotes,'the card was really rebuilt')
  assert.equal(ui.notes.open,true,'do not close the notes being read when the treat awards a memory')
  const memory=henFriends[id].memories[0]
  assert.equal(ui.html.split('<details class="hen-friend-notes">')[1]?.split(memory).length,2)
  assert.equal(ui.saves,saves+1)
  assert.equal(ui.messages.length,feedback+1);assert.match(ui.messages.at(-1)!,new RegExp(memory))
  assert.equal(ui.tones.at(-1)?.hidden,true,'the existing accessible feedback is not duplicated')
  ui.draw()
  assert.equal(ui.notes.open,true)
  assert.equal(ui.saves,saves+1);assert.equal(ui.messages.length,feedback+1)
})

test('explicitly closed notes stay closed; another hen or a new visit never inherits them',()=>{
  const ui=newlyHatched(), before=structuredClone(ui.farm)
  ui.notes.open=true;ui.click('hen-friend-select','4');assert.equal(ui.notes.open,true)
  ui.notes.open=false;ui.click('hen-friend-select','4');assert.equal(ui.notes.open,false)
  ui.notes.open=true;ui.click('hen-friend-select','0');assert.equal(ui.notes.open,false)
  assert.match(ui.html,/<h2>Плюша<\/h2>/)
  ui.click('hen-friend-select','4');assert.equal(ui.notes.open,false)
  ui.notes.open=true;ui.open('chicken-feed');assert.match(ui.html,/class="feed-choice"/)
  ui.open('hen-friendship');assert.equal(ui.notes.open,false)
  ui.notes.open=true;ui.dialog.open=false // The native close can leave the old content mounted.
  ui.open('hen-friendship');assert.equal(ui.notes.open,false);assert.equal(ui.dialog.open,true)
  assert.equal(ui.saves,0);assert.deepEqual(ui.messages,[]);assert.deepEqual(ui.farm,before)
})
