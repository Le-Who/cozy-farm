import { cropDefinitions, type FarmState } from './farm.ts'
import { getRestPreview } from './rest-preview.ts'
import { ruCount } from './ru.ts'

export function renderRestPreview(farm: Pick<FarmState, 'day' | 'beds'>): string {
  const preview = getRestPreview(farm)
  const groups = [
    ['К сбору утром', preview.ripening], ['Продолжат рост', preview.growing],
    ['Ждёт полива', preview.dry], ['Уже можно собрать', preview.ready],
  ] as const
  const hasCrops = groups.some(([, beds]) => beds.length)
  return `<section class="rest-preview" aria-label="Огород к утру"><h2>Огород к утру</h2>
    ${hasCrops ? `<div class="rest-preview-stats">${groups.filter(([, beds]) => beds.length).map(([title, beds]) => `<div><span>${title}</span><strong>${ruCount(beds.length, 'грядка', 'грядки', 'грядок')}</strong></div>`).join('')}</div>` : '<p>Посадок пока нет. Можно отдохнуть и без работы в огороде.</p>'}
    ${preview.dry.length ? `<p class="rest-preview-note">Сухие посадки этой ночью не подрастут. Они не погибнут: можно полить сейчас или оставить на потом.</p>
      ${preview.weather === 'rain' ? '<p>Завтрашний дождь польёт грядки утром, но не заменит полив для роста этой ночью.</p>' : ''}
      <button type="button" class="dialog-button secondary" data-action="focus-bed" data-value="${preview.dry[0].index}">К сухой грядке · ${cropDefinitions[preview.dry[0].crop].name.toLowerCase()}</button>` : ''}
    ${preview.ready.length ? `<p>Созревший урожай останется на грядках до сбора.</p>` : ''}
    ${hasCrops ? '<p class="rest-preview-footnote">Прогноз учитывает нынешний полив. День начнётся только по кнопке «До утра».</p>' : ''}
  </section>`
}
