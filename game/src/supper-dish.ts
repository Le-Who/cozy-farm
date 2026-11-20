/** The common table remembers its appearance, not a recipe or an inventory claim. */
const dishes=['handmade-round','handmade-folded','handmade-long','orchard-preserves','tart','strawberry-tart','blueberry-tart','raspberry-tart'] as const
export type SupperDish=typeof dishes[number]
export const isSupperDish=(value:unknown):value is SupperDish=>dishes.some(dish=>dish===value)
export function signatureTableDish(recipe?:{base:'tart'|'preserves';ingredients:readonly {id:string}[]}):SupperDish {
  if(recipe?.base==='preserves')return 'orchard-preserves'
  const berry=(['strawberry','blueberry','raspberry'] as const).find(id=>recipe?.ingredients.some(item=>item.id===id))
  return berry?`${berry}-tart`:'tart'
}
