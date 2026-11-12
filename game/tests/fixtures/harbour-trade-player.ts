import * as F from '../../src/farm.ts'
import * as H from '../../src/harbour-economy.ts'

/** Real earned opening and public commands only. Cooking receipts are not UI gestures. */
export function harbourTradePlayer(opening: {name:string;args:unknown[]}[]) {
  let state=F.createFarm()
  const log:{name:string;args:unknown[];day:number;coins:number}[]=[]
  const commands={...F,...H} as Record<string,Function>
  function reload() { const restored=F.restoreCurrentFarm(JSON.parse(JSON.stringify(state))); if(!restored)throw Error('Save rejected after '+log.length); state=restored }
  function act(name:string,...args:unknown[]) { const r=commands[name](state,...args);if(!r.ok)throw Error(name+': '+r.message);log.push({name,args,day:state.day,coins:state.coins});reload();return r }
  const visit=(island:F.IslandId)=>{if(state.island!==island)act('sail',island)}
  const night=()=>{visit('home');act('endDay')}
  function wheat(quantity:number) {
    visit('home')
    for(let attempt=0;state.produce.wheat<quantity;attempt++) {
      if(attempt>30)throw Error('Wheat route stalled')
      const ripe=state.beds.findIndex(b=>b.kind==='crop'&&b.crop==='wheat'&&F.getBedStage(b)==='ripe')
      if(ripe>=0){act('workBed',ripe);continue}
      let bed=state.beds.findIndex(b=>b.kind==='crop'&&b.crop==='wheat')
      if(bed<0){if(!state.seeds.wheat)act('buySeeds','wheat');if(state.selectedSeed!=='wheat')act('selectSeed','wheat');bed=state.beds.findIndex(b=>b.kind==='tilled');if(bed<0)throw Error('No plot');act('workBed',bed)}
      if(F.getBedAction(state,bed).kind==='water'){if(!state.water)act('refillWater');act('workBed',bed)}
      night()
    }
  }
  function voyage(id:string) {visit('home');act('sendFerryExpedition',id);night();act('receiveFerryExpedition')}
  for(const action of opening){if(action.name==='catchFish')break;act(action.name,...action.args)}
  visit('home')
  const blocked={day:state.day,coins:state.coins,actions:log.length,project:F.getVillageProject(state)}
  function prepare(first: 'mill-sale'|'mill-buy' = 'mill-sale'){wheat(first==='mill-sale'?4:2)}
  function build(first: 'mill-sale'|'mill-buy' = 'mill-sale'){prepare(first);voyage(first);voyage('explore-salt');voyage('salt-fish');act('contributeVillage');if(!state.village.built)throw Error('Harbour not built')}
  function twoHomes(){
    visit('village');act('inviteResident','bea',0);wheat(Math.max(0,2-state.handmade.round)*2)
    // Two purchased fish serve two evenings. No fishing command is introduced after entry.
    voyage('salt-fish')
    for(let dinner=0;dinner<2;dinner++){
      visit('home');if(!state.handmade.round){if(!state.eggs){if(!state.feed)act('buyFeed');act('feedChickens');night();act('collectEggs')}act('bakeWorkshop','round')}
      visit('village');act('serveVillageMeal','round');if(!dinner)night()
    }
    act('inviteResident','finn',1)
  }
  return {get state(){return state},get actions(){return log.length},log,blocked,act,visit,night,wheat,voyage,prepare,build,twoHomes,reload}
}
