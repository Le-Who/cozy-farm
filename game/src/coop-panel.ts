import { eggsPerBasket, eggsPerCrate, getCoopMorning, getEggUnpackAction, getRareIncubatorEgg, incubationDays, maxChickenHappiness, maxFlockSize, type FarmState, type StockItem } from './farm.ts'
import { renderCoopMorning } from './coop-preview.ts'
import { henFriends } from './hen-friendship.ts'
import { ruCount } from './ru.ts'
import { getLocalWarehouseSupply, warehouseConfirmationValue } from './warehouse-guidance.ts'

type CoopComponents = {
  icon(id:string):string
  row(image:string,name:string,detail:string,actions?:string):string
  button(label:string,action:string,enabled?:boolean,options?:{secondary?:boolean;value?:string|number;context?:string}):string
  feedRow():string
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

/** Existing actions, grouped by current daily work before optional services. No saved UI state. */
export function renderCoopPanel(farm:FarmState,{icon,row,button,feedRow}:CoopComponents):string {
  const morning=getCoopMorning(farm)
  const capacity=morning.blockedIfFed?' · соберите до отдыха':''
  const rare=getRareIncubatorEgg(farm)
  const storedEgg=getIncubatorWarehouseEgg(farm)
  const storedBasket=!storedEgg&&getIncubatorWarehouseBasket(farm)
  const incubation=farm.coopSpecialization==='hatchery'&&farm.flockSize<maxFlockSize
    ?row('egg','Инкубатор',farm.hatchDay===null?`${storedEgg ? 'Обычное яйцо на складе' : storedBasket ? '1 обычное яйцо' : rare ? 'Из припасов' : `1 обычное яйцо · в запасе ${farm.eggs}`} · ${ruCount(incubationDays,'ночь','ночи','ночей')}`:`До вылупления: ${ruCount(farm.hatchDay-farm.day,'ночь','ночи','ночей')}`,
      farm.hatchDay!==null?button('К отдыху дома','visit-rest',true,{secondary:true})
        :hasIncubatorBasketSource(farm)?button('К корзине яиц','incubator-basket',true,{secondary:true})
        :storedEgg?button('Забрать яйцо со склада','incubator-warehouse-egg',true,{value:storedEgg.token})
        :storedBasket?button('Забрать корзину со склада','incubator-warehouse-basket',true,{value:storedBasket.token})
        :rare?button(`Положить ${rare.name.toLowerCase()}`,'incubate-rare-egg',true,{value:rare.token})
        :button('Положить яйцо','incubate-egg',farm.eggs>0)):''
  const packing=(farm.coopSpecialization==='packing'?row('ui-egg-crate',`Ящики яиц · ${farm.eggCrates}`,`Нужно ${eggsPerCrate} · в запасе ${farm.eggs}`,
    button('Упаковать','pack-egg-crate',farm.eggs>=eggsPerCrate,{context:'ящик яиц'})+button(`Распаковать · +${eggsPerCrate}`,'unpack-egg-crate',getEggUnpackAction(farm,'crate').available,{secondary:true})):'')
    +(farm.buildingLevels.coop >= 2 || farm.eggBaskets > 0 ? row('ui-egg-basket',`Корзины яиц · ${farm.eggBaskets}`,`Нужно ${eggsPerBasket} · в запасе ${farm.eggs}`,
      button('Упаковать', 'pack-egg-basket', farm.buildingLevels.coop >= 2 && farm.eggs >= eggsPerBasket,{context:'корзина яиц'})+button(`Распаковать · +${eggsPerBasket}`,'unpack-egg-basket',getEggUnpackAction(farm,'basket').available,{secondary:true})):'')
  return `<section class="coop-panel" aria-label="Курятник: дела и забота">
    <ul class="dialog-list coop-primary" aria-label="Сегодня в курятнике">${feedRow()}${row('egg','Яйца',`В гнёздах: ${farm.eggsReady}/${morning.capacity}${capacity}`,button('Собрать','collect',farm.eggsReady>0,{context:'яйца'}))}${incubation}</ul>
    <details class="coop-forecast"><summary>Кладка после отдыха</summary>${renderCoopMorning(farm)}</details>
    <section class="coop-care" aria-label="Забота и развитие"><div class="coop-tools"><span title="Счастье курочек">${icon('tool-hen')} Забота · ${farm.chickenHappiness}/${maxChickenHappiness}</span>${button('Улучшения','upgrades',true,{secondary:true})}</div>
      <ul class="dialog-list">${row('tool-hen','Дружба со стаей','Погладить, угостить, погулять',button('Познакомиться','hen-friendship-open',true,{secondary:true}))}
        ${farm.buildingLevels.coop>=2?row('tool-feed','Корм из урожая','3 порции с морковью · 4 с яблоком',button('Выбрать смесь', 'chicken-feed-open',true,{secondary:true})):row('tool-feed','Домашние кормовые смеси','Откроются после улучшения курятника')}</ul>

    </section>
    ${packing?`<section class="coop-packing" aria-label="Упаковка яиц"><h2>Упаковка яиц</h2><ul class="dialog-list">${packing}</ul></section>`:''}
    <div class="hen-grid" role="group" aria-label="Курочки">${Array.from({length:farm.flockSize},(_,index)=>{const petted=farm.pettedChickens.includes(index);return `<button type="button" class="hen-card" data-action="pet" data-value="${index}" aria-label="${henFriends[index].name}, ${petted?'сегодня поглажена, погладить снова':'погладить'}">${icon('tool-hen')}<span>${henFriends[index].name}</span><small>${petted?'Поглажена':'Погладить'}</small></button>`}).join('')}</div>
  </section>`
}
