import { Cell, COLS, ROWS } from '../src/config/constants';
import type { Difficulty } from '../src/config/difficulty';
import type { GameMode } from '../src/config/waves';
import { Game } from '../src/core/Game';
import { Grid } from '../src/core/grid';
import type { MapData } from '../src/core/map';

export function emptyMap(): MapData {
  return { theme: 'meadow', grid: new Grid(), obstacles: [], decor: [], ponds: [] };
}

/** สร้างแมพจากภาพ ASCII ('#' = สิ่งกีดขวาง, '~' = น้ำ) วางที่มุมซ้ายบน */
export function mapFromAscii(rows: string[]): MapData {
  const m = emptyMap();
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length && c < COLS; c++) {
      if (line[c] === '#') m.grid.set(c, r, Cell.Obstacle);
      if (line[c] === '~') m.grid.set(c, r, Cell.Water);
    }
  });
  return m;
}

export function newGame(opts: { map?: MapData; mode?: GameMode; difficulty?: Difficulty; seed?: number } = {}): Game {
  const g = new Game({
    mode: opts.mode ?? 'normal',
    difficulty: opts.difficulty ?? 'normal',
    map: opts.map ?? emptyMap(),
    seed: opts.seed ?? 1,
  });
  g.drainEvents();
  return g;
}

/** กำแพงแนวตั้งที่คอลัมน์ c เว้นช่องว่างที่แถว gapRow */
export function wallWithGap(m: MapData, c: number, gapRow: number): void {
  for (let r = 0; r < ROWS; r++) if (r !== gapRow) m.grid.set(c, r, Cell.Obstacle);
}

export function runSeconds(g: Game, sec: number, dt = 1 / 60): void {
  const n = Math.round(sec / dt);
  for (let i = 0; i < n && !g.over; i++) g.step(dt);
}
