import { traitIds } from './climate.ts';
import { normalizeSignatureDraft, signatureFruitIds, type SignatureDraft, type SignatureIngredient } from './culinary.ts';

/** A remembered choice, never a reservation, recipe result, or executable action. */
export type RecipeDraftBookmark = {
  base: SignatureDraft['base'];
  slots: [SignatureIngredient | null, SignatureIngredient | null];
  activeSlot: 0 | 1;
};
type Holder = { recipeDraft?: RecipeDraftBookmark };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Missing old-save fields are preserved as missing. Invalid present fields reject the save. */
export function restoreRecipeDraft(value: unknown): RecipeDraftBookmark | null | undefined {
  if (value === undefined) return null;
  if (!record(value) || Object.keys(value).some(key => !['base', 'slots', 'activeSlot'].includes(key))
    || (value.base !== 'preserves' && value.base !== 'tart') || (value.activeSlot !== 0 && value.activeSlot !== 1)
    || !Array.isArray(value.slots) || value.slots.length !== 2) return;
  const slots: RecipeDraftBookmark['slots'] = [null, null];
  for (let index = 0; index < 2; index++) {
    const part: unknown = value.slots[index];
    if (part === null) continue;
    if (!record(part) || Object.keys(part).some(key => !['id', 'quantity', 'trait'].includes(key))
      || !signatureFruitIds.some(id => id === part.id) || part.quantity !== 1
      || (part.trait !== undefined && !traitIds.some(trait => trait === part.trait))) return;
    slots[index] = { id: part.id as SignatureIngredient['id'], quantity: 1,
      ...(part.trait === undefined ? {} : { trait: part.trait as SignatureIngredient['trait'] }) };
  }
  if (slots.every(part => part === null)) return;
  return { base: value.base, slots, activeSlot: value.activeSlot };
}

export function rememberRecipeDraft(holder: Holder, value: unknown): boolean {
  const draft = restoreRecipeDraft(value);
  if (!draft) return false;
  holder.recipeDraft = draft;
  return true;
}

export function recipeDraftKey(draft: RecipeDraftBookmark): string {
  return `${draft.base}|${draft.activeSlot}|${draft.slots.map(part => part ? `${part.id}:${part.trait ?? 'ordinary'}` : '-').join('|')}`;
}

export function resumeRecipeDraft(holder: Holder, expected: string | undefined): RecipeDraftBookmark | undefined {
  const draft = holder.recipeDraft;
  return draft && expected === recipeDraftKey(draft) ? restoreRecipeDraft(draft) ?? undefined : undefined;
}

export function resetRecipeDraft(holder: Holder, expected: string | undefined): boolean {
  if (!resumeRecipeDraft(holder, expected)) return false;
  delete holder.recipeDraft;
  return true;
}

/** Only a successful preparation of this same chosen composition completes its bookmark. */
export function completeRecipeDraft(holder: Holder, prepared: SignatureDraft): void {
  const draft = holder.recipeDraft;
  if (!draft) return;
  const chosen = normalizeSignatureDraft({ base: draft.base, ingredients: draft.slots.filter(part => part !== null) });
  if (chosen && JSON.stringify(chosen) === JSON.stringify(normalizeSignatureDraft(prepared))) delete holder.recipeDraft;
}
