import { COLS, ROWS, SPAWN_GUARD, SPAWN_ROW, Cell } from '../config/constants';
import { THEMES, type ThemeId } from '../config/themes';
import { toCustom } from '../core/customMap';
import { Grid } from '../core/grid';
import type { MapData } from '../core/map';
import { computeDist, spawnReachable } from '../core/pathfinding';
import type { Rng } from '../core/rng';
import { pick } from '../core/rng';

export type EdTool = 'tree' | 'water' | 'rock' | 'grass' | 'flower' | 'erase';

export interface Dirty {
  water: boolean;
  props: boolean;
  decor: boolean;
}

/** กติกาการวาดแมพ (ไม่แตะ DOM/ภาพ) — เหมือนเวอร์ชันเดิม */
export class EditorModel {
  map: MapData;

  constructor(theme: ThemeId) {
    this.map = { theme, grid: new Grid(), obstacles: [], decor: [], ponds: [] };
  }

  /** ช่องที่วาดได้: เว้นโซน spawn 2 คอลัมน์แรก, คอลัมน์ทางออก และหน้าจุด IN */
  static canPaint(c: number, r: number): boolean {
    if (!Grid.inBounds(c, r)) return false;
    if (c < SPAWN_GUARD || c >= COLS - 1) return false;
    if (r === SPAWN_ROW && c <= SPAWN_GUARD + 2) return false;
    return true;
  }

  setTheme(t: ThemeId): void {
    this.map.theme = t;
  }

  private decorAt(c: number, r: number): number {
    return this.map.decor.findIndex((d) => Math.floor(d.fx * COLS) === c && Math.floor(d.fy * ROWS) === r);
  }

  /** วาดหนึ่งช่อง คืนส่วนที่ต้องวาดภาพใหม่ (null = ไม่เปลี่ยน) */
  paint(c: number, r: number, tool: EdTool, rng: Rng): Dirty | null {
    if (!EditorModel.canPaint(c, r)) return null;
    const g = this.map.grid;
    const v = g.get(c, r);
    if (tool === 'erase') {
      const hadWater = v === Cell.Water;
      const before = this.map.obstacles.length;
      const di = this.decorAt(c, r);
      if (v === Cell.Obstacle || v === Cell.Water) g.set(c, r, Cell.Empty);
      this.map.obstacles = this.map.obstacles.filter((o) => !(o.c === c && o.r === r));
      if (di >= 0) this.map.decor = this.map.decor.filter((d) => !(Math.floor(d.fx * COLS) === c && Math.floor(d.fy * ROWS) === r));
      const props = before !== this.map.obstacles.length;
      if (!hadWater && !props && di < 0) return null;
      return { water: hadWater, props, decor: true };
    }
    if (v !== Cell.Empty) return null;
    if (tool === 'tree' || tool === 'rock') {
      g.set(c, r, Cell.Obstacle);
      const types = tool === 'tree' ? THEMES[this.map.theme].obs : (['rock'] as const);
      this.map.obstacles.push({ c, r, type: pick(rng, types), seed: rng() });
      return { water: false, props: true, decor: true };
    }
    if (tool === 'water') {
      g.set(c, r, Cell.Water);
      return { water: true, props: false, decor: true };
    }
    // หญ้า/ดอกไม้ (ช่องละชิ้น)
    if (this.decorAt(c, r) >= 0) return null;
    this.map.decor.push({ fx: (c + 0.5) / COLS, fy: (r + 0.5) / ROWS, type: tool, s: 0.7 + rng() * 0.5, seed: rng() });
    return { water: false, props: false, decor: true };
  }

  clear(): void {
    this.map = { theme: this.map.theme, grid: new Grid(), obstacles: [], decor: [], ponds: [] };
  }

  /** ยังเปิดทางให้ศัตรูเดินจากจุดเกิดถึงทางออก */
  valid(): boolean {
    return spawnReachable(computeDist(this.map.grid));
  }

  toSaved(name: string) {
    return toCustom(name, this.map);
  }
}
