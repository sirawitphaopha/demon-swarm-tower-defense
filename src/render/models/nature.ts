import type * as THREE from 'three';
import type { ObstacleType } from '../../config/themes';
import { Part } from '../materials';
import { ModelBuilder, box, cone, cyl, ico, rockGeo, sphere } from './geom';

// ต้นไม้/หิน/ของตกแต่ง — แต่ละชนิดมี 2 แบบ (variant) ให้ดูไม่ซ้ำ

const sway = (y: number) => ({ part: Part.Sway, pivot: [0, y, 0] as [number, number, number] });

function tree(v: number): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.add(cyl(0.06, 0.09, 0.42, 6), '#7a4a22', { pos: [0, 0.21, 0] });
  const greens = ['#3d9a26', '#4cb030', '#2f8420'];
  const blobs: [number, number, number, number][] =
    v === 0
      ? [
          [0, 0.66, 0, 0.32],
          [0.17, 0.52, 0.08, 0.24],
          [-0.15, 0.55, -0.08, 0.25],
          [0.02, 0.86, 0.02, 0.22],
        ]
      : [
          [0, 0.6, 0, 0.3],
          [0.1, 0.8, -0.06, 0.24],
          [-0.12, 0.74, 0.1, 0.22],
        ];
  blobs.forEach(([x, y, z, r], i) => b.add(ico(r, 0), greens[i % 3]!, { pos: [x, y, z], rot: [i, i * 2, 0], ...sway(0.35) }));
  return b.build();
}

function pine(v: number): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.add(cyl(0.05, 0.08, 0.3, 6), '#6a4020', { pos: [0, 0.15, 0] });
  const tiers = v === 0 ? 3 : 4;
  for (let i = 0; i < tiers; i++) {
    const r = 0.38 - i * (0.28 / tiers);
    const y = 0.38 + i * (0.62 / tiers);
    b.add(cone(r, 0.38, 7), i % 2 ? '#2a8a24' : '#1f7a1c', { pos: [0, y, 0], rot: [0, i * 0.4, 0], ...sway(0.25) });
  }
  return b.build();
}

function blossom(v: number): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.add(cyl(0.05, 0.08, 0.4, 6), '#7a4a22', { pos: [0, 0.2, 0] });
  b.limb([0, 0.34, 0], [0.14, 0.5, 0.06], 0.035, 0.025, '#7a4a22', {}, 4);
  const pinks = ['#ff8ec2', '#ffb0d4', '#ff74b0'];
  const blobs: [number, number, number, number][] =
    v === 0
      ? [
          [0, 0.64, 0, 0.3],
          [0.18, 0.56, 0.06, 0.22],
          [-0.16, 0.58, -0.05, 0.22],
        ]
      : [
          [0.04, 0.62, 0, 0.28],
          [-0.12, 0.78, 0.04, 0.2],
          [0.14, 0.76, -0.08, 0.18],
          [-0.1, 0.52, -0.12, 0.18],
        ];
  blobs.forEach(([x, y, z, r], i) => b.add(ico(r, 0), pinks[i % 3]!, { pos: [x, y, z], rot: [i * 2, i, 0], ...sway(0.35) }));
  return b.build();
}

function palm(v: number): THREE.BufferGeometry {
  const b = new ModelBuilder();
  // ลำต้นโค้งเป็นปล้อง
  const lean = v === 0 ? 0.08 : -0.06;
  let prev: [number, number, number] = [0, 0, 0];
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    const cur: [number, number, number] = [lean * t * t * 3, t * 0.95, 0];
    b.limb(prev, cur, 0.075 - t * 0.02, 0.07 - t * 0.02, i % 2 ? '#a0703a' : '#8a5a2a', {}, 6);
    prev = cur;
  }
  const top = prev;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + v;
    const tip: [number, number, number] = [top[0] + Math.cos(a) * 0.48, top[1] - 0.18, Math.sin(a) * 0.48];
    const mid: [number, number, number] = [top[0] + Math.cos(a) * 0.26, top[1] + 0.06, Math.sin(a) * 0.26];
    b.add(box(0.28, 0.02, 0.12), '#36a83e', { pos: [(top[0] + mid[0]) / 2, (top[1] + mid[1]) / 2 + 0.02, (top[2] + mid[2]) / 2], rot: [0, -a, 0.35], ...sway(0.6) });
    b.add(box(0.26, 0.02, 0.1), '#2c9634', { pos: [(mid[0] + tip[0]) / 2, (mid[1] + tip[1]) / 2, (mid[2] + tip[2]) / 2], rot: [0, -a, -0.5], ...sway(0.6) });
  }
  for (let i = 0; i < 3; i++) b.add(sphere(0.05, 6, 4), '#6a4a20', { pos: [top[0] + Math.cos(i * 2.1) * 0.06, top[1] - 0.06, Math.sin(i * 2.1) * 0.06] });
  return b.build();
}

function rock(v: number): THREE.BufferGeometry {
  const b = new ModelBuilder();
  b.add(rockGeo(0.36, 0.31 + v * 0.27), '#8f8f98', { pos: [0, 0.2, 0] });
  b.add(rockGeo(0.18, 0.77 + v * 0.11), '#a6a6ae', { pos: [0.22, 0.1, 0.14 - v * 0.28] });
  b.add(rockGeo(0.1, 0.19 + v), '#7c7c86', { pos: [-0.24, 0.06, -0.12 + v * 0.2] });
  return b.build();
}

const OBST: Record<ObstacleType, (v: number) => THREE.BufferGeometry> = { tree, pine, blossom, palm, rock };

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

export function obstacleModel(type: ObstacleType, variant: number): THREE.BufferGeometry {
  return cached(`${type}${variant}`, () => OBST[type](variant));
}

// ── ของตกแต่ง ──────────────────────────────────────
export const FLOWER_COLORS = ['#ff5d8f', '#ffd23f', '#ffffff', '#b06cff', '#ff8a3d'] as const;

export function grassModel(): THREE.BufferGeometry {
  return cached('grass', () => {
    const b = new ModelBuilder();
    const blades: [number, number, number][] = [
      [0, 0.22, 0],
      [0.06, 0.17, 0.5],
      [-0.06, 0.18, -0.5],
      [0.03, 0.14, 1.2],
      [-0.04, 0.15, -1.1],
    ];
    blades.forEach(([x, h, tilt], i) =>
      b.add(cone(0.025, h, 3), i % 2 ? '#4aa82a' : '#3a9422', { pos: [x, h / 2, (i - 2) * 0.02], rot: [tilt * 0.35, i, tilt * 0.25], ...sway(0) }),
    );
    return b.build();
  });
}

export function flowerModel(colorIdx: number): THREE.BufferGeometry {
  return cached(`flower${colorIdx}`, () => {
    const b = new ModelBuilder();
    b.limb([0, 0, 0], [0.02, 0.24, 0], 0.012, 0.01, '#3c8a22', sway(0), 3);
    b.add(cone(0.035, 0.1, 3), '#46a02a', { pos: [0.04, 0.08, 0], rot: [0, 0, -0.9], ...sway(0) });
    const col = FLOWER_COLORS[colorIdx % FLOWER_COLORS.length]!;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      b.add(sphere(0.04, 5, 3), col, { pos: [0.02 + Math.cos(a) * 0.045, 0.25, Math.sin(a) * 0.045], scale: [1, 0.5, 1], ...sway(0) });
    }
    b.add(sphere(0.03, 5, 3), '#ffe66d', { pos: [0.02, 0.265, 0], ...sway(0) });
    return b.build();
  });
}

export function bushModel(): THREE.BufferGeometry {
  return cached('bush', () => {
    const b = new ModelBuilder();
    for (let k = 0; k < 3; k++) b.add(ico(0.16, 0), k === 1 ? '#3a9a26' : '#2d8c1e', { pos: [(k - 1) * 0.15, 0.13 + (k === 1 ? 0.05 : 0), (k % 2) * 0.05], rot: [k, k, 0], ...sway(0) });
    return b.build();
  });
}

/** กกริมแอ่งน้ำ */
export function reedModel(): THREE.BufferGeometry {
  return cached('reed', () => {
    const b = new ModelBuilder();
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.05;
      const h = 0.32 + (i % 2) * 0.1;
      b.limb([x, 0, 0], [x * 1.6, h, (i - 1) * 0.03], 0.012, 0.008, '#4c8a2a', sway(0), 3);
      if (i !== 1) b.add(cyl(0.022, 0.022, 0.08, 5), '#7a4a22', { pos: [x * 1.6, h + 0.02, (i - 1) * 0.03], ...sway(0) });
    }
    return b.build();
  });
}
