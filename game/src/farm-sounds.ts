import { getBedStage, type Bed, type BedAction, type CropId, type TreeId } from './farm.ts'

const harvestSounds = {
  carrot: 'field.root-pull', beetroot: 'field.root-pull',
  tomato: 'field.firm-pick', pumpkin: 'field.pumpkin',
  cabbage: 'field.leaf-pick', leafyGreens: 'field.leaf-pick',
  wheat: 'field.grain-pick',
  strawberry: 'field.berry-pick', blueberry: 'field.berry-pick', raspberry: 'field.berry-pick',
} satisfies Record<CropId, string>

export function bedWorkSound(bed: Bed, action: BedAction['kind']): string | undefined {
  if (action === 'till') return 'field.till'
  if (action === 'plant') return 'field.seed'
  if (action === 'water' && bed.kind === 'crop') return getBedStage(bed) === 'seedling' ? 'field.can-soil' : 'field.can-pour'
  if (action === 'harvest' && bed.kind === 'crop') return harvestSounds[bed.crop]
  return undefined
}

export function orchardPickSound(tree: TreeId): string {
  return tree === 'peach' ? 'orchard.soft-pick' : 'orchard.firm-pick'
}
