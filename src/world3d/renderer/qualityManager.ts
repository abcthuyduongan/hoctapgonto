import type { QualityChoice, RenderTier } from './types.ts';

export const QUALITY = {
  low: { maxDpr: 1, shadows: false, particles: false },
  balanced: { maxDpr: 1.5, shadows: true, particles: false },
  high: { maxDpr: 2, shadows: true, particles: true },
} as const;
const tiers: RenderTier[] = ['low', 'balanced', 'high'];
/** Conservative start. Real device acceptance must tune these thresholds. */
export class QualityManager {
  tier: RenderTier;
  choice: QualityChoice;
  private lastChange = 0;
  private slow = 0;
  private fast = 0;
  private severe = 0;
  constructor(choice: QualityChoice, mobile: boolean) {
    this.choice = choice;
    this.tier = choice === 'auto' ? (mobile ? 'low' : 'balanced') : choice;
  }
  setChoice(choice: QualityChoice) {
    this.choice = choice;
    this.slow = this.fast = this.severe = 0;
    if (choice !== 'auto') this.tier = choice;
  }
  observe(frameMs: number, now: number): RenderTier | null {
    if (this.choice !== 'auto' || !Number.isFinite(frameMs) || frameMs <= 0) return null;
    this.slow = frameMs > 38 ? this.slow + 1 : 0;
    this.fast = frameMs < 19 ? this.fast + 1 : 0;
    this.severe = frameMs >= 80 ? this.severe + 1 : 0;
    // Sustained near-freezing should not wait through the ordinary cooldown.
    // A single asset decode, pause, or brief spike never meets this streak.
    if(this.severe>=30&&this.tier!=='low'){
      this.tier='low';this.lastChange=now;this.slow=this.fast=this.severe=0;return 'low';
    }
    if (now - this.lastChange < 15000) return null;
    const index = tiers.indexOf(this.tier);
    const next = this.slow >= 120 && index > 0 ? tiers[index - 1]
      : this.fast >= 600 && index < 1 ? tiers[index + 1] : null;
    if (!next) return null;
    this.tier = next; this.lastChange = now; this.slow = this.fast = this.severe = 0;
    return next;
  }
}
