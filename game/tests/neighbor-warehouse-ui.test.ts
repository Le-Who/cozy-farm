import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createServer} from 'vite'
import {repeatSignature,serveNeighborPlan} from '../src/farm.ts'
import {transferBayGoods} from '../src/harbour-economy.ts'
import {neighborFoodFixture} from './fixtures/neighbor-food.ts'

// Public renderer: the card must offer retrieval, not a hidden transfer or a new batch.
test('the real meeting card routes exact local portions to existing withdrawal panels', async () => {
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
  try {
    const {neighborDetail}=await server.ssrLoadModule('/src/community-ui.ts')
    const art={icon:()=>'<img alt="">',offerIcon:()=>'<img alt="">'}
    for(const ordinary of [false,true]) {
      const {farm,planId,recipeId}=neighborFoodFixture()
      const id=ordinary?'dish:strawberryTart':`signature:${recipeId}`
      if(ordinary)assert.ok(serveNeighborPlan(farm,planId,'dish:strawberryTart').ok)
      else assert.ok(repeatSignature(farm,recipeId,undefined,3).ok)
      assert.ok(transferBayGoods(farm,'deposit','village',id,ordinary?2:3).ok)
      const before=structuredClone(farm),html=neighborDetail(farm,'bea',art)
      assert.match(html,new RegExp(`data-action="neighbor-stored-food" data-value="bea:1" data-food="${id}"`))
      assert.match(html,/К готовой порции на складе/)
      assert.match(html,/Готовить заново не нужно/)
      assert.doesNotMatch(html,/data-action="neighbor-repeat-food"|data-action="arrange-neighbor"/)
      assert.deepEqual(farm,before)
      farm.freight.warehouses.village={}
      assert.doesNotMatch(neighborDetail(farm,'bea',art),/data-action="neighbor-stored-food"/)
    }
  } finally {await server.close()}
})
