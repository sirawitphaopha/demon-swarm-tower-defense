import { COLS } from '../config/constants';
import type { TargetMode } from '../config/towers';
import type { Enemy, Tower } from './entities';
import { distAt, type DistMap } from './pathfinding';

/** ศัตรูเดินดินออกจากสนามที่ x นี้ (กึ่งกลางช่องเสมือนถัดจากขอบขวา + ครึ่งช่อง) */
export const GROUND_EXIT_X = COLS + 1;
/** ศัตรูบินหลุดที่ x นี้ */
export const FLY_EXIT_X = COLS + 0.5;

/** ระยะทางที่เหลือถึงทางออก (หน่วยช่อง) — ใช้เทียบ "หน้าสุด/หลังสุด" ตามทางเดินจริงในเขาวงกต */
export function remaining(e: Enemy, dist: DistMap): number {
  if (e.def.fly) return FLY_EXIT_X - e.x;
  if (e.exiting) return GROUND_EXIT_X - e.x;
  const d = distAt(dist, e.tc, e.tr);
  const toNode = Math.hypot(e.tx - e.x, e.ty - e.y);
  // dist นับก้าวถึงคอลัมน์ขวาสุด + จากกึ่งกลางคอลัมน์นั้นถึงจุดออกอีก 1.5 ช่อง
  return (d < 0 ? 999 : d) + toNode + 1.5;
}

/** เลือกเป้าตามโหมดเล็ง (ใช้ > เพื่อคงลำดับเดิมเมื่อค่าเท่ากัน) */
export function pickTarget(tw: Tower, enemies: readonly Enemy[], dist: DistMap): Enemy | null {
  let tgt: Enemy | null = null;
  let best = -Infinity;
  const rng2 = tw.def.range * tw.def.range;
  for (const e of enemies) {
    if (e.dead || e.leaked) continue;
    const dx = e.x - tw.x;
    const dy = e.y - tw.y;
    if (dx * dx + dy * dy > rng2) continue;
    const v = score(tw.target, e, dist);
    if (v > best) {
      best = v;
      tgt = e;
    }
  }
  return tgt;
}

function score(mode: TargetMode, e: Enemy, dist: DistMap): number {
  switch (mode) {
    case 'last':
      return remaining(e, dist);
    case 'strong':
      return e.hp;
    case 'weak':
      return -e.hp;
    default:
      return -remaining(e, dist); // first = ใกล้ทางออกที่สุด
  }
}
