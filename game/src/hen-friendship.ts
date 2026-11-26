import type {HenFieldTarget} from './hen-harvest-walk.ts'
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
  const known = !!bond?.tasted.includes(treat), favorite = !!bond?.tasted.includes(hen.favorite)
  const capped = bond?.points === maxHenFriendship
  const complete = capped && favorite, repeatAtCap = capped && !favorite && known
  const available = farm.island === 'home' && isHen(farm, id) && stock >= 1 && bond.treatedOn !== farm.day && !complete && !repeatAtCap
  return { stock, complete, available, known, favorite, repeatAtCap }
}

export function treatHen(farm: FarmState, id: unknown, treat: unknown): ActionResult {
  if (farm.island !== 'home' || !isHen(farm, id) || !isTreat(treat)) return { ok: false, message: 'Выберите свою курочку и обычное угощение.' }
  const option = getHenTreat(farm, id, treat), bond = farm.henFriendship.hens[id], hen = henFriends[id]
  if (bond.treatedOn === farm.day) return { ok: false, message: `${hen.name} сегодня уже получила угощение. Можно продолжить знакомство в другой день.` }
  if (option.complete) return { ok: false, message: `${hen.name} уже ваш близкий друг. Поглаживаниям она рада и без угощений.` }
  if (option.repeatAtCap) return { ok: false, message: 'Это угощение уже знакомо.' }
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

const guideLabel=(favorite:HenTreat)=>`Пойти за курочкой ${{carrot:'к моркови',leafyGreens:'к зелени',apple:'к яблоне'}[favorite]}`
function henWalkChoice(farm: FarmState, id: number, walk: HenCompanionStatus | null, sceneAvailable: boolean) {
  const walking = walk?.id === id
  const reason = walking ? walk.returning ? 'Возвращается на своё место.' : walk.guiding ? 'Показывает, где созрело любимое угощение.' : 'Идёт с вами.'
    : !canWalkWithHen(farm, id) ? 'С 3 шагов дружбы.'
    : !sceneAvailable ? 'Когда отобразится остров.'
    : walk ? walk.returning ? 'Другая курочка возвращается.' : 'Сначала закончите другую прогулку.' : 'Бесплатно.'
  return {
    action: walking ? 'hen-walk-return' : 'hen-walk-start',
    label: walking ? walk.returning ? 'Возвращается' : 'Закончить прогулку' : 'Погулять вместе',
    enabled: walking ? !walk.returning : canWalkWithHen(farm, id) && !walk && sceneAvailable,
    reason,
  }
}

/** A returning hen can arrive while someone reads the open card. Keep its controls and focus in place. */
export function refreshHenWalkChoice(root: HTMLElement, farm: FarmState, walk: HenCompanionStatus | null, sceneAvailable: boolean, guide?:HenFieldTarget) {
  const row = root.querySelector('.hen-walk-choice'), button = row?.querySelector('button'), reason = row?.querySelector('small')
  const id = Number(button?.dataset.value)
  if (!button || !reason || !isHen(farm, id)) return
  const choice = henWalkChoice(farm, id, walk, sceneAvailable)
  button.dataset.action = choice.action
  button.disabled = !choice.enabled
  button.textContent = choice.label
  reason.textContent = choice.reason
  const lead=root.querySelector<HTMLButtonElement>('[data-action="hen-guide"]')
  if (lead) {
    lead.hidden=lead.disabled=!guide || !!walk || !sceneAvailable
    lead.textContent=guide ? guideLabel(henFriends[id].favorite) : ''
    lead.dataset.value=guide ? `${id}:${guide.kind}:${guide.index}` : ''
  }
}

/** Selection belongs to this view only; looking at a hen never touches the farm. */
export function renderHenFriendship(farm: FarmState, walk: HenCompanionStatus | null = null, sceneAvailable = true,
  selectedHen = 0, icon: (name: string) => string = () => '', guide?:HenFieldTarget) {
  if (farm.island !== 'home') return '<p>Курочки ждут вас на Родном острове.</p>'
  const id = isHen(farm, selectedHen) ? selectedHen : 0
  const hen = henFriends[id], bond = farm.henFriendship.hens[id]
  const petted = farm.pettedChickens.includes(id), known = bond.tasted.includes(hen.favorite)
  const complete = bond.points === maxHenFriendship && known
  const choices = henTreatIds.map(treat => ({ treat, option: getHenTreat(farm, id, treat) }))
  const hintAtChoice = !known && choices.some(({ treat, option }) => treat === hen.favorite && option.available)
  const choice = henWalkChoice(farm, id, walk, sceneAvailable)
  const guideReady=guide && !walk && sceneAvailable && known && canWalkWithHen(farm,id)
  const treatedToday = bond.treatedOn === farm.day
  const treatGrid = complete ? '' : `<div class="hen-treats" role="group" aria-labelledby="hen-treat-heading"${hintAtChoice ? ' aria-describedby="hen-treat-hint"' : ''}>${choices.map(({ treat, option }) => {
          return `<button type="button" class="dialog-button secondary" data-action="hen-treat" data-value="${id}:${treat}" aria-label="Угостить: ${henTreatNames[treat]} ×1 · в запасе ${option.stock}${option.known ? treat === hen.favorite ? ' · любимое' : ' · пробовала' : ''}"${option.available ? '' : ' disabled'}>${icon(treat)}<strong>${henTreatNames[treat]} ×1</strong><small>В запасе ${option.stock}</small>${option.known ? `<small>${treat === hen.favorite ? 'Любимое' : 'Пробовала'}</small>` : ''}</button>`
        }).join('')}</div>`
  const avatar = (index: number) => `<span class="hen-friend-avatar" style="--hen-pose:${[0, 2, 7, 4, 6][index]}" aria-hidden="true"></span>`
  return `<section class="hen-friendship">
    <div class="hen-friend-roster" aria-label="Выберите курочку">${henFriends.slice(0, farm.flockSize).map((friend, index) =>
      `<button type="button" class="hen-friend-select" data-action="hen-friend-select" data-value="${index}" aria-pressed="${index === id}" aria-label="${friend.name} · дружба ${farm.henFriendship.hens[index].points} из ${maxHenFriendship}">${avatar(index)}<strong>${friend.name}</strong><small>${farm.henFriendship.hens[index].points}/${maxHenFriendship}</small></button>`).join('')}</div>
    <article class="hen-friend-card" aria-label="${hen.name}">
      <div class="hen-friend-actions"><header><h2>${hen.name}</h2><span>${henFriendshipStage(bond.points)}</span></header>
        <div class="hen-friend-progress"><progress value="${bond.points}" max="${maxHenFriendship}" aria-label="Дружба · ${hen.name}"></progress><small>Дружба · ${bond.points}/${maxHenFriendship}</small></div>
        <button type="button" class="dialog-button" data-action="pet" data-value="${id}"${petted ? ' disabled' : ''}>${petted ? 'Сегодня поглажена' : `Погладить${bond.points < maxHenFriendship ? ' · +1' : ''}`}</button>
        <div class="hen-walk-choice"><button type="button" class="dialog-button secondary" data-action="${choice.action}" data-value="${id}"${choice.enabled ? '' : ' disabled'}>${choice.label}</button><small>${choice.reason}</small></div>
        <button type="button" class="dialog-button secondary hen-field-guide" data-action="hen-guide" data-value="${guideReady ? `${id}:${guide.kind}:${guide.index}` : ''}"${guideReady?'':' disabled hidden'}>${guideReady?guideLabel(hen.favorite):''}</button>
      </div>
      <div class="hen-friend-treats"><h3 id="hen-treat-heading">Угостить</h3>
        ${hintAtChoice ? `<p id="hen-treat-hint" class="hen-treat-status">${hen.hint}</p>` : ''}
        ${complete ? '<p class="hen-treat-status">Вы хорошо знаете друг друга. Угощения больше не нужны.</p>' : `${treatedToday ? '' : treatGrid}<p class="hen-treat-status">${treatedToday ? 'Сегодня уже угощали · снова после отдыха.' : 'Один раз в день · не заменяет корм.'}</p>`}
      </div>
    </article>
    <details class="hen-friend-notes"><summary>Характер и правила</summary><div><p><strong>${hen.name}.</strong> ${hen.character}${known ? ` Любимое угощение: ${henTreatNames[hen.favorite].toLowerCase()}.` : hintAtChoice ? '' : ` ${hen.hint}`}</p>
      <ol class="hen-memories">${hen.memories.slice(0, Math.floor(bond.points / 3)).map(memory => `<li>${memory}</li>`).join('')}${bond.points < maxHenFriendship ? `<li class="hen-memory-locked">Новая заметка при ${(Math.floor(bond.points / 3) + 1) * 3} шагах дружбы</li>` : ''}</ol>
      <p>Поглаживание даёт 1 шаг дружбы в день, угощение — ещё 1, любимое — 2. Каждые 3 шага открывают новую заметку. Пропуски не отнимают дружбу.</p>
      <p>Угощения необязательны: подружиться можно одними поглаживаниями. Они не заменяют корм, не добавляют яиц и расходуют только обычный урожай.</p>
      <p>Прогулка бесплатна и не прибавляет шагов дружбы. Можно гулять с одной курочкой. Перенос рукой, отдых или поездка заканчивают прогулку: курочка возвращается на прежнее место.</p>
      ${farm.flockSize < henFriends.length && farm.coopSpecialization !== 'packing' ? '<p>В инкубаторе можно вырастить ещё одну курочку. У неё тоже будут своё имя и привычки.</p>' : ''}
      ${treatedToday ? treatGrid : ''}</div></details>
  </section>`
}
