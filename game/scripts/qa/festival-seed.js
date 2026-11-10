// Isolated browser profile only. Sets up an unlocked harbour for festival UI QA.
async page => {
  return await page.evaluate(async () => {
    const m = await import('/src/farm.ts');
    const f = m.createFarm(); f.day = 10; f.coins = 100; f.boatOwned = true;
    f.projects.fair = { 'dishes:appleJam': 1, eggBaskets: 1, 'produce:carrot': 4, 'produce:wheat': 3 };
    f.projects.dock = { 'dishes:appleJam': 1, 'fruit:pear': 2, seaSalt: 2 };
    f.buildingLevels = { farmhouse: 3, coop: 2, well: 2 }; f.farmhouseSpecialization = 'bakery';
    f.orders.harbor = { completed: 2, deliveredOn: 2 }; f.fairGuestsServed = 3; f.guestServedOn = 3;
    f.capeFlowers[0] = 1; f.capeHoneyOn = 2; f.handmade.round = 3; f.workshopPatterns = ['round']; f.fish.seaBass = 2; f.fish.perch = 1; f.honey = 2;
    const actions = [m.contributeVillage(f), m.sail(f, 'village'), m.inviteResident(f, 'bea', 0), m.serveVillageMeal(f, 'round')];
    if (actions.some(action => !action.ok)) throw new Error(JSON.stringify(actions));
    for (const crop of ['carrot', 'beetroot', 'pumpkin', 'leafyGreens', 'cabbage', 'wheat']) f.produce[crop] = 50;
    f.fruit = { apple: 50, pear: 50, peach: 50 }; f.handmade.round = 20; f.fish.perch = 20; f.seaSalt = 20;
    if (!m.restoreFarm(JSON.parse(JSON.stringify(f)))) throw new Error('Invalid harbour fixture');
    localStorage.setItem('cozy-farm-island-v2', JSON.stringify(f));
    return { day: f.day, island: f.island, meals: f.village.meals };
  });
}
