import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'

test('every Buy category keeps the same four visible, named and operable category choices',()=>{
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const block=source.slice(source.indexOf('  const categories=`<nav class="market-category-icons'),source.indexOf("  if(marketCategory==='seeds')return"))
  const expected=[['seeds','Семена'],['trees','Деревья'],['care','Уход'],['buildings','Постройки']]
  for(const [marketCategory] of expected) {
    const html=runInNewContext(stripTypeScriptTypes(block+'\ncategories'),{marketCategory,icon:()=>'<img alt="">'}) as string
    const buttons=[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    assert.equal(buttons.length,4)
    for(const [i,[id,name]] of expected.entries()) {
      const [,attrs,content]=buttons[i]
      assert.ok(attrs.includes('data-action="market-category"')&&attrs.includes(`data-value="${id}"`))
      assert.ok(attrs.includes(`aria-label="${name}"`)&&attrs.includes(`aria-pressed="${marketCategory===id}"`))
      assert.equal(content.replace(/<[^>]+>/g,''),name,`${marketCategory}: ${name} must not become icon-only`)
    }
  }
})
