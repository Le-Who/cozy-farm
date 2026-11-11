import {createFarm,restoreFarm,completeSignature,cropDefinitions} from '../../src/farm.ts';
export function cropSpaceFixture(){
 const farm=createFarm();farm.day=3;farm.buildingLevels.farmhouse=2;
 farm.orientation={collections:true,islands:true};farm.discoveryPreferences.quiet=true;
 farm.fruit.apple=4;farm.produce.wheat=1;farm.eggs=2;
 const made=completeSignature(farm,{base:'tart',ingredients:[{id:'apple',quantity:2}]},{family:'decorate',processing:'chunky',fruit:[],steps:['place','finish']});
 if(!made.ok)throw Error(made.message);
 farm.beds=farm.beds.map(()=>({kind:'crop',crop:'pumpkin',growth:0,watered:false}));
 farm.beds[1]={kind:'crop',crop:'carrot',growth:cropDefinitions.carrot.days-1,watered:true};
 farm.selectedSeed='wheat';farm.seeds.wheat=3;
 const checked=restoreFarm(farm);if(!checked)throw Error('Некорректная ферма');return checked;
}
