import type * as THREE from 'three';
import type { TowerId } from '../../config/towers';
import { Part } from '../materials';
import { ModelBuilder, box, cone, cyl, octa, rockGeo, sphere, torus } from './geom';

// ป้อม 6 ระดับ: ฐานนิ่ง + หัวหมุนตามเป้า (หัวหันหน้า +X จุดหมุนอยู่ที่ origin ของหัว)

export interface TowerModel {
  base: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  /** ความสูงจุดหมุนหัว */
  headY: number;
  /** ปากกระบอก (ระยะไปข้างหน้า, ความสูงจากจุดหมุน) */
  muzzle: [number, number];
  /** ระยะถอยตอนยิง */
  recoil: number;
}

const WOOD = '#9a6634';
const WOOD_D = '#6e4420';
const STONE = '#b4ac9c';
const STONE_D = '#8c8476';

/** แผ่นฐานกลมสีประจำป้อม */
function plate(b: ModelBuilder, glow: string): void {
  b.add(cyl(0.44, 0.47, 0.07, 8), '#6c5c40', { pos: [0, 0.035, 0] });
  b.add(cyl(0.4, 0.42, 0.03, 8), glow, { pos: [0, 0.085, 0], glow: 0.15 });
}

/** ป้อมปราการหยัก (crenellation) รอบวงกลม */
function crenels(b: ModelBuilder, r: number, y: number, n: number, color: string, size = 0.1): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.add(box(size, size * 1.1, size), color, { pos: [Math.cos(a) * r, y, Math.sin(a) * r], rot: [0, -a, 0] });
  }
}

function stone(): TowerModel {
  const b = new ModelBuilder();
  plate(b, '#b0a090');
  b.add(cyl(0.34, 0.4, 0.3, 7), STONE_D, { pos: [0, 0.24, 0] });
  b.add(cyl(0.36, 0.34, 0.06, 7), STONE, { pos: [0, 0.42, 0] });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    b.add(rockGeo(0.09, 0.1 + i * 0.17), '#9c9488', { pos: [Math.cos(a) * 0.4, 0.14, Math.sin(a) * 0.4] });
  }
  const h = new ModelBuilder();
  // เครื่องดีดหิน
  h.add(box(0.42, 0.06, 0.3), WOOD_D, { pos: [0, 0.03, 0] });
  for (const s of [1, -1]) h.add(box(0.06, 0.26, 0.05), WOOD, { pos: [0, 0.16, 0.12 * s] });
  h.add(box(0.06, 0.05, 0.3), WOOD_D, { pos: [0, 0.28, 0] });
  h.limb([-0.26, 0.12, 0], [0.22, 0.38, 0], 0.03, 0.025, WOOD, {}, 4);
  h.add(cyl(0.08, 0.06, 0.06, 6), WOOD_D, { pos: [0.24, 0.4, 0] });
  h.add(rockGeo(0.07, 0.42), '#8a8278', { pos: [0.24, 0.46, 0] });
  h.add(box(0.12, 0.12, 0.14), '#5a5450', { pos: [-0.26, 0.08, 0] });
  return { base: b.build(), head: h.build(), headY: 0.45, muzzle: [0.24, 0.46], recoil: 0.04 };
}

function arrow(): TowerModel {
  const b = new ModelBuilder();
  plate(b, '#70c050');
  // หอไม้ 4 เสา + ค้ำยัน + ชานชาลา
  const c = 0.27;
  for (const [x, z] of [
    [c, c],
    [c, -c],
    [-c, c],
    [-c, -c],
  ] as const) {
    b.limb([x * 1.15, 0.08, z * 1.15], [x * 0.85, 0.74, z * 0.85], 0.045, 0.04, WOOD, {}, 5);
  }
  for (const s of [1, -1]) {
    b.limb([-c, 0.2, c * s], [c, 0.55, c * s], 0.02, 0.02, WOOD_D, {}, 4);
    b.limb([c * s, 0.2, -c], [c * s, 0.55, c], 0.02, 0.02, WOOD_D, {}, 4);
  }
  b.add(box(0.66, 0.08, 0.66), WOOD_D, { pos: [0, 0.76, 0] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    b.add(box(0.06, 0.12, 0.6), WOOD, { pos: [Math.cos(a) * 0.3, 0.86, Math.sin(a) * 0.3], rot: [0, -a, 0] });
  }
  // ธงเขียว
  b.limb([-0.3, 0.8, -0.3], [-0.3, 1.25, -0.3], 0.015, 0.012, WOOD_D, {}, 4);
  b.add(box(0.02, 0.14, 0.2), '#58b03a', { pos: [-0.3, 1.16, -0.2], part: Part.Sway, pivot: [0, 1.0, 0] });
  const h = new ModelBuilder();
  // ธนูใหญ่ + ลูกศร
  h.add(torus(0.22, 0.022, 4, 10, Math.PI), WOOD_D, { pos: [0.05, 0.14, 0], rot: [Math.PI / 2, 0, -Math.PI / 2] });
  h.limb([0.05, 0.14, -0.22], [-0.12, 0.14, 0], 0.006, 0.006, '#f4eedc', {}, 3);
  h.limb([0.05, 0.14, 0.22], [-0.12, 0.14, 0], 0.006, 0.006, '#f4eedc', {}, 3);
  h.limb([-0.14, 0.14, 0], [0.3, 0.14, 0], 0.012, 0.012, '#d8c8a0', {}, 4);
  h.add(cone(0.03, 0.08, 4), '#7ad050', { pos: [0.33, 0.14, 0], rot: [0, 0, -Math.PI / 2], glow: 0.5 });
  h.add(box(0.12, 0.08, 0.12), WOOD, { pos: [-0.04, 0.04, 0] });
  return { base: b.build(), head: h.build(), headY: 0.8, muzzle: [0.33, 0.14], recoil: 0.05 };
}

function crossbow(): TowerModel {
  const b = new ModelBuilder();
  plate(b, '#d08030');
  b.add(cyl(0.3, 0.36, 0.72, 8), STONE, { pos: [0, 0.44, 0] });
  b.add(cyl(0.305, 0.305, 0.06, 8), '#d08030', { pos: [0, 0.5, 0], glow: 0.12 });
  b.add(cyl(0.36, 0.33, 0.08, 8), STONE_D, { pos: [0, 0.82, 0] });
  crenels(b, 0.31, 0.92, 8, STONE, 0.1);
  // ช่องหน้าต่าง
  for (const a of [0.6, 2.4, 4.2]) b.add(box(0.05, 0.12, 0.06), '#3a3028', { pos: [Math.cos(a) * 0.31, 0.62, Math.sin(a) * 0.31], rot: [0, -a, 0] });
  const h = new ModelBuilder();
  // หน้าไม้
  h.add(box(0.48, 0.06, 0.08), WOOD_D, { pos: [0.02, 0.1, 0] });
  h.add(box(0.1, 0.1, 0.1), WOOD, { pos: [-0.04, 0.03, 0] });
  for (const s of [1, -1]) h.limb([0.18, 0.1, 0], [0.12, 0.12, 0.26 * s], 0.022, 0.014, '#5a3a20', {}, 4);
  for (const s of [1, -1]) h.limb([0.12, 0.12, 0.26 * s], [-0.08, 0.12, 0], 0.005, 0.005, '#f4eedc', {}, 3);
  h.limb([-0.08, 0.13, 0], [0.32, 0.13, 0], 0.014, 0.014, '#e09040', { glow: 0.35 }, 4);
  return { base: b.build(), head: h.build(), headY: 0.92, muzzle: [0.32, 0.13], recoil: 0.06 };
}

function cannon(): TowerModel {
  const b = new ModelBuilder();
  plate(b, '#7070c0');
  b.add(box(0.76, 0.34, 0.76), '#9c9cae', { pos: [0, 0.25, 0] });
  b.add(box(0.8, 0.06, 0.8), '#7070c0', { pos: [0, 0.4, 0], glow: 0.12 });
  for (let i = 0; i < 4; i++) {
    for (const t of [-0.28, 0, 0.28]) {
      const a = (i / 4) * Math.PI * 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      b.add(box(0.13, 0.13, 0.13), '#a8a8ba', { pos: [nx * 0.34 - nz * t, 0.5, nz * 0.34 + nx * t] });
    }
  }
  const h = new ModelBuilder();
  h.add(box(0.3, 0.12, 0.26), WOOD_D, { pos: [-0.02, 0.06, 0] });
  for (const s of [1, -1]) h.add(cyl(0.09, 0.09, 0.04, 8), '#4a3020', { pos: [-0.02, 0.07, 0.15 * s], rot: [Math.PI / 2, 0, 0] });
  h.limb([-0.2, 0.18, 0], [0.38, 0.2, 0], 0.11, 0.085, '#34343f', {}, 8);
  h.add(torus(0.09, 0.025, 4, 8), '#5a5a6c', { pos: [0.37, 0.2, 0], rot: [0, Math.PI / 2, 0] });
  h.add(sphere(0.1, 8, 6), '#34343f', { pos: [-0.22, 0.18, 0] });
  return { base: b.build(), head: h.build(), headY: 0.48, muzzle: [0.42, 0.2], recoil: 0.1 };
}

function machinegun(): TowerModel {
  const b = new ModelBuilder();
  plate(b, '#d0a030');
  b.add(cyl(0.34, 0.38, 0.32, 6), '#7a848c', { pos: [0, 0.24, 0] });
  b.add(cyl(0.35, 0.35, 0.05, 6), '#d0a030', { pos: [0, 0.36, 0], glow: 0.15 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(sphere(0.1, 6, 4), '#c8b47a', { pos: [Math.cos(a) * 0.4, 0.12, Math.sin(a) * 0.4], scale: [1.2, 0.6, 0.9], rot: [0, -a, 0] });
  }
  const h = new ModelBuilder();
  h.add(box(0.26, 0.16, 0.22), '#525a62', { pos: [-0.04, 0.1, 0] });
  h.add(box(0.12, 0.12, 0.1), '#d0a030', { pos: [-0.06, 0.1, 0.17] });
  // ลำกล้องหมุน 4 ลำ
  const pivot: [number, number, number] = [0, 0.14, 0];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const y = 0.14 + Math.cos(a) * 0.045;
    const z = Math.sin(a) * 0.045;
    h.limb([0.06, y, z], [0.44, y, z], 0.022, 0.02, '#2e3238', { part: Part.Spin, pivot }, 5);
  }
  h.add(cyl(0.075, 0.075, 0.05, 8), '#3a3e44', { pos: [0.3, 0.14, 0], rot: [0, 0, Math.PI / 2], part: Part.Spin, pivot });
  return { base: b.build(), head: h.build(), headY: 0.42, muzzle: [0.46, 0.14], recoil: 0.025 };
}

function laser(): TowerModel {
  const b = new ModelBuilder();
  plate(b, '#4090ff');
  b.add(cyl(0.28, 0.38, 0.4, 6), '#3a4266', { pos: [0, 0.27, 0] });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    b.add(box(0.03, 0.18, 0.08), '#5aa8ff', { pos: [Math.cos(a) * 0.33, 0.27, Math.sin(a) * 0.33], rot: [0, -a, 0], glow: 0.9 });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.limb([Math.cos(a) * 0.24, 0.45, Math.sin(a) * 0.24], [Math.cos(a) * 0.2, 0.95, Math.sin(a) * 0.2], 0.04, 0.02, '#2c3250', {}, 4);
    b.add(octa(0.035), '#8cc8ff', { pos: [Math.cos(a) * 0.2, 0.97, Math.sin(a) * 0.2], glow: 1 });
  }
  const h = new ModelBuilder();
  h.add(octa(0.2), '#4a9cff', { pos: [0, 0.22, 0], scale: [0.75, 1.45, 0.75], glow: 0.85 });
  h.add(octa(0.1), '#d8ecff', { pos: [0, 0.22, 0], scale: [0.75, 1.45, 0.75], glow: 1 });
  h.add(cone(0.05, 0.16, 6), '#9ccfff', { pos: [0.2, 0.22, 0], rot: [0, 0, -Math.PI / 2], glow: 1 });
  return { base: b.build(), head: h.build(), headY: 0.6, muzzle: [0.28, 0.22], recoil: 0.0 };
}

const BUILDERS: Record<TowerId, () => TowerModel> = { stone, arrow, crossbow, cannon, machinegun, laser };

const cache = new Map<TowerId, TowerModel>();
export function towerModel(id: TowerId): TowerModel {
  let m = cache.get(id);
  if (!m) {
    m = BUILDERS[id]();
    cache.set(id, m);
  }
  return m;
}
