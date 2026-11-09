// Contact points are registered in each cropped ImageGen sprite's source pixels.
export const festivalRewardArt = {
  harvest: {
    x: 535, y: 689, w: 110, h: 110 * 496 / 566,
    shadow: { width: 566, height: 496, baseline: 1, castHeight: 240, contacts: [
      { x: 125, y: 460, rx: 65, ry: 12 }, { x: 326, y: 471, rx: 66, ry: 15 }, { x: 492, y: 424, rx: 48, ry: 12 },
    ] },
  },
  lights: {
    x: 367, y: 784, w: 169, h: 169 * 502 / 614,
    shadow: { width: 614, height: 502, baseline: 1, castHeight: 300, contacts: [
      { x: 80, y: 480, rx: 45, ry: 11 }, { x: 546, y: 480, rx: 45, ry: 11 },
    ] },
  },
  stage: {
    x: 805, y: 423, w: 151, h: 151 * 486 / 657,
    shadow: { width: 657, height: 486, baseline: 1, castHeight: 150, contacts: [
      { x: 52, y: 397, rx: 29, ry: 8 }, { x: 230, y: 469, rx: 33, ry: 9 }, { x: 573, y: 420, rx: 33, ry: 9 },
    ] },
  },
} as const;
