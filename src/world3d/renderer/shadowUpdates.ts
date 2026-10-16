import type { RenderTier } from './types.ts';

/** Static game scenery needs one shadow pass; moving home scenery is rate limited. */
export class ShadowUpdates {
  private dirty = true;
  private last = -Infinity;
  updates = 0;
  request() { this.dirty = true; }
  shouldUpdate(now: number, tier: RenderTier, game: boolean, motion: boolean) {
    if (tier === 'low') return false;
    const animated = !game && motion && (tier === 'high' || now - this.last >= 32);
    if (!this.dirty && !animated) return false;
    this.dirty = false; this.last = now; this.updates++;
    return true;
  }
}
