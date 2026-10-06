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

// 10 เวฟของโหมดปกติ (ปล่อยศัตรูต่อเนื่องตลอด dur วินาที)
export const WAVE_CFG: readonly WaveCfg[] = [
  { dur: 30, pool: ['maggot'],                   iv: 1.8,  sc: 1.0,  bIv: 0 },  // W1
  { dur: 32, pool: ['maggot', 'beetle'],         iv: 1.6,  sc: 1.15, bIv: 0 },  // W2
  { dur: 34, pool: ['beetle', 'scarab'],         iv: 1.5,  sc: 1.3,  bIv: 0 },  // W3
  { dur: 36, pool: ['maggot', 'wasp'],           iv: 1.3,  sc: 1.45, bIv: 0 },  // W4
  { dur: 38, pool: ['scarab', 'wasp'],           iv: 1.2,  sc: 1.6,  bIv: 0 },  // W5
  { dur: 40, pool: ['wasp', 'spider'],           iv: 1.1,  sc: 1.8,  bIv: 0 },  // W6
  { dur: 42, pool: ['spider', 'wasp'],           iv: 1.0,  sc: 2.0,  bIv: 20 }, // W7 +บอส
  { dur: 44, pool: ['spider', 'scarab'],         iv: 0.95, sc: 2.3,  bIv: 18 }, // W8
  { dur: 46, pool: ['spider', 'wasp', 'scarab'], iv: 0.85, sc: 2.6,  bIv: 15 }, // W9
  { dur: 50, pool: ['spider', 'wasp', 'scarab'], iv: 0.75, sc: 3.0,  bIv: 12 }, // W10
];

export const BASE_WAVES = WAVE_CFG.length;

/** ตั้งค่าเวฟ n (เริ่มที่ 1) — เวฟเกิน 10 (โหมดไม่สิ้นสุด) สร้างอัตโนมัติให้ยากขึ้นเรื่อยๆ */
export function getWaveCfg(n: number): WaveCfg {
  if (n <= BASE_WAVES) return WAVE_CFG[Math.max(1, n) - 1]!;
  const over = n - BASE_WAVES; // 1,2,3...
  return {
    dur: 48,
    pool: over % 4 === 0 ? ['scarab', 'spider', 'wasp', 'beetle'] : ['spider', 'wasp', 'scarab'],
    iv: Math.max(0.45, 0.72 - over * 0.03),
    sc: 3.0 * Math.pow(1.16, over), // เลือดศัตรูโตขึ้นเรื่อยๆ
    bIv: Math.max(7, 12 - over * 0.4), // บอสมาถี่ขึ้น
  };
}

export type GameMode = 'normal' | 'endless';
