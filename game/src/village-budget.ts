import { getVillageProject, type FarmState } from './farm.ts';
import { ruCount } from './ru.ts';

const coins = (value: number) => ruCount(value,'монета','монеты','монет');

/** The construction price is already fixed in the domain; this is only a preview. */
export function renderVillageBudget(farm: FarmState, coinIcon: string, balanceLink: (content: string, ready: boolean) => string): string {
  const project=getVillageProject(farm);
  if (project.status === 'completed') return '';
  const missing=Math.max(0,project.coins-farm.coins);
  const content=`${coinIcon}<span><b>Постройка · ${coins(project.coins)}</b><small>У вас: ${coins(farm.coins)}${missing ? ` · Не хватает: ${coins(missing)}` : ''}</small></span><strong>${missing ? 'Как накопить' : 'Монет достаточно'}</strong>`;
  return `<section class="village-budget" aria-label="Стоимость строительства"><ul>${balanceLink(content,missing===0)}</ul>
    <p>Монеты списываются только при завершении постройки. Припасы можно вносить частями: внесённое останется в проекте после отдыха.</p></section>`;
}
