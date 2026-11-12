/** Pitcher control is normalized from upright (0) to fully tipped (1).
 * The rendered angle, stream radius and deposited dose share this one flow law. */
export function honeyPourFlow(tilt: number): number {
  if (!Number.isFinite(tilt)) return 0
  const t = Math.max(0, Math.min(1, (tilt - .16) / .84))
  return t * t * (3 - 2 * t)
}

export function honeyPourAngle(tilt: number): number {
  return tilt > 0 && Number.isFinite(tilt) ? -1.05 * Math.min(1, tilt) : 0
}
