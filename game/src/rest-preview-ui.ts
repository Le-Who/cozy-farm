import { cropDefinitions, type FarmState } from './farm.ts'
import { getRestPreview } from './rest-preview.ts'
import { ruCount } from './ru.ts'

export function renderRestPreview(farm: Pick<FarmState, 'day' | 'beds'>, compact = false): string {
  const preview = getRestPreview(farm)
  const groups = [
    ['К сбору утром', preview.ripening], ['Продолжат рост', preview.growing],
    ['Ждёт полива', preview.dry], ['Уже можно собрать', preview.ready],
  ] as const
  const hasCrops = groups.some(([, beds]) => beds.length)
  if (compact) return `<section class="rest-preview rest-preview-compact" aria-label="Огород к утру"><h2>Огород к утру <small>· грядки</small></h2>
    ${hasCrops ? `<div class="rest-preview-stats">${groups.map(([, beds], index) => `<div><span>${['Созреют', 'Растут', 'Без полива', 'Готовы'][index]}</span><strong>${beds.length}</strong></div>`).join('')}</div>` : '<p>Посадок пока нет. Можно отдохнуть и без работы в огороде.</p>'}
    ${hasCrops ? `<details class="home-rest-details"><summary>Полив и сбор</summary><div>
      ${preview.dry.length ? `<p>Сухие посадки этой ночью не подрастут. Они не погибнут: можно полить сейчас или оставить на потом.</p>${preview.weather === 'rain' ? '<p>Завтрашний дождь польёт грядки утром, но не заменит полив для роста этой ночью.</p>' : ''}<button type="button" class="dialog-button secondary" data-action="focus-bed" data-value="${preview.dry[0].index}">К сухой грядке · ${cropDefinitions[preview.dry[0].crop].name.toLowerCase()}</button>` : preview.growing.length || preview.ripening.length ? '<p>Политые посадки подрастут этой ночью.</p>' : ''}
      ${preview.ready.length ? '<p>Созревший урожай останется на грядках до сбора.</p>' : ''}
      <p>Прогноз учитывает нынешний полив и не меняет день. Утро начнётся по кнопке «До утра».</p>
    </div></details>` : ''}</section>`
  return `<section class="rest-preview" aria-label="Огород к утру"><h2>Огород к утру</h2>
    ${preview.dry.length ? `<p class="rest-preview-note">Сухие посадки этой ночью не подрастут. Они не погибнут: можно полить сейчас или оставить на потом.</p>
      ${preview.weather === 'rain' ? '<p>Завтрашний дождь польёт грядки утром, но не заменит полив для роста этой ночью.</p>' : ''}
      <button type="button" class="dialog-button secondary" data-action="focus-bed" data-value="${preview.dry[0].index}">К сухой грядке · ${cropDefinitions[preview.dry[0].crop].name.toLowerCase()}</button>` : ''}
    ${hasCrops ? `<div class="rest-preview-stats">${groups.filter(([, beds]) => beds.length).map(([title, beds]) => `<div><span>${title}</span><strong>${ruCount(beds.length, 'грядка', 'грядки', 'грядок')}</strong></div>`).join('')}</div>` : '<p>Посадок пока нет. Можно отдохнуть и без работы в огороде.</p>'}
    ${preview.ready.length ? `<p>Созревший урожай останется на грядках до сбора.</p>` : ''}
    ${hasCrops ? '<p class="rest-preview-footnote">Прогноз учитывает нынешний полив. День начнётся только по кнопке «До утра».</p>' : ''}
  </section>`
}
