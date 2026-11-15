import { eggsPerBasket, eggsPerCrate, getCoopMorning, getEggUnpackAction, incubationDays, maxChickenHappiness, maxFlockSize, type FarmState } from './farm.ts'
import { renderCoopMorning } from './coop-preview.ts'
import { henFriends } from './hen-friendship.ts'
import { ruCount } from './ru.ts'

type CoopComponents = {
  icon(id:string):string
  row(image:string,name:string,detail:string,actions?:string):string
  button(label:string,action:string,enabled?:boolean,options?:{secondary?:boolean;value?:string|number;context?:string}):string
  feedRow():string
}

/** Existing actions, grouped by current daily work before optional services. No saved UI state. */
export function renderCoopPanel(farm:FarmState,{icon,row,button,feedRow}:CoopComponents):string {
  const morning=getCoopMorning(farm)
  const capacity=morning.blockedIfFed?' · соберите до отдыха':''
  const incubation=farm.coopSpecialization==='hatchery'&&farm.flockSize<maxFlockSize
    ?row('egg','Инкубатор',farm.hatchDay===null?`1 обычное яйцо · в запасе ${farm.eggs} · ${ruCount(incubationDays,'ночь','ночи','ночей')}`:`До вылупления: ${ruCount(farm.hatchDay-farm.day,'ночь','ночи','ночей')}`,
      farm.hatchDay===null?button('Положить яйцо','incubate-egg',farm.eggs>0):''):''
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
