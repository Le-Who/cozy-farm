import { getCoopMorning } from './farm.ts'
import { ruCount } from './ru.ts'

type CoopFarm = Parameters<typeof getCoopMorning>[0]
const eggs = (count: number) => ruCount(count, 'яйцо', 'яйца', 'яиц')

/** A compact, optional reminder; entering the coop never collects eggs for the player. */
export function renderCoopCapacityWarning(farm: CoopFarm, linkToCoop = false): string {
  const morning = getCoopMorning(farm)
  if (!morning.blockedIfFed) return ''
  return `<aside class="coop-capacity-note" aria-label="Место для утренней кладки"><strong>${morning.ready === morning.capacity ? 'Гнёзда полны' : 'Места для всей кладки не хватит'} · ${morning.ready}/${morning.capacity}</strong>
    <p>${morning.addedIfFed ? `Поместится только ${eggs(morning.addedIfFed)} из ${morning.laying}.` : 'Новая кладка пока не поместится.'} Соберите готовые яйца перед отдыхом, чтобы освободить место.${farm.chickensFed ? '' : ' Для новой кладки также нужен корм.'}</p>
    ${linkToCoop ? '<button type="button" class="dialog-button secondary" data-action="open-panel" data-value="coop">Открыть курятник</button>' : ''}</aside>`
}

export function renderCoopMorning(farm: CoopFarm): string {
  const morning = getCoopMorning(farm)
  return `<section class="coop-morning" aria-label="Гнёзда и новая кладка"><h2>Гнёзда · ${morning.ready}/${morning.capacity}</h2>
    <p>${farm.chickensFed ? `К утру добавится: ${eggs(morning.added)}.`
      : `Без корма новой кладки не будет. Если покормить сейчас, к утру добавится: ${eggs(morning.addedIfFed)}.`}</p>
    <p class="coop-morning-detail">${farm.chickensFed ? 'После отдыха' : 'После кормления и отдыха'} в гнёздах: ${farm.chickensFed ? morning.total : morning.ready + morning.addedIfFed}/${morning.capacityAfterRest}. Уже готовые яйца останутся до сбора.</p>
    ${morning.hatching ? '<p class="coop-morning-detail">Утром вылупится новая курочка. В эту ночь кладка ещё рассчитана на прежнюю стаю и вместимость.</p>' : ''}
    ${renderCoopCapacityWarning(farm)}</section>`
}
