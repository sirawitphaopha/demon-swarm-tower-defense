import { SPAWN_GUARD, Cell } from '../config/constants';
import type { Enemy } from './entities';
import { Grid } from './grid';
import { distAt, spawnReachable, type DistMap } from './pathfinding';

/** เหตุผลที่วางป้อมไม่ได้ ('tower' / 'outside' = เงียบ ไม่ต้องแจ้งเตือน เหมือนเวอร์ชันเดิม) */
export type PlaceFail = 'gold' | 'guard' | 'obstacle' | 'water' | 'tower' | 'outside' | 'occupied' | 'blocks';

/** เช็คเงื่อนไขของช่องเอง (ไม่รวมเงิน/ศัตรู/การปิดทาง) */
export function staticFail(grid: Grid, c: number, r: number): PlaceFail | null {
  if (!Grid.inBounds(c, r)) return 'outside';
  if (c < SPAWN_GUARD) return 'guard';
  const v = grid.get(c, r);
  if (v === Cell.Obstacle) return 'obstacle';
  if (v === Cell.Water) return 'water';
  if (v === Cell.Tower) return 'tower';
  return null;
}

/** ช่องที่ตัวศัตรูอยู่ตอนนี้ */
export function bodyCell(e: Enemy): [number, number] {
  return [Math.floor(e.x), Math.floor(e.y)];
}

const isGroundActive = (e: Enemy): boolean => !e.def.fly && !e.dead && !e.leaked;

/** มีศัตรูเดินดินยืนอยู่ในช่องนี้ */
export function occupied(enemies: readonly Enemy[], c: number, r: number): boolean {
  for (const e of enemies) {
    if (!isGroundActive(e) || e.exiting) continue;
    const [bc, br] = bodyCell(e);
    if (bc === c && br === r) return true;
  }
  return false;
}

/**
 * dist ใหม่ยังเปิดทางให้ทุกคนไหม: จุดเกิดไปถึงทางออก + ศัตรูเดินดินทุกตัวยังมี "ช่องถัดไป" ที่ไปถึงทางออกได้
 * (ถ้าช่องถัดไปคือช่องที่เพิ่งวาง ศัตรูจะย้อนกลับช่องเดิม จึงเช็คช่องเดิมแทน)
 */
export function pathValid(d: DistMap, enemies: readonly Enemy[], placedC = -1, placedR = -1): boolean {
  if (!spawnReachable(d)) return false;
  for (const e of enemies) {
    if (!isGroundActive(e) || e.exiting) continue;
    let nc = e.tc;
    let nr = e.tr;
    if (nc === placedC && nr === placedR) {
      nc = e.col;
      nr = e.row;
    }
    if (!Grid.inBounds(nc, nr)) continue;
    if (distAt(d, nc, nr) === -1) return false;
  }
  return true;
}
