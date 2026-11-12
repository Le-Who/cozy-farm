import { normalizeSignatureDraft, signatureFruitIds, type SignatureIngredient } from './culinary.ts';
import { getSignatureAction, ingredientCount, type FarmState } from './farm.ts';
import { restoreRecipeDraft } from './recipe-draft.ts';

/** A future choice is not a purchase, reservation, or promise of cooking availability. */
export function recipePlanningChoices(_farm: FarmState): SignatureIngredient[] {
  return signatureFruitIds.map(id => ({ id, quantity: 1 }));
}

/** Resolve untrusted palette attributes without accepting arbitrary fruit or trait identifiers. */
export function recipePlanningIngredient(farm: FarmState, id: unknown, trait?: unknown): SignatureIngredient | undefined {
  return recipePlanningChoices(farm).find(part => part.id === id && part.trait === trait);
}

/** A full remembered composition uses the same exact costs and kitchen rules as cooking. */
export function recipePlanningGuide(farm: FarmState, bookmark: unknown = farm.recipeDraft) {
  const saved = restoreRecipeDraft(bookmark);
  if (!saved || saved.slots.some(part => part === null)) return undefined;
  const draft = normalizeSignatureDraft({ base: saved.base, ingredients: saved.slots });
  if (!draft) return undefined;
  const action = getSignatureAction(farm, draft);
  const lines = action.items.map(item => {
    const stock = ingredientCount(farm, item);
    return { item, stock, required: item.quantity, missing: Math.max(0, item.quantity - stock) };
  });
  return { draft, ...action, lines, missing: lines.reduce((sum, line) => sum + line.missing, 0) };
}
