import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createFarm } from '../src/farm.ts'
import { rememberRecipeDraft } from '../src/recipe-draft.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'

test('studio can select absent ingredients and a remembered tart exposes its entire exact supply list', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try {
    const {signatureStudio,signatureBook} = await server.ssrLoadModule('/src/culinary-ui.ts')
    const farm = createFarm()
    const art = {icon: () => '<img alt="">', stock: (item: {kind:string,item?:string,trait?:string,quantity:number}) => `<li>${item.kind}:${item.item ?? ''}:${item.trait ?? ''} ×${item.quantity}</li>`}
    const empty = signatureStudio(farm,'tart',[null,null],0,art)
    assert.match(empty,/Можно задумать блюдо заранее/)
    assert.match(empty,/aria-label="Выбрать: Груша, в наличии: 0, можно добавить в задумку"/)
    assert.doesNotMatch(empty,/data-action="signature-fruit"[^>]*disabled/)
    assert.match(empty,/data-action="start-signature"[^>]*disabled/)
    rememberRecipeDraft(farm,{base:'tart',slots:[{id:'apple',quantity:1},null],activeSlot:1})
    assert.match(signatureBook(farm,art),/Выберите ещё одну порцию/)
    rememberRecipeDraft(farm,{base:'tart',slots:[{id:'apple',quantity:1},{id:'apple',quantity:1}],activeSlot:0})
    const before = structuredClone(farm), book = signatureBook(farm,art)
    assert.match(book,/Для задуманного блюда/)
    assert.match(book,/fruit:apple: ×2/)
    assert.match(book,/produce:wheat: ×1/)
    assert.match(book,/eggs:: ×1/)
    assert.match(book,/Нажмите на недостающий продукт/)
    const chosen = signatureStudio(farm,'tart',farm.recipeDraft!.slots,0,art)
    assert.match(chosen,/К задумке в книге/)
    assert.deepEqual(farm,before)
  } finally { await server.close() }
})

test('known empty traits remain selectable, unknown traits stay hidden, and supply readiness does not claim cooking access', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try {
    const {signatureStudio,signatureBook} = await server.ssrLoadModule('/src/culinary-ui.ts')
    const farm=createFarm(); farm.discoveries.apple={frost:true}
    const art={icon:()=>'<img alt="">',stock:()=>'<li>Припасы</li>'}
    const studio=signatureStudio(farm,'preserves',[null,null],0,art)
    assert.match(studio,/data-value="apple" data-trait="frost" data-empty="true"/)
    assert.doesNotMatch(studio,/data-trait="rainbow"/)
    farm.fruit.apple=2
    rememberRecipeDraft(farm,{base:'preserves',slots:[{id:'apple',quantity:1},{id:'apple',quantity:1}],activeSlot:0})
    const book=signatureBook(farm,art)
    assert.match(book,/Все ингредиенты есть/)
    assert.match(book,/Улучшите дом, чтобы готовить заготовки/)
    assert.doesNotMatch(book,/data-action="start-signature"/)
    for (const action of ['signature-base','signature-slot','signature-fruit','start-signature']) assert.ok(isGuardedAction(action))
  } finally { await server.close() }
})
