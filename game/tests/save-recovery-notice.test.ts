import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import type {SaveIssue} from '../src/protected-save.ts'

// Adapt only DOM methods, execute the production mount function. The modal stack
// models showModal/close ownership, not optical/browser accessibility acceptance.
class Element extends EventTarget {
 children:Element[]=[];parts=new Map<string,Element>();open=false;hidden=false;disabled=false;textContent='';innerHTML='';className='';type='';focusCount=0;shows=0
 stack:Element[];constructor(stack:Element[]){super();this.stack=stack}
 setAttribute(){}append(...children:Element[]){this.children.push(...children)}
 querySelector(selector:string){if(!this.parts.has(selector))this.parts.set(selector,new Element(this.stack));return this.parts.get(selector)!}
 showModal(){assert.equal(this.open,false);this.open=true;this.shows++;this.stack.push(this)}
 close(){this.open=false;const i=this.stack.indexOf(this);if(i>=0)this.stack.splice(i,1)}
 focus(){this.focusCount++}click(){this.dispatchEvent(new Event('click'))}
}
function mount(issue?:SaveIssue){
 const stack:Element[]=[],body=new Element(stack),main=new Element(stack);body.append(main);main.showModal()
 const source:{issue:SaveIssue|undefined;raw:string;blocked:boolean;recoveryOrigin:'primary'}={issue,raw:'authoritative other-tab bytes',blocked:!!issue,recoveryOrigin:'primary'}
 let reloads=0
 const state:any={source,document:{body,createElement:()=>new Element(stack)},window:{setTimeout(){}},location:{reload(){reloads++}},Blob,URL}
 const file=readFileSync(new URL('../src/save-recovery.ts',import.meta.url),'utf8')
 const fn=file.slice(file.indexOf('export function mountSaveRecovery')).replace('export function','function')
 runInNewContext(stripTypeScriptTypes(fn+'\nvar recovery=mountSaveRecovery(source)'),state)
 const dialog=body.children.find(v=>v.className==='save-recovery-dialog')!,notice=body.children.find(v=>v.className==='save-recovery-notice')!
 return {source,stack,main,dialog,notice,recovery:state.recovery,reloads:()=>reloads}
}

test('a newly refused other-tab write opens existing recovery above the result modal once',()=>{
 const f=mount();assert.equal(f.dialog.open,false);assert.equal(f.notice.hidden,true)
 f.source.issue='changed';f.source.blocked=true;f.recovery.update()
 assert.equal(f.dialog.open,true);assert.equal(f.stack.at(-1),f.dialog);assert.equal(f.main.open,true)
 assert.match(f.dialog.querySelector('#save-recovery-detail').textContent,/Сохранение изменилось вне этой страницы/)
 assert.match(f.dialog.innerHTML,/Новый прогресс может исчезнуть после закрытия или перезагрузки страницы/)
 assert.equal(f.dialog.querySelector('[data-recovery="download"]').disabled,false)
 assert.equal(f.dialog.querySelector('[data-recovery="download"]').focusCount,1)
 f.dialog.querySelector('[data-recovery="continue"]').click();assert.equal(f.dialog.open,false);assert.equal(f.stack.at(-1),f.main)
 f.recovery.update();f.recovery.update();assert.equal(f.dialog.open,false);assert.equal(f.dialog.shows,1,'intentional Continue is not overridden by subsequent refused saves')
 assert.equal(f.source.raw,'authoritative other-tab bytes')
})

test('initial recovery and an explicit later Details still use the previous show policy',()=>{
 const f=mount('changed');assert.equal(f.dialog.open,false,'startup caller retains its explicit show')
 f.recovery.show();assert.equal(f.dialog.open,true);f.dialog.close();f.recovery.update();assert.equal(f.dialog.open,false)
 f.notice.click();assert.equal(f.dialog.open,true);assert.equal(f.dialog.shows,2)
 f.dialog.querySelector('[data-recovery="retry"]').click();assert.equal(f.reloads(),1);assert.equal(f.source.raw,'authoritative other-tab bytes')
})

test('ordinary recoverable write failure does not acquire a new automatic modal policy',()=>{
 const f=mount();f.source.issue='write-failed';f.source.blocked=false;f.recovery.update()
 assert.equal(f.dialog.open,false);assert.equal(f.notice.hidden,false);assert.match(f.notice.textContent,/Прогресс не сохранён/)
 assert.match(f.dialog.querySelector('#save-recovery-detail').textContent,/следующее действие попробует сохранить снова/)
 f.source.issue=undefined;f.recovery.update();assert.equal(f.notice.hidden,true);assert.equal(f.dialog.shows,0)
})
