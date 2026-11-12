export type KnifePoint = { x: number; y: number }
export type KnifeTrace = {
  angle: number | null; axis: KnifePoint | null; origin: KnifePoint | null;
  bins: Set<number>; progress: number;
  previous: KnifePoint | null; wasContact: boolean; entry: KnifePoint | null;
  samples: KnifePoint[]; travel: number; retry: KnifeTrace | null;
}
type Extent = { min: number; max: number }
type KnifeSample = { point: KnifePoint; contact: boolean; extent: (axis: KnifePoint, origin: KnifePoint) => Extent }
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v))
const distance = (a: KnifePoint, b: KnifePoint) => Math.hypot(a.x - b.x, a.y - b.y)
const finite = (p: KnifePoint) => Number.isFinite(p.x) && Number.isFinite(p.y)
const dot = (a: KnifePoint, b: KnifePoint) => a.x * b.x + a.y * b.y

export function createKnifeTrace(): KnifeTrace {
  return { angle: null, axis: null, origin: null, bins: new Set(), progress: 0, previous: null, wasContact: false, entry: null, samples: [], travel: 0, retry: null }
}

function cover(trace: KnifeTrace, from: KnifePoint, to: KnifePoint, extent: Extent): void {
  const axis = trace.axis!, origin = trace.origin!, span = extent.max - extent.min
  if (!(span > 0) || !Number.isFinite(span)) return
  const tolerance = clamp(span * .075, 2.5, 16), dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy
  const originAlong = dot(origin, axis)
  for (let bin = 0; bin < 16; bin++) {
    const along = extent.min + (bin + .5) / 16 * span - originAlong
    const x = origin.x + axis.x * along, y = origin.y + axis.y * along
    const t = length2 ? clamp(((x - from.x) * dx + (y - from.y) * dy) / length2, 0, 1) : 0
    if (Math.hypot(x - from.x - dx * t, y - from.y - dy * t) <= tolerance) trace.bins.add(bin)
  }
  trace.progress = trace.bins.size / 16
}

/** Contact comes from the rendered food mesh. Extent is its actual screen projection
 * dotted onto the supplied unit axis, in the same pixel coordinates as point. */
export function traceKnife(trace: KnifeTrace, sample: KnifeSample): KnifeTrace {
  const point = sample.point
  if (!finite(point)) return trace
  // Keep a partial kerf when the player resumes it, but do not trap all later
  // gestures on the first accidental nick. A new plane needs the same stable
  // contact travel as the first cut; a tap or jitter never erases prior work.
  if (trace.retry) {
    const retry = trace.retry
    const buffered = [...(retry.entry ? [retry.entry] : []), ...retry.samples, point]
    traceKnife(retry, sample)
    if (retry.axis && retry.origin) {
      const extent = sample.extent(retry.axis, retry.origin), span = extent.max - extent.min
      const alignment = Math.abs(dot(trace.axis!, retry.axis))
      const separation = Math.abs((retry.origin.x - trace.origin!.x) * -trace.axis!.y + (retry.origin.y - trace.origin!.y) * trace.axis!.x)
      if (alignment < Math.cos(Math.PI / 12) || separation > clamp(span * .075, 2.5, 16)) {
        Object.assign(trace, retry)
        return trace
      }
      trace.retry = null
      const originalExtent = sample.extent(trace.axis!, trace.origin!)
      for (let i = 1; i < buffered.length; i++) cover(trace, buffered[i - 1], buffered[i], originalExtent)
      trace.previous = { ...point }; trace.wasContact = sample.contact
    }
    // An undecided retry must not finish the old plane before its own direction
    // is known. Replaying after confirmation preserves a genuine continuation.
    return trace
  }
  const previous = trace.previous, wasContact = trace.wasContact
  trace.previous = { ...point }; trace.wasContact = sample.contact
  if (trace.axis) {
    if (previous && (sample.contact || wasContact)) cover(trace, previous, point, sample.extent(trace.axis, trace.origin!))
    return trace
  }
  if (!sample.contact) {
    trace.samples.length = 0; trace.entry = null; trace.travel = 0
    return trace
  }
  const samples = trace.samples
  if (!samples.length) { trace.entry = previous && !wasContact ? previous : null; samples.push({ ...point }); return trace }
  const last = samples.at(-1)!, step = distance(last, point)
  if (step < .5) return trace
  samples.push({ ...point }); trace.travel += step
  const first = samples[0], chord = distance(first, point)
  if (chord < .001) return trace
  const origin = { x: samples.reduce((sum, p) => sum + p.x, 0) / samples.length, y: samples.reduce((sum, p) => sum + p.y, 0) / samples.length }
  let xx=0,xy=0,yy=0
  for(const p of samples){const x=p.x-origin.x,y=p.y-origin.y;xx+=x*x;xy+=x*y;yy+=y*y}
  const heading=.5*Math.atan2(2*xy,xx-yy),axis={x:Math.cos(heading),y:Math.sin(heading)}
  if(axis.x*(point.x-first.x)+axis.y*(point.y-first.y)<0){axis.x=-axis.x;axis.y=-axis.y}
  const spread=Math.hypot(xx-yy,2*xy),major=(xx+yy+spread)/2,minor=(xx+yy-spread)/2
  const extent = sample.extent(axis, origin), span = extent.max - extent.min
  if (!(span > 0) || !Number.isFinite(span)) return trace
  const threshold = clamp(span * .15, 5, 28)
  if (chord >= threshold && major>0 && minor<=major*.10) {
    trace.axis = axis; trace.angle = Math.atan2(axis.y, axis.x)
    trace.origin = origin
    if (trace.entry) cover(trace, trace.entry, first, extent)
    for (let i = 1; i < samples.length; i++) cover(trace, samples[i - 1], samples[i], extent)
    trace.samples = []; trace.entry = null; trace.travel = 0
  } else {
    // A curved arrival must not permanently poison a later deliberate straight cut.
    while (samples.length > 3 && (samples.length > 128 || trace.travel > span * .24)) {
      trace.travel -= distance(samples[0], samples[1]); samples.shift(); trace.entry = null
    }
  }
  return trace
}

/** Releasing keeps the partial cut; a deliberate new stroke may choose another plane. */
export function releaseKnifeTrace(trace: KnifeTrace): void {
  trace.previous = null; trace.wasContact = false; trace.entry = null; trace.samples.length = 0; trace.travel = 0
  trace.retry = trace.axis && trace.progress < .875 ? createKnifeTrace() : null
}
