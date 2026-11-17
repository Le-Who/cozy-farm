import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const css=readFileSync(new URL('../src/facility-choice.css',import.meta.url),'utf8')
const compact=css.slice(css.indexOf('@media'))
test('compact permanent-choice controls apply only to short-landscape Coop specialization',()=>{
 assert.match(compact,/^@media\(min-width:461px\) and \(max-height:480px\)/)
 const selectors=[...compact.matchAll(/\n ([^{]+)\{/g)].map(match=>match[1])
 assert.equal(selectors.length,10)
 for(const selector of selectors)assert.ok(selector.startsWith('.farm-dialog[data-panel="specialize"]:has([data-action="preview-specialization"][data-value="hatchery"]) '))
 assert.match(compact,/\.specialization-footer\{position:sticky;bottom:0;/)
 assert.match(compact,/\.specialization-footer \.dialog-button\{[^}]*min-height:44px/)
 assert.doesNotMatch(compact,/display:none|visibility:hidden|pointer-events:none|overflow:hidden/)
})
