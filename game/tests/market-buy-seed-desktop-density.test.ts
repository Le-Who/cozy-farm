import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {ruPlural} from '../src/ru.ts'
import {seedSavingQuote,saveCropSeeds} from '../src/seed-saving.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const read=(file:string)=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
const source=read('main.ts'), css=read('market-buy-seeds.css')
function exact(a:string,b:string){
 const i=source.indexOf(a),j=source.indexOf(b,i+1)
 assert.ok(i>=0&&j>i,[a,b]);return source.slice(i,j)
}
function media(query:string){
 const start=css.indexOf(query)
 assert.ok(start>=0,'the desktop card must have its own scoped height band')
 let depth=1,end=start+query.length
 while(end<css.length&&depth>0) {const c=css[end++];if(c==='{')depth++;if(c==='}')depth--}
 assert.equal(depth,0)
 return css.slice(start+query.length,end-1)
}
test('720p desktop can put the original seed price and one buy button beside each other without removing the art or wrapping fallback',()=>{
 const compact=media('@media(min-width:1100px) and (min-height:700px) and (max-height:820px){')
 const selectors=[...compact.matchAll(/(?:^|\n)\s*([^\n{]+)\s*\{/g)].map(m=>m[1].trim())
 assert.ok(selectors.length>5)
 for(const selector of selectors)assert.ok(selector.startsWith('[data-market-seed-browser] '),selector)
 assert.match(compact,/grid-template-areas:\s*"art title title" "art pack pack" "art stock stock" "art price buy"/)
 assert.match(compact,/\.market-seed-art>\.icon\s*\{[^}]*width:112px;height:112px/)
 assert.match(compact,/\.market-seed-copy h2\s*\{[^}]*grid-area:title/)
 assert.match(compact,/\.market-seed-stock\s*\{[^}]*grid-area:stock/)
 assert.match(compact,/\.market-seed-price\s*\{[^}]*grid-area:price/)
 assert.match(compact,/>:is\(\.dialog-button,\.market-seed-limit\)\s*\{[^}]*grid-area:buy/)
 assert.match(compact,/\.dialog-button\s*\{[^}]*white-space:normal;overflow-wrap:anywhere/)
 assert.match(css,/\.market-seed-grid \.dialog-button\s*\{[^}]*min-height:46px/)
 assert.match(css,/\.market-seed-copy h2\s*\{[^}]*overflow-wrap:anywhere/)
 assert.match(css,/\.market-seed-stock\s*\{overflow-wrap:anywhere\}/)
 assert.doesNotMatch(compact,/display:none|visibility:hidden|pointer-events:none|overflow:hidden/)
})

const render=stripTypeScriptTypes(exact('function button(','function goods()')
 +exact('function marketCareProducts(','function treeSelector()')+'\nmarketCards()')
const clones=(f:F.FarmState)=>{const current=F.restoreCurrentFarm(structuredClone(f));assert.deepEqual(current,f);return current!}
test('earned mature wheat purchase and ordinary harvest exchange remain separate one-action alternatives',()=>{
 const p=earned416Mixed(false)
 p.night()
 const farm=clones(p.state),original=clones(farm)
 assert.deepEqual([farm.day,farm.island,farm.seeds.wheat,farm.produce.wheat,farm.beds.filter(x=>x.kind==='tilled').length],[194,'home',0,2,16])
 assert.ok(farm.coins>=F.cropDefinitions.wheat.seedPrice)
 const markup=runInNewContext(render,{
  ...F,farm,marketCategory:'seeds',marketTab:'buy',ruPlural,
  numberFormat:new Intl.NumberFormat('ru-RU'),icon:(id:string)=>`<img alt="" data-icon="${id}">`,
 }) as string
 const packs=[...markup.matchAll(/<section data-seed-pack="([^"]+)">([\s\S]*?)<\/section>/g)]
 assert.deepEqual(packs.map(m=>m[1]),F.cropIds)
 const wheat=packs[5][2]
 assert.equal(packs[5][1],'wheat')
 assert.match(wheat,/<h2>Пшеница<\/h2>/)
 assert.match(wheat,/В пакете: 3 семени/)
 assert.match(wheat,/В запасе: 0 семян/)
 assert.match(wheat,/aria-label="4 монеты за пакет"/)
 assert.equal((wheat.match(/<button /g)??[]).length,1)
 assert.match(wheat,/aria-label="Купить пакет, Пшеница, 3 семени за 4 монеты"/)
 assert.deepEqual(farm,original)
 const cash=clones(farm),seed=clones(farm)
 assert.ok(F.buySeeds(cash,'wheat').ok)
 assert.deepEqual(cash,{...original,coins:original.coins-4,seeds:{...original.seeds,wheat:3}})
 const option=seedSavingQuote(seed,'wheat')
 assert.ok(option?.available);assert.ok(saveCropSeeds(seed,option.token).ok)
 assert.deepEqual(seed,{...original,seeds:{...original.seeds,wheat:3},produce:{...original.produce,wheat:1},workToday:original.workToday+1})
})

test('the unlocked Shop can share desktop category height without changing its label, action, order or hit area',()=>{
 const b=media('@media(min-width:1100px) and (min-height:700px){')
 assert.match(b,/\[data-market-seed-browser\]:has\(>\.market-seed-tools\)\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto;grid-template-rows:auto auto minmax\(0,1fr\)/)
 assert.match(b,/grid-template-areas:"market market" "categories shop" "seeds seeds"/)
 assert.match(b,/\.market-seed-tools\s*\{[^}]*grid-area:shop;align-self:center;padding:0 0 0 12px;border-top:0;border-left:1px/)
 assert.match(b,/\.market-seed-tools \.dialog-button\s*\{white-space:nowrap\}/)
 for(const k of ['.market-controls',' .market-category-icons',' .market-seed-grid']) assert.ok(b.includes(k))
 assert.doesNotMatch(b,/display:none|visibility:hidden|overflow:hidden|pointer-events:none|\border\s*:/)
 assert.match(css,/\.market-seed-tools \.dialog-button\s*\{min-height:44px/)
 assert.match(css,/\.market-seed-copy \.market-seed-select\s*\{[^}]*min-height:44px/)
 assert.match(css,/\.market-seed-packs :is\(\.market-seed-step,input\)\s*\{[^}]*min-height:44px/)

 const p=earned416Mixed(false)
 p.night()
 const f=p.state,before=structuredClone(f)
 assert.deepEqual([p.actions,f.day,f.island,f.coins, f.village.built],[544,194,'home',56,true])
 const html=(state:F.FarmState)=>runInNewContext(render,{
  ...F,farm:state,marketCategory:'seeds',marketTab:'buy',ruPlural,
  numberFormat:new Intl.NumberFormat('ru-RU'),icon:(id:string)=>`<img alt="" data-icon="${id}">`,
 }) as string
 const page=html(f)
 const buttons=[...page.matchAll(/data-action="(market-tab|market-category|open-panel)"\s+data-value="([^"]+)"/g)]
 assert.deepEqual(buttons.map(m=>m[2]),['buy','sell','orders','projects','seeds','trees','care','buildings','bay-shop'])
 const tabs=page.indexOf('class="market-controls"'),categories=page.indexOf('class="market-category-icons"')
 const tools=page.indexOf('class="market-seed-tools"'),grid=page.indexOf('class="market-seed-grid"')
 assert.ok(tabs>=0 && tabs<categories && categories<tools && tools<grid)
 assert.match(page,/data-action="open-panel"\s+data-value="bay-shop"[^>]*>В лавку в гавань/)
 assert.equal((page.match(/data-action="buy-seeds"/g)??[]).length,10)
 assert.doesNotMatch(html(F.createFarm()),/market-seed-tools|data-value="bay-shop"/)
 assert.deepEqual(f,before)
})
