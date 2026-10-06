import * as THREE from 'three';
import { Grid } from '../core/grid';
import { gx, gy } from './coords';

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();

/** จุดบนพื้น (y=0) ใต้ตำแหน่งเมาส์ */
export function groundPoint(camera: THREE.Camera, canvas: HTMLElement, clientX: number, clientY: number): THREE.Vector3 | null {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
}

export interface CellHit {
  c: number;
  r: number;
  /** พิกัดเกม (หน่วยช่อง) */
  x: number;
  y: number;
}

/** ช่องบนสนามใต้เมาส์ (null = นอกสนาม) */
export function cellAt(camera: THREE.Camera, canvas: HTMLElement, clientX: number, clientY: number): CellHit | null {
  const p = groundPoint(camera, canvas, clientX, clientY);
  if (!p) return null;
  const x = gx(p.x);
  const y = gy(p.z);
  const c = Math.floor(x);
  const r = Math.floor(y);
  return Grid.inBounds(c, r) ? { c, r, x, y } : null;
}

/** ยิง ray หากล่อง (ป้อมที่หัวสูงอาจบังช่องด้านหลัง) คืน index ที่ใกล้สุด */
export function pickBoxes(camera: THREE.Camera, canvas: HTMLElement, clientX: number, clientY: number, boxes: readonly THREE.Box3[]): number {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  let best = -1;
  let bestD = Infinity;
  boxes.forEach((b, i) => {
    if (ray.ray.intersectBox(b, hit)) {
      const d = hit.distanceToSquared(ray.ray.origin);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  });
  return best;
}
