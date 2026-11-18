import {cropDefinitions,cropIds,ingredientCount,variantLabel,type FarmState,type StockItem} from './farm.ts';
import {ruCount} from './ru.ts';
type VariantRequest=Extract<StockItem,{kind:'variants'}>;

/** Only an already known trait survives subsequent weather; never predict a new rare trait. */
export function getGrowingVariantSource(farm:FarmState,request:VariantRequest){
 const missing=request.quantity-ingredientCount(farm,request);
 if(missing<=0||!cropIds.some(crop=>crop===request.item))return undefined;
 const candidates=farm.beds.flatMap((bed,index)=>{
  if(bed.kind!=='crop'||bed.crop!==request.item||bed.trait!==request.trait)return [];
  const nights=cropDefinitions[bed.crop].days-bed.growth;
  return nights>0?[{index,nights,watered:bed.watered}]:[];
 });
 // Each exact bed yields one rare item. Tend the earliest needed beds, not surplus copies.
 const needed=candidates.sort((a,b)=>a.nights-b.nights||Number(b.watered)-Number(a.watered)||a.index-b.index).slice(0,missing);
 return needed.find(bed=>!bed.watered)??needed[0];
}

export function growingVariantNotice(request:VariantRequest,source:NonNullable<ReturnType<typeof getGrowingVariantSource>>):string{
 const retainsWater=cropIds.some(crop=>crop===request.item&&cropDefinitions[crop].retainsWater);
 const nights=ruCount(source.nights,'ночь','ночи','ночей');
 const care=retainsWater
  ? source.watered?'Грядка уже полита, больше поливать не нужно.':'Полейте грядку один раз.'
  : source.watered?'Грядка уже полита.':'Сначала полейте эту грядку; сухая грядка этой ночью не вырастет.';
 const timing=retainsWater?`До зрелости: ${nights}.`
  : source.nights===1?'До зрелости осталась 1 ночь после полива.':`До зрелости осталось ${nights} при политой грядке перед каждой ночью роста.`;
 return `На грядке ${source.index+1} уже растёт нужная разновидность: ${variantLabel(request.item,request.trait).name}. Редкий урожай этой грядки: ×1. ${care} ${timing} Отдых и сбор выбираются отдельно.`;
}
