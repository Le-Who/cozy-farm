import { recipePlanningChoices, recipePlanningGuide } from './recipe-planning'
import { recipeDraftKey } from './recipe-draft'
import { getRecipeRepeatGuide, recipeIngredientsDisclosureLabel } from './recipe-repeat-guidance'
import { sortedBookRecipes, visibleBookRecipes, selectedBookId, type RecipeBookView } from './recipe-book-view'
import './recipe-book.css'
import './recipe-repeat-guidance.css'
import {canSailTo,fishDefinitions,getCoveActions,getSignatureAction,getSignatureCookOutput,getVillageMeal,ingredientCount,variantLabel,type FarmState,type StockItem} from './farm'
import {signatureFruitNames,signatureProcessingDefinitions,resolvedCookeryFruit,cookeryFinishTraits,type CookeryResult,type SignatureDraft,type SignatureIngredient,type SignatureRecipe} from './culinary'
import {traitIds,type Trait} from './climate'
import {type CoveChoices,type CoveFishingHabitat} from './shoreline'
import {hasLanternfishDepth} from './fishing-model'
import './culinary-ui.css'
import {ruCount,traitLabel} from './ru'
import {signatureBookCapacity} from './signature-book'
import {harvestPicnicOffer,renderHarvestPicnicRoute} from './harvest-picnic'
import {renderPicnicOffer,renderPicnicStatus} from './picnic-guidance'
import './picnic-guidance.css'
import {getReadySignatureSuppers} from './shared-supper'
import {shopCommissionUsesRecipe} from './shop-commissions'
import {lastPortionShopStock,signatureTastingGuide} from './signature-tasting-guidance'
import {getStoredSignature,storedSignatureValue} from './stored-signature'

import {evaluateFood, qualityNames, type IntentId} from './intent-orders'

type Icons={icon:(name:string,className?:string)=>string;stock:(item:StockItem)=>string}
export const escapeRecipeText=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export const ingredientArt=(id:string)=>id==='pear'?'ui-pear':id==='peach'?'ui-peach-fruit':id
export function signaturePortionStock(farm:FarmState,part:SignatureIngredient):number{
  return part.trait?farm.variants[part.id]?.[part.trait]??0:part.id==='apple'||part.id==='pear'||part.id==='peach'?farm.fruit[part.id]:farm.produce[part.id]
}
const ingredientName=(part:SignatureIngredient)=>part.trait?`${traitLabel(part.trait,part.id)} ${signatureFruitNames[part.id].toLowerCase()}`:signatureFruitNames[part.id]
const control=(text:string,action:string,id:string,enabled=true,extra='',secondary=false)=>`<button type="button" class="dialog-button${secondary?' secondary':''}" data-action="${action}" data-value="${id}" ${enabled?'':'disabled'} ${extra}>${text}</button>`

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

function recipeDraftCard(farm: FarmState, art: Icons): string {
  const draft = farm.recipeDraft
  if (!draft) return ''
  const parts = draft.slots.map(part => part ? ingredientName(part) : 'ещё не выбрано').join(' + ')
  const key = recipeDraftKey(draft)
  const guide = recipePlanningGuide(farm, draft)
  return `<section class="recipe-draft-card" aria-label="Сохранённая задумка"><strong>Задумка: ${draft.base === 'tart' ? 'тарт' : 'варенье'}</strong>
    <p>${parts}</p>
    ${guide ? `<h3>Для задуманного блюда</h3><ul class="ingredients recipe-draft-supplies">${guide.items.map(art.stock).join('')}</ul><p>${guide.missing ? 'Нажмите на недостающий продукт, чтобы узнать, где его взять. Задумка останется в книге.' : 'Все ингредиенты есть. Приготовление выбирается отдельно.'}</p>${!guide.available && !guide.missing ? `<p>${guide.label}</p>` : ''}` : '<p>Выберите ещё одну порцию, чтобы увидеть полный список ингредиентов.</p>'}
    <p>Сохраняется одна задумка: другой состав заменит её. Продукты не отложены и не расходуются при выборе.</p>
    ${control('Продолжить задумку', 'resume-recipe-draft', key)}${control('Сбросить задумку', 'reset-recipe-draft', key)}
  </section>`
}

function recipeBookSupper(farm: FarmState, recipeId: string): string {
  const offer = getReadySignatureSuppers(farm).find(({recipe}) => recipe.id === recipeId)
  const fish = offer?.fish ?? getVillageMeal(farm).fish
  return `<div class="recipe-book-supper">${control('Ужин вместе','supper-signature',recipeId,offer?.available ?? false)}<p>Расход: 1 порция + 1 ${fishDefinitions[fish].name.toLowerCase()}.${farm.village.mealOn===farm.day?' Сегодня общий ужин уже состоялся.':''}</p></div>`
}

const capacityDescription = (canCreate:boolean) => canCreate ? '' : 'aria-describedby="recipe-capacity-note"'

function bookRecipe(farm:FarmState,recipe:SignatureRecipe,art:Icons,view:RecipeBookView):string {
  const beaTasting=signatureTastingGuide(farm,recipe.id,'bea'), shopChoice=lastPortionShopStock(farm,recipe.id)
  const count=farm.culinary.stock[recipe.id]??0, capacity=signatureBookCapacity(farm.culinary)
  const action=getSignatureAction(farm,recipe), batch=action.available&&action.items.every(item=>ingredientCount(farm,item)>=item.quantity*3), stored=getStoredSignature(farm,recipe.id)
  const repeatLabel=(label:string,repeats:1|3,available:boolean)=>{
    if(!available||!Number.isSafeInteger(farm.workToday+1)) return label
    const {portions,fits}=getSignatureCookOutput(farm,repeats,recipe)
    return fits&&portions>repeats?`${label} · ${ruCount(portions,'порция','порции','порций')}`:label
  }
  const guide=getRecipeRepeatGuide(farm,recipe.id)!
  // When distance is the only blocker, travel before scanning already-owned ingredients.
  const homeRouteReady=guide.away&&canSailTo(farm,'home')&&getSignatureAction({...farm,island:'home'},recipe).available
  const homeRoute=guide.away?control('На домашнюю кухню','recipe-repeat-home',recipe.id):''
  const missing=guide.missing.map(item=>{
    const label=item.kind==='variants'?variantLabel(item.item,item.trait).name
      :item.kind==='eggs'?'Яйцо':item.kind==='produce'&&item.item==='wheat'?'Пшеница':'item' in item?signatureFruitNames[item.item as keyof typeof signatureFruitNames]??'Продукт':'Продукт'
    return `${label} ×${item.quantity-ingredientCount(farm,item)}`
  }).join(', ')
  const reason=!guide.available ? guide.away||farm.buildingLevels.farmhouse<(recipe.base==='preserves'?2:1)?guide.label:missing==='Яйцо ×1'?'Не хватает 1 яйца':`Не хватает: ${missing}` : ''
  const opened=(key:string)=>view.disclosures?.includes(key)?' open':''
  return `<article class="signature-page" data-recipe="${recipe.id}">
    <header class="recipe-detail-heading"><textarea aria-label="Название рецепта" data-recipe-name="${recipe.id}" rows="1" maxlength="32">${escapeRecipeText(recipe.name)}</textarea>${control(recipe.favorite?'★':'☆','favorite-signature',recipe.id,true,`aria-label="${recipe.favorite?'Убрать из избранного':'В избранное'} ${escapeRecipeText(recipe.name)}" aria-pressed="${recipe.favorite}"`)}</header>
    <div class="recipe-book-hero"><div class="recipe-book-result">${signatureResultPicture(recipe,art)}<span>${recipe.base==='tart'?'Тарт':'Варенье'} · ${signatureProcessingDefinitions[recipe.processing].name}</span><div class="signature-stamps">${recipe.ingredients.map(part=>`<span ${part.trait?`data-trait="${part.trait}"`:''} title="${ingredientName(part)}">${finishedIcon(art.icon(ingredientArt(part.id)),part.trait?[part.trait]:[])}<b>${part.quantity}</b></span>`).join('')}</div></div>
    <div class="recipe-book-stock"><dl><div><dt>С собой</dt><dd>${count}</dd></div><div><dt>На местном складе</dt><dd>${stored?.stored??0}</dd></div></dl>${stored?control('Забрать 1 порцию','recipe-warehouse-withdraw',storedSignatureValue(stored),true):''}${count>0&&farm.village.built&&!shopChoice?(farm.island==='village'?control('Своя лавка','open-panel','bay-shop'):control('В лавку в гавань','recipe-harbour-shop',recipe.id)):''}</div></div>
    <section class="recipe-book-cooking" aria-labelledby="recipe-cooking-title"><h2 id="recipe-cooking-title" tabindex="-1" data-recipe-focus="cooking">Приготовить точно</h2>
      ${homeRouteReady?homeRoute:''}
      <div class="signature-actions recipe-book-repeat">${control(repeatLabel('Повторить ×1',1,action.available),'make-signature',recipe.id,action.available)}${control(repeatLabel('Партия ×3',3,batch),'batch-signature',recipe.id,batch)}</div>
      ${reason?`<p class="recipe-book-blocker" tabindex="-1" data-recipe-focus="blocker" role="status">${escapeRecipeText(reason)}</p>`:!batch?'<p class="recipe-book-blocker">Для партии ×3 нужно втрое больше каждого ингредиента.</p>':''}
      <section class="recipe-repeat-guide" aria-label="Точный повтор рецепта"><details data-repeat-guide="${recipe.id}"${(reason&&!homeRouteReady)||view.expandedRepeatId===recipe.id?' open':''}><summary>${recipeIngredientsDisclosureLabel}</summary><ul class="ingredients">${guide.items.map(art.stock).join('')}</ul><p class="recipe-repeat-note">Тот же состав, особенности и оформление. Для партии ×3 нужно втрое больше каждого ингредиента.</p></details>${homeRouteReady?'':homeRoute}</section>
      ${control('Готовить вручную','manual-signature',recipe.id,capacity.canCreate,capacityDescription(capacity.canCreate))}
    </section>
    <section class="recipe-book-uses" aria-label="Применить готовые порции"><h2 tabindex="-1" data-recipe-focus="uses">Применить</h2>
      <div class="signature-actions">${control('Пикник · 1 порция','use-signature',recipe.id,count>0&&farm.culinary.picnic===null)}${farm.island==='home'?control('Продать…','sell-signature',recipe.id,count>0):''}</div>
      ${farm.culinary.picnic?'<p class="recipe-book-note">Сначала используйте текущий эффект пикника.</p>':!count?'<p class="recipe-book-note">Нет порций с собой.</p>':''}
      ${recipe.processing==='chunky'&&!farm.culinary.picnic&&count>0?`<p class="recipe-book-note">${harvestPicnicOffer(farm)}</p>`:''}
      ${recipe.processing==='chunky'?renderHarvestPicnicRoute(farm):''}
      <details data-recipe-disclosure="picnic-offer"${opened('picnic-offer')}><summary>Эффект и расход пикника</summary>${renderPicnicOffer(farm,recipe.processing)}</details>
      ${farm.island==='home'?control('Продать лишние ингредиенты','recipe-surplus-choose',recipe.id):''}
      ${farm.island==='village'&&farm.village.built?`<div class="signature-neighbours">${farm.village.residents.some(Boolean)?`<div class="signature-tastings" aria-label="Угощения соседям"><p>Каждый сосед пробует одно угощение за игровой день.</p>${(['bea','finn'] as const).map(id=>{
        const tasting=id==='bea'?beaTasting:signatureTastingGuide(farm,recipe.id,id)
        if(!tasting)return ''
        const noteId=`tasting-${recipe.id}-${id}`
        const icon=art.icon('ui-'+id)
        const taste=control(`${tasting.bakeFirst?'':icon}${tasting.label}`,'taste-signature',recipe.id,tasting.available,`data-resident="${id}"${tasting.reason||tasting.favoriteNote?` aria-describedby="${noteId}"`:''}`,!!beaTasting?.bakeFirst)
        return `<div class="signature-tasting">${tasting.bakeFirst?`<div class="signature-bake-choice">${control(icon+'К Беа · выпечка ×4','tasting-bakery',recipe.id)}${taste}</div>`:taste}${tasting.reason||tasting.favoriteNote?`<p id="${noteId}">${tasting.reason}${tasting.reason&&tasting.favoriteNote?' ':''}${tasting.knownFavorite?'♥ ':''}${tasting.favoriteNote}</p>`:''}</div>`
      }).join('')}${shopChoice?control('На прилавок…','recipe-shop-stock',recipe.id,true,'',true):''}</div>`:''}${recipeBookSupper(farm,recipe.id)}</div>`:''}
    </section>${!count&&!recipe.favorite&&!shopCommissionUsesRecipe(farm.shopCommissions,recipe.id)?`<button class="signature-forget" type="button" data-action="forget-signature" data-value="${recipe.id}">Удалить пустой рецепт</button>`:''}
  </article>`
}

export function recipeBookSearchStatus(farm:FarmState,view:RecipeBookView):string {
  return view.query?.trim() ? `Найдено ${visibleBookRecipes(farm,view).length} из ${farm.culinary.recipes.length}` : ''
}
export function recipeBookResults(farm:FarmState,art:Icons,view:RecipeBookView):string {
  const recipes=visibleBookRecipes(farm,view),selectedId=selectedBookId(farm,view)
  const traits=(recipe:SignatureRecipe)=>[...new Set(recipe.ingredients.filter(part=>part.trait).map(ingredientName))].join(' · ')
  const traitHint=(recipe:SignatureRecipe)=>{
    const label=traits(recipe)
    return label&&farm.culinary.recipes.some(other=>other.name===recipe.name&&traits(other)!==label)
      ? `<small class="recipe-book-traits">${escapeRecipeText(label)}</small>` : ''
  }
  return `${recipes.map(recipe=>`<div class="recipe-book-row" data-selected="${recipe.id===selectedId}"><button type="button" class="recipe-book-select" data-action="select-recipe" data-value="${recipe.id}" aria-pressed="${recipe.id===selectedId}"><span class="recipe-book-thumb">${signatureResultPicture(recipe,art)}</span><span><strong>${escapeRecipeText(recipe.name)}</strong>${traitHint(recipe)}<small>С собой ${farm.culinary.stock[recipe.id]??0}</small></span><span aria-hidden="true">›</span></button>${control(recipe.favorite?'★':'☆','favorite-signature',recipe.id,true,`aria-label="${recipe.favorite?'Убрать из избранного':'В избранное'} ${escapeRecipeText(recipe.name)}" aria-pressed="${recipe.favorite}"`)}</div>`).join('')}${!recipes.length&&view.query?.trim()?'<p class="recipe-book-search-empty">По этому названию рецептов нет. Измените запрос или очистите поиск.</p>':''}`
}

export function signatureBook(farm:FarmState,art:Icons,state:RecipeBookView|string={}):string {
  const view:RecipeBookView=typeof state==='string'?{selectedId:state,expandedRepeatId:state,mode:'detail'}:state
  const recipes=sortedBookRecipes(farm), selectedId=selectedBookId(farm,view), selected=recipes.find(recipe=>recipe.id===selectedId), capacity=signatureBookCapacity(farm.culinary)
  const draft=farm.recipeDraft
  const status=renderPicnicStatus(farm)
  return `<div class="signature-book" data-selected-recipe="${selectedId??''}" data-mode="${view.mode??'index'}">
    ${capacity.message?`<p id="recipe-capacity-note" class="signature-capacity" role="status">${capacity.message}</p>`:''}
    <section class="recipe-book-index" aria-label="Список рецептов">${status?`<details class="recipe-book-picnic recipe-book-picnic-index" data-recipe-disclosure="picnic-status-index"${view.disclosures?.includes('picnic-status-index')?' open':''}><summary>Пикник действует · до сна</summary>${status}</details>`:''}<div class="recipe-book-tools"><span class="recipe-book-capacity" aria-label="Рецептов в книге: ${recipes.length} из 24">${recipes.length}/24</span><div class="signature-book-tools">${control(`${art.icon('ui-apple-jam')}Варенье +`,'new-signature','preserves',capacity.canCreate,capacityDescription(capacity.canCreate))}${control(`${art.icon('ui-tart')}Тарт +`,'new-signature','tart',capacity.canCreate,capacityDescription(capacity.canCreate))}</div></div>
      <div class="recipe-book-search"><label for="recipe-book-query">Найти рецепт<input id="recipe-book-query" type="search" data-recipe-query maxlength="100" value="${escapeRecipeText(view.query??'')}" placeholder="Название рецепта" aria-controls="recipe-book-results" autocomplete="off"></label>${control('Очистить','recipe-search-clear','',Boolean(view.query))}</div>
      <p class="recipe-book-search-status" role="status" aria-live="polite">${recipeBookSearchStatus(farm,view)}</p>
      ${draft?`<button class="recipe-book-draft" type="button" data-action="select-recipe" data-value="draft" aria-pressed="${selectedId==='draft'}"><strong>Черновик</strong><span>${draft.slots.map(part=>part?ingredientName(part):'ещё не выбрано').join(' + ')}</span><span aria-hidden="true">›</span></button>`:''}
      <div class="recipe-book-list" id="recipe-book-results">${recipeBookResults(farm,art,view)}</div>
      ${!recipes.length&&!draft?'<p class="recipe-book-note">Сохранённых рецептов пока нет. Начните с варенья или тарта.</p>':''}
    </section>
    <section class="recipe-book-detail" aria-label="Выбранный рецепт">${status?`<details class="recipe-book-picnic" data-recipe-disclosure="picnic-status"${view.disclosures?.includes('picnic-status')?' open':''}><summary>Пикник действует · до сна</summary>${status}</details>`:''}${selected?bookRecipe(farm,selected,art,view):selectedId==='draft'?recipeDraftCard(farm,art):`<div class="recipe-book-empty">${art.icon('ui-signature-bright')}<p>Ваши рецепты будут здесь.</p></div>`}</section>
  </div>`
}

export function signatureStudio(farm:FarmState,base:SignatureDraft['base'],slots:readonly (SignatureIngredient|null)[],activeSlot:number,art:Icons,intent?:IntentId):string{
  const draft:SignatureDraft={base,ingredients:slots.filter((p):p is SignatureIngredient=>p!==null)},action=getSignatureAction(farm,draft)
  const capacity=signatureBookCapacity(farm.culinary)
  const away=farm.island!=='home'&&farm.island!=='village',upgrade=base==='preserves'&&farm.buildingLevels.farmhouse<2
  const choices = recipePlanningChoices(farm)
  const preview = intent && draft.ingredients.length === 2 ? evaluateFood({
    id:'signature:draft',name:'',identity:base,source:'signature',ingredients:draft.ingredients.map(p=>p.id),count:0,sellPrice:0
  }, intent) : undefined
  const fit = preview ? preview.eligible ? '✓ Подходит для просьбы' : base === 'preserves' && intent === 'delicate'
    ? 'Для чаепития разотрите варенье до нежной текстуры'
    : 'Для просьбы нужно: ' + preview.requiredQualities.filter(q=>!preview.qualities.includes(q)).map(q=>qualityNames[q]).join(', ') : ''
  return `<div class="recipe-studio">${capacity.message?`<p class="signature-capacity" role="status">${capacity.message}</p>${control('Мои рецепты','recipe-book-return','')}`:''}${fit ? `<p class="signature-request-fit" role="status">${fit}</p>` : ''}<div class="recipe-base-tabs">${(['preserves','tart'] as const).map(kind=>control(`${art.icon(kind==='tart'?'ui-tart':'ui-apple-jam')}${kind==='tart'?'Тарт':'Варенье'}`,'signature-base',kind,true,`aria-pressed="${base===kind}"`)).join('')}</div>
    <div class="recipe-portions">${slots.map((part,index)=>`<button type="button" class="recipe-portion" data-action="signature-slot" data-value="${index}" aria-pressed="${activeSlot===index}" aria-label="${index?'Вторая':'Первая'} порция фруктов">${part?`${finishedIcon(art.icon(ingredientArt(part.id)),part.trait?[part.trait]:[])}<span>${ingredientName(part)}</span>`:'<span class="portion-plus" aria-hidden="true">+</span>'}</button>`).join('<span class="portion-join" aria-hidden="true">+</span>')}</div>
    <p class="recipe-planning-help">Можно задумать блюдо заранее: выберите фрукты и ягоды, даже если их пока нет. Выбор запоминается в книге, продукты не расходуются.</p>
    <div class="recipe-fruit-palette">${choices.map(part=>{const count=signaturePortionStock(farm,part);return `<button type="button" data-action="signature-fruit" data-value="${part.id}" ${part.trait?`data-trait="${part.trait}"`:''} data-empty="${count===0}" aria-label="Выбрать: ${ingredientName(part)}, в наличии: ${count}${count === 0 ? ", можно добавить в задумку" : ""}">${finishedIcon(art.icon(ingredientArt(part.id)),part.trait?[part.trait]:[])}<strong>${ingredientName(part)}</strong><span>×${count}</span></button>`}).join('')}</div>
    ${slots.every(Boolean)?`<ul class="ingredients recipe-cost">${action.items.map(art.stock).join('')}</ul>${!action.available ? `<p class="recipe-planning-help">${action.label} Нажмите недостающий продукт, чтобы найти его, или вернитесь к задумке позже.</p>` : ''}`:''}
    ${farm.recipeDraft && farm.recipeDraft.base === base && JSON.stringify(farm.recipeDraft.slots) === JSON.stringify(slots) ? control('К задумке в книге', 'recipe-book-return', 'draft') : ''}
    <footer>${away?control('Домой','signature-home','home'):upgrade?control('Улучшить дом','upgrades',''):control('Готовить','start-signature',base,action.available&&capacity.canCreate)}</footer></div>`
}

const coveChoiceSummary=(choices:CoveChoices)=>`${choices.flow==='open'?'Открытое течение':'Тихое течение'} · ${choices.cover==='kelp'?'водоросли':'луг'} · ${choices.refuge==='stones'?'камни':'песок'}`
function coveEffectSummary(habitat:CoveFishingHabitat):string{
  const flow=habitat.profile==='channel'?'больше редкой рыбы на глубине':'медленные косяки'
  const lantern=hasLanternfishDepth(habitat)?'может встретиться рыба-фонарь':'для рыбы-фонаря мелко'
  return `${habitat.cover==='kelp'?'Обычно морской окунь, иногда окунь':'Окунь чаще'} · ${flow}; ${lantern}. ${habitat.refuge==='stones'?'Камни укрывают краба и смягчают рывки рыб.':'На песке краб ищет корм.'}`
}
export function coveControls(farm:FarmState, observing=false):string{
  const shoreline=farm.shoreline,action=getCoveActions(farm),{ecology,choices,forecast}=action
  const birdDescription = ecology.animals.egret.mode === 'wade' ? 'Цапля выходит на мелководье.' : 'Цапля наблюдает с насеста.'
  const groups:[keyof CoveChoices,string,string,readonly [string,string][]][]=[['flow','cove-current','Течение',[['sheltered','Тихое'],['open','Открытое']]],['cover','cove-kelp-right','Растения',[['kelp','Водоросли'],['meadow','Луг']]],['refuge','cove-refuge','Берег',[['sand','Песок'],['stones','Камни']]]]
  return `<div class="cove-console"><div class="cove-tools">${groups.map(([key,image,name,options])=>`<fieldset><legend><img src="${import.meta.env.BASE_URL}art/lavender/${image}.webp" alt="">${name}</legend>${options.map(([value,label])=>`<button type="button" data-action="cove-choice" data-value="${key}:${value}" aria-pressed="${choices[key]===value}">${label}</button>`).join('')}</fieldset>`).join('')}</div>
    ${action.appliedToday?'<p class="cove-confirmation" role="status">Утренний прилив применил план. Обустройство берега готово.</p>':''}
    <p class="cove-effect"><strong>Сейчас:</strong> ${coveChoiceSummary(ecology.choices)}. ${shoreline.settled?coveEffectSummary(ecology.fishing):'Естественный берег.'}</p>
    ${forecast?`<p class="cove-effect cove-forecast" role="status"><strong>После прилива, день ${forecast.day}:</strong> ${coveChoiceSummary(forecast.ecology.choices)}. ${coveEffectSummary(forecast.ecology.fishing)}</p>
      <div class="cove-plan"><span>Прилив наступит после отдыха дома.</span>${control('Отменить план','cove-cancel',action.planKey!)}</div>`:''}
    <div class="cove-footer"><span>${shoreline.pending?'':shoreline.settled?`Обустройство действует с дня ${shoreline.settledOn}`:'Выберите обустройство берега'}</span>${action.available ? control('Понаблюдать за цаплей','cove-watch','',true,`aria-pressed="${observing}" aria-description="${birdDescription}"`) : ''}${control('На рыбалку','cove-fish','')}${control('Домой','sail','home')}</div></div>`
}
