import * as THREE from 'three';
import type { Stage } from './stage';

export interface MoveAxes {
  forward: { x: number; z: number };
  right: { x: number; z: number };
}

const up = new THREE.Vector3(0, 1, 0);
const origin = new THREE.Vector3();
const hitPoint = new THREE.Vector3();
const direction = new THREE.Vector3();
const ideal = new THREE.Vector3();
const defaultForward = new THREE.Vector3(0, 0, -1);

export class ThirdPersonCamera {
  readonly stage;
  readonly raycaster = new THREE.Raycaster();
  private colliders: THREE.Box3[] = [];
  private orbiting = false;
  private yaw = 0;
  private pitch = -0.35;
  private distance = 24;
  private targetDistance = 24;
  private minDistance = 10;
  private maxDistance = 40;
  private height = 5.6;
  private sensitivity = 0.0022;
  private followSpeed = 7;
  private eye = new THREE.Vector3();
  private target = new THREE.Vector3();
  private forward = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private cinematic: { x: number; z: number; until: number } | null = null;
  private shake = 0;

  constructor(stage: Stage) {
    this.stage = stage;
    this.eye.copy(stage.camera.position);
  }

  setColliders(boxes: THREE.Box3[]) {
    this.colliders = boxes;
  }

  setOrbiting(value: boolean) {
    this.orbiting = value;
  }

  setCinematic(x: number, z: number, until: number) {
    this.cinematic = { x, z, until };
  }

  clearCinematic() {
    this.cinematic = null;
  }

  handlePointerMove(dx: number, dy: number) {
    if (!this.orbiting) return;
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.3, 0.55);
  }

  handleWheel(delta: number) {
    this.targetDistance += delta * 0.0035;
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance, this.minDistance, this.maxDistance);
  }

  getMoveAxes(): MoveAxes {
    return { forward: { x: this.forward.x, z: this.forward.z }, right: { x: this.right.x, z: this.right.z } };
  }

  update(dt: number, time: number, aim: THREE.Vector3) {
    let target = aim.clone();
    if (this.cinematic && time < this.cinematic.until) {
      target.set(this.cinematic.x, 0, this.cinematic.z);
    } else if (this.cinematic) {
      this.cinematic = null;
    }
    this.target.lerpVectors(this.target, target, 1 - Math.exp(-dt * this.followSpeed));

    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance, this.minDistance, this.maxDistance);

    origin.set(this.target.x, this.target.y + 1.2, this.target.z);
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    ideal.set(
      this.target.x + Math.sin(this.yaw) * cosPitch * this.targetDistance,
      this.target.y + this.height + sinPitch * this.targetDistance,
      this.target.z + Math.cos(this.yaw) * cosPitch * this.targetDistance
    );

    direction.subVectors(ideal, origin);
    const maxDist = direction.length();
    direction.normalize();
    this.raycaster.set(origin, direction);

    let hit = maxDist;
    for (const box of this.colliders) {
      const h = this.raycaster.ray.intersectBox(box, hitPoint);
      if (h) {
        const d = origin.distanceTo(hitPoint);
        if (d < hit) hit = d;
      }
    }

    if (hit < maxDist - 0.25) {
      this.targetDistance = Math.max(this.minDistance, hit - 0.25);
    } else {
      this.targetDistance = this.maxDistance;
    }

    this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-dt * this.followSpeed * 1.6));
    this.distance = THREE.MathUtils.clamp(this.distance, this.minDistance, this.maxDistance);

    ideal.set(
      this.target.x + Math.sin(this.yaw) * cosPitch * this.distance,
      this.target.y + this.height + sinPitch * this.distance,
      this.target.z + Math.cos(this.yaw) * cosPitch * this.distance
    );

    this.eye.lerpVectors(this.eye, ideal, 1 - Math.exp(-dt * this.followSpeed));

    if (this.shake > 0.001) {
      this.eye.x += (Math.random() - 0.5) * this.shake;
      this.eye.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.eye.z += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 8);
    } else {
      this.shake = 0;
    }

    this.stage.camera.position.copy(this.eye);
    this.stage.camera.lookAt(this.target.x, this.target.y + 1.0, this.target.z);

    this.forward.set(this.target.x - this.eye.x, 0, this.target.z - this.eye.z);
    const len = this.forward.length();
    if (len > 0.001) this.forward.normalize();
    else this.forward.copy(defaultForward);
    this.right.set(-this.forward.z, 0, this.forward.x);
  }

  shakeCamera(intensity: number) {
    this.shake = Math.max(this.shake, intensity);
  }

  dispose() {
    this.colliders = [];
    this.cinematic = null;
  }
}
