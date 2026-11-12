import { createHoneyFilm, type HoneyPoint } from './honey-cookery-model.ts'

/** Coordinates belong to the unrotated pear-platter master, not the screen.
 * Leave the decorative raised rim dry; never clamp an outside hit onto the dish. */
export function onHoneyPlate(point: HoneyPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && ((point.x - .5) / .405) ** 2 + ((point.y - .525) / .225) ** 2 <= 1
}

export function createHoneyPlateFilm(size = 96) {
  size = Math.max(32, Math.min(128, Number.isFinite(size) ? Math.round(size) : 96))
  const region = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
    if (onHoneyPlate({ x: (x + .5) / size, y: (y + .5) / size })) region[y * size + x] = 255
  const film = createHoneyFilm(size, region)
  let poured = 0
  return {
    size, region, height: film.height,
    /** A missed pear lands on the plate, not on the recipe's coverage counter. */
    deposit(from: HoneyPoint, to: HoneyPoint, amount: number, flow: number, occluded: (point: HoneyPoint) => boolean = () => false): number {
      if (![from.x, from.y, to.x, to.y, amount, flow].every(Number.isFinite) || amount <= 0 || flow <= 0) return 0
      const samples = Math.min(128, Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * size)))
      const dose = Math.min(36, amount, Math.max(0, size * size * 4 - poured)) / samples
      let accepted = 0
      for (let i = 1; i <= samples; i++) {
        const point = { x: from.x + (to.x - from.x) * i / samples, y: from.y + (to.y - from.y) * i / samples }
        if (!onHoneyPlate(point) || occluded(point)) continue
        film.deposit(point, dose, .009 + .005 * Math.sqrt(Math.min(1, flow)))
        accepted += dose
      }
      poured += accepted
      return accepted
    },
    step: film.step,
  }
}
