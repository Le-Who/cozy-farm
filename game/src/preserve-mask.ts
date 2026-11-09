/** The painted preserve inside each source image, in percentages of the full sprite cell. */
type FillProfile = { inside: string; foreground?: string[] }

const openFruitJar =
  'M32 33 C32 29 40 27 50 27 C60 27 68 29 68 33 L68 38 C72 40 74 42 74 46 L74 65 C74 73 64 78 50 78 C36 78 26 73 26 65 L26 46 Q26 41 32 38 Z'
const openBerryJar =
  'M32 33 C32 30 41 28 50 28 C59 28 68 30 68 33 L68 38 Q74 41 74 46 L74 65 C74 73 64 78 50 78 C36 78 26 73 26 65 L26 46 Q26 41 32 38 Z'

const profiles: Record<string, FillProfile> = {
  'ui-orchard-preserves.webp': {
    inside:
      'M21 44 Q24 43 27 47 Q35 53 42 47 L46 48 L46 52 L50 52 L50 47 Q55 48 58 50 Q64 52 70 46 Q74 46 80 45 C84 49 85 57 85 65 L84 76 C82 85 68 90 50 90 C30 90 18 84 16 77 C14 66 14 54 21 44 Z',
    foreground: [
      'M8 96 L8 81 Q10 76 16 76 L15 72 L18 71 L19 75 Q20 71 28 70 Q29 76 24 78 C31 79 33 86 30 94 Z',
      'M66 95 C64 87 68 80 73 74 Q75 69 80 70 L80 67 Q83 63 90 64 L92 70 L85 73 Q87 76 90 83 L92 95 Z',
    ],
  },
  'ui-apple-jam.webp': {
    inside:
      'M10 47 Q15 49 20 47 Q27 53 33 52 Q41 52 46 48 Q50 50 56 50 Q65 49 69 51 Q75 53 82 48 Q87 48 90 47 C94 54 95 64 93 73 C91 85 78 92 51 92 C24 92 10 84 8 73 C6 62 7 54 10 47 Z',
    foreground: [
      'M44 50 Q46 47 49 48 L49 44 L52 44 L52 49 Q59 48 64 51 Q68 53 69 58 L69 71 Q67 79 57 80 L40 80 Q29 80 29 72 L30 60 Q30 55 35 53 Z',
    ],
  },
  'ui-signature-bright.webp': { inside: openFruitJar },
  'ui-signature-chunky.webp': { inside: openFruitJar },
  'ui-signature-silky.webp': { inside: openBerryJar },
  'berry-jar-full.webp': { inside: openBerryJar },
  'jar-full.webp': {
    inside:
      'M29 39 C29 37 39 35 50 35 C61 35 71 37 71 39 L71 42 C75 44 78 46 78 51 L78 68 C78 76 66 83 50 83 C34 83 22 77 22 68 L22 51 Q22 46 29 42 Z',
  },
}

function smooth(value: number): number {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

const masks = new WeakMap<HTMLImageElement, HTMLCanvasElement>()

/** Alpha is the visible fill, retaining the glints and clear glass painted over it. */
export function preserveFillMask(image: HTMLImageElement): HTMLCanvasElement | undefined {
  const cached = masks.get(image)
  if (cached) return cached
  const name = new URL(image.currentSrc || image.src, document.baseURI).pathname.split('/').pop()!
  const profile = profiles[name]
  if (!profile) return undefined

  const mask = document.createElement('canvas')
  mask.width = image.naturalWidth
  mask.height = image.naturalHeight
  const ctx = mask.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  const source = ctx.getImageData(0, 0, mask.width, mask.height).data
  ctx.clearRect(0, 0, mask.width, mask.height)
  ctx.scale(mask.width / 100, mask.height / 100)
  ctx.fillStyle = 'white'
  const contour = new Path2D(profile.inside)
  ctx.fill(contour)
  ctx.globalCompositeOperation = 'destination-out'
  for (const hole of profile.foreground ?? []) ctx.fill(new Path2D(hole))
  ctx.strokeStyle = 'rgba(0,0,0,.42)'
  ctx.lineWidth = 1.1
  ctx.stroke(contour)
  const pixel = ctx.getImageData(0, 0, mask.width, mask.height)
  for (let i = 0; i < source.length; i += 4) {
    const high = Math.max(source[i], source[i + 1], source[i + 2])
    const low = Math.min(source[i], source[i + 1], source[i + 2])
    // A warm reflection contains cream and peach as well as white.
    const reflection = smooth((low - 142) / 53) * smooth((high - 200) / 34)
    let weight = 1 - reflection
    if (name === 'ui-orchard-preserves.webp' && i / (4 * mask.width * mask.height) < 0.52) {
      // Olive cloth meets amber syrup in small scallops under the bow.
      weight *= smooth((source[i] - source[i + 1] - 30) / 50)
    }
    pixel.data[i + 3] *= (weight * source[i + 3]) / 255
  }
  ctx.putImageData(pixel, 0, 0)
  masks.set(image, mask)
  return mask
}
