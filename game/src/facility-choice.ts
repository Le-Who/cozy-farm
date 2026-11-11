import { bedsPerRow, eggsPerCrate, facilitySpecializations, getWaterCapacity, incubationDays, maxFlockSize, type FacilityBranch, type FarmState } from './farm.ts';
import { ruCount } from './ru.ts';

/** Explain existing permanent choices without buying them or preparing their resources. */
export function getFacilityChoiceDetails(farm: FarmState, branch: FacilityBranch) {
  switch (branch) {
    case 'rain': {
      const capacity=getWaterCapacity({...farm,buildingLevels:{...farm.buildingLevels,well:3},wellSpecialization:'rain'});
      return {name:facilitySpecializations.well.rain.name,lines:[
        `Вместимость вашей лейки с цистерной: ${capacity} порций воды.`,
        'После каждого отдыха дома лейка наполняется до краёв. Сразу после постройки воду можно набрать вручную.',
        'Грядки по-прежнему нужно поливать самостоятельно.',
      ]};
    }
    case 'pipes': return {name:facilitySpecializations.well.pipes.name,lines:[
      `Одним действием можно полить два соседних ряда: до ${bedsPerRow*2} грядок.`,
      'Расход: 1 порция воды на каждую сухую растущую грядку. Уже политые и готовые к сбору грядки воду не расходуют.',
      'Выберите ряды и нажмите «Полить». Воду в лейку набирайте вручную.',
    ]};
    case 'hatchery': return {name:facilitySpecializations.coop.hatchery.name,lines:[
      `После постройки положите 1 обычное яйцо в инкубатор. Новая курочка появится через ${ruCount(incubationDays,'ночь','ночи','ночей')} отдыха дома.`,
      `Предел стада: ${maxFlockSize} курочек. Сейчас у вас: ${farm.flockSize}.`,
      `Яиц в запасе: ${farm.eggs}. Яйцо понадобится для запуска инкубатора, при постройке оно не расходуется.`,
    ]};
    case 'packing': return {name:facilitySpecializations.coop.packing.name,lines:[
      `${eggsPerCrate} обычных яиц → 1 ящик. Упаковку запускайте вручную в курятнике.`,
      `Яиц в запасе: ${farm.eggs}. Они нужны для упаковки, при постройке не расходуются.`,
      `Готовый ящик можно бесплатно распаковать: вернутся все ${eggsPerCrate} яиц.`,
    ]};
  }
}

export function renderFacilityChoiceDetails(farm: FarmState, branch: FacilityBranch) {
  const detail=getFacilityChoiceDetails(farm,branch);
  return `<section class="facility-choice-details" aria-label="Условия направления"><h2>${detail.name}</h2><ul>${detail.lines.map(line=>`<li>${line}</li>`).join('')}</ul><p>Откроются заказы этого направления на рынке.</p></section>`;
}
