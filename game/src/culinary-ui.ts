import { recipeDraftKey } from './recipe-draft'
import { renderRecipeRepeatGuide } from './recipe-repeat-guidance'
import './recipe-repeat-guidance.css'
import {getCoveActions,getSignatureAction,getSignatureStock,ingredientCount,type FarmState,type StockItem} from './farm'
import {signatureFruitIds,signatureFruitNames,signatureProcessingDefinitions,resolvedCookeryFruit,cookeryFinishTraits,type CookeryResult,type SignatureDraft,type SignatureIngredient,type SignatureRecipe} from './culinary'
import {traitIds,type Trait} from './climate'
import {type CoveChoices} from './shoreline'
import './culinary-ui.css'
import {traitLabel} from './ru'
import {signatureBookCapacity} from './signature-book'
import {renderPicnicOffer,renderPicnicStatus} from './picnic-guidance'
import './picnic-guidance.css'
import {signatureTastingGuide} from './signature-tasting-guidance'
import {getStoredSignature,storedSignatureValue} from './stored-signature'

import {evaluateFood, qualityNames, type IntentId} from './intent-orders'

type Icons={icon:(name:string,className?:string)=>string;stock:(item:StockItem)=>string}
export const escapeRecipeText=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export const ingredientArt=(id:string)=>id==='pear'?'ui-pear':id==='peach'?'ui-peach-fruit':id
export function signaturePortionStock(farm:FarmState,part:SignatureIngredient):number{
  return part.trait?farm.variants[part.id]?.[part.trait]??0:part.id==='apple'||part.id==='pear'||part.id==='peach'?farm.fruit[part.id]:farm.produce[part.id]
}
const ingredientName=(part:SignatureIngredient)=>part.trait?`${traitLabel(part.trait,part.id)} ${signatureFruitNames[part.id].toLowerCase()}`:signatureFruitNames[part.id]
const control=(text:string,action:string,id:string,enabled=true,extra='')=>`<button type="button" class="dialog-button" data-action="${action}" data-value="${id}" ${enabled?'':'disabled'} ${extra}>${text}</button>`

export function finishedIcon(markup:string,traits:readonly Trait[],surface:'fruit'|'jar'='fruit'):string{
 const finish=traitIds.filter(trait=>traits.includes(trait)).join(' ')
 return finish?markup.replace(/<img\b([^>]*)>/,`<img $1 data-finish="${finish}"${surface==='jar'?' data-surface="jar"':''}>`):markup
}
export function cookeryResultPicture(result:CookeryResult,ingredients:readonly SignatureIngredient[],art:Pick<Icons,'icon'>,processing=result.processing??'bright'):string{
  if(result.family==='preserves')return finishedIcon(art.icon(`ui-signature-${processing}`,'signature-jar'),cookeryFinishTraits(result,ingredients),'jar')
  const topping=(id:string)=>id==='apple'?'apple-slice':id==='pear'?'pear-piece':id==='peach'?'peach-slice':id
  const points=resolvedCookeryFruit(result,ingredients),fruit=points.length?points.map(point=>point.ingredientId):ingredients.map(part=>part.id),berry=fruit[0]
  const base=fruit.every(id=>id===berry)&&['strawberry','blueberry','raspberry'].includes(berry)?`tart-${berry}`:'tart'
  return `<span class="signature-tart"><img class="signature-tart-base" src="${import.meta.env.BASE_URL}art/lavender/cookery/${base}.webp" alt="">${points.map(p=>`<img class="signature-topping" ${p.trait?`data-finish="${p.trait}"`:''} src="${import.meta.env.BASE_URL}art/lavender/cookery/${topping(p.ingredientId)}.webp" alt="" style="left:${50+p.x*27}%;top:${46+p.y*18}%;transform:translate(-50%,-50%) rotate(${p.angle}rad)">`).join('')}</span>`
}
export function signatureResultPicture(recipe:SignatureRecipe,art:Pick<Icons,'icon'>):string{
 return cookeryResultPicture(recipe.result,recipe.ingredients,art,recipe.processing)
}

function recipeDraftCard(farm: FarmState): string {
  const draft = farm.recipeDraft
  if (!draft) return ''
  const parts = draft.slots.map(part => part ? ingredientName(part) : 'ещё не выбрано').join(' + ')
  const key = recipeDraftKey(draft)
  return `<section class="recipe-draft-card" aria-label="Сохранённая задумка"><strong>Задумка: ${draft.base === 'tart' ? 'тарт' : 'варенье'}</strong>
    <p>${parts}</p><p>Сохраняется одна задумка: выбор другого состава заменит её. Продукты не отложены; наличие проверяется при возвращении.</p>
    ${control('Продолжить задумку', 'resume-recipe-draft', key)}${control('Сбросить задумку', 'reset-recipe-draft', key)}
  </section>`
}

export function signatureBook(farm:FarmState,art:Icons,expandedRepeatId?:string):string{
  const recipes=getSignatureStock(farm).sort((a,b)=>Number(b.recipe.favorite)-Number(a.recipe.favorite)||b.recipe.createdOn-a.recipe.createdOn||Number(b.recipe.id.slice(1))-Number(a.recipe.id.slice(1)))
  const capacity=signatureBookCapacity(farm.culinary)
  return `<div class="signature-book">${recipeDraftCard(farm)}${renderPicnicStatus(farm)}${capacity.message?`<p class="signature-capacity" role="status">${capacity.message}</p>`:''}<div class="signature-book-tools">${control(`${art.icon('ui-apple-jam')}Новый рецепт`,'new-signature','preserves',capacity.canCreate)}${control(`${art.icon('ui-tart')}Фруктовый тарт`,'new-signature','tart',capacity.canCreate)}</div>
    ${recipes.length?`<div class="signature-pages">${recipes.map(({recipe,count})=>{
      const action=getSignatureAction(farm,recipe),batch=action.available&&action.items.every(item=>ingredientCount(farm,item)>=item.quantity*3),stored=getStoredSignature(farm,recipe.id)
      return `<article class="signature-page" data-recipe="${recipe.id}"><header>${control(recipe.favorite?'★':'☆','favorite-signature',recipe.id,true,`aria-label="${recipe.favorite?'Убрать из избранного':'В избранное'} ${escapeRecipeText(recipe.name)}" aria-pressed="${recipe.favorite}"`)}<input aria-label="Название рецепта" data-recipe-name="${recipe.id}" value="${escapeRecipeText(recipe.name)}" maxlength="32"></header>
      <div class="signature-result">${signatureResultPicture(recipe,art)}<div><strong class="signature-stock">×${count}</strong><span>${signatureProcessingDefinitions[recipe.processing].name}</span><div class="signature-stamps">${recipe.ingredients.map(part=>`<span ${part.trait?`data-trait="${part.trait}"`:''} title="${ingredientName(part)}">${finishedIcon(art.icon(ingredientArt(part.id)),part.trait?[part.trait]:[])}<b>${part.quantity}</b></span>`).join('')}</div></div></div>
      ${stored?`<div class="signature-warehouse"><p>Готовых порций на местном складе: ${stored.stored}. Готовить заново не нужно.</p>${control('Забрать со склада · 1 порция','recipe-warehouse-withdraw',storedSignatureValue(stored))}</div>`:''}
      ${renderPicnicOffer(farm,recipe.processing)}<div class="signature-actions">${control('Повторить ×1','make-signature',recipe.id,action.available)}${control('Партия ×3','batch-signature',recipe.id,batch)}${control('Готовить вручную','manual-signature',recipe.id,capacity.canCreate)}${control('Продать…','sell-signature',recipe.id,count>0&&farm.island==='home')}${control('Устроить пикник · 1 порция','use-signature',recipe.id,count>0&&farm.culinary.picnic===null,`title="${signatureProcessingDefinitions[recipe.processing].use}"`)}</div>
      ${renderRecipeRepeatGuide(farm,recipe.id,art.stock,expandedRepeatId===recipe.id)}
      ${farm.island==='village'&&farm.village.built?`<div class="signature-neighbours">${farm.village.residents.some(Boolean)?`<div class="signature-tastings" aria-label="Угощения соседям"><p>Каждый сосед пробует одно угощение за игровой день.</p>${(['bea','finn'] as const).map(id=>{
        const tasting=signatureTastingGuide(farm,recipe.id,id)
        if(!tasting)return ''
        const noteId=`tasting-${recipe.id}-${id}`
        return `<div class="signature-tasting">${control(`${art.icon('ui-'+id)}${tasting.label}`,'taste-signature',recipe.id,tasting.available,`data-resident="${id}"${tasting.reason||tasting.favoriteNote?` aria-describedby="${noteId}"`:''}`)}${tasting.reason||tasting.favoriteNote?`<p id="${noteId}">${tasting.reason}${tasting.reason&&tasting.favoriteNote?' ':''}${tasting.knownFavorite?'♥ ':''}${tasting.favoriteNote}</p>`:''}</div>`
      }).join('')}</div>`:''}${control('Ужин вместе','supper-signature',recipe.id,count>0&&farm.village.mealOn!==farm.day&&farm.fish[farm.village.residents.includes('finn')?'seaBass':'perch']>0)}</div>`:''}
      ${!count&&!recipe.favorite?`<button class="signature-forget" type="button" data-action="forget-signature" data-value="${recipe.id}">Удалить пустой рецепт</button>`:''}</article>`
    }).join('')}</div>`:`<div class="recipe-book-empty">${art.icon('ui-signature-bright')}<div>${art.icon('apple')}${art.icon('ui-pear')}${art.icon('strawberry')}${art.icon('blueberry')}</div></div>`}</div>`
}

export function signatureStudio(farm:FarmState,base:SignatureDraft['base'],slots:readonly (SignatureIngredient|null)[],activeSlot:number,art:Icons,intent?:IntentId):string{
  const draft:SignatureDraft={base,ingredients:slots.filter((p):p is SignatureIngredient=>p!==null)},action=getSignatureAction(farm,draft)
  const capacity=signatureBookCapacity(farm.culinary)
  const away=farm.island!=='home'&&farm.island!=='village',upgrade=base==='preserves'&&farm.buildingLevels.farmhouse<2
  const variants=signatureFruitIds.flatMap(id=>traitIds.filter(trait=>(farm.variants[id]?.[trait]??0)>0).map(trait=>({id,quantity:1,trait} as SignatureIngredient)))
  const choices:SignatureIngredient[]=[...signatureFruitIds.map(id=>({id,quantity:1})),...variants]
  const preview = intent && draft.ingredients.length === 2 ? evaluateFood({
    id:'signature:draft',name:'',identity:base,source:'signature',ingredients:draft.ingredients.map(p=>p.id),count:0,sellPrice:0
  }, intent) : undefined
  const fit = preview ? preview.eligible ? '✓ Подходит для просьбы' : base === 'preserves' && intent === 'delicate'
    ? 'Для чаепития разотрите варенье до нежной текстуры'
    : 'Для просьбы нужно: ' + preview.requiredQualities.filter(q=>!preview.qualities.includes(q)).map(q=>qualityNames[q]).join(', ') : ''
  return `<div class="recipe-studio">${capacity.message?`<p class="signature-capacity" role="status">${capacity.message}</p>${control('Мои рецепты','open-panel','recipes')}`:''}${fit ? `<p class="signature-request-fit" role="status">${fit}</p>` : ''}<div class="recipe-base-tabs">${(['preserves','tart'] as const).map(kind=>control(`${art.icon(kind==='tart'?'ui-tart':'ui-apple-jam')}${kind==='tart'?'Тарт':'Варенье'}`,'signature-base',kind,true,`aria-pressed="${base===kind}"`)).join('')}</div>
    <div class="recipe-portions">${slots.map((part,index)=>`<button type="button" class="recipe-portion" data-action="signature-slot" data-value="${index}" aria-pressed="${activeSlot===index}" aria-label="${index?'Вторая':'Первая'} порция фруктов">${part?`${finishedIcon(art.icon(ingredientArt(part.id)),part.trait?[part.trait]:[])}<span>${ingredientName(part)}</span>`:'<span class="portion-plus" aria-hidden="true">+</span>'}</button>`).join('<span class="portion-join" aria-hidden="true">+</span>')}</div>
    <div class="recipe-fruit-palette">${choices.map(part=>{const count=signaturePortionStock(farm,part);return `<button type="button" data-action="signature-fruit" data-value="${part.id}" ${part.trait?`data-trait="${part.trait}"`:''} data-empty="${count===0}" aria-label="${ingredientName(part)}, в наличии: ${count}">${finishedIcon(art.icon(ingredientArt(part.id)),part.trait?[part.trait]:[])}<strong>${ingredientName(part)}</strong><span>×${count}</span></button>`}).join('')}</div>
    ${slots.every(Boolean)?`<ul class="ingredients recipe-cost">${action.items.map(art.stock).join('')}</ul>`:''}
    <footer>${away?control('Домой','signature-home','home'):upgrade?control('Улучшить дом','upgrades',''):control('Готовить','start-signature',base,action.available&&capacity.canCreate)}</footer></div>`
}

const coveChoiceSummary=(choices:CoveChoices)=>`${choices.flow==='open'?'Открытое течение':'Тихое течение'} · ${choices.cover==='kelp'?'водоросли':'луг'} · ${choices.refuge==='stones'?'камни':'песок'}`
const coveEffectSummary=(choices:CoveChoices)=>`${choices.cover==='kelp'?'Морской окунь чаще':'Окунь чаще'} · ${choices.flow==='open'?'больше редкой рыбы на глубине':'медленные косяки'}. ${choices.refuge==='stones'?'Камни укрывают краба и смягчают рывки рыб.':'На песке краб ищет корм.'}`
export function coveControls(farm:FarmState):string{
  const shoreline=farm.shoreline,action=getCoveActions(farm),{ecology,choices,forecast}=action
  const groups:[keyof CoveChoices,string,string,readonly [string,string][]][]=[['flow','cove-current','Течение',[['sheltered','Тихое'],['open','Открытое']]],['cover','cove-kelp-right','Растения',[['kelp','Водоросли'],['meadow','Луг']]],['refuge','cove-refuge','Берег',[['sand','Песок'],['stones','Камни']]]]
  return `<div class="cove-console"><div class="cove-tools">${groups.map(([key,image,name,options])=>`<fieldset><legend><img src="${import.meta.env.BASE_URL}art/lavender/${image}.webp" alt="">${name}</legend>${options.map(([value,label])=>`<button type="button" data-action="cove-choice" data-value="${key}:${value}" aria-pressed="${choices[key]===value}">${label}</button>`).join('')}</fieldset>`).join('')}</div>
    ${action.appliedToday?'<p class="cove-confirmation" role="status">Утренний прилив применил план. Обустройство берега готово.</p>':''}
    <p class="cove-effect"><strong>Сейчас:</strong> ${coveChoiceSummary(ecology.choices)}. ${shoreline.settled?coveEffectSummary(ecology.choices):'Естественный берег.'}</p>
    ${forecast?`<p class="cove-effect cove-forecast" role="status"><strong>После прилива, день ${forecast.day}:</strong> ${coveChoiceSummary(forecast.ecology.choices)}. ${coveEffectSummary(forecast.ecology.choices)}</p>
      <div class="cove-plan"><span>План ещё не применён. Прилив наступит после отдыха дома.</span>${control('Отменить план','cove-cancel',action.planKey!)}</div>`:''}
    <div class="cove-footer"><span>${shoreline.pending?'До прилива действует нынешний берег':shoreline.settled?`Обустройство действует с дня ${shoreline.settledOn}`:'Выберите обустройство берега'}</span>${control('На рыбалку','cove-fish','')}${control('Домой','sail','home')}</div></div>`
}
