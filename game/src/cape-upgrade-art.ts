// Sprites use 512px cells with their shared ground line at source y=480.
// Render with fullCell=true to retain the registered margins and baseline.
export const capeUpgradeArt = {
  apiary: {
    path: 'lavender/cape-apiary',
    x: 995, y: 365, w: 212, h: 212, baseline: 480 / 512,
    shadow: { width: 512, height: 512, baseline: 480 / 512, castHeight: 240, contacts: [
      { x: 79, y: 388, rx: 22, ry: 6 }, { x: 173, y: 463, rx: 21, ry: 6 },
      { x: 226, y: 426, rx: 18, ry: 5 }, { x: 383, y: 480, rx: 22, ry: 6 },
      { x: 430, y: 438, rx: 20, ry: 5 },
    ] },
  },
  kitchen: {
    path: 'lavender/cape-honey-kitchen',
    x: 660, y: 365, w: 300, h: 300, baseline: 480 / 512,
    stop: { x: 650, y: 410 },
    steam: { x: 660, y: 269 },
    shadow: { width: 512, height: 512, baseline: 480 / 512, castHeight: 310, contacts: [
      { x: 67, y: 457, rx: 23, ry: 6 }, { x: 137, y: 443, rx: 48, ry: 8 },
      { x: 208, y: 468, rx: 21, ry: 6 }, { x: 385, y: 480, rx: 22, ry: 6 },
      { x: 433, y: 446, rx: 22, ry: 6 },
    ] },
  },
} as const;
