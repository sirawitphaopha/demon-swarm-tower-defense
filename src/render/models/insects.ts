import type * as THREE from 'three';
import type { EnemyId } from '../../config/enemies';
import { Part } from '../materials';
import { ModelBuilder, cone, sphere } from './geom';

// แมลงปีศาจ 6 แบบ — ปั้นจากรูปทรงพื้นฐาน หันหน้าไป +X ความยาวลำตัว ~1 หน่วย (ไปขยายตาม sz ภายหลัง)
// ขาแบ่งเป็นสองชุด (A/B) แกว่งสลับกันใน vertex shader, ปีกแยกเป็น mesh โปร่งแสง

export interface InsectModel {
  body: THREE.BufferGeometry;
  /** ปีก (เฉพาะแตน) */
  wings?: THREE.BufferGeometry;
  /** ความสูงลอยจากพื้น (เฉพาะตัวบิน) */
  hover: number;
  /** ความสูงกึ่งกลางลำตัว (ไว้เล็งกระสุน/วางแถบเลือด) — หน่วยก่อนขยาย */
  centerY: number;
  topY: number;
}

const EYE = '#ff2a1a';

type V3 = [number, number, number];

/** ขาแมลง 2 ท่อน: สะโพก → เข่า (ยกขึ้น) → ปลายเท้าแตะพื้น */
function leg(b: ModelBuilder, hip: V3, side: number, reach: number, kneeH: number, fwd: number, color: string, part: number, r = 0.022): void {
  const knee: V3 = [hip[0] + fwd * 0.5, hip[1] + kneeH, hip[2] + side * reach * 0.55];
  const foot: V3 = [hip[0] + fwd, 0.0, hip[2] + side * reach];
  b.limb(hip, knee, r * 1.2, r, color, { part, pivot: hip });
  b.limb(knee, foot, r, r * 0.55, color, { part, pivot: hip });
}

/** ขา 3 คู่แบบ tripod: A = ซ้ายหน้า/ขวากลาง/ซ้ายหลัง, B = ที่เหลือ */
function sixLegs(b: ModelBuilder, xs: [number, number, number], y: number, z: number, reach: number, kneeH: number, color: string, r = 0.022): void {
  const fwd = [0.18, 0.0, -0.18];
  xs.forEach((x, i) => {
    for (const side of [1, -1]) {
      const groupA = (i % 2 === 0) === (side === 1);
      leg(b, [x, y, z * side], side, reach, kneeH, fwd[i]!, color, groupA ? Part.LegA : Part.LegB, r);
    }
  });
}

function eyes(b: ModelBuilder, x: number, y: number, z: number, r: number, color = EYE): void {
  for (const s of [1, -1]) b.add(sphere(r, 6, 4), color, { pos: [x, y, z * s], glow: 1 });
}

function horn(b: ModelBuilder, base: V3, len: number, r: number, tiltZ: number, tiltX: number, color: string, glow = 0): void {
  b.add(cone(r, len, 5), color, { pos: [base[0], base[1] + len / 2, base[2]], rot: [tiltX, 0, tiltZ], glow });
}

function maggot(): InsectModel {
  const b = new ModelBuilder();
  const cols = ['#8a4220', '#a35a2c'];
  const segs: [number, number][] = [
    [0.3, 0.19],
    [0.1, 0.2],
    [-0.1, 0.19],
    [-0.28, 0.16],
    [-0.43, 0.12],
  ];
  segs.forEach(([x, r], i) => {
    b.add(sphere(r, 8, 6), cols[i % 2]!, { pos: [x, r * 0.9, 0], scale: [1, 0.85, 1], part: Part.Worm, pivot: [i + 1, 0, 0] });
    // จุดหนามบนหลัง
    b.add(cone(0.035, 0.08, 4), '#4a1a0a', { pos: [x, r * 1.7, 0], part: Part.Worm, pivot: [i + 1, 0, 0] });
  });
  // หัว + เขี้ยว + ตา
  b.add(sphere(0.17, 8, 6), '#5a2210', { pos: [0.48, 0.18, 0], part: Part.Worm, pivot: [0, 0, 0] });
  for (const s of [1, -1]) {
    b.add(cone(0.035, 0.14, 4), '#e8d8b0', { pos: [0.64, 0.12, 0.06 * s], rot: [0, 0, -1.9], part: Part.Worm, pivot: [0, 0, 0] });
    b.add(sphere(0.045, 6, 4), EYE, { pos: [0.58, 0.26, 0.08 * s], glow: 1, part: Part.Worm, pivot: [0, 0, 0] });
  }
  return { body: b.build(), hover: 0, centerY: 0.2, topY: 0.42 };
}

function beetle(): InsectModel {
  const b = new ModelBuilder();
  // กระดองโค้ง + เส้นแบ่งปีกแข็ง
  b.add(sphere(0.42, 10, 7), '#2f6a1c', { pos: [-0.08, 0.27, 0], scale: [1.15, 0.62, 0.86] });
  b.add(sphere(0.3, 8, 5), '#4a9a2c', { pos: [-0.02, 0.4, 0], scale: [1.1, 0.4, 0.7] });
  b.limb([0.25, 0.53, 0], [-0.52, 0.42, 0], 0.018, 0.018, '#123010', {}, 4);
  // อก + หัว
  b.add(sphere(0.2, 8, 6), '#1c3a12', { pos: [0.34, 0.27, 0], scale: [0.9, 0.75, 1.05] });
  b.add(sphere(0.15, 8, 6), '#121c0c', { pos: [0.53, 0.25, 0] });
  // เขาปีศาจ (แรด) + เขาข้าง
  horn(b, [0.62, 0.3, 0], 0.3, 0.05, -0.75, 0, '#6a1414', 0.15);
  for (const s of [1, -1]) horn(b, [0.5, 0.36, 0.08 * s], 0.14, 0.03, -0.3, 0.6 * s, '#6a1414');
  eyes(b, 0.64, 0.29, 0.085, 0.04);
  sixLegs(b, [0.3, 0.1, -0.12], 0.22, 0.14, 0.42, 0.14, '#16200e');
  return { body: b.build(), hover: 0, centerY: 0.3, topY: 0.62 };
}

function scarab(): InsectModel {
  const b = new ModelBuilder();
  // เกราะหลายชั้น
  const plates: [number, number, string][] = [
    [-0.32, 0.3, '#6e5e14'],
    [-0.1, 0.34, '#857218'],
    [0.14, 0.3, '#6e5e14'],
  ];
  for (const [x, r, c] of plates) {
    b.add(sphere(r, 10, 6), c, { pos: [x, 0.3, 0], scale: [0.85, 0.7, 1.05] });
    b.add(sphere(r * 1.02, 10, 3), '#b49a36', { pos: [x, 0.33, 0], scale: [0.86, 0.35, 1.06] });
  }
  // หนามบนหลัง
  for (const [x, h] of [
    [-0.32, 0.18],
    [-0.1, 0.22],
    [0.14, 0.17],
  ] as const) {
    b.add(cone(0.05, h, 5), '#3a2a06', { pos: [x, 0.56 + h / 2, 0] });
    for (const s of [1, -1]) b.add(cone(0.035, h * 0.7, 4), '#3a2a06', { pos: [x, 0.48, 0.2 * s], rot: [0.9 * s, 0, 0] });
  }
  // หัว + หนวด + ตา
  b.add(sphere(0.16, 8, 6), '#2a2208', { pos: [0.42, 0.26, 0] });
  for (const s of [1, -1]) b.limb([0.52, 0.34, 0.06 * s], [0.85, 0.62, 0.22 * s], 0.014, 0.008, '#2a2208', {}, 3);
  eyes(b, 0.53, 0.3, 0.09, 0.042);
  sixLegs(b, [0.28, 0.0, -0.28], 0.22, 0.2, 0.5, 0.16, '#2a2208', 0.032);
  return { body: b.build(), hover: 0, centerY: 0.32, topY: 0.8 };
}

function wasp(): InsectModel {
  const b = new ModelBuilder();
  // อก + หัว
  b.add(sphere(0.16, 8, 6), '#2a1030', { pos: [0.08, 0, 0] });
  b.add(sphere(0.13, 8, 6), '#1e0a22', { pos: [0.32, 0.02, 0] });
  for (const s of [1, -1]) b.add(sphere(0.065, 6, 4), EYE, { pos: [0.4, 0.05, 0.07 * s], scale: [0.8, 1, 1], glow: 1 });
  for (const s of [1, -1]) b.limb([0.4, 0.1, 0.04 * s], [0.62, 0.3, 0.12 * s], 0.012, 0.007, '#1e0a22', {}, 3);
  // ท้องลายม่วง-ดำ + เหล็กใน
  b.add(sphere(0.22, 10, 7), '#8a2a92', { pos: [-0.28, -0.04, 0], scale: [1.45, 0.92, 0.92] });
  for (const x of [-0.16, -0.32, -0.48]) {
    const rr = 0.2 * Math.sqrt(Math.max(0.05, 1 - ((x + 0.28) / 0.33) ** 2));
    b.add(sphere(rr * 1.04, 10, 3), '#1a0a1a', { pos: [x, -0.04, 0], scale: [0.22, 0.95, 0.95] });
  }
  b.add(cone(0.05, 0.18, 5), '#ff4030', { pos: [-0.66, -0.07, 0], rot: [0, 0, Math.PI / 2], glow: 0.7 });
  // ขาห้อย
  for (const x of [0.15, 0.05, -0.05])
    for (const s of [1, -1]) b.limb([x, -0.08, 0.06 * s], [x - 0.08, -0.32, 0.14 * s], 0.014, 0.008, '#1e0a22', {}, 3);
  const body = b.build();

  const w = new ModelBuilder();
  for (const s of [1, -1]) {
    const hinge: V3 = [0.08, 0.12, 0.05 * s];
    w.add(sphere(0.2, 8, 3), '#efe4ff', { pos: [0.02, 0.15, 0.27 * s], scale: [1.35, 0.06, 0.62], rot: [0.12 * s, 0, 0], part: Part.Wing, pivot: hinge });
    w.add(sphere(0.14, 8, 3), '#e2d6ff', { pos: [-0.12, 0.13, 0.2 * s], scale: [1.2, 0.06, 0.6], rot: [0.08 * s, 0.4 * s, 0], part: Part.Wing, pivot: hinge });
  }
  return { body, wings: w.build(), hover: 1.15, centerY: 0, topY: 0.3 };
}

function spider(): InsectModel {
  const b = new ModelBuilder();
  // ท้องกลมใหญ่ + ลายหัวกะโหลกเรืองแสงจางๆ
  b.add(sphere(0.32, 10, 7), '#43207a', { pos: [-0.3, 0.42, 0], scale: [1.05, 0.9, 0.95] });
  b.add(sphere(0.12, 6, 4), '#c9a8ff', { pos: [-0.22, 0.66, 0], scale: [1, 0.35, 1.1], glow: 0.35 });
  for (const s of [1, -1]) b.add(sphere(0.035, 5, 3), '#2a0a4a', { pos: [-0.18, 0.7, 0.04 * s] });
  // ส่วนหัว-อก + ตาแดงหลายดวง + เขี้ยว
  b.add(sphere(0.19, 8, 6), '#2e1258', { pos: [0.12, 0.36, 0], scale: [1.1, 0.8, 1] });
  for (const [y, z, r] of [
    [0.44, 0.06, 0.035],
    [0.44, -0.06, 0.035],
    [0.4, 0.11, 0.025],
    [0.4, -0.11, 0.025],
  ] as const)
    b.add(sphere(r, 5, 3), EYE, { pos: [0.29, y, z], glow: 1 });
  for (const s of [1, -1]) b.add(cone(0.03, 0.12, 4), '#d8c8f0', { pos: [0.32, 0.26, 0.05 * s], rot: [0, 0, -2.6] });
  // ขา 8 ขา เข่าสูง
  const xs = [0.2, 0.12, 0.04, -0.04];
  const fwd = [0.42, 0.14, -0.14, -0.38];
  xs.forEach((x, i) => {
    for (const side of [1, -1]) {
      const groupA = (i % 2 === 0) === (side === 1);
      const hip: V3 = [x, 0.38, 0.1 * side];
      const knee: V3 = [x + fwd[i]! * 0.45, 0.72, side * 0.42];
      const foot: V3 = [x + fwd[i]!, 0, side * 0.72];
      const part = groupA ? Part.LegA : Part.LegB;
      b.limb(hip, knee, 0.026, 0.02, '#24103f', { part, pivot: hip });
      b.limb(knee, foot, 0.02, 0.01, '#24103f', { part, pivot: hip });
    }
  });
  return { body: b.build(), hover: 0, centerY: 0.4, topY: 0.8 };
}

function boss(): InsectModel {
  const b = new ModelBuilder();
  // ลำตัวแดงเข้ม + เกราะดำ
  b.add(sphere(0.44, 12, 8), '#9a1414', { pos: [-0.1, 0.34, 0], scale: [1.15, 0.7, 0.92] });
  b.add(sphere(0.34, 10, 5), '#2a0808', { pos: [-0.12, 0.46, 0], scale: [1.15, 0.45, 0.8] });
  for (const x of [-0.42, -0.22, -0.02]) b.add(cone(0.06, 0.2, 5), '#f0c040', { pos: [x, 0.7, 0], glow: 0.25 });
  for (const s of [1, -1]) for (const x of [-0.35, -0.1]) b.add(cone(0.045, 0.16, 4), '#2a0808', { pos: [x, 0.5, 0.32 * s], rot: [1.1 * s, 0, 0] });
  // อก + หัว
  b.add(sphere(0.24, 10, 7), '#6a0c0c', { pos: [0.36, 0.34, 0], scale: [0.9, 0.85, 1.05] });
  b.add(sphere(0.18, 8, 6), '#3a0606', { pos: [0.58, 0.34, 0] });
  // มงกุฎทอง
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.add(cone(0.04, 0.16, 4), '#ffcc33', { pos: [0.56 + Math.cos(a) * 0.1, 0.56, Math.sin(a) * 0.1], glow: 0.55 });
  }
  b.add(sphere(0.12, 8, 3), '#d9a420', { pos: [0.56, 0.49, 0], scale: [1, 0.35, 1], glow: 0.3 });
  // เขาโค้งใหญ่
  for (const s of [1, -1]) {
    b.limb([0.66, 0.42, 0.1 * s], [0.84, 0.62, 0.26 * s], 0.05, 0.035, '#1a0404', {}, 5);
    b.limb([0.84, 0.62, 0.26 * s], [0.96, 0.86, 0.22 * s], 0.035, 0.008, '#1a0404', {}, 5);
  }
  eyes(b, 0.7, 0.38, 0.1, 0.05, '#ffd21a');
  sixLegs(b, [0.38, 0.1, -0.22], 0.28, 0.2, 0.55, 0.18, '#1a0404', 0.04);
  return { body: b.build(), hover: 0, centerY: 0.36, topY: 0.92 };
}

const BUILDERS: Record<EnemyId, () => InsectModel> = { maggot, beetle, scarab, wasp, spider, boss };

const cache = new Map<EnemyId, InsectModel>();
export function insectModel(id: EnemyId): InsectModel {
  let m = cache.get(id);
  if (!m) {
    m = BUILDERS[id]();
    cache.set(id, m);
  }
  return m;
}
