import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createFarm,restoreFarm,berryCropIds,cropDefinitions,buySeeds,selectSeed,workBed,getArchive,getSignatureAction,completeSignature,repeatSignature,nameSignature,favoriteSignature,forgetSignature,sellSignature,useSignature,tasteSignature,deliverSignature,runResidentService,beginFishingTrip,cookDish,endDay} from '../src/farm.ts'
import {type CookeryResult,type SignatureDraft} from '../src/culinary.ts'
const draft:SignatureDraft={base:'preserves',ingredients:[{id:'apple',quantity:1},{id:'blueberry',quantity:1}]}
const result=(processing:'bright'|'silky'|'chunky'='bright'):CookeryResult=>({family:'preserves',processing,fruit:[{ingredientId:'apple',x:.1,y:-.1,angle:.4},{ingredientId:'blueberry',x:-.2,y:.1,angle:-.5}],steps:['fruit','stir','jar'],baking:{method:'stovetop',finish:'set',seconds:30}})
function kitchen(){const f=createFarm();f.buildingLevels.farmhouse=2;f.fruit.apple=100;f.fruit.pear=10;f.produce.blueberry=100;f.produce.wheat=100;f.eggs=30;return f}
function village(){const f=kitchen();f.day=5;f.boatOwned=true;f.projects.fair={'dishes:appleJam':1,eggBaskets:1,'produce:carrot':4,'produce:wheat':3};f.fairGuestsServed=3;f.guestServedOn=3;f.projects.dock={'dishes:appleJam':1,'fruit:pear':2,seaSalt:2};f.village={built:true,supplies:{'handmade:round':2,'fish:seaBass':2,honey:2},residents:['bea','finn'],meals:2,mealOn:2,serviceOn:{bea:0,finn:0},scouting:false};f.island='village';f.workshopPatterns=['round'];return f}
const roundTrip=(farm:ReturnType<typeof createFarm>)=>restoreFarm(JSON.parse(JSON.stringify(farm)))

test('all berries grow, retain trait produce and appear in the crop archive; old inventories migrate without resets',()=>{
 for(const crop of berryCropIds){const f=createFarm();f.coins=100;assert.ok(buySeeds(f,crop).ok);assert.ok(selectSeed(f,crop).ok);f.beds[0]={kind:'crop',crop,growth:cropDefinitions[crop].days,watered:false,trait:'rainbow'};assert.ok(workBed(f,0).ok);assert.equal(f.produce[crop],2);assert.equal(f.variants[crop]?.rainbow,1);assert.ok(getArchive(f,'crops').find(entry=>entry.id===crop)?.items.some(item=>item.trait==='rainbow'&&item.discovered));assert.ok(roundTrip(f))}
 const old:any=createFarm();old.day=7;old.coins=321;old.produce.carrot=9;delete old.culinary;delete old.shoreline;for(const crop of berryCropIds){delete old.seeds[crop];delete old.produce[crop]}const restored=restoreFarm(old)!;assert.ok(restored);assert.equal(restored.day,7);assert.equal(restored.coins,321);assert.equal(restored.produce.carrot,9);for(const crop of berryCropIds){assert.equal(restored.seeds[crop],0);assert.equal(restored.produce[crop],0)}
 old.seeds.carrot=undefined;assert.equal(restoreFarm(old),undefined,'missing old fields are still invalid')
})

test('signature creation is atomic, records placements/rotation, and creates separate equally priced processing stocks',()=>{
 const f=kitchen(),before=structuredClone(f);assert.equal(getSignatureAction(f,{...draft,ingredients:[{id:'apple',quantity:3}]}).available,false);assert.equal(completeSignature(f,draft,{...result(),fruit:[{ingredientId:'pear',x:0,y:0,angle:0}]}).ok,false);assert.deepEqual(f,before)
 const ids=[];for(const style of ['bright','silky','chunky'] as const){const made=completeSignature(f,draft,result(style));assert.ok(made.ok);ids.push(made.recipeId!)}assert.equal(new Set(ids).size,3);assert.equal(new Set(f.culinary.recipes.map(r=>r.sellPrice)).size,1);assert.equal(f.fruit.apple,97);assert.equal(f.produce.blueberry,97);assert.deepEqual(f.culinary.recipes[0].result.fruit,result().fruit);assert.ok(roundTrip(f))
 const noStock=kitchen();noStock.produce.blueberry=0;const snapshot=structuredClone(noStock);assert.equal(completeSignature(noStock,draft,result()).ok,false);assert.deepEqual(noStock,snapshot)
})

test('trait portions are debited precisely and tart decoration is a genuine saved stock identity',()=>{
 const f=kitchen();f.variants.strawberry={star:2};f.discoveries.strawberry={star:true};const tart:SignatureDraft={base:'tart',ingredients:[{id:'strawberry',quantity:1,trait:'star'},{id:'pear',quantity:1}]};const baked:CookeryResult={family:'decorate',fruit:[{ingredientId:'strawberry',x:.2,y:.3,angle:1.5},{ingredientId:'pear',x:-.2,y:0,angle:-.7}],steps:['fruit','dust','bake'],baking:{method:'oven',finish:'golden',seconds:140}};
 const a=completeSignature(f,tart,baked);assert.ok(a.ok);assert.equal(f.variants.strawberry.star,1);assert.equal(f.produce.strawberry,0);assert.equal(f.fruit.pear,9);assert.equal(f.produce.wheat,99);assert.equal(f.eggs,29)
 const b=completeSignature(f,tart,{...baked,fruit:baked.fruit.map(p=>({...p,angle:0}))});assert.ok(b.ok);assert.notEqual(a.recipeId,b.recipeId);assert.equal(f.culinary.recipes[0].ingredients[1]?.trait??f.culinary.recipes[0].ingredients[0]?.trait,'star');assert.ok(roundTrip(f))
})

test('naming/favourites, exact repeats and mastered triple batches preserve separate stock and atomic costs',()=>{
 const f=kitchen(),id=completeSignature(f,draft,result()).recipeId!;assert.ok(nameSignature(f,id,'Bay morning').ok);assert.ok(favoriteSignature(f,id,true).ok);const before=structuredClone(f);assert.equal(nameSignature(f,id,'<script>').ok,false);assert.equal(repeatSignature(f,id,undefined,2).ok,false);assert.deepEqual(f,before)
 assert.ok(repeatSignature(f,id,undefined,3).ok);assert.equal(f.culinary.stock[id],4);assert.equal(f.culinary.recipes[0].name,'Bay morning');assert.equal(f.culinary.recipes[0].favorite,true);assert.equal(f.fruit.apple,96);const full=structuredClone(f);assert.equal(forgetSignature(f,id).ok,false);assert.deepEqual(f,full)
 assert.equal(repeatSignature(f,id,result('silky'),3).ok,false,'an unknown variation cannot bypass its first manual preparation');assert.deepEqual(f,full)
 f.fruit.apple=0;const shortage=structuredClone(f);assert.equal(repeatSignature(f,id,undefined,3).ok,false);assert.deepEqual(f,shortage)
})

test('all three picnic outcomes have distinct real uses and are consumed only by a successful relevant action',()=>{
 for(const style of ['bright','silky','chunky'] as const){const f=kitchen(),id=completeSignature(f,draft,result(style)).recipeId!;assert.ok(useSignature(f,id).ok);assert.equal(f.culinary.stock[id],0);const snapshot=structuredClone(f);assert.equal(useSignature(f,id).ok,false);assert.deepEqual(f,snapshot)
  if(style==='bright'){const trip=beginFishingTrip(f);assert.ok(trip.ok);assert.equal(trip.config?.capacity,3)}
  if(style==='silky'){assert.ok(cookDish(f,'appleJam',result()).ok);assert.equal(f.dishes.appleJam,2)}
  if(style==='chunky'){f.beds[0]={kind:'crop',crop:'carrot',growth:1,watered:false};assert.ok(workBed(f,0).ok);assert.equal(f.produce.carrot,4)}
  assert.equal(f.culinary.picnic,null);assert.ok(roundTrip(f))
 }
 const f=kitchen(),id=completeSignature(f,draft,result()).recipeId!;useSignature(f,id);endDay(f);assert.equal(f.culinary.picnic,null)
})

test('residents remember their tastes and preferred food changes actual baking/scouting services',()=>{
 const f=village(),bea=completeSignature(f,{...draft,ingredients:[{id:'pear',quantity:2}]}, {...result('silky'),fruit:[{ingredientId:'pear',x:0,y:0,angle:0}]}).recipeId!;assert.ok(tasteSignature(f,bea,'bea').ok);assert.equal(f.culinary.tastings.bea.bonus,true);const before=structuredClone(f);assert.equal(tasteSignature(f,bea,'bea').ok,false);assert.deepEqual(f,before);assert.ok(runResidentService(f,'bea','round').ok);assert.equal(f.handmade.round,4);assert.equal(f.culinary.tastings.bea.bonus,false)
 const finn=completeSignature(f,draft,result('chunky')).recipeId!;assert.ok(tasteSignature(f,finn,'finn').ok);assert.ok(runResidentService(f,'finn').ok);f.island='grove';const trip=beginFishingTrip(f);assert.equal(trip.config?.resilience,5);assert.equal(f.culinary.tastings.finn.bonus,false);assert.ok(roundTrip(f))
})

test('signature stock sells and supplies real Harbour supper progress without masquerading as ordinary dishes',()=>{
 const f=village(),id=completeSignature(f,draft,result()).recipeId!;f.fish.seaBass=1;assert.ok(deliverSignature(f,id).ok);assert.equal(f.village.meals,3);assert.equal(f.village.mealOn,f.day);assert.equal(f.fish.seaBass,0);assert.equal(f.culinary.stock[id],0);assert.equal(f.dishes.appleJam,0);assert.ok(roundTrip(f))
 f.island='home';repeatSignature(f,id);const coins=f.coins,price=f.culinary.recipes[0].sellPrice;assert.ok(sellSignature(f,id).ok);assert.ok(f.coins>=coins+price);const snapshot=structuredClone(f);assert.equal(sellSignature(f,id).ok,false);assert.deepEqual(f,snapshot)
})

test('malformed recipe saves, stock references and geometry are rejected while valid books round-trip',()=>{
 const f=kitchen();completeSignature(f,draft,result());assert.ok(roundTrip(f));for(const mutate of [(x:any)=>x.culinary.recipes[0].result.fruit[0].x=2,(x:any)=>x.culinary.stock.unknown=1,(x:any)=>x.culinary.recipes[0].ingredients[0].quantity=8,(x:any)=>x.culinary.tastings.bea.favoriteIds=['missing']]){const saved=structuredClone(f);mutate(saved);assert.equal(restoreFarm(saved),undefined)}
})

test('recipe book capacity is bounded and archiving an empty recipe makes room without reusing stock identity',()=>{
 const f=kitchen(),tart:SignatureDraft={base:'tart',ingredients:[{id:'apple',quantity:2}]};
 const pattern=(angle:number):CookeryResult=>({family:'decorate',fruit:[{ingredientId:'apple',x:0,y:0,angle}],steps:['fruit','dust']})
 for(let i=0;i<24;i++)assert.ok(completeSignature(f,tart,pattern(i*.1)).ok)
 const full=structuredClone(f);assert.equal(completeSignature(f,tart,pattern(2.4)).ok,false);assert.deepEqual(f,full)
 const old=f.culinary.recipes[0].id;assert.ok(sellSignature(f,old).ok);assert.ok(forgetSignature(f,old).ok);const made=completeSignature(f,tart,pattern(2.4));assert.ok(made.ok);assert.notEqual(made.recipeId,old);assert.equal(f.culinary.recipes.length,24);assert.ok(roundTrip(f))
})

test('submitted result metadata is copied and all manual honey dishes persist actual preparation and baking records',()=>{
 const f=village();f.day=12;f.buildingLevels.farmhouse=3;f.farmhouseSpecialization='bakery';f.orders.harbor={completed:2,deliveredOn:2};f.capeFlowers=[1,1,1];f.capeLevel=3;f.capeHoneyOn=12;f.honey=10;f.windHoney=2;f.seaSalt=3;f.fruit.peach=3;f.island='cape'
 const cases=[['honeyPear',{family:'honeyPear',fruit:[{ingredientId:'pear',x:.3,y:0,angle:.2}],steps:['cut','glaze']}],['honeyBiscuits',{family:'honeyBiscuits',fruit:[],steps:['shape','bake','glaze'],baking:{method:'oven',finish:'golden',seconds:120}}],['windParfait',{family:'windParfait',fruit:[{ingredientId:'peach',x:0,y:.2,angle:-.5}],steps:['custard','fruit','glaze'],baking:{method:'chilled',finish:'set',seconds:0}}]] as const
 for(const [dish,metadata]of cases){assert.ok(cookDish(f,dish,metadata).ok);assert.deepEqual(f.culinary.lastDishes[dish],metadata)}
 f.island='home';const cake:CookeryResult={family:'honeyCake',fruit:[],steps:['mix','bake','glaze'],baking:{method:'oven',finish:'golden',seconds:180}};assert.ok(cookDish(f,'honeyCake',cake).ok);assert.ok(roundTrip(f));cake.baking!.seconds=1;assert.equal(f.culinary.lastDishes.honeyCake.baking!.seconds,180)
 const before=structuredClone(f);assert.equal(cookDish(f,'honeyCake',{...cake,family:'decorate'}).ok,false);assert.deepEqual(f,before)
})

test('overflow and impossible semantic snapshots fail without spending ingredients or stock',()=>{
 const f=kitchen(),id=completeSignature(f,draft,result()).recipeId!;f.coins=Number.MAX_SAFE_INTEGER;const before=structuredClone(f);assert.equal(sellSignature(f,id).ok,false);assert.deepEqual(f,before)
 f.coins=0;f.workToday=Number.MAX_SAFE_INTEGER;const work=structuredClone(f);assert.equal(repeatSignature(f,id).ok,false);assert.deepEqual(f,work)
 const valid=kitchen();completeSignature(valid,draft,result());for(const mutate of [(x:any)=>x.culinary.recipes[0].processing='chunky',(x:any)=>x.culinary.stock.s1=100,(x:any)=>x.culinary.tastings.finn.bonus=true]){const saved=structuredClone(valid);mutate(saved);assert.equal(restoreFarm(saved),undefined)}
})
