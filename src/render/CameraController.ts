import * as THREE from 'three';
import { HALF_H, HALF_W } from './coords';

const DEG = Math.PI / 180;
export const PITCH_MIN = 30 * DEG;
export const PITCH_MAX = 85 * DEG;
const TOP_DOWN = 89.9 * DEG;
const DIST_MIN = 9;
const DIST_MAX = 75;
/** ขอบเขตจุดเป้ากล้อง = สนาม + 4 ช่อง */
const BOUND_X = HALF_W + 4;
const BOUND_Z = HALF_H + 4;

export interface CamState {
  target: THREE.Vector3;
  yaw: number;
  pitch: number;
  dist: number;
}

/**
 * กล้องหมุนรอบจุดเป้าบนพื้น: ซูม (ล้อเมาส์), เลื่อน (WASD/ลากปุ่มกลาง), หมุน (Q/E/ลากปุ่มขวา)
 * ค่าที่ตั้ง (goal) จะค่อยๆ ไหลเข้าหาแบบนุ่มนวล
 */
export class CameraController {
  readonly goal: CamState = { target: new THREE.Vector3(), yaw: 0, pitch: 55 * DEG, dist: 50 };
  readonly cur: CamState = { target: new THREE.Vector3(), yaw: 0, pitch: 55 * DEG, dist: 50 };
  /** โหมดมองลงตรง (หน้าสร้างแมพ) ห้ามหมุน */
  topDown = false;
  /** หมุนช้าๆ อัตโนมัติ (พื้นหลังเมนู) */
  orbit = false;

  constructor(private camera: THREE.PerspectiveCamera) {}

  /** หาระยะกล้องที่เห็นสนามครบทั้ง 4 มุม (ตามสัดส่วนจอ/แผงด้านซ้ายปัจจุบัน) */
  fit(snap = false): void {
    const g = this.goal;
    g.target.set(0, 0, 0);
    g.yaw = 0;
    g.pitch = this.topDown ? TOP_DOWN : 55 * DEG;
    const corners = [
      new THREE.Vector3(-HALF_W, 0, -HALF_H),
      new THREE.Vector3(HALF_W, 0, -HALF_H),
      new THREE.Vector3(-HALF_W, 0, HALF_H),
      new THREE.Vector3(HALF_W, 0, HALF_H),
      new THREE.Vector3(-HALF_W, 1.2, -HALF_H),
      new THREE.Vector3(HALF_W, 1.2, -HALF_H),
    ];
    const margin = 0.93;
    let lo = DIST_MIN;
    let hi = 160;
    const tmp = new THREE.Vector3();
    for (let it = 0; it < 22; it++) {
      const mid = (lo + hi) / 2;
      this.place(this.camera, { ...g, dist: mid });
      this.camera.updateMatrixWorld();
      const ok = corners.every((c) => {
        tmp.copy(c).project(this.camera);
        return Math.abs(tmp.x) <= margin && Math.abs(tmp.y) <= margin && tmp.z < 1;
      });
      if (ok) hi = mid;
      else lo = mid;
    }
    g.dist = Math.min(DIST_MAX + 40, hi);
    if (snap) this.snap();
  }

  snap(): void {
    this.cur.target.copy(this.goal.target);
    this.cur.yaw = this.goal.yaw;
    this.cur.pitch = this.goal.pitch;
    this.cur.dist = this.goal.dist;
    this.place(this.camera, this.cur);
  }

  setTopDown(on: boolean): void {
    this.topDown = on;
    this.fit();
  }

  /** ซูมเข้าหาจุดบนพื้น (จุดใต้เมาส์) */
  zoom(factor: number, toward: THREE.Vector3 | null): void {
    const g = this.goal;
    const nd = THREE.MathUtils.clamp(g.dist * factor, DIST_MIN, Math.max(DIST_MAX, g.dist));
    if (toward) {
      const k = 1 - nd / g.dist;
      g.target.x += (toward.x - g.target.x) * k;
      g.target.z += (toward.z - g.target.z) * k;
    }
    g.dist = nd;
    this.clamp();
  }

  /** เลื่อนตามทิศที่กล้องหัน (หน่วย: สัดส่วนของระยะกล้อง) */
  panLocal(right: number, forward: number): void {
    const g = this.goal;
    const s = g.dist;
    const yaw = g.yaw;
    g.target.x += (Math.cos(yaw) * right - Math.sin(yaw) * forward) * s;
    g.target.z += (-Math.sin(yaw) * right - Math.cos(yaw) * forward) * s;
    this.clamp();
  }

  /** เลื่อนแบบจับพื้น: ให้จุด from บนพื้นไปอยู่ที่ to */
  panWorld(dx: number, dz: number): void {
    this.goal.target.x += dx;
    this.goal.target.z += dz;
    this.cur.target.x += dx;
    this.cur.target.z += dz;
    this.clamp();
  }

  rotate(dYaw: number, dPitch: number): void {
    if (this.topDown) return;
    this.goal.yaw += dYaw;
    this.goal.pitch = THREE.MathUtils.clamp(this.goal.pitch + dPitch, PITCH_MIN, PITCH_MAX);
  }

  private clamp(): void {
    const t = this.goal.target;
    t.x = THREE.MathUtils.clamp(t.x, -BOUND_X, BOUND_X);
    t.z = THREE.MathUtils.clamp(t.z, -BOUND_Z, BOUND_Z);
  }

  update(dt: number): void {
    if (this.orbit) this.goal.yaw += dt * 0.05;
    const k = 1 - Math.exp(-dt * 11);
    const c = this.cur;
    const g = this.goal;
    c.target.lerp(g.target, k);
    c.yaw += (g.yaw - c.yaw) * k;
    c.pitch += (g.pitch - c.pitch) * k;
    c.dist += (g.dist - c.dist) * k;
    this.place(this.camera, c);
  }

  private place(cam: THREE.PerspectiveCamera, s: CamState): void {
    const cp = Math.cos(s.pitch);
    cam.position.set(s.target.x + Math.sin(s.yaw) * cp * s.dist, s.target.y + Math.sin(s.pitch) * s.dist, s.target.z + Math.cos(s.yaw) * cp * s.dist);
    // มองลงตรงเกือบ 90° ให้ทิศ "บน" ของจอเป็นด้านบนของแมพ
    cam.up.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw)).multiplyScalar(Math.max(0, s.pitch - 80 * DEG)).add(new THREE.Vector3(0, 1, 0)).normalize();
    cam.lookAt(s.target);
  }
}
