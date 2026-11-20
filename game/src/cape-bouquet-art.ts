/** Hand grips in authored 160px cells (x relative to cell centre). The bouquet is
 * part of the same atlas as the body, so it shares bob, shadow, scaling and cover. */
const grips: Record<string, readonly (readonly [number,number])[]> = {
  'farmer-actions':[[-22,102]],
  'walk-left-smooth':[[-26,95],[-20,99],[-19,95],[-17,93],[-20,98],[-17,99],[-11,93],[-16,94]],
  'walk-right-smooth':[[24,91],[21,94],[18,93],[22,92],[23,93],[19,92],[22,92],[18,90]],
  'walk-back-smooth':[[27,83],[26,90],[24,90],[21,97],[27,80],[26,93],[26,90],[27,88]],
  'walk-left':[[-26,95],[-20,98],[-12,95],[-16,97]],
  'walk-right':[[26,92],[22,96],[13,94],[24,95]],
  'walk-back':[[29,82],[26,91],[27,82],[26,96]],
}
const cache = new WeakMap<HTMLImageElement,HTMLCanvasElement>()
export function bouquetCarrySheet(key:string, base?:HTMLImageElement, flowers?:HTMLImageElement) {
  const hand=grips[key]
  if (!hand || !base || !flowers) return
  const cached=cache.get(base); if(cached) return cached
  const sheet=document.createElement('canvas'); sheet.width=base.naturalWidth;sheet.height=base.naturalHeight
  const c=sheet.getContext('2d'); if(!c) return
  c.drawImage(base,0,0)
  const cw=sheet.width/(key==='farmer-actions'?6:hand.length),dir=key.includes('right')||key.includes('back')?1:-1
  hand.forEach(([dx,y],i)=>{
    const x=(i+.5)*cw+dx
    c.save(); c.translate(x,y);c.rotate(dir*28*Math.PI/180)
    c.drawImage(flowers,-42*65/128,-42*98/128,42,42);c.restore()
    // Repaint just the original knuckles, leaving the stems gripped, not hovering.
    c.save();c.beginPath();c.ellipse(x,y,4,5,0,0,Math.PI*2);c.clip();c.drawImage(base,0,0);c.restore()
  })
  cache.set(base,sheet);return sheet
}
