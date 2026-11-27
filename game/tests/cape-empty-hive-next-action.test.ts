import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {getApiaryCopy} from '../src/apiary-preview.ts'
import {getWindHoneySource} from '../src/wind-honey-guidance.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read = (name:string) => readFileSync(new URL(name,import.meta.url),'utf8')
const opening = JSON.parse(read('./fixtures/home-progress-actions.json')) as {name:string;args:unknown[]}[]
const firstCape = opening.findIndex(({name,args}) => name === 'sail' && args[0] === 'cape')
assert.equal(firstCape,29)
const arrival = () => commissionPlayer(opening.slice(0,firstCape+1))
const main = read('../src/main.ts')
function exact(from:string,to:string) {
  const a=main.indexOf(from),b=main.indexOf(to,a+from.length)
  assert.ok(a>=0&&b>a,from);return main.slice(a,b)
}
const view = stripTypeScriptTypes(exact('function button(label:','function quantity(') +
  `\n;switch('hive'){${exact("    case 'hive': {","    case 'cape-upgrade': {")}}`)
const focus = stripTypeScriptTypes(`switch(action){${exact("    case 'focus-bed':","    case 'travel-panel':")}}`)
function hive(farm:F.FarmState) {
  const dialogContent={innerHTML:''}
  const before=structuredClone(farm)
  runInNewContext(view,{...F,farm,hiveFlower:undefined,dialogContent,dialogTitle:{textContent:'',setAttribute(){}},
    getApiaryCopy,getWindHoneySource,icon:()=>'',row:(_icon:string,label:string,count:string)=>`<li>${label} ${count}</li>`,
    nav:(...buttons:string[])=>`<nav>${buttons.join('')}</nav>`})
  assert.deepEqual(farm,before)
  return [...dialogContent.innerHTML.matchAll(/<button[^>]*data-action="([^"]+)"([^>]*)>([^<]*)<\/button>/g)]
    .map(([,id,attrs,label])=>({id,label:label.trim(),value:attrs.match(/data-value="([^"]+)"/)?.[1],enabled:!attrs.includes('disabled')}))
}
test('on a real first Cape arrival, the manual hive offers one current empty plot and one click only focuses it',()=>{
  const player=arrival(), farm=player.state, before=structuredClone(farm)
  assert.deepEqual([farm.day,farm.island,farm.capeFlowers,farm.honey],[3,'cape',[null,null,null],0])
  assert.equal(F.getCapeUpgrade(farm)?.available,false)
  const actions=hive(farm)
  assert.deepEqual(actions,[
    {id:'focus-flower',label:'К свободной клумбе',value:'0',enabled:true},
    {id:'cape-upgrade',label:'Улучшить',value:undefined,enabled:true},
  ],'use the disabled gather slot, not a new button or an upgrade detour')
  const pick=actions[0]
  const effects:string[]=[]
  runInNewContext(focus,{action:pick.id,value:pick.value,closeDialog(){effects.push('close')},
    island:{focusTarget(p:{kind:string;index:number}){effects.push(p.kind+':'+p.index)}}})
  assert.deepEqual(effects,['close','flower:0'])
  assert.deepEqual(farm,before,'no planting, travel, sleep, spend or other farm mutation')
  player.act('plantCapeFlower',0)
  assert.deepEqual([player.state.capeFlowers,player.state.coins,player.state.honey],[[3,null,null],before.coins,0])
})

test('a single planting already keeps the optional rest and eventual gather; no duplicate plot shortcut',()=>{
  const player=arrival()
  player.act('plantCapeFlower',0)
  const one=hive(player.state)
  assert.deepEqual(one,[
    {id:'visit-rest',label:'Домой к отдыху',value:undefined,enabled:true},
    {id:'cape-upgrade',label:'Улучшить',value:undefined,enabled:true},
  ])
  assert.equal(getApiaryCopy(player.state).tomorrow.honey,1)
  player.night();player.visit('cape')
  const blooms=hive(player.state)
  assert.equal(blooms.filter(a=>a.id==='collect-honey'&&a.enabled).length,1)
  assert.ok(blooms.some(a=>a.id==='cape-upgrade'&&a.enabled))
  assert.ok(!blooms.some(a=>a.id==='focus-flower'))
  player.act('collectCapeHoney')
  assert.equal(player.state.honey,1)
  const collected=hive(player.state)
  assert.ok(collected.some(a=>a.id==='visit-rest'&&a.enabled))
  assert.ok(!collected.some(a=>a.id==='focus-flower'||a.id==='collect-honey'&&a.enabled))
})
