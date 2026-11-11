import { getCapeHoney, type FarmState } from './farm.ts';

/** Detect only a currently available wind harvest that contains no ordinary honey. */
export function getOrdinaryHoneyWait(farm: FarmState) {
  const current=getCapeHoney({...farm,island:'cape'});
  if(!current.available||current.honey>0||current.windHoney===0)return undefined;
  const day=farm.day+1;
  const next=Number.isSafeInteger(day)?getCapeHoney({...farm,island:'cape',day}):undefined;
  const forecast=next?.available&&next.honey>0
    ? `Цветочный мёд ×${next.honey} можно собрать после отдыха дома, в игровой день ${day}. Прогноз по нынешним клумбам; при их изменении состав нужно проверить снова.`
    : 'Следующий сбор цветочного мёда нужно проверить после отдыха дома.';
  return {day:next?.available?day:undefined,quantity:next?.honey??0,
    detail:`Сегодня единственная порция — мёд ветров, а для этой цели нужен цветочный. ${forecast} Редкий мёд сегодня можно отдельно собрать на мысе. Сон и сбор выполняются вручную.`,
  };
}
