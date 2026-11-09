export const traitIds = ['dew', 'frost', 'rainbow', 'star'] as const;
export type Trait = typeof traitIds[number];
export type Weather = 'sun' | 'rain' | 'snow' | 'rainbow' | 'stars';

export const weatherNames: Record<Weather, string> = {
  sun: 'Ясно', rain: 'Дождь', snow: 'Снег', rainbow: 'Радуга', stars: 'Звёздное небо',
};

export const traitNames: Record<Trait, string> = {
  dew: 'Росистый', frost: 'Морозный', rainbow: 'Радужный', star: 'Звёздный',
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

// From day six each eight-day cycle has four two-day weather windows.
const skies = ['rain', 'snow', 'stars', 'rainbow'] as const;
export function getClimate(day: number): { weather: Weather } {
  if (day < 5) return { weather: 'sun' };
  if (day === 5) return { weather: 'rainbow' };
  const offset = day - 6, cycle = Math.floor(offset / 8), pair = Math.floor(offset % 8 / 2);
  const eventDay = dayRoll(cycle, 260 + pair) % 2;
  if (offset % 2 === eventDay) return { weather: skies[pair] };
  return { weather: dayRoll(day,256) < 12 ? 'rain' : 'sun' };
}

export function nextWeatherDay(day: number, weather: Exclude<Weather,'sun'>): number {
  for (let offset = 0; offset < 16; offset++) {
    const candidate = day + offset;
    if (getClimate(candidate).weather === weather) return candidate;
  }
  throw new RangeError('Day is outside the weather calendar');
}

export function exposedTrait(day: number, weather: Weather, source: number): Trait | undefined {
  if (weather === 'sun') return undefined;
  const { trait, chance } = exposures[weather];
  if (day <= 5) return dayRoll(day, source) < chance ? trait : undefined;
  // Step through the probability range once per cycle for each bed, tree or nest.
  // A tended source cannot repeatedly lose independent rolls for the same sky.
  const cycle = Math.floor((day - 6) / 8);
  const phase = dayRoll(source, skies.indexOf(weather) + 501);
  return (phase + cycle * chance) % 100 < chance ? trait : undefined;
}
