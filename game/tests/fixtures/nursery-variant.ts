import {createFarm,restoreFarm,completeSignature,storeTree} from '../../src/farm.ts';
export function nurseryVariantFixture(){
 const farm=createFarm();farm.buildingLevels.farmhouse=2;
 farm.orientation={collections:true,islands:true};farm.discoveryPreferences.quiet=true;
 farm.variants.apple={rainbow:2};
 const recipe=completeSignature(farm,{base:'preserves',ingredients:[{id:'apple',quantity:2,trait:'rainbow'}]},
 {family:'preserves',processing:'silky',fruit:[],steps:['stir','pour']});
 if(!recipe.ok)throw Error('Рецепт не создан');
 farm.trees.home[1]={...farm.trees.home[0]!,trait:'rainbow'};storeTree(farm,1);
 farm.trees.home[2]={...farm.trees.home[0]!};storeTree(farm,2);
 const checked=restoreFarm(farm);if(!checked)throw Error('Некорректная ферма');return checked;
}
