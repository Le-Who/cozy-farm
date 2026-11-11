import {cropDefinitions,cropIds,ingredientCount,variantLabel,type FarmState,type StockItem} from './farm.ts';
import {ruCount} from './ru.ts';
type VariantRequest=Extract<StockItem,{kind:'variants'}>;

/** Only an already known trait survives subsequent weather; never predict a new rare trait. */
export function getGrowingVariantSource(farm:FarmState,request:VariantRequest){
 if(ingredientCount(farm,request)>=request.quantity||!cropIds.some(crop=>crop===request.item))return undefined;
 const candidates=farm.beds.flatMap((bed,index)=>{
  if(bed.kind!=='crop'||bed.crop!==request.item||bed.trait!==request.trait)return [];
  const nights=cropDefinitions[bed.crop].days-bed.growth;
  return nights>0?[{index,nights,watered:bed.watered}]:[];
 });
 return candidates.sort((a,b)=>a.nights-b.nights||Number(b.watered)-Number(a.watered)||a.index-b.index)[0];
}

export function growingVariantNotice(request:VariantRequest,source:NonNullable<ReturnType<typeof getGrowingVariantSource>>):string{
 const care=source.watered?'Грядка уже полита.':'Сначала полейте эту грядку; сухая грядка этой ночью не вырастет.';
 const timing=source.nights===1?'До зрелости осталась 1 ночь после полива.':`До зрелости осталось ${ruCount(source.nights,'ночь','ночи','ночей')} при политой грядке перед каждой ночью роста.`;
 return `На грядке ${source.index+1} уже растёт нужная разновидность: ${variantLabel(request.item,request.trait).name}. Редкий урожай этой грядки: ×1. ${care} ${timing} Отдых и сбор выбираются отдельно.`;
}
