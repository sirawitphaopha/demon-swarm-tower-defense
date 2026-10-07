import type { EnemyId } from './enemies';

export interface WaveCfg {
  /** วินาทีที่ปล่อยศัตรู */
  dur: number;
  /** ชนิดศัตรูที่สุ่มเกิด */
  pool: readonly EnemyId[];
  /** ระยะห่างการเกิดต่อตัว (วินาที) */
  iv: number;
  /** ตัวคูณเลือดศัตรู */
  sc: number;
  /** บอสเกิดทุกกี่วินาที (0 = ไม่มี) */
  bIv: number;
}

// 10 เวฟของโหมดปกติ — เวฟต่อกันไม่มีพัก ศัตรูมาถี่ขึ้น เลือดหนาขึ้น บอสมาบ่อยขึ้นเรื่อยๆ
export const WAVE_CFG: readonly WaveCfg[] = [
  { dur: 30, pool: ['maggot'],                             iv: 1.6,  sc: 1.0,  bIv: 0 },  // W1
  { dur: 32, pool: ['maggot', 'beetle'],                   iv: 1.4,  sc: 1.1,  bIv: 0 },  // W2
  { dur: 34, pool: ['beetle', 'scarab'],                   iv: 1.3,  sc: 1.35, bIv: 0 },  // W3
  { dur: 36, pool: ['maggot', 'beetle', 'wasp'],           iv: 1.15, sc: 1.6,  bIv: 0 },  // W4
  { dur: 38, pool: ['scarab', 'wasp'],                     iv: 1.05, sc: 1.9,  bIv: 0 },  // W5
  { dur: 40, pool: ['wasp', 'spider'],                     iv: 0.95, sc: 2.3,  bIv: 0 },  // W6
  { dur: 42, pool: ['spider', 'wasp'],                     iv: 0.85, sc: 2.8,  bIv: 20 }, // W7 +บอส
  { dur: 44, pool: ['spider', 'scarab'],                   iv: 0.8,  sc: 3.3,  bIv: 16 }, // W8
  { dur: 46, pool: ['spider', 'wasp', 'scarab'],           iv: 0.7,  sc: 4.0,  bIv: 13 }, // W9
  { dur: 50, pool: ['spider', 'wasp', 'scarab', 'beetle'], iv: 0.6,  sc: 4.8,  bIv: 10 }, // W10
];

export const BASE_WAVES = WAVE_CFG.length;

/** ตั้งค่าเวฟ n (เริ่มที่ 1) — เวฟเกิน 10 (โหมดไม่สิ้นสุด) สร้างอัตโนมัติให้ยากขึ้นเรื่อยๆ */
export function getWaveCfg(n: number): WaveCfg {
  if (n <= BASE_WAVES) return WAVE_CFG[Math.max(1, n) - 1]!;
  const over = n - BASE_WAVES; // 1,2,3...
  return {
    dur: 48,
    pool: over % 4 === 0 ? ['scarab', 'spider', 'wasp', 'beetle'] : ['spider', 'wasp', 'scarab'],
    iv: Math.max(0.35, 0.58 - over * 0.02),
    sc: 4.8 * Math.pow(1.16, over), // เลือดศัตรูโตขึ้นเรื่อยๆ
    bIv: Math.max(6, 10 - over * 0.4), // บอสมาถี่ขึ้น
  };
}

export type GameMode = 'normal' | 'endless';
