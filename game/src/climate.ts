export const traitIds = ['dew', 'frost', 'rainbow', 'star'] as const;
export type Trait = typeof traitIds[number];
export type Weather = 'sun' | 'rain' | 'snow' | 'rainbow' | 'stars';

export const weatherNames: Record<Weather, string> = {
  sun: 'Clear', rain: 'Rain', snow: 'Snow', rainbow: 'Rainbow', stars: 'Starlight',
};

export const traitNames: Record<Trait, string> = {
  dew: 'Dewkissed', frost: 'Frosted', rainbow: 'Rainbow', star: 'Star-touched',
};

const exposures: Record<Exclude<Weather, 'sun'>, { trait: Trait; chance: number }> = {
  rain: { trait: 'dew', chance: 35 },
  snow: { trait: 'frost', chance: 30 },
  rainbow: { trait: 'rainbow', chance: 45 },
  stars: { trait: 'star', chance: 35 },
};

export function dayRoll(day: number, source: number): number {
  let hash = Math.imul(day, 0x9e3779b1) ^ Math.imul(source, 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return ((hash ^ (hash >>> 16)) >>> 0) % 100;
}

export function getClimate(day: number): { weather: Weather } {
  // Give the starting farm time for a full growing cycle before the first unusual sky.
  if (day < 5) return { weather: 'sun' };
  if (day === 5) return { weather: 'rainbow' };
  const chance = dayRoll(day, 256);
  return { weather: chance < 18 ? 'rain' : chance < 30 ? 'snow'
    : chance < 42 ? 'rainbow' : chance < 54 ? 'stars' : 'sun' };
}

export function exposedTrait(day: number, weather: Weather, source: number): Trait | undefined {
  if (weather === 'sun') return undefined;
  const { trait, chance } = exposures[weather];
  return dayRoll(day, source) < chance ? trait : undefined;
}
