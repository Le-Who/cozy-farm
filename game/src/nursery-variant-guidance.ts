import {canSailTo,ingredientCount,variantLabel,type FarmState,type StockItem} from './farm.ts';
type VariantRequest=Extract<StockItem,{kind:'variants'}>;

/** Stored fruit needs an explicit return first; never promise a hidden or occupied slot. */
export function getNurseryVariantSource(farm:FarmState,request:VariantRequest){
 if(ingredientCount(farm,request)>=request.quantity)return undefined;
 const entry=farm.treeNursery.find(({tree})=>tree.tree===request.item&&tree.trait===request.trait&&tree.fruitReady>0);
 if(!entry)return undefined;
 const islands=farm.island==='grove'?['grove','home'] as const:['home','grove'] as const;
 for(const island of islands){
  if(island==='grove'&&!canSailTo(farm,island))continue;
  const slot=farm.trees[island].findIndex(tree=>tree===null);
  if(slot>=0)return {island,slot,nurseryId:entry.id};
 }
 return undefined;
}

export function nurseryVariantNotice(request:VariantRequest):string{
 return `В питомнике сохранено: ${variantLabel(request.item,request.trait).name} ×1. Бесплатно верните выделенное дерево на свободное место в саду, затем отдельно соберите его плоды. В питомнике собирать нельзя.`;
}
