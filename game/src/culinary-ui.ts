import {getSignatureAction,getSignatureStock,ingredientCount,type FarmState,type StockItem} from './farm'
import {signatureFruitIds,signatureFruitNames,signatureProcessingDefinitions,type SignatureDraft,type SignatureIngredient,type SignatureRecipe} from './culinary'
import {traitIds} from './climate'
import {getCoveEcology,type CoveChoices} from './shoreline'
import './culinary-ui.css'
import {traitLabel} from './ru'

import {evaluateFood, qualityNames, type IntentId} from './intent-orders'

type Icons={icon:(name:string,className?:string)=>string;stock:(item:StockItem)=>string}
export const escapeRecipeText=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export const ingredientArt=(id:string)=>id==='pear'?'ui-pear':id==='peach'?'ui-peach-fruit':id
export function signaturePortionStock(farm:FarmState,part:SignatureIngredient):number{
  return part.trait?farm.variants[part.id]?.[part.trait]??0:part.id==='apple'||part.id==='pear'||part.id==='peach'?farm.fruit[part.id]:farm.produce[part.id]
}
const ingredientName=(part:SignatureIngredient)=>part.trait?`${traitLabel(part.trait,part.id)} ${signatureFruitNames[part.id].toLowerCase()}`:signatureFruitNames[part.id]
const control=(text:string,action:string,id:string,enabled=true,extra='')=>`<button type="button" class="dialog-button" data-action="${action}" data-value="${id}" ${enabled?'':'disabled'} ${extra}>${text}</button>`

function resultPicture(recipe:SignatureRecipe,art:Icons){
  if(recipe.base==='preserves')return art.icon(`ui-signature-${recipe.processing}`,'signature-jar')
  const topping=(id:string)=>id==='apple'?'apple-slice':id==='pear'?'pear-piece':id==='peach'?'peach-slice':id
  const fruit=recipe.ingredients.map(part=>part.id),berry=fruit[0]
  const base=fruit.every(id=>id===berry)&&['strawberry','blueberry','raspberry'].includes(berry)?`tart-${berry}`:'tart'
  return `<span class="signature-tart"><img class="signature-tart-base" src="${import.meta.env.BASE_URL}art/lavender/cookery/${base}.webp" alt="">${recipe.result.fruit.map(p=>`<img class="signature-topping" src="${import.meta.env.BASE_URL}art/lavender/cookery/${topping(p.ingredientId)}.webp" alt="" style="left:${50+p.x*27}%;top:${46+p.y*18}%;transform:translate(-50%,-50%) rotate(${p.angle}rad)">`).join('')}</span>`
}

export function signatureBook(farm:FarmState,art:Icons):string{
  const recipes=getSignatureStock(farm).sort((a,b)=>Number(b.recipe.favorite)-Number(a.recipe.favorite)||b.recipe.createdOn-a.recipe.createdOn||Number(b.recipe.id.slice(1))-Number(a.recipe.id.slice(1)))
  return `<div class="signature-book"><div class="signature-book-tools">${control(`${art.icon('ui-apple-jam')}Новый рецепт`,'new-signature','preserves')}${control(`${art.icon('ui-tart')}Фруктовый тарт`,'new-signature','tart')}</div>
    ${recipes.length?`<div class="signature-pages">${recipes.map(({recipe,count})=>{
      const action=getSignatureAction(farm,recipe),batch=action.available&&action.items.every(item=>ingredientCount(farm,item)>=item.quantity*3)
      return `<article class="signature-page" data-recipe="${recipe.id}"><header>${control(recipe.favorite?'★':'☆','favorite-signature',recipe.id,true,`aria-label="${recipe.favorite?'Убрать из избранного':'В избранное'} ${escapeRecipeText(recipe.name)}" aria-pressed="${recipe.favorite}"`)}<input aria-label="Название рецепта" data-recipe-name="${recipe.id}" value="${escapeRecipeText(recipe.name)}" maxlength="32"></header>
      <div class="signature-result">${resultPicture(recipe,art)}<div><strong class="signature-stock">×${count}</strong><span>${signatureProcessingDefinitions[recipe.processing].name}</span><div class="signature-stamps">${recipe.ingredients.map(part=>`<span ${part.trait?`data-trait="${part.trait}"`:''} title="${ingredientName(part)}">${art.icon(ingredientArt(part.id))}<b>${part.quantity}</b></span>`).join('')}</div></div></div>
      <div class="signature-actions">${control('Приготовить ещё','make-signature',recipe.id)}${control('Партия ×3','batch-signature',recipe.id,batch)}${control(`Продать · ${recipe.sellPrice}`,'sell-signature',recipe.id,count>0&&farm.island==='home')}${control('Устроить пикник','use-signature',recipe.id,count>0&&farm.culinary.picnic===null,`title="${signatureProcessingDefinitions[recipe.processing].use}"`)}</div>
      ${farm.island==='village'&&farm.village.built?`<div class="signature-neighbours">${(['bea','finn'] as const).filter(id=>farm.village.residents.includes(id)).map(id=>control(`${art.icon('ui-'+id)}${id==='bea'?'Беа':'Финн'}${farm.culinary.tastings[id].favoriteIds.includes(recipe.id)?' ♥':''}`,'taste-signature',recipe.id,count>0&&farm.culinary.tastings[id].servedOn!==farm.day,`data-resident="${id}"`)).join('')}${control('Ужин вместе','supper-signature',recipe.id,count>0&&farm.village.mealOn!==farm.day&&farm.fish[farm.village.residents.includes('finn')?'seaBass':'perch']>0)}</div>`:''}
      ${!count&&!recipe.favorite?`<button class="signature-forget" type="button" data-action="forget-signature" data-value="${recipe.id}">Удалить пустой рецепт</button>`:''}</article>`
    }).join('')}</div>`:`<div class="recipe-book-empty">${art.icon('ui-signature-bright')}<div>${art.icon('apple')}${art.icon('ui-pear')}${art.icon('strawberry')}${art.icon('blueberry')}</div></div>`}</div>`
}

export function signatureStudio(farm:FarmState,base:SignatureDraft['base'],slots:readonly (SignatureIngredient|null)[],activeSlot:number,art:Icons,intent?:IntentId):string{
  const draft:SignatureDraft={base,ingredients:slots.filter((p):p is SignatureIngredient=>p!==null)},action=getSignatureAction(farm,draft)
  const away=farm.island!=='home'&&farm.island!=='village',upgrade=base==='preserves'&&farm.buildingLevels.farmhouse<2
  const variants=signatureFruitIds.flatMap(id=>traitIds.filter(trait=>(farm.variants[id]?.[trait]??0)>0).map(trait=>({id,quantity:1,trait} as SignatureIngredient)))
  const choices:SignatureIngredient[]=[...signatureFruitIds.map(id=>({id,quantity:1})),...variants]
  const preview = intent && draft.ingredients.length === 2 ? evaluateFood({
    id:'signature:draft',name:'',identity:base,source:'signature',ingredients:draft.ingredients.map(p=>p.id),count:0,sellPrice:0
  }, intent) : undefined
  const fit = preview ? preview.eligible ? '✓ Подходит для просьбы' : base === 'preserves' && intent === 'delicate'
    ? 'Для чаепития разотрите варенье до нежной текстуры'
    : 'Для просьбы нужно: ' + preview.requiredQualities.filter(q=>!preview.qualities.includes(q)).map(q=>qualityNames[q]).join(', ') : ''
  return `<div class="recipe-studio">${fit ? `<p class="signature-request-fit" role="status">${fit}</p>` : ''}<div class="recipe-base-tabs">${(['preserves','tart'] as const).map(kind=>control(`${art.icon(kind==='tart'?'ui-tart':'ui-apple-jam')}${kind==='tart'?'Тарт':'Варенье'}`,'signature-base',kind,true,`aria-pressed="${base===kind}"`)).join('')}</div>
    <div class="recipe-portions">${slots.map((part,index)=>`<button type="button" class="recipe-portion" data-action="signature-slot" data-value="${index}" aria-pressed="${activeSlot===index}" aria-label="${index?'Вторая':'Первая'} порция фруктов">${part?`${art.icon(ingredientArt(part.id))}<span>${ingredientName(part)}</span>`:'<span class="portion-plus" aria-hidden="true">+</span>'}</button>`).join('<span class="portion-join" aria-hidden="true">+</span>')}</div>
    <div class="recipe-fruit-palette">${choices.map(part=>{const count=signaturePortionStock(farm,part);return `<button type="button" data-action="signature-fruit" data-value="${part.id}" ${part.trait?`data-trait="${part.trait}"`:''} data-empty="${count===0}" aria-label="${ingredientName(part)}, в наличии: ${count}">${art.icon(ingredientArt(part.id))}<strong>${ingredientName(part)}</strong><span>×${count}</span></button>`}).join('')}</div>
    ${slots.every(Boolean)?`<ul class="ingredients recipe-cost">${action.items.map(art.stock).join('')}</ul>`:''}
    <footer>${away?control('Домой','signature-home','home'):upgrade?control('Улучшить дом','upgrades',''):control('Готовить','start-signature',base,action.available)}</footer></div>`
}

export function coveControls(farm:FarmState):string{
  const shoreline=farm.shoreline,ecology=getCoveEcology(shoreline,farm.day),choices=shoreline.pending??ecology.choices
  const groups:[keyof CoveChoices,string,string,readonly [string,string][]][]=[['flow','cove-current','Течение',[['sheltered','Тихое'],['open','Открытое']]],['cover','cove-kelp-right','Растения',[['kelp','Водоросли'],['meadow','Луг']]],['refuge','cove-refuge','Берег',[['sand','Песок'],['stones','Камни']]]]
  return `<div class="cove-console"><div class="cove-tools">${groups.map(([key,image,name,options])=>`<fieldset><legend><img src="${import.meta.env.BASE_URL}art/lavender/${image}.webp" alt="">${name}</legend>${options.map(([value,label])=>`<button type="button" data-action="cove-choice" data-value="${key}:${value}" aria-pressed="${choices[key]===value}">${label}</button>`).join('')}</fieldset>`).join('')}</div>
    <p class="cove-effect" role="status">${shoreline.pending?'После ночного прилива: ':shoreline.settled?'Сейчас: ':'После обустройства: '}${choices.cover==='kelp'?'морской окунь чаще':'окунь чаще'} · ${choices.flow==='open'?'больше редкой рыбы на глубине':'медленные косяки'}. ${choices.refuge==='stones'?'Камни укрывают краба и смягчают рывки рыб.':'На песке краб ищет корм.'}</p>
    <div class="cove-footer"><span>${shoreline.pending?'Вернитесь утром — берег изменится':shoreline.settled?`${ecology.fishing.profile==='nursery'?'Заросли для мальков':'Открытый пролив'} · День ${shoreline.settledOn}`:'Выберите обустройство берега'}</span>${control('На рыбалку','cove-fish','')}${control('Домой','sail','home')}</div></div>`
}
