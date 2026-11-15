import type { FarmState } from './farm.ts'

/** Navigation only. None of this state belongs in a farm save. */
export type RecipeBookView = {
  selectedId?: string
  query?: string
  mode?: 'index' | 'detail'
  fromIndex?: boolean
  expandedRepeatId?: string
  indexScroll?: number
  detailScroll?: number
  disclosures?: string[]
  focus?: string
}
export function sortedBookRecipes(farm: FarmState) {
  return [...farm.culinary.recipes].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.createdOn-a.createdOn||Number(b.id.slice(1))-Number(a.id.slice(1)))
}
const searchableRecipeName = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim()
/** Filter names only; keep favorite ordering and every exact saved ID, including duplicate names. */
export function visibleBookRecipes(farm: FarmState, view: RecipeBookView) {
  const words = searchableRecipeName(view.query ?? '').split(/\s+/).filter(Boolean)
  return sortedBookRecipes(farm).filter(recipe => words.every(word => searchableRecipeName(recipe.name).includes(word)))
}
export function selectedBookId(farm: FarmState, view: RecipeBookView): string | undefined {
  if (view.selectedId === 'draft' && farm.recipeDraft) return 'draft'
  return farm.culinary.recipes.some(recipe=>recipe.id===view.selectedId) ? view.selectedId : sortedBookRecipes(farm)[0]?.id ?? (farm.recipeDraft ? 'draft' : undefined)
}
export function recipeBookNarrow() { return window.matchMedia('(max-width: 819px), (max-height: 559px)').matches }
function focusId(element: Element | null): string | undefined {
  if (!(element instanceof HTMLElement)) return
  const scope=element.closest('.recipe-book-index')?'index:':'detail:'
  if (element.matches('[data-recipe-query]')) return 'index:query'
  if (element.dataset.recipeName) return `${scope}name:${element.dataset.recipeName}`
  if (element.tagName === 'SUMMARY') return scope+(element.parentElement?.getAttribute('data-recipe-disclosure') ?? element.parentElement?.getAttribute('data-repeat-guide') ?? '')
  if (element.dataset.action) return scope+JSON.stringify([element.dataset.action,element.dataset.value,element.dataset.resident])
  return element.dataset.recipeFocus
}
const focusable = 'button:not(:disabled),input,textarea,summary,[data-recipe-focus]'
function paneScroll(root: HTMLElement, selector: string) {
  const pane = root.querySelector<HTMLElement>(selector)
  // At narrow widths the inactive pane has no layout box, so CSSOM reports 0.
  return pane?.getClientRects().length ? pane.scrollTop : undefined
}

/** Owns selection plus the view snapshot used by rerenders and PanelVisit. */
export class RecipeBookNavigation {
  view: RecipeBookView = {mode:'index'}
  setQuery(query: string) {
    const next = query.slice(0,100)
    if ((this.view.query ?? '') === next) return false
    this.view = {...this.view,query:next,indexScroll:0,focus:'index:query'}
    return true
  }
  reconcile(farm: FarmState) {
    const selectedId = selectedBookId(farm,this.view)
    if (selectedId !== this.view.selectedId) {
      const deleted = this.view.selectedId !== undefined
      this.view = {...this.view,selectedId,detailScroll:0,disclosures:[],expandedRepeatId:undefined,focus:undefined,...(deleted?{mode:'index' as const}:{})}
    }
  }
  select(farm: FarmState, id: string | undefined, expanded = false, fromIndex = false) {
    if (!id || !(id === 'draft' ? farm.recipeDraft : farm.culinary.recipes.some(recipe=>recipe.id===id))) return false
    const changed = id !== this.view.selectedId
    this.view = {...this.view,selectedId:id,mode:'detail',fromIndex,focus:undefined,...(changed?{detailScroll:0,disclosures:[],expandedRepeatId:undefined}:{}),...(expanded?{expandedRepeatId:id}:{})}
    return true
  }
  index() { this.view={...this.view,mode:'index',focus:'index:'+JSON.stringify(['select-recipe',this.view.selectedId,undefined])} }
  capture(root: HTMLElement) {
    const book=root.querySelector<HTMLElement>('.signature-book')
    if (!book) return
    const same=book.dataset.selectedRecipe===this.view.selectedId && book.dataset.mode===(this.view.mode??'index')
    this.view={...this.view,indexScroll:paneScroll(root,'.recipe-book-index')??this.view.indexScroll,
      ...(same?{detailScroll:paneScroll(root,'.recipe-book-detail')??this.view.detailScroll,
        disclosures:[...root.querySelectorAll<HTMLDetailsElement>('details[data-recipe-disclosure][open]')].map(item=>item.dataset.recipeDisclosure!),
        focus:root.contains(document.activeElement)?focusId(document.activeElement):this.view.focus}:{}),
    }
  }
  snapshot(root: HTMLElement): RecipeBookView { this.capture(root); return structuredClone(this.view) }
  load(view: RecipeBookView) { this.view=structuredClone(view) }
  restore(root: HTMLElement, focus=false) {
    const index=root.querySelector<HTMLElement>('.recipe-book-index'),detail=root.querySelector<HTMLElement>('.recipe-book-detail')
    if(index)index.scrollTop=this.view.indexScroll??0
    if(detail)detail.scrollTop=this.view.detailScroll??0
    if(focus){
      const search = this.view.mode === 'index' && this.view.query ? root.querySelector<HTMLElement>('[data-recipe-query]') : null
      const target=[...root.querySelectorAll<HTMLElement>(focusable)].find(element=>focusId(element)===this.view.focus&&element.getClientRects().length>0)
        ?? (search?.getClientRects().length ? search : undefined)
        ?? [...root.querySelectorAll<HTMLElement>('[data-recipe-focus="cooking"], .recipe-book-index [data-action="select-recipe"], .recipe-book-index [data-action="new-signature"]')].find(element=>element.getClientRects().length>0)
      target?.focus({preventScroll:true})
    }
  }
}
