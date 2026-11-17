import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,treeIds,treeDefinitions,buySapling,buyAndPlantTree,restoreCurrentFarm} from '../src/farm.ts'
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),branch=source.slice(source.indexOf("  if(marketCategory==='trees')return"),source.indexOf("  if(marketCategory==='care')return"))
function render(farm:ReturnType<typeof createFarm>){
 const actions:{label:string;action:string;enabled:boolean;options:any}[]=[]
 const ctx={farm,marketCategory:'trees',tabs:'',categories:'',stall:'',treeIds,treeDefinitions,quantity:(n:number,word:string)=>`${n} ${word}`,icon:(s:string)=>`<img src="${s}">`,nav:(s:string)=>s,button:(label:string,action:string,enabled:boolean,options:any)=>{actions.push({label,action,enabled,options});return `<button data-action="${action}"${enabled?'':' disabled'}>${label}</button>`}}
 const html=runInNewContext(stripTypeScriptTypes(`function render(){${branch}}\nrender()`),ctx) as string
 return{html,actions}
}
test('tree products expose canonical price, maturity and stock with one original direct buy action',()=>{
 const farm=createFarm(),before=structuredClone(farm),{html,actions}=render(farm)
 assert.equal(actions.length,treeIds.length)
 for(const [i,tree]of treeIds.entries()){
  const d=treeDefinitions[tree];assert.match(html,new RegExp(`data-tree-product="${tree}"`));assert.ok(html.includes(d.saplingName));assert.ok(html.includes(`${d.days} ночь до зрелости`));assert.ok(html.includes(`В запасе: ${farm.saplings[tree]}`));assert.ok(html.includes(`${d.saplingPrice} <img src="coin"> за саженец`))
  assert.deepEqual(JSON.parse(JSON.stringify(actions[i])),{label:'Купить',action:'buy-sapling',enabled:farm.coins>=d.saplingPrice,options:{value:tree,context:d.saplingName}})
 }
 assert.deepEqual(farm,before)
})
test('full Home orchard retains exact storage guidance and does not falsely block buying into stock',()=>{
 const farm=createFarm();assert.ok(buyAndPlantTree(farm,1,'apple').ok);assert.ok(buyAndPlantTree(farm,2,'apple').ok);const before=structuredClone(farm),{html,actions}=render(farm)
 assert.ok(html.includes('Родной сад заполнен. Бесплатно уберите дерево на хранение, чтобы освободить место для другого.'))
 assert.equal(actions.filter(a=>a.action==='market-orchard-space').length,1);assert.equal(actions.find(a=>a.action==='market-orchard-space')?.label,'Освободить место')
 assert.equal(actions.find(a=>a.options.value==='apple')?.enabled,true);assert.equal(actions.find(a=>a.options.value==='pear')?.enabled,false);assert.deepEqual(farm,before)
 assert.ok(buySapling(farm,'apple').ok);assert.deepEqual(farm.trees,before.trees);assert.deepEqual(farm.treeNursery,before.treeNursery);assert.equal(farm.coins,0);assert.equal(farm.saplings.apple,before.saplings.apple+1);assert.deepEqual(restoreCurrentFarm(structuredClone(farm)),farm)
})
test('insufficient coins disable all purchase actions without mutation or artificial orchard gate',()=>{
 const farm=createFarm();assert.ok(buySapling(farm,'pear').ok);const before=structuredClone(farm),{html,actions}=render(farm)
 assert.ok(actions.every(a=>!a.enabled));assert.doesNotMatch(html,/Освободить место/);assert.deepEqual(farm,before);assert.equal(buySapling(farm,'apple').ok,false);assert.deepEqual(farm,before)
})
test('tree markup is read-only and uses its own presentation scope',()=>{
 assert.match(branch,/data-market-tree-browser/);assert.doesNotMatch(branch,/perform\(|saveFarm\(|buySapling\(|localStorage|data-market-seed-browser|data-market-orders-browser/)
 const css=readFileSync(new URL('../src/market-buy-trees.css',import.meta.url),'utf8');assert.doesNotMatch(css,/market-seed|market-orders|market-sale/)
})
test('short focus reveal is restricted to Trees buy buttons and preserves the existing Sale focus path',()=>{
 const focus=source.slice(source.indexOf("app.addEventListener('focusin',event=>{"),source.indexOf("app.addEventListener('input', event => {"))
 assert.match(focus,/marketTab==='buy'&&marketCategory==='trees'/);assert.match(focus,/event.target instanceof HTMLButtonElement/);assert.match(focus,/\[data-action=buy-sapling\]/);assert.match(focus,/max-height:400px/);assert.match(focus,/\[data-tree-product\]/);assert.match(focus,/:focus-visible/)
 assert.match(focus,/marketTab==='sell'&&event.target instanceof HTMLInputElement/);assert.doesNotMatch(focus,/perform\(|saveFarm\(|buySapling\(|localStorage/)
})
