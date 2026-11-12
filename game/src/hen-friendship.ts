import { canWalkWithHen, type HenCompanionStatus } from './hen-companion.ts'
import type { ActionResult, FarmState } from './farm.ts'

export const henTreatIds = ['carrot', 'leafyGreens', 'apple'] as const
export type HenTreat = typeof henTreatIds[number]
export const henTreatNames: Record<HenTreat, string> = { carrot: 'Морковь', leafyGreens: 'Зелень', apple: 'Яблоко' }
export const maxHenFriendship = 9
export const henFriends = [
  { name: 'Плюша', character: 'Спокойная любительница солнечных мест.', favorite: 'carrot', hint: 'С интересом смотрит на оранжевые овощи.', memories: ['Плюша перестала прятаться за подругами, когда вы приходите.', 'После поглаживания Плюша уютно устраивается у ваших ног.', 'Плюша узнаёт ваши шаги и первой встречает у калитки.'] },
  { name: 'Искорка', character: 'Любопытная исследовательница огорода.', favorite: 'leafyGreens', hint: 'Любит разглядывать свежие листочки.', memories: ['Искорка смело подходит посмотреть, что у вас в руках.', 'Искорка доверчиво наклоняет голову под вашу ладонь.', 'Даже из дальнего уголка сада Искорка приходит поздороваться.'] },
  { name: 'Крошка', character: 'Тихая мечтательница у садовой дорожки.', favorite: 'apple', hint: 'Часто засматривается на яблоню.', memories: ['Крошка больше не торопится отойти, когда вы рядом.', 'Крошка тихонько отвечает на ваше приветствие.', 'Крошка с удовольствием проводит с вами спокойные минуты в саду.'] },
  { name: 'Зорька', character: 'Деловая хозяйка куриной компании.', favorite: 'carrot', hint: 'Замечает морковную грядку раньше остальных.', memories: ['Зорька оставляет свои важные дела ради короткого знакомства.', 'Зорька разрешает почесать ей шейку и довольно щурится.', 'Зорька уверенно ведёт всю компанию встречать вас.'] },
  { name: 'Пуговка', character: 'Младшая курочка, выросшая на вашей ферме.', favorite: 'apple', hint: 'Радуется запаху свежих садовых фруктов.', memories: ['Пуговка привыкает к вашему голосу и новой большой семье.', 'Пуговка уже сама ищет вашу ладонь для поглаживания.', 'Пуговка выросла, но по-прежнему встречает вас как самого близкого друга.'] },
] as const
export type HenBond = { points: number; treatedOn: number; tasted: HenTreat[] }
export type HenFriendship = { hens: HenBond[] }
export function createHenFriendship(): HenFriendship {
  return { hens: henFriends.map(() => ({ points: 0, treatedOn: 0, tasted: [] })) }
}
const isTreat = (value: unknown): value is HenTreat => henTreatIds.some(id => id === value)
const isHen = (farm: FarmState, id: unknown): id is number => Number.isInteger(id) && typeof id === 'number' && id >= 0 && id < farm.flockSize

export function restoreHenFriendship(value: unknown, day: number, flockSize: number): HenFriendship | undefined {
  if (value === undefined) return createHenFriendship()
  if (!value || typeof value !== 'object' || !('hens' in value) || !Array.isArray(value.hens) || value.hens.length !== henFriends.length) return
  const hens: HenBond[] = []
  for (const [id, bond] of value.hens.entries()) {
    if (!bond || typeof bond !== 'object' || !Number.isSafeInteger(bond.points) || bond.points < 0 || bond.points > maxHenFriendship
      || !Number.isSafeInteger(bond.treatedOn) || bond.treatedOn < 0 || bond.treatedOn > day || !Array.isArray(bond.tasted)
      || !bond.tasted.every(isTreat) || new Set(bond.tasted).size !== bond.tasted.length
      || (bond.treatedOn === 0) !== (bond.tasted.length === 0) || bond.tasted.length > 0 && bond.points === 0
      || id >= flockSize && (bond.points !== 0 || bond.treatedOn !== 0 || bond.tasted.length !== 0)) return
    hens.push({ points: bond.points, treatedOn: bond.treatedOn, tasted: [...bond.tasted] })
  }
  return { hens }
}

/** Called only after the existing per-hen, per-day pet guard succeeds. */
export function befriendPettedHen(farm: FarmState, id: number): string {
  const bond = farm.henFriendship.hens[id], before = bond.points
  bond.points = Math.min(maxHenFriendship, before + 1)
  const memory = Math.floor(bond.points / 3) > Math.floor(before / 3) ? henFriends[id].memories[Math.floor(bond.points / 3) - 1] : ''
  return `${henFriends[id].name} довольно кудахчет.${memory ? ` ${memory}` : bond.points > before ? ' Вы стали чуть ближе.' : ''}`
}

export function getHenTreat(farm: FarmState, id: number, treat: HenTreat) {
  const hen = henFriends[id], bond = farm.henFriendship.hens[id]
  const stock = treat === 'apple' ? farm.fruit.apple : farm.produce[treat]
  const complete = !!bond && bond.points === maxHenFriendship && bond.tasted.includes(hen.favorite)
  const available = farm.island === 'home' && isHen(farm, id) && stock >= 1 && bond.treatedOn !== farm.day && !complete
  return { stock, complete, available, known: !!bond?.tasted.includes(treat), favorite: !!bond?.tasted.includes(hen.favorite) }
}

export function treatHen(farm: FarmState, id: unknown, treat: unknown): ActionResult {
  if (farm.island !== 'home' || !isHen(farm, id) || !isTreat(treat)) return { ok: false, message: 'Выберите свою курочку и обычное угощение.' }
  const option = getHenTreat(farm, id, treat), bond = farm.henFriendship.hens[id], hen = henFriends[id]
  if (bond.treatedOn === farm.day) return { ok: false, message: `${hen.name} сегодня уже получила угощение. Можно продолжить знакомство в другой день.` }
  if (option.complete) return { ok: false, message: `${hen.name} уже ваш близкий друг. Поглаживаниям она рада и без угощений.` }
  if (!option.available) return { ok: false, message: 'Нужна одна порция выбранного обычного продукта. Необычный урожай останется в запасах.' }
  if (treat === 'apple') farm.fruit.apple -= 1
  else farm.produce[treat] -= 1
  const before = bond.points, firstFavorite = treat === hen.favorite && !bond.tasted.includes(treat)
  bond.points = Math.min(maxHenFriendship, bond.points + (treat === hen.favorite ? 2 : 1))
  bond.treatedOn = farm.day
  if (!bond.tasted.includes(treat)) bond.tasted.push(treat)
  const memory = Math.floor(bond.points / 3) > Math.floor(before / 3) ? hen.memories[Math.floor(bond.points / 3) - 1] : ''
  return { ok: true, message: `${hen.name} ${treat === hen.favorite ? 'радостно клюёт любимое угощение' : 'с интересом пробует угощение'}.${firstFavorite ? ` Открыто любимое угощение: ${henTreatNames[treat].toLowerCase()}.` : ''}${memory ? ` ${memory}` : ''} Кормление стаи остаётся отдельным действием.` }
}

export function henFriendshipStage(points: number) {
  return points >= 9 ? 'Близкие друзья' : points >= 6 ? 'Вам доверяет' : points >= 3 ? 'Рада знакомству' : 'Присматривается'
}

export function renderHenFriendship(farm: FarmState, walk: HenCompanionStatus | null = null, sceneAvailable = true) {
  if (farm.island !== 'home') return '<p>Курочки ждут вас на Родном острове.</p>'
  return `<section class="hen-friendship"><p>Знакомьтесь в своём темпе: поглаживание даёт 1 шаг дружбы в день, угощение — ещё 1, любимое — 2. Каждые 3 шага открывают новую заметку. Пропуски не отнимают дружбу.</p>
    <p class="coop-morning-detail">Угощения необязательны: подружиться можно одними поглаживаниями. Они не заменяют корм, не добавляют яиц и расходуют только обычный урожай.</p>
    <p class="coop-morning-detail">После первого знакомства, при 3 шагах дружбы, можно погулять вместе по Родному острову. Прогулка бесплатна и не прибавляет шагов дружбы. Курочка помнит своё прежнее место.</p>
    ${henFriends.slice(0, farm.flockSize).map((hen, id) => {
      const bond = farm.henFriendship.hens[id], petted = farm.pettedChickens.includes(id), known = bond.tasted.includes(hen.favorite)
      return `<article class="hen-friend-card" aria-label="${hen.name}"><h2>${hen.name} <span>${henFriendshipStage(bond.points)}</span></h2><p>${hen.character}</p>
        <progress value="${bond.points}" max="${maxHenFriendship}" aria-label="Дружба · ${hen.name}"></progress><p class="hen-bond-count">Дружба · ${bond.points}/${maxHenFriendship}</p>
        <ol class="hen-memories">${hen.memories.slice(0, Math.floor(bond.points / 3)).map(memory => `<li>${memory}</li>`).join('')}${bond.points < maxHenFriendship ? `<li class="hen-memory-locked">Новая заметка при ${(Math.floor(bond.points / 3) + 1) * 3} шагах дружбы</li>` : ''}</ol>
        <button type="button" class="dialog-button secondary" data-action="pet" data-value="${id}"${petted ? ' disabled' : ''}>${petted ? 'Сегодня поглажена' : 'Погладить'}</button>
        <div class="hen-walk-choice">${walk?.id === id
          ? `<p>${walk.returning ? 'Возвращается на своё место.' : 'Гуляет вместе с вами по ферме.'}</p><button type="button" class="dialog-button secondary" data-action="hen-walk-return" data-value="${id}"${walk.returning ? ' disabled' : ''}>${walk.returning ? 'Возвращается' : 'Закончить прогулку'}</button>`
          : `<button type="button" class="dialog-button secondary" data-action="hen-walk-start" data-value="${id}"${canWalkWithHen(farm, id) && !walk && sceneAvailable ? '' : ' disabled'}>Погулять вместе</button><small>${!canWalkWithHen(farm, id) ? 'Откроется при 3 шагах дружбы.' : !sceneAvailable ? 'Прогулка станет доступна, когда отобразится остров.' : walk ? walk.returning ? 'Другая курочка ещё возвращается на своё место.' : 'Сначала закончите прогулку с другой курочкой.' : 'Идёт следом, пока вы занимаетесь фермой. Перенос рукой, отдых или поездка заканчивают прогулку.'}</small>`}</div>
        <p>${known ? `Любимое угощение: ${henTreatNames[hen.favorite].toLowerCase()}.` : hen.hint}</p>
        ${bond.points === maxHenFriendship && known ? '<p class="coop-morning-detail">Вы хорошо знаете друг друга. Угощения больше не нужны, а погладить можно каждый день.</p>' : `<div class="hen-treats">${henTreatIds.map(treat => {
          const option = getHenTreat(farm, id, treat)
          return `<button type="button" class="dialog-button secondary" data-action="hen-treat" data-value="${id}:${treat}"${option.available ? '' : ' disabled'}>${henTreatNames[treat]} ×1${option.known ? treat === hen.favorite ? ' · любимое' : ' · пробовала' : ''}<small>В запасе ${option.stock}</small></button>`
        }).join('')}</div><p class="coop-morning-detail">${bond.treatedOn === farm.day ? 'Угощение на сегодня уже было. Новое можно предложить после отдыха.' : 'Одно угощение этой курочке за день. Выберите продукт, который готовы отдать.'}</p>`}</article>`
    }).join('')}${farm.flockSize < henFriends.length && farm.coopSpecialization !== 'packing' ? '<p class="coop-morning-detail">В инкубаторе можно вырастить ещё одну курочку. У неё тоже будут своё имя и привычки.</p>' : ''}</section>`
}
