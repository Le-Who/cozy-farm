import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {BAY_INSTRUMENTS, BAY_SCALE} from '../src/bay-music-model.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {getShellAt} from '../src/farm.ts'
import {gardenMaterialStock,installGardenInstrument} from '../src/harbour-economy.ts'

const source = readFileSync(new URL('../src/bay-music.ts',import.meta.url),'utf8')
const markup = source.match(/<div data-sheet-content="materials"[^\n]+/)?.[0] ?? ''
const previewOnly = /class="bay-music-preview-note">Послушать<\/button>/
function lifecycle() {
  assert.match(markup, previewOnly, 'the existing material card must offer one explicit sound before building')
  const functions = source.slice(source.indexOf('  function cancelInstrumentPreview('),source.indexOf('  async function restoreSound('))
  const currentInstrument = source.match(/  const nextInstrument = .*/)?.[0]
  assert.ok(currentInstrument); assert.ok(functions.includes('async function previewExpansion'))
  return stripTypeScriptTypes(`let instrumentPreview: { until?: number; stop?: () => void } | undefined;
    ${currentInstrument}
    ${functions}
    ;({play:previewExpansion,cancel:cancelInstrumentPreview});`)
}

test('the exact Materials card offers a native named sample, not another build, concert or melody load',()=>{
  assert.match(markup, previewOnly)
  assert.equal([...source.matchAll(/class="bay-music-preview-note"/g)].length,1)
  assert.match(markup,/class="bay-music-expand">Собрать инструмент<\/button>/)
  assert.match(markup,/class="bay-music-freight">Материалы и склады<\/button>/)
  assert.match(source,/listen\.setAttribute\('aria-label', `Послушать: \$\{next\.name\}`\)/)
  assert.match(source,/preview\.hidden = !expansion \|\| !next/)
  assert.match(source,/if \(button === listen\) \{ void previewExpansion\(\); return \}/)
  assert.match(source,/if \(next !== 'materials'\) cancelInstrumentPreview\(\)/)
  assert.match(source,/if \(document\.hidden\) \{\s+cancelInstrumentPreview\(\); solo\(\)/)
  assert.match(source,/function stop\(message\?: string\): void \{\s+cancelInstrumentPreview\(\)/)
  assert.match(source,/if \(button\.classList\.contains\('bay-music-freight'\)\) \{ cancelInstrumentPreview\(\)/)
  assert.match(source,/if \(event\.key === 'Escape'\).*showSheet\(null\)/)
  assert.match(source,/if \(\(event\.target as HTMLElement\)\.matches\('input,select,textarea'\) \|\| sheet\) return/)
  // The old rewarded sheets alone still load a complete arrangement explicitly.
  assert.match(source,/bay-music-festival'\) && state\.festivalUnlocked \? bayFestivalPattern/)
  assert.match(source,/cloneBayPattern\(pattern\)[^\n]*update\(\); save\(\)/)
})

function audioContract(state: {level: number}) {
  const calls: unknown[][] = [], notices: string[] = []
  const audio = {
    currentTime:1,
    unlock:async()=>{calls.push(['unlock']);return true},
    primeInstruments:async(ids: string[])=>{calls.push(['prime',...ids]);return true},
    previewNote:(id:string,midi:number)=>{
      calls.push(['preview',id,midi])
      const until=audio.currentTime+.7
      return {until,stop:()=>calls.push(['stop',id])}
    },
  }
  const env = {BAY_INSTRUMENTS,BAY_SCALE,bayAudio:audio,document:{hidden:false},state, sheet:'materials',
    running:false,preparing:false,destroyed:false, heard:true, audible:()=>env.heard,
    query:(selector: string)=>{
      assert.equal(selector,'.bay-music-sheet-status')
      return {set textContent(line:string){notices.push(line)}}
    } }
  const action = runInNewContext(lifecycle(),env) as {play:()=>Promise<void>; cancel:()=>void}
  return {audio,calls,notices,env,action}
}

test('a voluntary preview on the genuinely earned Day15 shore branch leaves every entry of farm and composition unchanged',async()=>{
  const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const player=commissionPlayer(opening);
  assert.deepEqual([player.state.day,player.actions,player.state.coins],[14,107,68])
  for(let day=14;day<=15;day++){
    player.visit('grove');player.act('gatherSeaSalt')
    for(let spot=0;spot<3;spot++){assert.equal(getShellAt(player.state,spot),'regular');player.act('collectShell',spot)}
    if(day<15)player.night()
  }
  player.visit('village')
  const farm=player.state, before=structuredClone(farm)
  assert.deepEqual(gardenMaterialStock(farm),{shells:6,seaSalt:4,beeswax:0})
  const {calls,audio,action}=audioContract(farm.musicGarden)
  assert.deepEqual(calls,[],'opening the sheet itself plays nothing')
  const request=action.play()
  await action.play()
  await request; await action.play()
  assert.deepEqual(calls,[['unlock'],['prime','shaker'],['preview','shaker',60]])
  assert.deepEqual(farm,before)
  audio.currentTime=2
  await action.play()
  assert.equal(calls.filter(a=>a[0]==='preview').length,2,'a fresh press after the one-shot may replay it')
  action.cancel()
  assert.deepEqual(calls.at(-1),['stop','shaker'])
  assert.deepEqual(farm,before)
  // Only the existing explicit install changes gameplay, and only by the existing quote.
  assert.equal(installGardenInstrument(farm),1)
  player.reload()
  assert.deepEqual([player.state.musicGarden.level,player.state.coins,player.state.shells.regular,player.state.seaSalt],[1,68,0,1])
  assert.deepEqual(player.state.musicGarden,{...before.musicGarden,level:1})
})

test('an audio wait cannot outlive its card, visibility or exact instrument; failure never starts another audio or gameplay action',async()=>{
  const {calls,action,audio,notices,env}=audioContract({level:0})
  env.running=true;await action.play();env.running=false
  env.heard=false;await action.play();env.heard=true
  assert.deepEqual(calls,[])
  assert.deepEqual(notices,['Сначала остановите мелодию.','Музыка выключена.'])
  audio.unlock=async()=>false
  await action.play()
  assert.equal(notices.at(-1),'Звук инструмента пока недоступен.')
  audio.unlock=async()=>true
  for(const invalidate of [
    () => { env.sheet='settings';action.cancel() },
    () => { env.document.hidden=true;action.cancel() },
    () => { env.state.level=1 },
    () => { env.destroyed=true;action.cancel() },
  ]){
    let loaded!: (ready:boolean)=>void
    let started!: () => void
    const decoded=new Promise<boolean>(resolve=>{loaded=resolve})
    const requested=new Promise<void>(resolve=>{started=resolve})
    audio.primeInstruments=ids=>{calls.push(['prime',...ids]);started();return decoded}
    const pending=action.play()
    await requested
    invalidate()
    loaded(true);await pending
    assert.ok(calls.every(call=>call[0]==='prime'),'a stale decode never plays after cancel or expansion changes')
    env.sheet='materials';env.document.hidden=false;env.state.level=0;env.destroyed=false
  }
  audio.primeInstruments=async(ids)=>{calls.push(['prime',...ids]);return false}
  await action.play()
  assert.equal(notices.at(-1),'Звук инструмента пока недоступен.')
  assert.ok(calls.every(call=>call[0]==='prime'))
  env.state.level=1;audio.primeInstruments=async()=>true;await action.play()
  assert.deepEqual(calls.at(-1),['preview','bass',60])
  action.cancel()
  assert.deepEqual(calls.at(-1),['stop','bass'])
  const count=calls.length
  env.state.level=2;await action.play()
  assert.equal(calls.length,count)
})
