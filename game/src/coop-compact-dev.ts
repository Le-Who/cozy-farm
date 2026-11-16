import './coop-compact-dev.css'
import type { FarmState } from './farm.ts'
import { ruCount } from './ru.ts'

const disclosure = new Map<string, boolean>()
const observed = new WeakSet<HTMLElement>()
/** Local presentation only. Canonical buttons are moved intact, never copied or rebound. */
export function enhanceCoopPanel(root: HTMLElement, farm: FarmState): void {
  const panel = root.querySelector<HTMLElement>('.coop-panel')
  if (!panel || panel.dataset.coopCompact === 'true') return
  panel.dataset.coopCompact = 'true'
  const document = root.ownerDocument
  if (!observed.has(root)) {
    root.addEventListener('toggle', event => {
      const detail = event.target as HTMLDetailsElement
      if (detail?.dataset.coopDisclosure) disclosure.set(detail.dataset.coopDisclosure, detail.open)
    }, true)
    observed.add(root)
  }
  const details = (key: string, label: string, content: HTMLElement) => {
    const element = document.createElement('details'), summary = document.createElement('summary')
    element.dataset.coopDisclosure = key; element.open = disclosure.get(key) ?? false
    summary.textContent = label; element.append(summary, content); return element
  }
  for (const [index, row] of [...panel.querySelectorAll<HTMLElement>('.coop-primary > .dialog-row')].entries()) {
    const copy = row.querySelector<HTMLElement>('.dialog-row-copy')!, full = copy.querySelector('small')?.textContent ?? ''
    const title = copy.querySelector('strong')!.textContent!
    const brief = index === 0 ? farm.chickensFed ? 'Сегодня накормлены' : 'Пора покормить'
      : index === 1 ? full.includes('соберите до отдыха') ? `${farm.eggsReady} · соберите до отдыха` : `${farm.eggsReady} в гнёздах`
      : farm.hatchDay === null ? '1 обычное яйцо' : `Ещё ${ruCount(farm.hatchDay - farm.day, 'ночь', 'ночи', 'ночей')}`
    const body = document.createElement('p'); body.textContent = full
    const detail = details(`primary-${index}`, '', body), summary = detail.querySelector('summary')!
    const name = document.createElement('strong'), status = document.createElement('span')
    name.textContent = index === 0 ? 'Корм' : title; status.textContent = brief; summary.append(name, status)
    detail.className = 'coop-compact-card-detail'; copy.replaceWith(detail)
  }
  const secondary = document.createElement('div'); secondary.className = 'coop-compact-secondary'
  for (const [selector, key, label] of [
    ['.coop-care', 'care', 'Забота и знакомства'],
    ['.coop-packing', 'packing', 'Упаковка яиц'],
    ['.hen-grid', 'hens', `Погладить курочек · ${farm.flockSize}`],
  ]) {
    const content = panel.querySelector<HTMLElement>(selector)
    if (content) secondary.append(details(key, label, content))
  }
  const forecast = panel.querySelector<HTMLDetailsElement>('.coop-forecast')!
  forecast.dataset.coopDisclosure = 'forecast'; forecast.open = disclosure.get('forecast') ?? false
  secondary.append(forecast); panel.append(secondary)
}
