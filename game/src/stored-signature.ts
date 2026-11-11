import {canSailTo,restoreFarm,type FarmState} from './farm.ts'
import {freightStock} from './bay-freight-model.ts'
import {transferBayGoods} from './harbour-economy.ts'

/** A local, already-made portion. Reading the book never retrieves or cooks it. */
export function getStoredSignature(farm:FarmState,recipeId:string){
  if(!farm.culinary.recipes.some(recipe=>recipe.id===recipeId)||!canSailTo(farm,farm.island))return undefined
  const stored=freightStock(farm.freight,farm.island,`signature:${recipeId}`)
  if(!stored)return undefined
  const preview=structuredClone(farm)
  if(!transferBayGoods(preview,'withdraw',farm.island,`signature:${recipeId}`,1).ok||!restoreFarm(preview))return undefined
  return {port:farm.island,recipeId,stored}
}

export function storedSignatureValue(supply:NonNullable<ReturnType<typeof getStoredSignature>>){
  return `${supply.port}|${supply.recipeId}|${supply.stored}`
}

/** The shown stock count prevents an old confirmation from retrieving another portion. */
export function withdrawStoredSignature(farm:FarmState,value:string|undefined){
  const parts=value?.split('|'),supply=parts?.length===3?getStoredSignature(farm,parts[1]):undefined
  if(!supply||storedSignatureValue(supply)!==value)
    return {ok:false,message:'Запас изменился. Проверьте готовые порции в книге рецептов.'}
  const result=transferBayGoods(farm,'withdraw',supply.port,`signature:${supply.recipeId}`,1)
  return result.ok?{ok:true,message:'Одна готовая порция со склада теперь в припасах.'}:result
}
