import { traitIds, type Trait } from './climate'
import { preserveFillMask } from './preserve-mask'
import { loadImage } from './image-assets'

type ImageSource = HTMLImageElement | HTMLCanvasElement
type Surface = 'fruit' | 'jar' | 'jam'
const painted = new WeakMap<ImageSource, Map<string, HTMLCanvasElement>>()
const thumbUrls = new Map<string, Promise<string>>()

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4,
      radius = i % 2 ? size * 0.23 : size
    const px = x + Math.cos(angle) * radius,
      py = y + Math.sin(angle) * radius
    if (i) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

// Paint a material finish onto the original alpha silhouette once per source and mixture.
export function finishedIngredient(
  source: ImageSource,
  traits: readonly Trait[],
  surface: Surface = 'fruit',
): ImageSource {
  if (!traits.length) return source
  const kinds = traitIds.filter((t) => traits.includes(t))
  if (!kinds.length) return source
  const key = surface + ':' + kinds.join(',')
  let variants = painted.get(source)
  if (!variants) {
    variants = new Map()
    painted.set(source, variants)
  }
  const old = variants.get(key)
  if (old) return old
  const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  const scale = Math.min(1, 640 / Math.max(sw, sh))
  const art = document.createElement('canvas')
  art.width = Math.max(1, Math.round(sw * scale))
  art.height = Math.max(1, Math.round(sh * scale))
  const ctx = art.getContext('2d')!
  ctx.drawImage(source, 0, 0, art.width, art.height)
  const mask =
    surface === 'jar' && source instanceof HTMLImageElement ? preserveFillMask(source) : undefined
  if (surface === 'jar' && !mask) return source
  // Find the actual painted area; loose sprite cells can have very wide transparent margins.
  const sample = document.createElement('canvas')
  sample.width = sample.height = 48
  const probe = sample.getContext('2d', { willReadFrequently: true })!
  probe.drawImage(art, 0, 0, 48, 48)
  const rgba = probe.getImageData(0, 0, 48, 48).data
  let x0 = 48,
    x1 = 0,
    y0 = 48,
    y1 = 0
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 48; x++)
      if (rgba[(y * 48 + x) * 4 + 3] > 90) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x + 1)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y + 1)
      }
  if (x1 <= x0 || y1 <= y0) return source
  ctx.translate((x0 * art.width) / 48, (y0 * art.height) / 48)
  ctx.scale(((x1 - x0) * art.width) / 4800, ((y1 - y0) * art.height) / 4800)
  const glass = surface === 'jar' ? ctx.getImageData(0, 0, art.width, art.height) : undefined
  ctx.globalCompositeOperation = 'source-atop'
  const wash = (colors: string[], diagonal = false) => {
    const g = ctx.createLinearGradient(0, 0, diagonal ? 100 : 0, 100)
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 100, 100)
  }
  for (const kind of kinds) {
    ctx.save()
    ctx.globalAlpha = (kinds.length > 1 ? 0.82 : 1) * (surface === 'fruit' ? 1 : 0.64)
    let seed = 1741 + traitIds.indexOf(kind) * 71
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    if (kind === 'frost') {
      wash(['#dbffffc7', '#abcff396', '#acc7fa35', '#f2ffff93'], true)
      for (let i = 0; i < (surface === 'jam' ? 80 : 36); i++) {
        const x = random() * 100,
          y = random() * 100,
          r = (2 + random() * 4) * (surface === 'jam' ? 0.53 : 1)
        ctx.fillStyle = i % 2 ? '#f6ffffbf' : '#93d1efb8'
        ctx.beginPath()
        ctx.moveTo(x, y - r)
        ctx.lineTo(x + r * 0.68, y)
        ctx.lineTo(x, y + r * 1.4)
        ctx.lineTo(x - r * 0.5, y)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#ffffffc4'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(x - r * 0.5, y)
        ctx.lineTo(x, y - r)
        ctx.lineTo(x + r * 0.68, y)
        ctx.stroke()
      }
    } else if (kind === 'dew') {
      wash(['#aedcdd42', '#62b4bf25'])
      for (let i = 0; i < 24; i++) {
        const x = random() * 100,
          y = random() * 100,
          r = 1.7 + random() * 2.5
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, 0.08 * r, x, y, r)
        g.addColorStop(0, '#ffffff')
        g.addColorStop(0.3, '#d4fcffdb')
        g.addColorStop(0.61, '#abe7f061')
        g.addColorStop(0.92, '#458b9aba')
        g.addColorStop(1, '#e0ffffaa')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(x, y, r, r * 1.1, -0.2, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (kind === 'rainbow') {
      wash(
        ['#f6b3e792', '#b89af39d', '#76d5fa92', '#91e6c28c', '#ffe28c99', '#f6abc68e', '#cdaff293'],
        true,
      )
      // Narrow pearlescent glints retain the shadows between individual berries.
      for (let i = 0; i < 9; i++) {
        const x = random() * 100,
          y = random() * 100,
          r = 2 + random() * 3
        const glint = ctx.createRadialGradient(x, y, 0, x, y, r)
        glint.addColorStop(0, '#fffbe9ac')
        glint.addColorStop(1, '#fffbe900')
        ctx.fillStyle = glint
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
      }
    } else {
      wash(['#493c873c', '#72619760', '#dc9a8445'], true)
      for (let i = 0; i < 22; i++) {
        ctx.fillStyle = i % 3 ? '#fff4bfd9' : '#ffdf7a'
        sparkle(ctx, random() * 100, random() * 100, 1.4 + random() * 3.3)
      }
    }
    ctx.restore()
  }
  if (glass && mask) {
    const maskedLayer = ctx.getImageData(0, 0, art.width, art.height)
    const coating = document.createElement('canvas')
    coating.width = art.width
    coating.height = art.height
    const paint = coating.getContext('2d')!
    paint.drawImage(mask, 0, 0, art.width, art.height)
    const coverage = paint.getImageData(0, 0, art.width, art.height).data
    for (let i = 0; i < glass.data.length; i += 4) {
      const light = (glass.data[i] * 0.213 + glass.data[i + 1] * 0.715 + glass.data[i + 2] * 0.072) / 255
      // Keep deep fruit shadows beneath the iridescence; glints already live on the glass.
      maskedLayer.data[i + 3] = coverage[i + 3] * (0.3 + 0.7 * Math.sqrt(light))
    }
    paint.putImageData(maskedLayer, 0, 0)
    ctx.resetTransform()
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(source, 0, 0, art.width, art.height)
    ctx.globalCompositeOperation = 'source-atop'
    ctx.drawImage(coating, 0, 0)
  }
  variants.set(key, art)
  return art
}

export function applyIngredientFinishes(host: HTMLElement) {
  for (const image of host.querySelectorAll<HTMLImageElement>('img[data-finish]')) {
    const traits = image.dataset
      .finish!.split(' ')
      .filter((s): s is Trait => traitIds.includes(s as Trait))
    if (!traits.length || image.dataset.finishApplied) continue
    const url = image.src,
      surface: Surface = image.dataset.surface === 'jar' ? 'jar' : 'fruit',
      key = [url, surface, ...traits].join('|')
    image.dataset.finishApplied = 'true'
    let thumb = thumbUrls.get(key)
    if (!thumb) {
      thumb = loadImage(url).then((source) => {
        const art = finishedIngredient(source, traits, surface),
          preview = document.createElement('canvas')
        const factor = Math.min(1, 240 / Math.max(art.width, art.height))
        preview.width = Math.max(1, Math.round(art.width * factor))
        preview.height = Math.max(1, Math.round(art.height * factor))
        preview.getContext('2d')!.drawImage(art, 0, 0, preview.width, preview.height)
        return preview.toDataURL('image/png')
      })
      thumbUrls.set(key, thumb)
      if (thumbUrls.size > 64) thumbUrls.delete(thumbUrls.keys().next().value!)
    }
    void thumb
      .then((src) => {
        if (image.isConnected && image.src === url) image.src = src
      })
      .catch(() => {
        thumbUrls.delete(key)
        delete image.dataset.finishApplied
      })
  }
}
