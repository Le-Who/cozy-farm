import { cropDefinitions, getBedStage, getWorkshopAction, treeDefinitions, type FarmState, type ResidentId } from './farm.ts'
import { henFriends } from './hen-friendship.ts'
import { canInviteNeighbor, isVisitActivity, visitActivities, visitActivityIds, visitName, type VisitActivityId, type VisitMemory, type NeighborVisit } from './neighbor-visits.ts'

/** Reversible, local-only prototype. Not imported by the production panel or save schema. */
export type GuestBookSelection = { resident: ResidentId; activity: VisitActivityId; page: 'visit' | 'memories' | 'rules'; memory?: VisitActivityId }
export type GuestBookAction = 'visit-invite' | 'visit-do' | 'visit-introduce-hen' | 'visit-reply' | 'visit-finish' | 'visit-book-home' | 'close'
export type GuestBookCommand = { action: GuestBookAction; value: string; label: string; enabled: boolean; context: string }
export type GuestBookScreen = {
  kind: 'invitation' | 'active' | 'memories' | 'rules'; activity: VisitActivityId; resident: ResidentId
  commands: GuestBookCommand[]; gate?: string; readiness?: string; workReady?: boolean
  memories: VisitMemory[]; memory?: VisitMemory; active?: NeighborVisit
}
const isPage = (value: unknown): value is GuestBookSelection['page'] => value === 'visit' || value === 'memories' || value === 'rules'
function invitationGate(farm: FarmState, resident: ResidentId): string | undefined {
  if (farm.island !== 'home') return 'Приглашайте соседей с Родного острова.'
  if (!farm.village.built) return 'Постройте Лавандовую гавань, чтобы познакомиться с соседями.'
  if (!farm.village.residents.includes(resident)) return 'Сначала пригласите этого соседа поселиться в гавани.'
  if (!canInviteNeighbor(farm, resident)) return 'Сначала устройте с этим соседом общую встречу в гавани.'
  if (farm.neighborVisits.serial >= 1_000_000) return 'Гостевая книга заполнена.'
}
function workReadiness(farm: FarmState, id: VisitActivityId): { readiness: string; workReady: boolean } {
  switch (visitActivities[id].kind) {
    case 'crop': {
      const bed = farm.beds.find(b => b.kind === 'crop' && getBedStage(b) === 'ripe')
      return bed?.kind === 'crop'
        ? { readiness: `Можно показать: ${cropDefinitions[bed.crop].name.toLowerCase()}.`, workReady: true }
        : { readiness: 'Зрелых грядок пока нет. Можно сначала вырастить урожай.', workReady: false }
    }
    case 'hen': return { readiness: 'Можно познакомить с любой курочкой, даже уже поглаженной.', workReady: true }
    case 'pastry': {
      const action = getWorkshopAction(farm)
      return { readiness: action.available ? 'Для одной выпечки есть 2 пшеницы и 1 яйцо. Изделие останется у вас.' : action.label, workReady: action.available }
    }
    case 'fruit': {
      const tree = farm.trees.home.find(t => t && t.fruitReady > 0)
      return tree
        ? { readiness: `Можно показать: ${treeDefinitions[tree.tree].treeName.toLowerCase()}.`, workReady: true }
        : { readiness: 'Дождитесь спелых плодов домашнего дерева. Визит можно начать позднее.', workReady: false }
    }
  }
}

export class GuestBookView {
  private selection: GuestBookSelection = { resident: 'bea', activity: 'beaHarvest', page: 'visit' }

  private revision = 0

  snapshot(): GuestBookSelection { return { ...this.selection } }

  /** Panel-history snapshot only, never an executable payload or FarmState field. */
  restore(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false
    const s = value as Partial<GuestBookSelection>
    if ((s.resident !== 'bea' && s.resident !== 'finn') || !isVisitActivity(s.activity)
      || visitActivities[s.activity].resident !== s.resident || !isPage(s.page)
      || s.memory !== undefined && !isVisitActivity(s.memory)) return false
    this.selection = { resident: s.resident, activity: s.activity, page: s.page, ...(s.memory ? { memory: s.memory } : {}) }
    this.revision++
    return true
  }

  /** false means the caller should use its existing parent Back/Close, not finish the visit. */
  back(): boolean {
    if (this.selection.page === 'visit') return false
    this.selection = { ...this.selection, page: 'visit' }; this.revision++
    return true
  }

  choose(farm: FarmState, part: string, value: string): boolean {
    if (part === 'page' && isPage(value)) {
      this.selection = { ...this.selection, page: value }; this.revision++
      return true
    }
    if (part === 'memory' && this.selection.page === 'memories' && isVisitActivity(value)
      && farm.neighborVisits.memories.some(memory => memory.activity === value)) {
      this.selection = { ...this.selection, memory: value }; this.revision++
      return true
    }
    if (farm.neighborVisits.active || this.selection.page !== 'visit') return false
    if (part === 'resident' && (value === 'bea' || value === 'finn')) {
      this.selection = { ...this.selection, resident: value, activity: visitActivityIds.find(id => visitActivities[id].resident === value)! }
      this.revision++
      return true
    }
    if (part === 'activity' && isVisitActivity(value) && visitActivities[value].resident === this.selection.resident) {
      this.selection = { ...this.selection, activity: value }; this.revision++
      return true
    }
    return false
  }

  current(farm: FarmState): GuestBookScreen {
    const active = farm.neighborVisits.active
    const activity = active?.activity ?? this.selection.activity
    const resident = visitActivities[activity].resident
    const context = `${this.revision}:${farm.day}:${farm.island}:${farm.neighborVisits.serial}:${active?.observation ? 'observed' : 'pending'}:${this.selection.page}:${activity}`
    const memories = farm.neighborVisits.memories.map(memory => ({ ...memory }))
    const common = { activity, resident, memories }
    if (this.selection.page === 'memories') return { ...common, kind: 'memories', memory: memories.find(m => m.activity === this.selection.memory) ?? memories[0], commands: [] }
    if (this.selection.page === 'rules') return { ...common, kind: 'rules', commands: [] }
    if (active) {
      const commands: GuestBookCommand[] = []
      const add = (action: GuestBookAction, value: string, label: string) => commands.push({ action, value, label, enabled: farm.island === 'home', context })
      if (active.observation) {
        add('visit-reply', `${active.serial}:quiet`, 'О тихих радостях')
        add('visit-reply', `${active.serial}:curious`, 'О новых идеях')
      } else if (visitActivities[activity].kind === 'hen') {
        henFriends.slice(0, farm.flockSize).forEach((hen, id) => add('visit-introduce-hen', `${active.serial}:${id}`, `Познакомить: ${hen.name}`))
      } else {
        const kind = visitActivities[activity].kind
        add('visit-do', String(active.serial), kind === 'pastry' ? 'В кондитерскую' : kind === 'fruit' ? 'К дереву' : 'К зрелой грядке')
      }
      commands.push({ action: 'close', value: '', label: 'Побыть на ферме', enabled: true, context })
      add('visit-finish', String(active.serial), active.observation ? 'Попрощаться' : 'Завершить визит')
      return { ...common, ...workReadiness(farm, activity), kind: 'active', commands,
        active: { ...active, observation: active.observation ? { ...active.observation } : null } }
    }
    const gate = invitationGate(farm, resident)
    const commands: GuestBookCommand[] = [{ action: 'visit-invite', value: activity,
      label: `${memories.some(m => m.activity === activity) ? 'Позвать снова' : 'Пригласить'}: ${visitName(resident)} · ${visitActivities[activity].title}`,
      enabled: !gate, context }]
    if (farm.island !== 'home') commands.push({ action: 'visit-book-home', value: '', label: 'Вернуться домой к приглашениям', enabled: true, context })
    return { ...common, ...workReadiness(farm, activity), kind: 'invitation', gate, commands }
  }

  /** Returns only a currently displayed command. The existing domain handler remains authoritative. */
  resolve(farm: FarmState, request: unknown): { action: GuestBookAction; value: string } | undefined {
    if (!request || typeof request !== 'object') return
    const candidate = request as Partial<GuestBookCommand>
    const command = this.current(farm).commands.find(item => item.enabled && item.action === candidate.action && item.value === candidate.value && item.context === candidate.context)
    if (command) return { action: command.action, value: command.value }
  }
}
