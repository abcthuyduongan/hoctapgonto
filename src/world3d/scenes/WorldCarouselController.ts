import { Vector3, type Group } from 'three';
import type { WorldId } from '../engine';
import { blendPose, neutralSlots, orbitSlots, smoothStep, targetRotationForIndex, type IslandPose } from './islandCarousel.ts';
import { carouselLayout, WORLD_ISLANDS } from './worldLayout.ts';

const OVERVIEW_ANGLE = Math.PI / 6;
/** One interruptible transition, advanced by the renderer's existing RAF only. */
export class WorldCarouselController {
  selected: WorldId | null = null;
  rotation = 0;
  moving = false;
  mascotLocation: 'waiting' | WorldId = 'waiting';
  mascotState: 'waiting' | 'jumping' | 'on-island' = 'waiting';
  jumpProgress = 1;
  private mobile = false;
  private ids: WorldId[];
  private layout = carouselLayout(false);
  private fromPoses: Record<WorldId, IslandPose>;
  private orbitOffsets: Record<WorldId, IslandPose>;
  private fromRotation = 0;
  private targetRotation = 0;
  private elapsed = 0;
  private jumpStart = new Vector3();
  private destination = new Vector3();
  private roots: Map<WorldId, Group>;
  private guide: Group;
  private waitingPlatform: Group;

  constructor(roots: Map<WorldId, Group>, guide: Group, waitingPlatform: Group) {
    this.roots = roots; this.guide = guide; this.waitingPlatform = waitingPlatform;
    this.ids = [...roots.keys()];
    this.layout = carouselLayout(false, this.ids.length);
    this.fromPoses = this.readPoses(); this.orbitOffsets = this.readPoses();
    this.settle();
  }
  private readPoses() {
    return Object.fromEntries([...this.roots].map(([id, root]) => [id,
      { x: root.position.x, y: root.position.y, z: root.position.z, scale: root.scale.x },
    ])) as Record<WorldId, IslandPose>;
  }
  private neutral() {
    return neutralSlots(this.ids, this.layout.spacing, 0, -1, this.layout.neutralScale);
  }
  private orbit(rotation: number) {
    return orbitSlots(this.ids, rotation, this.layout.radiusX, this.layout.radiusZ,
      this.layout.centerZ, this.layout.orbitScale);
  }
  private apply(poses: Record<WorldId, IslandPose>) {
    for (const [id, root] of this.roots) {
      const pose = poses[id]; root.position.set(pose.x, pose.y, pose.z); root.scale.setScalar(pose.scale);
    }
  }
  private arrival() {
    if (!this.selected) return this.destination.set(this.layout.waiting.x, this.layout.waiting.y, this.layout.waiting.z);
    const island = this.roots.get(this.selected)!;
    const landing = WORLD_ISLANDS.find(item => item.id === this.selected)?.landing ?? [-1.1, .04, 1.1];
    return this.destination.set(island.position.x + landing[0] * island.scale.x,
      island.position.y + landing[1] * island.scale.y, island.position.z + landing[2] * island.scale.z);
  }
  private finishJump() {
    this.guide.position.copy(this.arrival()); this.guide.rotation.y = 0;
    this.mascotLocation = this.selected ?? 'waiting';
    this.mascotState = this.selected ? 'on-island' : 'waiting';
    this.jumpProgress = 1;
  }
  configure(mobile: boolean) {
    if (mobile === this.mobile) return;
    this.mobile = mobile; this.layout = carouselLayout(mobile, this.ids.length);
    // A viewport profile switch keeps the current selection and a valid landing.
    this.settle();
  }
  settle() {
    this.moving = false;
    if (this.selected) {
      this.rotation = targetRotationForIndex(this.ids.indexOf(this.selected), this.ids.length, this.rotation);
      const poses = this.orbit(this.rotation);
      poses[this.selected].scale = this.layout.frontScale; poses[this.selected].y = .1;
      this.apply(poses);
    } else { this.rotation = OVERVIEW_ANGLE; this.apply(this.neutral()); }
    this.waitingPlatform.position.set(this.layout.waiting.x, 0, this.layout.waiting.z);
    this.waitingPlatform.visible = !this.selected;
    this.finishJump();
  }
  select(id: WorldId | null, animate: boolean) {
    if (id === this.selected || (id && !this.roots.has(id))) return false;
    this.fromPoses = this.readPoses();
    const orbitNow = this.orbit(this.rotation);
    this.orbitOffsets = Object.fromEntries(this.ids.map(key => [key, {
      x: this.fromPoses[key].x - orbitNow[key].x, y: 0,
      z: this.fromPoses[key].z - orbitNow[key].z, scale: 0,
    }])) as Record<WorldId, IslandPose>;
    this.fromRotation = this.rotation;
    this.selected = id;
    this.targetRotation = id
      ? targetRotationForIndex(this.ids.indexOf(id), this.ids.length, this.rotation)
      : targetRotationForIndex(0, this.ids.length, this.rotation - OVERVIEW_ANGLE) + OVERVIEW_ANGLE;
    this.elapsed = 0; this.jumpProgress = 0;
    this.jumpStart.copy(this.guide.position);
    this.moving = true; this.mascotState = 'jumping';
    if (!id) this.waitingPlatform.visible = true;
    if (!animate) this.settle();
    return true;
  }
  advance(delta: number) {
    if (!this.moving) return;
    this.elapsed += Math.max(0, Math.min(delta, .05));
    const progress = Math.min(1, this.elapsed / this.layout.transitionSeconds);
    const ease = smoothStep(progress);
    this.rotation = this.fromRotation + (this.targetRotation - this.fromRotation) * ease;
    if (this.selected) {
      const poses = this.orbit(this.rotation);
      for (const id of this.ids) {
        poses[id].x += this.orbitOffsets[id].x * (1 - ease);
        poses[id].z += this.orbitOffsets[id].z * (1 - ease);
        poses[id].y = this.fromPoses[id].y * (1 - ease) + (id === this.selected ? .1 : 0) * ease;
        poses[id].scale = this.fromPoses[id].scale * (1 - ease)
          + (id === this.selected ? this.layout.frontScale : this.layout.orbitScale) * ease;
      }
      this.apply(poses);
    } else {
      const poses = this.neutral();
      this.apply(Object.fromEntries(this.ids.map(id => [id, blendPose(this.fromPoses[id], poses[id], progress)])) as Record<WorldId, IslandPose>);
    }
    const arrival = this.arrival();
    this.guide.position.lerpVectors(this.jumpStart, arrival, ease);
    // Rapid retargets start from the actual in-flight position and cannot keep
    // adding full-height hops on top of an already airborne character.
    const height = Math.max(.2, this.layout.jumpHeight - Math.max(0, this.jumpStart.y - arrival.y));
    this.guide.position.y += Math.sin(Math.PI * progress) * height;
    this.guide.position.y = Math.min(this.guide.position.y,
      Math.max(this.layout.waiting.y, arrival.y) + this.layout.jumpHeight);
    this.guide.rotation.y = Math.sin(Math.PI * progress) * Math.atan2(arrival.x - this.jumpStart.x, arrival.z - this.jumpStart.z) * .3;
    this.jumpProgress = progress;
    if (this.selected && progress > .25) this.waitingPlatform.visible = false;
    if (progress === 1) { this.moving = false; this.finishJump(); }
  }
  snapshot() {
    return { selectedWorld: this.selected, carouselMoving: this.moving, rotation: this.rotation,
      islands: [...this.roots].map(([id, root]) => ({ id, x: root.position.x, y: root.position.y,
        z: root.position.z, scale: root.scale.x })),
      mascotLocation: this.mascotLocation, mascotState: this.mascotState,
      mascotPosition: { x: this.guide.position.x, y: this.guide.position.y, z: this.guide.position.z },
      jumpProgress: this.jumpProgress };
  }
}
