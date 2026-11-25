import { cropDefinitions, dishDefinitions, treeFruitAtDawn, type FarmState } from './farm.ts'
import { getRestPreview } from './rest-preview.ts'
import { getNextFairCropPrep } from './fair-return.ts'
import { ruCount } from './ru.ts'

type RestFarm = Pick<FarmState, 'day' | 'beds' | 'island' | 'buildingLevels' | 'dishes' | 'bayDiscoveries' | 'trees'>

function renderFirstJamOrchard(farm: RestFarm): string {
  if (farm.island !== 'home' || farm.buildingLevels.farmhouse < dishDefinitions.appleJam.requiredLevel
    || farm.dishes.appleJam > 0 || farm.bayDiscoveries.includes('appleJam')) return ''
  const orchard = farm.trees.home.flatMap((tree, index) => {
    if (tree?.tree !== 'apple') return []
    const tomorrow = treeFruitAtDawn(tree)
    return tomorrow ? [{ index, today: tree.fruitReady, tomorrow }] : []
  })
  const apple = orchard.find(tree => tree.today > 0) ?? orchard[0]
  if (!apple) return ''
  return `<div class="rest-orchard-preview">${apple.today
    ? `<p>Если собрать сейчас, утром будет ещё ×${apple.tomorrow}.</p><button type="button" class="dialog-button secondary" data-action="visit-tree" data-value="${apple.index}">К яблоне · ×${apple.today} сейчас</button>`
    : `<p>Яблоки к утру · ×${apple.tomorrow}</p>`}</div>`
}

export function renderRestPreview(farm: FarmState, compact = false): string {
  const preview = getRestPreview(farm)
  const fairPrep = getNextFairCropPrep(farm, preview)
  const fairChoice = fairPrep ? `<div class="rest-fair-prep"><p><strong>${fairPrep.guest} завтра</strong> · ${cropDefinitions[fairPrep.crop].name} ${fairPrep.carried}/${fairPrep.required}</p>
    <button type="button" class="dialog-button secondary" data-fair-crop-prep data-action="focus-bed" data-value="${fairPrep.index}">К грядке · ${fairPrep.task === 'harvest' ? 'собрать' : 'полить'} сегодня</button></div>` : ''
  const firstOtherDry = preview.dry.find(bed => bed.index !== fairPrep?.index)
  const otherDryChoice = firstOtherDry ? `<button type="button" class="dialog-button secondary" data-action="focus-bed" data-value="${firstOtherDry.index}">К сухой грядке · ${cropDefinitions[firstOtherDry.crop].name.toLowerCase()}</button>` : ''
  const groups = [
    ['К сбору утром', preview.ripening], ['Продолжат рост', preview.growing],
    ['Ждёт полива', preview.dry], ['Уже можно собрать', preview.ready],
  ] as const
  const hasCrops = groups.some(([, beds]) => beds.length)
  if (compact) return `<section class="rest-preview rest-preview-compact" aria-label="Огород к утру"><h2>Огород к утру <small>· грядки</small></h2>
    ${fairChoice}${hasCrops ? `<div class="rest-preview-stats">${groups.map(([, beds], index) => `<div><span>${['Созреют', 'Растут', 'Без полива', 'Готовы'][index]}</span><strong>${beds.length}</strong></div>`).join('')}</div>` : '<p>Посадок пока нет. Можно отдохнуть и без работы в огороде.</p>'}
    ${renderFirstJamOrchard(farm)}
    ${hasCrops ? `<details class="home-rest-details"><summary>Полив и сбор</summary><div>
      ${preview.dry.length ? `<p>Сухие посадки этой ночью не подрастут. Они не погибнут: можно полить сейчас или оставить на потом.</p>${preview.weather === 'rain' ? '<p>Завтрашний дождь польёт грядки утром, но не заменит полив для роста этой ночью.</p>' : ''}${otherDryChoice}` : preview.growing.length || preview.ripening.length ? '<p>Политые посадки подрастут этой ночью.</p>' : ''}
      ${preview.ready.length ? '<p>Созревший урожай останется на грядках до сбора.</p>' : ''}
      <p>Прогноз учитывает нынешний полив и не меняет день. Утро начнётся по кнопке «До утра».</p>
    </div></details>` : ''}</section>`
  return `<section class="rest-preview" aria-label="Огород к утру"><h2>Огород к утру</h2>
    ${fairChoice}
    ${preview.dry.length ? `<p class="rest-preview-note">Сухие посадки этой ночью не подрастут. Они не погибнут: можно полить сейчас или оставить на потом.</p>
      ${preview.weather === 'rain' ? '<p>Завтрашний дождь польёт грядки утром, но не заменит полив для роста этой ночью.</p>' : ''}
      ${otherDryChoice}` : ''}
    ${hasCrops ? `<div class="rest-preview-stats">${groups.filter(([, beds]) => beds.length).map(([title, beds]) => `<div><span>${title}</span><strong>${ruCount(beds.length, 'грядка', 'грядки', 'грядок')}</strong></div>`).join('')}</div>` : '<p>Посадок пока нет. Можно отдохнуть и без работы в огороде.</p>'}
    ${preview.ready.length ? `<p>Созревший урожай останется на грядках до сбора.</p>` : ''}
    ${hasCrops ? '<p class="rest-preview-footnote">Прогноз учитывает нынешний полив. День начнётся только по кнопке «До утра».</p>' : ''}
  </section>`
}
