import type { RenderTier } from './types.ts';

/** Throttle real draws at low quality, then stop scheduling when motion settles. */
export class RenderSchedule {
  private last = -Infinity;
  private reactionUntil = 0;
  react(now:number,duration=2400){this.reactionUntil=Math.max(this.reactionUntil,now+duration);}
  moving(now:number,transition:boolean,motion:boolean){return motion&&(transition||now<this.reactionUntil);}
  shouldDraw(now:number,tier:RenderTier){
    if(tier==='low'&&now-this.last<1000/30-.5)return false;
    this.last=now;return true;
  }
  resetClock(){this.last=-Infinity;}
  stop(){this.reactionUntil=0;this.resetClock();}
}
