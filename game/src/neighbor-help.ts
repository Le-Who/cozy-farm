import type { FarmState, ResidentId } from './farm.ts'

/** The existing one-use promise survives mornings until its real service consumes it. */
export function neighborHelpStatus(farm: FarmState, resident: ResidentId) {
  if (!farm.village.built || !farm.village.residents.includes(resident)
    || !(farm.neighbors[resident].helpReady || farm.culinary.tastings[resident].bonus)) return undefined
  const usedToday = farm.village.serviceOn[resident] === farm.day
  if (resident === 'bea') return {
    title: 'Помощь Беа сохранена', summary: 'Следующая выпечка ×4',
    detail: 'Один раз Беа испечёт 4 изделия вместо 3 за обычные 4 пшеницы и 2 яйца.',
    next: usedToday ? 'Сегодня Беа уже пекла. Помощь останется до следующей выпечки.'
      : 'Выберите освоенную форму в её домике. Помощь останется до выпечки.',
  }
  return {
    title: 'Помощь Финна сохранена', summary: 'Крючок крепче ещё на 1',
    detail: 'У следующей подготовленной рыбалки прочность крючка будет 5 вместо 4. Помощь используется один раз.',
    next: farm.village.scouting ? 'Маршрут уже готов. Помощь сохранится до начала этой рыбалки.'
      : usedToday ? 'Сегодня Финн уже помог. После отдыха попросите разведать новый маршрут; помощь сохранится.'
        : 'Сначала попросите Финна разведать маршрут. До подготовленной рыбалки помощь сохранится.',
  }
}
