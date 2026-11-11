import { createFarm, plantCapeFlower, collectCapeHoney, endDay, sail, restoreFarm, upgradeCape } from '../../src/farm.ts'

/** Synthetic saves for the visible localhost harness; no production boot hook. */
export function apiaryReturnFixture(mode: 'collected' | 'wind' | 'growing' | 'empty' = 'collected') {
  const farm = createFarm()
  farm.coins = 200; farm.boatOwned = true
  farm.projects.dock = { 'dishes:appleJam': 1, 'fruit:pear': 2, seaSalt: 2 }
  sail(farm, 'cape')
  if (mode !== 'empty') {
    for (let i = 0; i < 3; i++) plantCapeFlower(farm, i)
    if (mode !== 'growing') {
      sail(farm, 'home'); endDay(farm); sail(farm, 'cape')
      if (!collectCapeHoney(farm).ok || !upgradeCape(farm).ok) throw Error('Пасека не подготовлена')
      sail(farm, 'home')
      while (farm.day < (mode === 'wind' ? 8 : 7)) endDay(farm)
      sail(farm, 'cape')
      if (!collectCapeHoney(farm).ok) throw Error('Нет дневного сбора')
    }
  }
  if (!restoreFarm(farm)) throw Error('Некорректная проверочная пасека')
  return farm
}
