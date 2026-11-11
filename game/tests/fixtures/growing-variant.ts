import {createFarm,restoreFarm,completeSignature,cropDefinitions} from '../../src/farm.ts';
export function growingVariantFixture(watered=false){
 const farm=createFarm();farm.day=3;farm.buildingLevels.farmhouse=2;
 farm.orientation={collections:true,islands:true};farm.discoveryPreferences.quiet=true;
 farm.variants.strawberry={rainbow:2};
 const recipe=completeSignature(farm,{base:'preserves',ingredients:[{id:'strawberry',quantity:2,trait:'rainbow'}]},
 {family:'preserves',processing:'silky',fruit:[],steps:['stir','pour']});
 if(!recipe.ok)throw Error('Рецепт не создан');
 farm.beds[0]={kind:'crop',crop:'strawberry',growth:cropDefinitions.strawberry.days,watered:false};
 farm.beds[1]={kind:'crop',crop:'strawberry',growth:cropDefinitions.strawberry.days-1,watered,trait:'rainbow'};
 const checked=restoreFarm(farm);if(!checked)throw Error('Некорректная ферма');return checked;
}
