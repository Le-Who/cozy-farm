import { canSailTo, getShellAt, type FarmState } from './farm.ts';
import { shellSpotCount } from './tide.ts';
import { ruCount } from './ru.ts';

/** Read the exact uncollected kind; a lunar shell cannot supply an ordinary-shell request. */
export function getRegularShellSource(farm: FarmState) {
  if (!canSailTo(farm,'grove')) return {status:'locked' as const,detail:'Сначала откройте путь в Солёную рощу.'};
  for(let nights=0;nights<=7;nights++){
    const day=farm.day+nights;
    if(!Number.isSafeInteger(day)||day<1)break;
    const shore=nights===0?farm:{...farm,day,shellsCollectedToday:[]};
    const spots=Array.from({length:shellSpotCount},(_,i)=>i).filter(i=>getShellAt(shore,i)==='regular');
    if(!spots.length)continue;
    return nights===0 ? {status:'available' as const,day,nights,spots,
      detail:`На берегу рощи сейчас ${ruCount(spots.length,'обычная ракушка','обычные ракушки','обычных ракушек')}. Соберите нужный вид вручную.`,
    } : {status:'waiting' as const,day,nights,spots,
      detail:`Сегодня обычных ракушек для сбора нет. Следующее появление: игровой день ${day}, через ${ruCount(nights,'ночь','ночи','ночей')} отдыха дома. На берегу в тот день будет ${ruCount(spots.length,'обычная ракушка','обычные ракушки','обычных ракушек')}; сбор вручную.`,
    };
  }
  return {status:'unknown' as const,detail:'Сегодня обычных ракушек для сбора нет. Сейчас нельзя определить следующий игровой день с обычными ракушками.'};
}
