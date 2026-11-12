import { buildingIds, getGoal, isProjectComplete, type FarmState } from './farm.ts';
import { festivalDefinitions, festivalTraditions } from './bay-festival.ts';

export type DiscoveryChapter = {
  id: string;
  title: string;
  detail: string;
  icon: string;
  complete: boolean;
};
export type DiscoveryJournal = {
  chapters: DiscoveryChapter[];
  current?: DiscoveryChapter;
  next?: DiscoveryChapter;
  completed: number;
  tip: string;
  activities: { label: string; detail: string; icon: string; panel: string }[];
};

/** Read-only landmarks, not a second quest ledger. Spending goods never undoes an opening. */
export function getDiscoveryJournal(farm: FarmState): DiscoveryJournal {
  const harbour = farm.village.built;
  const dock = isProjectComplete(farm, 'dock');
  const fair = isProjectComplete(farm, 'fair');
  const developed = farm.boatOwned || harbour || dock || fair || buildingIds.some(id => farm.buildingLevels[id] > 1);
  const honey = farm.bayDiscoveries.includes('honey') || farm.honey > 0 || farm.capeLevel > 1;
  const traditions = festivalTraditions.filter(id => farm.festivals.completed[id] > 0);
  const chapters: DiscoveryChapter[] = [
    { id: 'roots', title: 'Первое утро на ферме', icon: 'carrot', complete: developed || !getGoal(farm),
      detail: 'Урожай, свежие яйца и первая продажа дают основу для кухни и путешествий.' },
    { id: 'grove', title: 'За пределами огорода', icon: 'boat', complete: farm.boatOwned || harbour,
      detail: 'Лодка открывает Солёную рощу: груши, морскую рыбу, соль и полезные рейсы парома.' },
    { id: 'cape', title: 'Цветы и мёд', icon: 'ui-honey', complete: dock && honey || harbour,
      detail: 'Восстановленный причал ведёт на Цветочный мыс. Цветы кормят пчёл, а мёд открывает новые блюда.' },
    { id: 'harbour', title: 'Место для соседей', icon: 'ui-bea', complete: harbour,
      detail: 'Ярмарка знакомит с гостями. После первой встречи можно построить Лавандовую гавань.' },
    { id: 'living-bay', title: 'Своё дело у воды', icon: 'bay/pavilion', complete: harbour && farm.bayShop.sold > 0 && farm.musicGarden.performances > 0,
      detail: 'Продавайте свои товары в лавке. Концерт приводит больше покупателей, а паром помогает с припасами.' },
    { id: 'traditions', title: 'Традиции вашей бухты', icon: 'festivals/lights', complete: traditions.length === festivalTraditions.length,
      detail: 'Три разных праздника меняют бухту: дают доплату за урожай в рейсах, приводят гостей и открывают музыку.' },
  ];
  const currentIndex = chapters.findIndex(chapter => !chapter.complete);
  let tip = 'Дневник предлагает путь, но вы можете заниматься любым открытым делом. Заказы подождут.';
  if (!developed && getGoal(farm)) tip = 'Время не торопит: ночь начнётся, когда вы отдохнёте дома. Перед отдыхом полейте посадки и покормите курочек.';
  else if (harbour) tip = 'Новый день начинается после отдыха дома: паром продолжает рейс, лавка встречает новых гостей, а соседи готовят новые встречи.';
  const activities: DiscoveryJournal['activities'] = [];
  if (farm.boatOwned) activities.push({ label: 'Паром «Ласточка»', detail: 'Торговые рейсы и открытие новых портов.', icon: 'bay/ferry', panel: 'bay-freight' });
  if (harbour) {
    activities.push({ label: 'Гостевая книга', detail: 'Приглашайте знакомых соседей на свою ферму.', icon: 'ui-bea', panel: 'neighbor-visits' });
    activities.push({ label: 'Своя лавка', detail: 'Товары, цены и вкусы постоянных гостей.', icon: 'bay/pavilion', panel: 'bay-shop' });
    activities.push({ label: 'Музыкальный сад', detail: 'Своя мелодия и концерт для бухты.', icon: 'bay/music-harp', panel: 'bay-music' });
    activities.push({ label: 'Праздники гавани', detail: traditions.length ? 'Новые праздники и следующие встречи.' : festivalDefinitions.lights.name, icon: 'festivals/lights', panel: 'festival' });
  }
  return {
    chapters, current: currentIndex < 0 ? undefined : chapters[currentIndex],
    next: currentIndex < 0 ? undefined : chapters.slice(currentIndex + 1).find(chapter => !chapter.complete),
    completed: chapters.filter(chapter => chapter.complete).length, tip, activities,
  };
}
