import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type Object3D, type AnimationClip } from 'three';

export type MascotState = 'Idle' | 'Cheer' | 'Victory';
export class MascotController {
  readonly mixer: AnimationMixer;
  private actions = new Map<MascotState, AnimationAction>();
  private current?: AnimationAction;
  activeClip: MascotState = 'Idle';
  private onFinished = () => this.play('Idle');
  constructor(private root: Object3D, clips: AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    for (const name of ['Idle', 'Cheer', 'Victory'] as const) {
      const clip = clips.find(item => item.name === name);
      if (!clip) throw new Error(`Cáo thiếu clip ${name}`);
      this.actions.set(name, this.mixer.clipAction(clip));
    }
    this.mixer.addEventListener('finished', this.onFinished);
    this.play('Idle', false);
  }
  play(state: MascotState, motion = true) {
    if (!motion && state !== 'Idle') return;
    const action = this.actions.get(state)!;
    if (action === this.current && state === 'Idle') return;
    action.reset().setLoop(state === 'Idle' ? LoopRepeat : LoopOnce, state === 'Idle' ? Infinity : 1);
    action.clampWhenFinished = state !== 'Idle';
    this.current?.fadeOut(.18);
    action.fadeIn(.18).play();
    this.current = action; this.activeClip = state;
  }
  update(delta: number) { this.mixer.update(Math.max(0, Math.min(delta, .05))); }
  dispose() {
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root);
  }
}
