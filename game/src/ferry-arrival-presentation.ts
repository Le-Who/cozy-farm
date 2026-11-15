import type { FerryExpedition } from './ferry-expeditions.ts';
type Voyage = Pick<FerryExpedition, 'serial' | 'phase'> | null;

/** Session-only reveal opportunity, never part of the farm or save. */
export class FerryArrivalPresentation {
  private pendingSerial: number | undefined;

  /** Call only after a successful played night, with the pre-night phase copied. */
  recordNight(before: Voyage, after: Voyage): void {
    if (before?.phase === 'sailing' && after?.phase === 'ready' && before.serial === after.serial)
      this.pendingSerial = after.serial;
    else if (after?.phase !== 'ready' || after.serial !== this.pendingSerial)
      this.pendingSerial = undefined;
  }

  take(active: Voyage, visible: boolean): boolean {
    if (active?.phase !== 'ready' || active.serial !== this.pendingSerial) {
      this.pendingSerial = undefined;
      return false;
    }
    if (!visible) return false;
    this.pendingSerial = undefined;
    return true;
  }
}
