import {traitIds,type Trait} from './climate.ts'
import {fishingSpecies,type FishingSpecies} from './fishing-model.ts'

export const signatureFruitIds=['apple','pear','peach','strawberry','blueberry','raspberry'] as const
export type SignatureFruitId=typeof signatureFruitIds[number]
export const signatureFruitNames:Record<SignatureFruitId,string>={apple:'Яблоко',pear:'Груша',peach:'Персик',strawberry:'Клубника',blueberry:'Черника',raspberry:'Малина'}
export const signatureProcessingIds=['bright','silky','chunky'] as const
export type SignatureProcessing=typeof signatureProcessingIds[number]
export const signatureProcessingDefinitions={bright:{name:'Свежее',use:'На следующей рыбалке крючок вместит ещё одну находку.'},silky:{name:'Нежное',use:'Следующая готовка даст ещё одну порцию.'},chunky:{name:'С кусочками',use:'Следующий сбор урожая даст ещё одну единицу.'}} as const
export type CookeryResult={
 family:'preserves'|'decorate'|'honeyPear'|'honeyBiscuits'|'windParfait'|'honeyCake'|'grilledFish'
 processing?:SignatureProcessing
 fishSpecies?:FishingSpecies
 fruit:readonly {ingredientId:string;x:number;y:number;angle:number}[]
 garnish?:readonly {ingredientId:'carrot';x:number;y:number;angle:number}[]
 steps:readonly string[]
 baking?:{method:'oven'|'chilled'|'stovetop'|'grill';finish:'golden'|'soft'|'set';seconds:number}
}
export type SignatureIngredient={id:SignatureFruitId;quantity:number;trait?:Trait}
export type SignatureDraft={base:'preserves'|'tart';ingredients:readonly SignatureIngredient[]}
export type SignatureRecipe={id:string;name:string;favorite:boolean;base:SignatureDraft['base'];ingredients:SignatureIngredient[];processing:SignatureProcessing;result:CookeryResult;createdOn:number;batches:number;sellPrice:number}
export type TastingMemory={servedOn:number;visits:number;liked:number;lastRecipeId:string|null;favoriteIds:string[];bonus:boolean}
export type CulinaryState={serial:number;recipes:SignatureRecipe[];stock:Record<string,number>;tastings:Record<'bea'|'finn',TastingMemory>;picnic:{processing:SignatureProcessing;day:number}|null;lastDishes:Record<string,CookeryResult>}
export const signatureRecipeLimit=24
export const residentTastes={bea:{processing:'silky',fruit:'pear',name:'Беа'},finn:{processing:'chunky',fruit:'blueberry',name:'Финн'}} as const
const memory=():TastingMemory=>({servedOn:0,visits:0,liked:0,lastRecipeId:null,favoriteIds:[],bonus:false})
export function createCulinary():CulinaryState{return {serial:0,recipes:[],stock:{},tastings:{bea:memory(),finn:memory()},picnic:null,lastDishes:{}}}
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v)
const count=(v:unknown,max=1_000_000):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max
const oneOf=<T extends string>(values:readonly T[],v:unknown):v is T=>values.includes(v as T)
const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max
export function isCookeryResult(value:unknown):value is CookeryResult{
 if(!record(value)||!oneOf(['preserves','decorate','honeyPear','honeyBiscuits','windParfait','honeyCake','grilledFish'],value.family)||value.processing!==undefined&&!oneOf(signatureProcessingIds,value.processing))return false
 if(value.fishSpecies!==undefined&&(value.family!=='grilledFish'||!oneOf(fishingSpecies,value.fishSpecies)))return false
 if(!Array.isArray(value.fruit)||value.fruit.length>24||!value.fruit.every(p=>record(p)&&oneOf(signatureFruitIds,p.ingredientId)&&finite(p.x,-1,1)&&finite(p.y,-1,1)&&finite(p.angle,-Math.PI,Math.PI)))return false
 if(value.garnish!==undefined&&(!Array.isArray(value.garnish)||value.garnish.length>3||!value.garnish.every(p=>record(p)&&p.ingredientId==='carrot'&&finite(p.x,-1,1)&&finite(p.y,-1,1)&&finite(p.angle,-Math.PI,Math.PI))))return false
 if(!Array.isArray(value.steps)||value.steps.length>24||!value.steps.every(step=>typeof step==='string'&&step.length>0&&step.length<=32&&/^[a-zA-Z0-9 _-]+$/.test(step)))return false
 return value.baking===undefined||record(value.baking)&&oneOf(['oven','chilled','stovetop','grill'],value.baking.method)&&oneOf(['golden','soft','set'],value.baking.finish)&&finite(value.baking.seconds,0,1800)
}
export function copyCookeryResult(value:CookeryResult):CookeryResult{
 return {family:value.family,...(value.processing?{processing:value.processing}:{}),...(value.fishSpecies?{fishSpecies:value.fishSpecies}:{}),fruit:value.fruit.map(p=>({ingredientId:p.ingredientId,x:p.x,y:p.y,angle:p.angle})),steps:[...value.steps],...(value.garnish?{garnish:value.garnish.map(p=>({...p}))}:{}),...(value.baking?{baking:{method:value.baking.method,finish:value.baking.finish,seconds:value.baking.seconds}}:{})}
}
export function normalizeSignatureDraft(value:unknown):SignatureDraft|undefined{
 if(!record(value)||!oneOf(['preserves','tart'],value.base)||!Array.isArray(value.ingredients)||value.ingredients.length<1||value.ingredients.length>2)return
 const ingredients:SignatureIngredient[]=[]
 for(const part of value.ingredients){
  if(!record(part)||!oneOf(signatureFruitIds,part.id)||!count(part.quantity,2)||part.quantity<1||part.trait!==undefined&&!oneOf(traitIds,part.trait))return
  const old=ingredients.find(p=>p.id===part.id&&p.trait===part.trait)
  if(old)old.quantity+=part.quantity;else ingredients.push({id:part.id,quantity:part.quantity,...(part.trait?{trait:part.trait}:{})})
 }
 if(ingredients.reduce((sum,p)=>sum+p.quantity,0)!==2)return
 ingredients.sort((a,b)=>(a.id+(a.trait??'')).localeCompare(b.id+(b.trait??'')))
 return {base:value.base,ingredients}
}
export function signatureIdentity(draft:SignatureDraft,result:CookeryResult):string{
 const processing=result.processing??(draft.base==='tart'?'chunky':'bright')
 const fruit=draft.base==='tart'?result.fruit.map(p=>({ingredientId:p.ingredientId,x:Math.round(p.x*100)/100,y:Math.round(p.y*100)/100,angle:Math.round(p.angle*10)/10})):[]
 return JSON.stringify([draft.base,draft.ingredients,processing,fruit,result.baking?.method,result.baking?.finish])
}
export function validSignatureName(value:unknown):value is string{return typeof value==='string'&&value.trim().length>0&&value.trim().length<=32&&!/[<>\x00-\x1f]/.test(value)}

export function restoreCulinary(value:unknown,day:number):CulinaryState|undefined{
 if(value===undefined)return createCulinary()
 if(!record(value)||!count(value.serial)||!Array.isArray(value.recipes)||value.recipes.length>signatureRecipeLimit||!record(value.stock)||!record(value.tastings)||!record(value.lastDishes))return
 const recipes:SignatureRecipe[]=[]
 for(const raw of value.recipes){
  if(!record(raw)||typeof raw.id!=='string'||!/^s[1-9]\d{0,5}$/.test(raw.id)||Number(raw.id.slice(1))>value.serial||recipes.some(r=>r.id===raw.id)||!validSignatureName(raw.name)||typeof raw.favorite!=='boolean'||!oneOf(signatureProcessingIds,raw.processing)||!isCookeryResult(raw.result)||!count(raw.createdOn,day)||raw.createdOn<1||!count(raw.batches)||raw.batches<1||!count(raw.sellPrice,1000)||raw.sellPrice<1)return
  const draft=normalizeSignatureDraft(raw),result=raw.result
  if(!draft||result.family!==(draft.base==='tart'?'decorate':'preserves')||raw.processing!==(result.processing??(draft.base==='tart'?'chunky':'bright'))||result.fruit.some(p=>!draft.ingredients.some(i=>i.id===p.ingredientId)))return
  if(recipes.some(recipe=>signatureIdentity(recipe,recipe.result)===signatureIdentity(draft,result)))return
  recipes.push({id:raw.id,name:raw.name.trim(),favorite:raw.favorite,...draft,ingredients:[...draft.ingredients],processing:raw.processing,result:copyCookeryResult(result),createdOn:raw.createdOn,batches:raw.batches,sellPrice:raw.sellPrice})
 }
 const stock:Record<string,number>={}
 for(const [id,n]of Object.entries(value.stock)){const recipe=recipes.find(r=>r.id===id);if(!recipe||!count(n)||n>recipe.batches*2)return;stock[id]=n}
 const tastings={} as CulinaryState['tastings']
 for(const id of ['bea','finn'] as const){const m=value.tastings[id];if(!record(m)||!count(m.servedOn,day)||!count(m.visits)||m.visits>m.servedOn||(m.visits===0)!==(m.servedOn===0)||!count(m.liked)||m.liked>m.visits||typeof m.bonus!=='boolean'||m.bonus&&m.liked===0||m.lastRecipeId!==null&&!recipes.some(r=>r.id===m.lastRecipeId)||!Array.isArray(m.favoriteIds)||m.favoriteIds.length>signatureRecipeLimit||m.favoriteIds.length>m.liked||new Set(m.favoriteIds).size!==m.favoriteIds.length||!m.favoriteIds.every(id=>recipes.some(r=>r.id===id)))return;tastings[id]={servedOn:m.servedOn,visits:m.visits,liked:m.liked,lastRecipeId:m.lastRecipeId as string|null,favoriteIds:[...m.favoriteIds] as string[],bonus:m.bonus}}
 const picnic=value.picnic
 if(picnic!==null&&(!record(picnic)||!oneOf(signatureProcessingIds,picnic.processing)||!count(picnic.day,day)||picnic.day!==day))return
 const lastDishes:Record<string,CookeryResult>={},dishIds=['strawberryTart','blueberryTart','raspberryTart','orchardTart','grilledFish','appleJam','farmhouseBread','orchardPreserves','honeyCake','honeyBiscuits','honeyPear','windParfait']
 for(const [id,result]of Object.entries(value.lastDishes)){if(!dishIds.includes(id)||!isCookeryResult(result))return;lastDishes[id]=copyCookeryResult(result)}
 return {serial:value.serial,recipes,stock,tastings,picnic:picnic===null?null:{processing:picnic.processing as SignatureProcessing,day:picnic.day as number},lastDishes}
}
