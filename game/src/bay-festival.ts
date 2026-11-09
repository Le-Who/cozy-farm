import { festivalMelodyNames } from './bay-music-model.ts';
import type { FarmState, StockItem } from './farm.ts';

export const festivalTraditions = ['harvest', 'lights', 'stage'] as const;
export type FestivalTradition = (typeof festivalTraditions)[number];
export type FestivalPreparation = {
  tradition: FestivalTradition;
  edition: number;
  stage: number;
  startedOn: number;
  readyOn: number;
  performanceBaseline: number;
  materialValue: number;
  cargoDelivered: number;
  activity: Record<FestivalActivity, boolean>;
  delivered: Record<string, number>;
};
export type FestivalActivity = 'harvest' | 'bake' | 'fish' | 'shore';
export type BayFestivalState = {
  completed: Record<FestivalTradition, number>;
  lastCompletedOn: number;
  active: FestivalPreparation | null;
};
export const festivalDefinitions = {
  harvest: {
    name: 'Праздник урожая',
    description: 'Садовые плоды, разноцветные корзины и общий стол.',
    effect: 'Расширение склада гавани и постоянные украшения урожая.',
  },
  lights: {
    name: 'Огни причала',
    description: 'Обычный улов, береговые находки и припасы для соседей.',
    effect: 'Новые огни на причале и дополнительные гости лавки.',
  },
  stage: {
    name: 'Садовая сцена',
    description: 'Угощение, общий стол и живой концерт собственного сада.',
    effect: 'Украшенная сцена и новые мелодии музыкального сада.',
  },
} as const;
const editionNames = {
  harvest: ['Садовый стол', 'Пикник огородников', 'Кладовая соседей'],
  lights: ['Береговые фонари', 'Ужин рыбаков', 'Припасы дальнего причала'],
  stage: ['Фруктовое утро', 'Медовый вечер', 'Песни к общему столу'],
} as const;
type FestivalHost = Pick<
  FarmState,
  'day' | 'island' | 'village' | 'concertDay' | 'musicGarden' | 'freight' | 'culinary'
>;
export type FestivalContext = FestivalHost & {
  count: (item: StockItem) => number;
  take: (item: StockItem) => void;
  value: (item: StockItem) => number;
};
type Alternative = {
  id: string;
  label: string;
  quantity: number;
  item?: StockItem;
  event?: 'concert' | 'delivery' | FestivalActivity;
  signature?: string;
};
type Requirement = { id: string; label: string; quantity: number; alternatives: Alternative[] };
type Preparation = { label: string; detail: string; requirements: Requirement[] };
export type FestivalResult = { ok: boolean; message: string; reward?: number; tradition?: FestivalTradition };
const tradition = (v: unknown): v is FestivalTradition => festivalTraditions.some((id) => id === v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const success = (message: string): FestivalResult => ({ ok: true, message });
const fail = (message: string): FestivalResult => ({ ok: false, message });
const stock = (id: string, label: string, item: StockItem, quantity = 1): Alternative => ({
  id,
  label,
  item,
  quantity,
});
const fruit = [
  stock('apple', 'Яблоки', { kind: 'fruit', item: 'apple', quantity: 1 }),
  stock('pear', 'Груши', { kind: 'fruit', item: 'pear', quantity: 1 }),
  stock('peach', 'Персики', { kind: 'fruit', item: 'peach', quantity: 1 }),
];
const roots = [
  stock('carrot', 'Морковь', { kind: 'produce', item: 'carrot', quantity: 1 }),
  stock('beetroot', 'Свёкла', { kind: 'produce', item: 'beetroot', quantity: 1 }),
  stock('pumpkin', 'Тыква', { kind: 'produce', item: 'pumpkin', quantity: 1 }),
];
const greens = [
  stock('leafyGreens', 'Зелень', { kind: 'produce', item: 'leafyGreens', quantity: 1 }),
  stock('cabbage', 'Капуста', { kind: 'produce', item: 'cabbage', quantity: 1 }),
  stock('wheat', 'Пшеница', { kind: 'produce', item: 'wheat', quantity: 1 }),
];
const fish = [
  stock('perch', 'Окунь', { kind: 'fish', item: 'perch', quantity: 1 }),
  stock('seaBass', 'Морской окунь', { kind: 'fish', item: 'seaBass', quantity: 1 }),
  stock('moonfish', 'Лунная рыба', { kind: 'fish', item: 'moonfish', quantity: 1 }),
  stock('lanternfish', 'Рыба-фонарь', { kind: 'fish', item: 'lanternfish', quantity: 1 }),
];
const baking = [
  stock('round', 'Круглая булочка', { kind: 'handmade', item: 'round', quantity: 1 }),
  stock('folded', 'Слойка', { kind: 'handmade', item: 'folded', quantity: 1 }),
  stock('long', 'Батон', { kind: 'handmade', item: 'long', quantity: 1 }),
  stock('appleJam', 'Яблочное варенье', { kind: 'dishes', item: 'appleJam', quantity: 1 }),
  stock('orchardTart', 'Фруктовый пирог', { kind: 'dishes', item: 'orchardTart', quantity: 1 }),
];
const honey = [
  stock('honey', 'Цветочный мёд', { kind: 'honey', quantity: 1 }),
  stock('apple', 'Яблоки вместо мёда', { kind: 'fruit', item: 'apple', quantity: 1 }, 2),
];
function themedPreparations(active: FestivalPreparation, context?: FestivalContext): Preparation[] {
  const scale = Math.min(3, active.edition),
    variant = (active.edition - 1) % 3;
  const treats = [
    ...baking,
    ...(context?.culinary.recipes ?? []).map((recipe) => ({
      id: `signature:${recipe.id}`,
      label: recipe.name,
      quantity: 1,
      signature: recipe.id,
    })),
  ];
  const req = (id: string, label: string, quantity: number, alternatives: Alternative[]): Requirement => ({
    id,
    label,
    quantity,
    alternatives,
  });
  if (active.tradition === 'harvest')
    return variant === 0
      ? [
          {
            label: 'Плоды первого стола',
            detail: 'Принесите любые садовые плоды. Можно вносить их понемногу.',
            requirements: [req('fruit', 'Плоды сада', 2 + scale, fruit)],
          },
          {
            label: 'Разноцветные корзины',
            detail: 'Соберите корнеплоды и вторую корзину зелени или зерна.',
            requirements: [
              req('roots', 'Корнеплоды', 2 + scale, roots),
              req('greens', 'Зелень или зерно', 2, greens),
            ],
          },
          {
            label: 'Угощения соседям',
            detail: 'Слепите булочку, сварите варенье или принесите своё приготовленное угощение.',
            requirements: [req('treat', 'Приготовленное угощение', 1 + scale, treats)],
          },
        ]
      : variant === 1
        ? [
            {
              label: 'Корзины для пикника',
              detail: 'Для пикника нужны две разные группы урожая.',
              requirements: [
                req('roots', 'Корнеплоды', 2 + scale, roots),
                req('fruit', 'Садовые плоды', 2, fruit),
              ],
            },
            {
              label: 'Сладкая заправка',
              detail: 'Принесите мёд или замените каждую порцию двумя яблоками.',
              requirements: [req('honey', 'Заправка для пикника', scale, honey)],
            },
            {
              label: 'Выпечка на пледе',
              detail: 'Подготовьте любимую выпечку или варенье для общего пикника.',
              requirements: [req('treat', 'Угощение для пикника', 1 + scale, treats)],
            },
          ]
        : [
            {
              label: 'Зерновая кладовая',
              detail: 'Соседи запасают зерно и садовые плоды.',
              requirements: [
                req('greens', 'Зелень или зерно', 3 + scale, greens),
                req('fruit', 'Садовые плоды', 2, fruit),
              ],
            },
            {
              label: 'Обмен урожаем',
              detail: 'Для обмена принесите корнеплоды и мёд или яблоки.',
              requirements: [
                req('roots', 'Корнеплоды', 2 + scale, roots),
                req('honey', 'Мёд или яблоки', 1, honey),
              ],
            },
            {
              label: 'Баночки и угощения',
              detail: 'Готовое угощение завершит соседскую кладовую.',
              requirements: [req('treat', 'Приготовленное угощение', 1 + scale, treats)],
            },
          ];
  if (active.tradition === 'lights') {
    const shore = [
      stock('shells', 'Обычные ракушки', { kind: 'shells', item: 'regular', quantity: 1 }),
      stock('salt', 'Морская соль вместо ракушек', { kind: 'seaSalt', quantity: 1 }, 2),
    ];
    const delivery: Alternative = {
      id: 'delivery',
      label: 'Доставленный после выбора груз',
      quantity: 1,
      event: 'delivery',
    };
    const cargo = [
      delivery,
      stock('wheat', 'Пшеница, принесённая вручную', { kind: 'produce', item: 'wheat', quantity: 1 }),
      stock('salt', 'Соль, принесённая вручную', { kind: 'seaSalt', quantity: 1 }),
    ];
    const catchStage = {
      label: variant === 1 ? 'Ужин рыбаков' : 'Улов для причала',
      detail: 'Подойдёт любая рыба, в том числе обычный окунь Родного острова.',
      requirements: [req('fish', 'Любая рыба', 2 + scale, fish)],
    };
    const shoreStage = {
      label: variant === 2 ? 'Знаки для дальнего причала' : 'Береговые фонари',
      detail: 'Обычные ракушки можно заменить солью. Лунные находки не нужны.',
      requirements: [req('shore', 'Украшения берега', 1 + scale, shore)],
    };
    const cargoStage = {
      label: variant === 1 ? 'Угощение для рыбаков' : 'Припасы соседям',
      detail:
        variant === 1
          ? 'Приготовьте угощение к рыбному ужину.'
          : 'Дождитесь разгрузки парома в гавани после выбора праздника или принесите припасы вручную.',
      requirements:
        variant === 1
          ? [req('treat', 'Угощение к ужину', 1 + scale, treats)]
          : [req('cargo', 'Припасы для гавани', 2 + scale, cargo)],
    };
    return variant === 2
      ? [cargoStage, catchStage, shoreStage]
      : variant === 1
        ? [shoreStage, catchStage, cargoStage]
        : [catchStage, shoreStage, cargoStage];
  }
  const concert: Preparation = {
    label: variant === 1 ? 'Медовый концерт' : 'Концерт музыкального сада',
    detail: 'Сыграйте живой концерт после выбора этой программы. Прежние концерты не засчитываются.',
    requirements: [
      req('concert', 'Новый живой концерт', 1, [
        { id: 'concert', label: 'Сыгранный концерт', quantity: 1, event: 'concert' },
      ]),
    ],
  };
  const table: Preparation = {
    label: variant === 2 ? 'Большой соседский стол' : 'Стол у сцены',
    detail: 'Подготовьте урожай или плоды для гостей музыкального сада.',
    requirements: [
      req('fruit', 'Плоды для гостей', 2 + scale, fruit),
      req('greens', 'Урожай к столу', scale, greens),
    ],
  };
  const themed: Preparation = {
    label: variant === 1 ? 'Медовое угощение' : 'Угощение музыкального сада',
    detail:
      variant === 1
        ? 'Медовый кекс или другая приготовленная выпечка; мёд можно заменить садовым угощением.'
        : 'Принесите своё блюдо, булочку, варенье или фруктовый пирог.',
    requirements: [
      req(
        'treat',
        'Тематическое угощение',
        1 + scale,
        variant === 1
          ? [
              stock('honeyCake', 'Медовый кекс', { kind: 'dishes', item: 'honeyCake', quantity: 1 }),
              ...treats,
            ]
          : treats,
      ),
    ],
  };
  return variant === 0
    ? [themed, table, concert]
    : variant === 1
      ? [table, concert, themed]
      : [concert, themed, table];
}
function preparations(active: FestivalPreparation, context?: FestivalContext): Preparation[] {
  const stages = themedPreparations(active, context);
  const alternatives: Alternative[] =
    active.tradition === 'harvest'
      ? [
          { id: 'harvest', label: 'Новый сбор урожая или плодов', quantity: 1, event: 'harvest' },
          { id: 'bake', label: 'Новая домашняя выпечка или заготовка', quantity: 1, event: 'bake' },
        ]
      : active.tradition === 'lights'
        ? [
            { id: 'fish', label: 'Новый успешный улов', quantity: 1, event: 'fish' },
            { id: 'shore', label: 'Новая находка на берегу', quantity: 1, event: 'shore' },
            { id: 'delivery', label: 'Новая разгрузка парома в гавани', quantity: 1, event: 'delivery' },
          ]
        : [];
  if (alternatives.length)
    stages[0].requirements.unshift({
      id: 'participation',
      label: 'Личное участие после выбора программы',
      quantity: 1,
      alternatives,
    });
  return stages;
}
export function noteFestivalActivity(state: BayFestivalState, activity: FestivalActivity): void {
  if (state.active) state.active.activity[activity] = true;
}
export function noteFestivalDelivery(state: BayFestivalState, quantity: number): void {
  if (state.active && integer(quantity) && quantity > 0)
    state.active.cargoDelivered = Math.min(1000000, state.active.cargoDelivered + quantity);
}
export function createBayFestival(): BayFestivalState {
  return { completed: { harvest: 0, lights: 0, stage: 0 }, lastCompletedOn: 0, active: null };
}
export function restoreBayFestival(
  value: unknown,
  day: number,
  unlocked: boolean,
): BayFestivalState | undefined {
  if (value === undefined) return createBayFestival();
  if (
    !record(value) ||
    !record(value.completed) ||
    !integer(value.lastCompletedOn) ||
    value.lastCompletedOn > day
  )
    return undefined;
  const completed = {
    harvest: value.completed.harvest,
    lights: value.completed.lights,
    stage: value.completed.stage,
  };
  if (!festivalTraditions.every((id) => integer(completed[id]) && completed[id] <= 100000)) return undefined;
  const counts = completed as Record<FestivalTradition, number>,
    total = counts.harvest + counts.lights + counts.stage;
  if (
    total > day ||
    (total === 0) !== (value.lastCompletedOn === 0) ||
    (!unlocked && (total > 0 || value.active !== null))
  )
    return undefined;
  if (value.active === null)
    return { completed: counts, lastCompletedOn: value.lastCompletedOn, active: null };
  const a = value.active;
  if (
    !record(a) ||
    !tradition(a.tradition) ||
    !integer(a.edition) ||
    a.edition !== counts[a.tradition] + 1 ||
    !integer(a.stage) ||
    a.stage > 3 ||
    !integer(a.startedOn) ||
    a.startedOn < 1 ||
    a.startedOn > day ||
    a.startedOn < value.lastCompletedOn ||
    !integer(a.readyOn) ||
    a.readyOn < a.startedOn + a.stage ||
    a.readyOn > day + 1 ||
    !integer(a.performanceBaseline) ||
    a.performanceBaseline > 1000000000 ||
    !record(a.delivered)
  )
    return undefined;
  if (!integer(a.materialValue) || a.materialValue > 1000000) return undefined;
  if (!integer(a.cargoDelivered) || a.cargoDelivered > 1000000) return undefined;
  const activity = a.activity;
  if (
    !record(activity) ||
    !['harvest', 'bake', 'fish', 'shore'].every((id) => typeof activity[id] === 'boolean')
  )
    return undefined;
  const active: FestivalPreparation = {
    tradition: a.tradition,
    edition: a.edition,
    stage: a.stage,
    startedOn: a.startedOn,
    readyOn: a.readyOn,
    performanceBaseline: a.performanceBaseline,
    materialValue: a.materialValue,
    cargoDelivered: a.cargoDelivered,
    activity: {
      harvest: activity.harvest as boolean,
      bake: activity.bake as boolean,
      fish: activity.fish as boolean,
      shore: activity.shore as boolean,
    },
    delivered: {},
  };
  const requirements = preparations(active)[active.stage]?.requirements ?? [];
  for (const [id, amount] of Object.entries(a.delivered)) {
    const req = requirements.find((req) => req.id === id);
    if (!req || !integer(amount) || amount > req.quantity) return undefined;
    active.delivered[id] = amount;
  }
  if (requirements.length && requirements.every((req) => (active.delivered[req.id] ?? 0) === req.quantity))
    return undefined;
  return { completed: counts, lastCompletedOn: value.lastCompletedOn, active };
}
function nextFestivalReward(id: FestivalTradition, completed: number): string {
  if (completed >= 3) return 'Повторная программа · гонорар 12 монет';
  if (id === 'stage') return `Мелодия «${festivalMelodyNames[completed]}»`;
  if (id === 'lights') return `Гостей в день · ${6+completed} → ${7+completed}`;
  const capacity = [36,48,52,56];
  return `Мест на складе · ${capacity[completed]} → ${capacity[completed+1]}`;
}
export function getBayFestivalChoices(state: BayFestivalState, context: FestivalContext) {
  return festivalTraditions.map((id) => ({
    id,
    ...festivalDefinitions[id],
    effect: nextFestivalReward(id,state.completed[id]),
    edition: state.completed[id] + 1,
    editionName: editionNames[id][state.completed[id] % 3],
    completed: state.completed[id],
    available: context.village.built && context.village.meals >= 1 && state.active === null,
    lockedReason: !context.village.built
      ? 'Сначала откройте Лавандовую гавань.'
      : context.village.meals < 1
        ? 'Поужинайте с соседом за общим столом.'
        : state.active
          ? 'Выбранная подготовка сохранена. Продолжайте её в своём темпе.'
          : '',
  }));
}
function available(alt: Alternative, active: FestivalPreparation, context: FestivalContext): number {
  if (alt.item) return Math.floor(context.count(alt.item) / alt.quantity);
  if (alt.signature) return Math.floor((context.culinary.stock[alt.signature] ?? 0) / alt.quantity);
  if (alt.event === 'concert') return Number(context.musicGarden.performances > active.performanceBaseline);
  if (alt.event && alt.event !== 'delivery') return Number(active.activity[alt.event]);
  return Math.max(0, active.cargoDelivered - (active.delivered.cargo ?? 0));
}
export function getBayFestivalStatus(state: BayFestivalState, context: FestivalContext) {
  const a = state.active;
  if (!a) return { active: null };
  const prep = preparations(a, context)[a.stage],
    waitingNight = context.day < a.readyOn;
  const requirements = (prep?.requirements ?? []).map((req) => {
    const delivered = a.delivered[req.id] ?? 0,
      remaining = req.quantity - delivered;
    const alternatives = req.alternatives.map((alt) => ({
      ...alt,
      available: Math.min(remaining, available(alt, a, context)),
    }));
    return {
      id: req.id,
      label: req.label,
      quantity: req.quantity,
      delivered,
      available: Math.min(
        remaining,
        alternatives.reduce((sum, alt) => sum + alt.available, 0),
      ),
      alternatives,
    };
  });
  const honorarium = state.completed[a.tradition] === 0 ? 24 : 12;
  return {
    active: {
      tradition: a.tradition,
      name: festivalDefinitions[a.tradition].name,
      edition: a.edition,
      editionName: editionNames[a.tradition][(a.edition - 1) % 3],
      stage: a.stage,
      label: prep?.label ?? 'Праздник готов',
      detail: prep?.detail ?? 'Все приготовления завершены. Соберите соседей в гавани.',
      readyOn: a.readyOn,
      waitingNight,
      materialValue: a.materialValue,
      honorarium,
      reward: a.materialValue + honorarium,
      requirements,
      canContribute:
        context.island === 'village' && !waitingNight && requirements.some((req) => req.available > 0),
      canFinish: context.island === 'village' && !waitingNight && a.stage === 3,
    },
  };
}
export function beginBayFestival(
  state: BayFestivalState,
  context: FestivalContext,
  id: FestivalTradition,
): FestivalResult {
  if (
    !tradition(id) ||
    !getBayFestivalChoices(state, context).find((choice) => choice.id === id)?.available ||
    context.island !== 'village'
  )
    return fail('Выберите традицию после первого общего ужина в гавани.');
  state.active = {
    tradition: id,
    edition: state.completed[id] + 1,
    stage: 0,
    startedOn: context.day,
    readyOn: context.day,
    performanceBaseline: context.musicGarden.performances,
    materialValue: 0,
    cargoDelivered: 0,
    activity: { harvest: false, bake: false, fish: false, shore: false },
    delivered: {},
  };
  return success('Традиция выбрана. Готовьтесь в своём темпе: припасы и прогресс сохранятся без срока.');
}
export function contributeBayFestival(
  state: BayFestivalState,
  context: FestivalContext,
  requirementId?: string,
  alternativeId?: string,
): FestivalResult {
  const a = state.active,
    view = getBayFestivalStatus(state, context).active;
  if (!a || !view?.canContribute)
    return fail(
      view?.waitingNight
        ? 'Следующий шаг откроется после отдыха до утра.'
        : 'Принесите припасы для выбранной подготовки в гавань.',
    );
  const req = preparations(a, context)[a.stage].requirements.find(
    (req) =>
      (!requirementId || req.id === requirementId) &&
      (a.delivered[req.id] ?? 0) < req.quantity &&
      req.alternatives.some(
        (alt) => (!alternativeId || alt.id === alternativeId) && available(alt, a, context) > 0,
      ),
  );
  const alt = req?.alternatives.find(
    (alt) => (!alternativeId || alt.id === alternativeId) && available(alt, a, context) > 0,
  );
  if (!req || !alt) return fail('Выберите доступную замену для недостающего вклада.');
  const materialValue = alt.item
    ? context.value({ ...alt.item, quantity: alt.quantity })
    : alt.signature
      ? (context.culinary.recipes.find((recipe) => recipe.id === alt.signature)?.sellPrice ?? 0) *
        alt.quantity
      : 0;
  if (!integer(materialValue) || a.materialValue + materialValue > 1000000)
    return fail('Для этого вклада в праздничной смете нет места.');
  if (alt.item) context.take({ ...alt.item, quantity: alt.quantity });
  if (alt.signature) context.culinary.stock[alt.signature] -= alt.quantity;
  a.materialValue += materialValue;
  a.delivered[req.id] = (a.delivered[req.id] ?? 0) + 1;
  if (
    preparations(a, context)[a.stage].requirements.every((req) => (a.delivered[req.id] ?? 0) === req.quantity)
  ) {
    a.stage++;
    a.delivered = {};
    a.readyOn = context.day + 1;
    return success(
      a.stage === 3
        ? 'Всё готово. После отдыха можно провести праздник.'
        : 'Подготовка завершена. Следующая небольшая забота откроется утром.',
    );
  }
  return success('Вклад принят. Остальные припасы можно принести позже.');
}
export function finishBayFestival(state: BayFestivalState, context: FestivalContext): FestivalResult {
  const a = state.active;
  if (!a || !getBayFestivalStatus(state, context).active?.canFinish)
    return fail('Завершите приготовления и дождитесь следующего утра в гавани.');
  const reward = a.materialValue + (state.completed[a.tradition] === 0 ? 24 : 12);
  state.completed[a.tradition]++;
  state.lastCompletedOn = context.day;
  state.active = null;
  return {
    ok: true,
    message: `«${festivalDefinitions[a.tradition].name}» состоялся! Возвращена стоимость припасов и выплачен гонорар: ${reward} монет. Украшения останутся с бухтой.`,
    reward,
    tradition: a.tradition,
  };
}
