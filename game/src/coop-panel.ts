import { eggsPerBasket, eggsPerCrate, feedBagPrice, feedBagSize, getCoopMorning, getEggUnpackAction, getRareIncubatorEgg, incubationDays, maxChickenHappiness, maxFlockSize, type FarmState, type StockItem } from './farm.ts'
import { renderCoopMorning } from './coop-preview.ts'
import { canMixBedtimeFeed, getChickenFeedMix } from './chicken-feed.ts'
import { henFriends } from './hen-friendship.ts'
import { ruCount } from './ru.ts'
import { getLocalWarehouseSupply, warehouseConfirmationValue } from './warehouse-guidance.ts'

type CoopComponents = {
  icon(id:string):string
  row(image:string,name:string,detail:string,actions?:string):string
  button(label:string,action:string,enabled?:boolean,options?:{secondary?:boolean;value?:string|number;context?:string}):string
  feedRow(alternate?:string):string
}

export function hasIncubatorBasketSource(farm:FarmState):boolean {
  return farm.coopSpecialization==='hatchery' && farm.flockSize<maxFlockSize && farm.hatchDay===null
    && farm.eggs===0 && farm.eggsReady<=Number(farm.eggTrait!==null) && getEggUnpackAction(farm,'basket').available
}

/** A loose local egg only; taking it and inserting it remain separate actions. */
export function getIncubatorWarehouseEgg(farm:FarmState) {
  if (farm.island !== 'home' || farm.coopSpecialization !== 'hatchery' || farm.flockSize >= maxFlockSize
    || farm.hatchDay !== null || farm.eggs > 0 || farm.eggsReady > Number(farm.eggTrait !== null)
    || getEggUnpackAction(farm,'basket').available || getEggUnpackAction(farm,'crate').available) return
  const request:StockItem = {kind:'eggs',quantity:1}
  const supply = getLocalWarehouseSupply(farm, request)
  if (supply) return {request, supply, token:`${farm.day}:${warehouseConfirmationValue(supply)}`}
}

/** Bring one local basket into the existing unpacking flow; don't open it here. */
export function getIncubatorWarehouseBasket(farm:FarmState) {
  if (farm.island !== 'home' || farm.coopSpecialization !== 'hatchery' || farm.flockSize >= maxFlockSize
    || farm.hatchDay !== null || farm.eggs !== 0 || farm.eggsReady > Number(farm.eggTrait !== null)
    || farm.eggBaskets !== 0 || getEggUnpackAction(farm,'crate').available || getIncubatorWarehouseEgg(farm)) return
  const request:StockItem = {kind:'eggBaskets',quantity:1}
  const supply = getLocalWarehouseSupply(farm, request)
  if (supply && getEggUnpackAction({...farm,eggBaskets:supply.quantity},'basket').available)
    return {request, supply, token:`${farm.day}:${warehouseConfirmationValue(supply)}`}
}

/** The fifth hen is really owned and hasn't had her first interaction. Not a saved event. */
export function getIncubatorNewHen(farm:FarmState):number|undefined {
  const id=maxFlockSize-1
  if (farm.island==='home' && farm.coopSpecialization==='hatchery' && farm.flockSize===maxFlockSize
    && farm.hatchDay===null && farm.henFriendship.hens[id]?.points===0) return id
}

/** Compare buying against the ordinary mixes that can actually solve today's shortage. */
export function getCoopFeedComparison(farm:FarmState) {
  if (farm.feed !== 0 || farm.chickensFed) return
  const garden=getChickenFeedMix(farm,'garden'), orchard=getChickenFeedMix(farm,'orchard')
  const choice=garden.available && orchard.available ? 'both' : garden.available ? 'garden' : orchard.available ? 'orchard' : null
  if (choice) return {garden,orchard,choice}
}

function renderCoopFeedComparison(farm:FarmState, icon:CoopComponents['icon'], mixes:NonNullable<ReturnType<typeof getCoopFeedComparison>>) {
  const portions=(count:number)=>ruCount(count,'порция','порции','порций')
  const mixButton=(recipe:'garden'|'orchard')=>{
    const mix=mixes[recipe], cost=`Пшеница ×1 + ${mix.extraName.toLowerCase()} ×1`
    return `<button type="button" class="dialog-button secondary" data-action="mix-chicken-feed" data-value="${recipe}" aria-label="Смешать: ${mix.name}, ${portions(mix.portions)}. ${cost}">Смешать · ${portions(mix.portions)}<br><small>${cost}</small></button>`
  }
  // Leave the old right-side Feed action lane clear of all acquisition buttons,
  // even when the dialog recenters after a successful purchase or mix.
  return `<li class="dialog-row" data-coop-feed-compare="${mixes.choice}" tabindex="-1" aria-label="Корм для кур">
    <span class="dialog-icon">${icon('tool-feed')}</span><span class="dialog-row-copy"><strong>Корм для кур</strong></span><small>В запасе ${farm.feed}</small>
    <div class="coop-feed-acquire" role="group" aria-label="Пополнить запас корма">
      <button type="button" class="dialog-button secondary" data-action="buy-feed"${farm.coins>=feedBagPrice?'':' disabled'}>Купить · ${portions(feedBagSize)}<br><small>${ruCount(feedBagPrice,'монета','монеты','монет')}</small></button>
      ${mixes.garden.available?mixButton('garden'):''}${mixes.orchard.available?mixButton('orchard'):''}
    </div></li>`
}

/** Existing actions, grouped by current daily work before optional services. No saved UI state. */
export function renderCoopPanel(farm:FarmState,{icon,row,button,feedRow}:CoopComponents, desktopFeed=false):string {
  const morning=getCoopMorning(farm)
  const mixNow=canMixBedtimeFeed(farm)
  const compare=desktopFeed && getCoopFeedComparison(farm)
  const singleMix=compare && compare.choice!=='both'
  const mixChoice=farm.buildingLevels.coop>=2?button('Выбрать смесь', 'chicken-feed-open',true,{secondary:true}):''
  const capacity=morning.blockedIfFed?' · соберите до отдыха':''
  const rare=getRareIncubatorEgg(farm)
  const storedEgg=getIncubatorWarehouseEgg(farm)
  const storedBasket=!storedEgg&&getIncubatorWarehouseBasket(farm)
  const hatchery=farm.island==='home' && farm.coopSpecialization==='hatchery'
  const canIncubate=hatchery && farm.flockSize<maxFlockSize
  const fromNest=canIncubate && farm.hatchDay===null && farm.eggs===0 && farm.eggsReady>Number(farm.eggTrait!==null)
  const newcomer=getIncubatorNewHen(farm)
  const basketSource=hasIncubatorBasketSource(farm), directBasket=desktopFeed && basketSource
  const unpackBasket=getEggUnpackAction(farm,'basket')
  const nights=ruCount(incubationDays,'ночь','ночи','ночей')
  const collect=row('egg','Яйца',`В гнёздах: ${farm.eggsReady}/${morning.capacity}${capacity}`,button('Собрать','collect',farm.eggsReady>0,{context:'яйца'}))
  const incubation=canIncubate
    ?row('egg','Инкубатор',farm.hatchDay===null? `${storedEgg?'Обычное яйцо на складе':fromNest||storedBasket?'1 обычное яйцо':rare?'Из припасов':`1 обычное яйцо · в запасе ${farm.eggs}`} · ${nights}`:`До вылупления: ${ruCount(farm.hatchDay-farm.day,'ночь','ночи','ночей')}`,
      farm.hatchDay!==null?button('К отдыху дома','visit-rest',true,{secondary:true})
        :basketSource?directBasket?button(unpackBasket.label,'unpack-egg-basket',true,{secondary:true,context:'корзина яиц'})
          :button('К корзине яиц','incubator-basket',true,{secondary:true})
        :storedEgg?button('Забрать яйцо со склада','incubator-warehouse-egg',true,{value:storedEgg.token})
        :storedBasket?button('Забрать корзину со склада','incubator-warehouse-basket',true,{value:storedBasket.token})
        :rare?button(`Положить ${rare.name.toLowerCase()}`,'incubate-rare-egg',true,{value:rare.token})
        :farm.eggs>0?button('Положить яйцо','incubate-egg'):''):''
  const meeting=newcomer===undefined?'':`<li class="coop-incubator-new-hen"><ul class="dialog-list">${row('tool-hen',henFriends[newcomer].name,'',
    button('Познакомиться','hen-friendship-open',true,{secondary:true,context:'с Пуговкой'}))}</ul></li>`
  const eggJourney=fromNest?`<li class="coop-incubator-nest"><ul class="dialog-list">${collect}${incubation}</ul></li>`:`${collect}${incubation}${meeting}`
  const packing=(farm.coopSpecialization==='packing'?row('ui-egg-crate',`Ящики яиц · ${farm.eggCrates}`,`Нужно ${eggsPerCrate} · в запасе ${farm.eggs}`,
    button('Упаковать','pack-egg-crate',farm.eggs>=eggsPerCrate,{context:'ящик яиц'})+button(`Распаковать · +${eggsPerCrate}`,'unpack-egg-crate',getEggUnpackAction(farm,'crate').available,{secondary:true})):'')
    +(farm.buildingLevels.coop >= 2 || farm.eggBaskets > 0 ? row('ui-egg-basket',`Корзины яиц · ${farm.eggBaskets}`,`Нужно ${eggsPerBasket} · в запасе ${farm.eggs}`,
      button('Упаковать', 'pack-egg-basket', farm.buildingLevels.coop >= 2 && farm.eggs >= eggsPerBasket,{context:'корзина яиц'})+(directBasket?'':button(`Распаковать · +${eggsPerBasket}`,'unpack-egg-basket',unpackBasket.available,{secondary:true}))):'')
  return `<section class="coop-panel" aria-label="Курятник: дела и забота">
    <ul class="dialog-list coop-primary" aria-label="Сегодня в курятнике">${compare?renderCoopFeedComparison(farm,icon,compare):feedRow(mixNow?mixChoice:undefined)}${eggJourney}</ul>
    <details class="coop-forecast"><summary>Кладка после отдыха</summary>${renderCoopMorning(farm)}</details>
    <section class="coop-care" aria-label="Забота и развитие"><div class="coop-tools"><span title="Счастье курочек">${icon('tool-hen')} Забота · ${farm.chickenHappiness}/${maxChickenHappiness}</span>${button('Улучшения','upgrades',true,{secondary:true})}</div>
      <ul class="dialog-list">${newcomer===undefined?row('tool-hen','Дружба со стаей','Погладить, угостить, погулять',button('Познакомиться','hen-friendship-open',true,{secondary:true})):''}
        ${mixNow&&!singleMix?'':mixChoice?row('tool-feed','Корм из урожая',singleMix?'':'3 порции с морковью · 4 с яблоком',mixChoice):row('tool-feed','Домашние кормовые смеси','Откроются после улучшения курятника')}</ul>

    </section>
    ${packing?`<section class="coop-packing" aria-label="Упаковка яиц"><h2>Упаковка яиц</h2><ul class="dialog-list">${packing}</ul></section>`:''}
    <div class="hen-grid" role="group" aria-label="Курочки">${Array.from({length:farm.flockSize},(_,index)=>{const petted=farm.pettedChickens.includes(index);return `<button type="button" class="hen-card" data-action="pet" data-value="${index}" aria-label="${henFriends[index].name}, ${petted?'сегодня поглажена, погладить снова':'погладить'}">${icon('tool-hen')}<span>${henFriends[index].name}</span><small>${petted?'Поглажена':'Погладить'}</small></button>`}).join('')}</div>
  </section>`
}
