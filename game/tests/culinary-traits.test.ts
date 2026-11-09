import assert from 'node:assert/strict'
import {test} from 'node:test'
import {copyCookeryResult,cookeryFinishTraits,isCookeryResult,resolvedCookeryFruit,signatureIdentity,type CookeryResult,type SignatureDraft} from '../src/culinary.ts'
import {completeSignature,createFarm,getIntentOffers,restoreFarm} from '../src/farm.ts'

const draft:SignatureDraft={base:'tart',ingredients:[{id:'apple',quantity:1},{id:'apple',quantity:1,trait:'frost'}]}
const result:CookeryResult={family:'decorate',fruitTraitsVersion:1,fruit:[{ingredientId:'apple',x:-.3,y:0,angle:0},{ingredientId:'apple',x:.3,y:0,angle:0,trait:'frost'}],steps:['fruit','dust','bake'],baking:{method:'oven',finish:'golden',seconds:20}}
function kitchen(){const farm=createFarm();farm.buildingLevels.farmhouse=2;farm.fruit.apple=4;farm.variants.apple={frost:4};farm.discoveries.apple={frost:true};farm.produce.wheat=4;farm.eggs=4;return farm}

test('a mixed ordinary and frost receipt preserves exactly which placed piece has the finish',()=>{
 const copied=copyCookeryResult(result)
 assert.deepEqual(copied,result);assert.notEqual(copied.fruit,result.fruit)
 assert.deepEqual(resolvedCookeryFruit(copied,draft.ingredients).map(point=>point.trait),[undefined,'frost'])
 const farm=kitchen(),made=completeSignature(farm,draft,result);assert.ok(made.ok)
 const restored=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(restored)
 assert.deepEqual(restored.culinary.recipes[0].result,result)
 assert.equal(farm.fruit.apple,3);assert.equal(farm.variants.apple?.frost,3)
 const offer=getIntentOffers(restored,'sharing').find(offer=>offer.id===`signature:${made.recipeId}`)!
 assert.deepEqual(offer.recipeIngredients,restored.culinary.recipes[0].ingredients)
 assert.notEqual(offer.recipeIngredients,restored.culinary.recipes[0].ingredients)
 assert.deepEqual(offer.preparation,result)
})

test('legacy receipts recover portion finishes while explicit ordinary pieces are never recolored',()=>{
 const legacy:CookeryResult={...result,fruitTraitsVersion:undefined,fruit:result.fruit.map(({trait,...point})=>point)}
 assert.deepEqual(resolvedCookeryFruit(legacy,draft.ingredients).map(point=>point.trait),[undefined,'frost'])
 assert.deepEqual(resolvedCookeryFruit({...legacy,fruitTraitsVersion:1},draft.ingredients).map(point=>point.trait),[undefined,undefined])
 assert.deepEqual(cookeryFinishTraits(legacy,draft.ingredients),['frost'])
 assert.deepEqual(cookeryFinishTraits(result,draft.ingredients),['frost'])
 assert.deepEqual(cookeryFinishTraits({...legacy,fruitTraitsVersion:1},draft.ingredients),[])
 assert.equal(signatureIdentity(draft,legacy),signatureIdentity(draft,result))
 const swapped:CookeryResult={...result,fruit:result.fruit.map((point,index)=>{const {trait,...ordinary}=point;return {...ordinary,...(index===0?{trait:'frost' as const}:{})}})}
 assert.notEqual(signatureIdentity(draft,result),signatureIdentity(draft,swapped))
})

test('unknown finishes and unselected variant receipts cannot enter saved cooking state',()=>{
 assert.equal(isCookeryResult({...result,fruitTraitsVersion:2}),false)
 assert.equal(isCookeryResult({...result,fruit:[{...result.fruit[0],trait:'glitter'}]}),false)
 const farm=kitchen(),before=structuredClone(farm)
 const forged:CookeryResult={...result,fruit:[{...result.fruit[0],trait:'star'}]}
 assert.equal(completeSignature(farm,draft,forged).ok,false);assert.deepEqual(farm,before)
 const variantOnly:SignatureDraft={base:'tart',ingredients:[{id:'apple',quantity:2,trait:'frost'}]}
 assert.equal(completeSignature(farm,variantOnly,{...result,fruit:[result.fruit[0]]}).ok,false);assert.deepEqual(farm,before)
 assert.ok(completeSignature(farm,draft,result).ok)
 const invalid=JSON.parse(JSON.stringify(farm));invalid.culinary.recipes[0].result.fruit[1].trait='star'
 assert.equal(restoreFarm(invalid),undefined)
})
