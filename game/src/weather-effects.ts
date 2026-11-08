import type { Trait, Weather } from './climate';
import { scenePoint } from './lavender-layout';
import type { IslandWorld } from './world';

function fraction(value: number): number {
  return value - Math.floor(value);
}

function seed(index: number): number {
  return fraction(Math.sin(index * 61.21 + 8.07) * 39771.3);
}

const particles = Array.from({ length: 56 }, (_, index) => {
  const column = index % 8;
  const row = Math.floor(index / 8);
  return {
    x: 90 + (column + 0.15 + seed(index * 3) * 0.7) * 158,
    phase: (row + 0.15 + seed(index * 3 + 1) * 0.7) / 7,
    size: seed(index * 3 + 2),
    sparse: (row + column * 2) % 5 === 0,
  };
});

const shoreRipples = [
  [170, 919], [335, 951], [665, 950], [795, 944], [1010, 934], [1235, 940],
  [1455, 896], [1512, 822], [800, 82],
].map(([x, y]) => scenePoint(x, y));

const rainbowColors = ['244, 164, 169', '255, 226, 163', '176, 231, 210', '189, 189, 241'];
const rainbowMotes = ['#ffc0c2', '#ffe29a', '#c9ffea', '#e5d3ff'];
const weatherWash = { rain: '#536e911c', snow: '#bdd6f01b', stars: '#48477d29' } as const;

function makeRainbow(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1440;
  canvas.height = 394;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.filter = 'blur(1.5px)';
  rainbowColors.forEach((color, band) => {
    const tint = context.createLinearGradient(38, 0, 1402, 0);
    tint.addColorStop(0, `rgba(${color}, 0)`);
    tint.addColorStop(0.21, `rgba(${color}, 0.38)`);
    tint.addColorStop(0.55, `rgba(${color}, 0.66)`);
    tint.addColorStop(0.82, `rgba(${color}, 0.32)`);
    tint.addColorStop(1, `rgba(${color}, 0)`);
    context.strokeStyle = tint;
    context.lineWidth = 7;
    context.shadowColor = `rgba(${color}, 0.5)`;
    context.shadowBlur = 7;
    context.beginPath();
    context.ellipse(720, 346, 680 - band * 8, 325 - band * 7, 0, Math.PI, 2 * Math.PI);
    context.stroke();
  });
  return canvas;
}

export function createWeatherEffects(world: IslandWorld) {
  let rainbow: HTMLCanvasElement | undefined;
  const airLayer = world.overlay - 4;
  const traitLayer = world.overlay + 1;

  function sparkle(x: number, y: number, size: number, color: string, alpha: number, layer: number): void {
    world.shape('diamond', x, y, size * 0.47, size, color, alpha, layer);
    world.shape('diamond', x, y, size * 0.77, size * 0.35, color, alpha, layer);
  }

  return {
    paint(weather: Weather, time: number, reducedMotion: boolean): void {
      if (weather === 'sun') return;
      if (weather === 'rainbow') {
        const arc = rainbow ??= makeRainbow();
        // Behind the plate, the island's silhouette hides the two ends.
        world.sprite(arc, { x: 0, y: 0, w: arc.width, h: arc.height }, 720, -10, arc.width, arc.height,
          { layer: -101, baseline: 0 });
      } else {
        world.wash(weatherWash[weather]);
      }

      particles.forEach(({ x, phase, size, sparse }, index) => {
        if (reducedMotion ? !sparse : (weather === 'rainbow' || weather === 'stars') && index % 3 !== 0) return;
        if (weather === 'rain') {
          const fall = fraction(phase + time * (0.45 + 0.23 * size));
          const visibility = Math.min(fall * 12, (1 - fall) * 12, 1);
          world.shape('shade', x + (0.5 - fall) * 90, 36 + fall * 824, 1.2 + size * 0.55, 10 + size * 11,
            '#cfecff', (0.4 + size * 0.22) * visibility, airLayer, 0.12);
        } else if (weather === 'snow') {
          const fall = fraction(phase + time * (0.043 + size * 0.027));
          const drift = Math.sin(time * (0.84 + size * 0.6) + index) * (12 + size * 20);
          const visibility = Math.min(fall * 12, (1 - fall) * 12, 1);
          const radius = 1.5 + size * 2.4;
          world.shape('ellipse', x + drift, 36 + fall * 824, radius, radius * 0.91,
            size > 0.65 ? '#f9faff' : '#d4e7ff', (0.44 + size * 0.31) * visibility, airLayer);
        } else if (weather === 'stars') {
          const large = size > 0.52;
          const fall = fraction(phase + time * (large ? 0.06 : 0.028));
          const px = x + (0.5 - fall) * 140;
          const y = 65 + fall * 700;
          const visibility = Math.min(fall * 9, (1 - fall) * 9, 1);
          const shimmer = (reducedMotion ? 0.85 : 0.72 + Math.sin(time * 1.6 + index) * 0.18) * visibility;
          const color = large ? '#f9e9ff' : '#dbcdff';
          if (large) {
            world.shape('shade', px, y, 15, 13, color, shimmer * 0.38, airLayer);
            if (!reducedMotion) world.shape('shade', px + 2, y - 9, 1.6, 11, color, shimmer * 0.43, airLayer, 0.2);
            sparkle(px, y, 6 + size * 2, color, shimmer, airLayer);
          } else {
            world.shape('diamond', px, y, 1.8 + size, 2.6 + size, color, shimmer, airLayer);
          }
        } else {
          const drift = Math.sin(time * 0.42 + index) * 14;
          const y = 85 + phase * 700 + Math.sin(time * 0.79 + index * 0.71) * 10;
          const shimmer = reducedMotion ? 0.72 : 0.48 + Math.sin(time * 1.6 + index) * 0.25;
          world.shape('diamond', x + drift, y, 2 + size, 2.8 + size,
            rainbowMotes[index % rainbowMotes.length], shimmer * 0.88, airLayer);
        }
      });

      if (weather === 'rain') shoreRipples.forEach(({ x, y }, index) => {
        if (reducedMotion && index % 3 !== 0) return;
        const spread = reducedMotion ? 0.35 : fraction(time * 0.83 + index * 0.381);
        const radius = 5 + spread * 13;
        world.shape('outline', x, y, radius, radius * 0.32, '#c3f6f0', (1 - spread) * 0.52, -95);
      });
    },

    glint(trait: Trait, x: number, y: number, time: number): void {
      const gleam = 0.86 + 0.12 * Math.sin(time * 2 + x * 0.018);
      world.shape('shade', x, y, 10, 10, '#494765', 0.46, traitLayer);
      switch (trait) {
        case 'dew':
          world.shape('diamond', x, y - 1.3, 3.3, 6.4, '#c9f6f4', gleam, traitLayer);
          world.shape('ellipse', x, y + 1, 3.3, 3.6, '#c9f6f4', gleam, traitLayer);
          world.shape('ellipse', x - 0.8, y, 1, 1.6, '#f0fffc', gleam, traitLayer);
          break;
        case 'frost':
          world.shape('diamond', x, y, 1.6, 6, '#c3e5ff', gleam, traitLayer);
          world.shape('diamond', x, y, 1.6, 6, '#c3e5ff', gleam, traitLayer, Math.PI / 3);
          world.shape('diamond', x, y, 1.6, 6, '#c3e5ff', gleam, traitLayer, -Math.PI / 3);
          break;
        case 'rainbow':
          world.shape('diamond', x - 3.9, y + 1, 2.4, 3.6, rainbowMotes[0], gleam, traitLayer);
          world.shape('diamond', x, y - 1.6, 2.4, 4.4, rainbowMotes[1], gleam, traitLayer);
          world.shape('diamond', x + 3.9, y + 1, 2.4, 3.6, rainbowMotes[2], gleam, traitLayer);
          break;
        case 'star':
          sparkle(x, y, 6.8, '#ffe9ad', gleam, traitLayer);
          break;
      }
    },
  };
}
