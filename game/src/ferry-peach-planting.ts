import { getFruitTreeSeed, type FarmState } from './farm.ts'
import { ferryCommissionUse } from './ferry-commission-use.ts'
import type { FerryExpeditions } from './ferry-expeditions.ts'
import { receiveFerryExpedition } from './harbour-economy.ts'

export type FerryPeachChoice = { slot: number; key: string }

/** An unpersisted continuation of the first ordinary peach cargo actually collected here. */
export class FerryPeachPlanting {
  private claim?: { island: 'home' | 'grove'; serial: number; slot: number; last: FerryExpeditions['last'] }

  reset() { this.claim = undefined }

  receive(farm: FarmState) {
    const { island } = farm, world = farm.freight.expeditions, voyage = world.active
    const firstPeach = !farm.discoveries.peach?.regular && voyage?.phase === 'ready' &&
      voyage.port === 'orchard' && voyage.kind === 'trade' && voyage.incoming.some(lot => lot.id === 'peach')
    const result = receiveFerryExpedition(farm)
    if (result.ok) {
      this.reset()
      if (firstPeach && (island === 'home' || island === 'grove')) {
        const slot = farm.trees[island].findIndex((_, slot) => getFruitTreeSeed(farm, slot, 'peach'))
        if (slot >= 0) this.claim = { island, slot, serial: world.serial, last: world.last }
      }
    }
    return result
  }

  current(farm: FarmState): FerryPeachChoice | undefined {
    const claim = this.claim, world = farm.freight.expeditions
    if (!claim || farm.island !== claim.island || world.active || world.serial !== claim.serial ||
      world.last !== claim.last || world.last?.day !== farm.day || ferryCommissionUse(farm)) return
    const seed = getFruitTreeSeed(farm, claim.slot, 'peach')
    if (seed) return { slot: claim.slot, key: `peach:${claim.serial}:${seed.token}` }
  }

  resolve(farm: FarmState, key: string): FerryPeachChoice | undefined {
    const choice = this.current(farm)
    if (choice?.key === key) return choice
  }
}
