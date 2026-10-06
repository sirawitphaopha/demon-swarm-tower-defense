import { describe, expect, it } from 'vitest';
import { advance, MAX_STEPS } from '../src/app/loopMath';
import { Cell, COLS, SIM_DT, SPAWN_ROW, START_LIVES, px } from '../src/config/constants';
import { ENEMIES } from '../src/config/enemies';
import { generateMap } from '../src/core/mapgen';
import { mulberry32 } from '../src/core/rng';
import { emptyMap, newGame, runSeconds } from './helpers';

describe('ความเร็วเป็นหน่วยช่อง', () => {
  it('แปลงจาก px/s เดิมด้วยค่าอ้างอิงเดียว', () => {
    expect(ENEMIES.maggot.spd).toBeCloseTo(px(55));
    expect(ENEMIES.boss.spd).toBeCloseTo(px(30));
  });
});

describe('การเดินของศัตรู', () => {
  it('ระยะเดินเท่ากับความเร็ว × เวลา แม้ผ่านหัวมุม', () => {
    const m = emptyMap();
    // บังทางตรง บังคับให้เลี้ยวลงแล้วเลี้ยวขวา
    m.grid.set(3, SPAWN_ROW, Cell.Obstacle);
    const g = newGame({ map: m });
    const e = g.spawnEnemy('beetle');
    const t = 1.5;
    runSeconds(g, t);
    // ทางเดิน: (0.5,r)→(2.5,r) 2 ช่อง, ลง 1 ช่อง, แล้วไปทางขวา
    const travelled = 2 + 1 + (e.x - 2.5);
    expect(e.y).toBeCloseTo(SPAWN_ROW + 1.5);
    expect(travelled).toBeCloseTo(ENEMIES.beetle.spd * t, 6);
  });

  it('ศัตรูบินตรงไปทางขวาและหลุดที่ขอบ', () => {
    const g = newGame();
    const e = g.spawnEnemy('wasp');
    runSeconds(g, 1);
    expect(e.x).toBeCloseTo(0.5 + ENEMIES.wasp.spd, 6);
    expect(e.y).toBe(SPAWN_ROW + 0.5);
    runSeconds(g, (COLS + 1) / ENEMIES.wasp.spd);
    expect(g.lives).toBe(START_LIVES - 1);
    expect(g.enemies).toHaveLength(0);
  });

  it('ศัตรูเดินดินหลุดทางขวาแล้วเสียชีวิต 1', () => {
    const g = newGame();
    g.spawnEnemy('beetle');
    runSeconds(g, (COLS + 2) / ENEMIES.beetle.spd);
    expect(g.lives).toBe(START_LIVES - 1);
    const ev = g.drainEvents().map((e) => e.type);
    expect(ev).toContain('enemyLeaked');
  });
});

describe('fixed timestep', () => {
  it('advance: x1 = 1 step ต่อเฟรม 60Hz, x3 = 3 step', () => {
    let acc = 0;
    let total1 = 0;
    for (let i = 0; i < 60; i++) {
      const a = advance(acc, 1 / 60, 1);
      acc = a.acc;
      total1 += a.steps;
    }
    expect(total1).toBe(60);
    acc = 0;
    let total3 = 0;
    for (let i = 0; i < 60; i++) {
      const a = advance(acc, 1 / 60, 3);
      acc = a.acc;
      total3 += a.steps;
    }
    expect(total3).toBe(180);
  });

  it('advance: เฟรมช้ามากจำกัดจำนวน step', () => {
    const a = advance(0, 5, 3);
    expect(a.steps).toBeLessThanOrEqual(MAX_STEPS);
    expect(a.alpha).toBeGreaterThanOrEqual(0);
    expect(a.alpha).toBeLessThanOrEqual(1);
  });

  it('seed เดียวกัน: เล่น x1 600 เฟรม กับ x3 200 เฟรม ได้สถานะเท่ากัน', () => {
    const make = () => {
      const g = newGame({ map: generateMap('forest', mulberry32(7)), seed: 99 });
      g.gold = 5000;
      for (const [c, r] of [
        [8, 10],
        [8, 12],
        [12, 14],
        [15, 13],
        [20, 15],
      ] as const)
        g.place('arrow', c, r);
      g.skipBreak();
      return g;
    };
    const run = (g: ReturnType<typeof make>, speed: number, frames: number) => {
      let acc = 0;
      for (let i = 0; i < frames; i++) {
        const a = advance(acc, 1 / 60, speed);
        acc = a.acc;
        for (let s = 0; s < a.steps; s++) g.step(SIM_DT);
      }
    };
    const a = make();
    const b = make();
    run(a, 1, 600);
    run(b, 3, 200);
    const snap = (g: typeof a) => ({
      gold: g.gold,
      kills: g.kills,
      lives: g.lives,
      time: g.time.toFixed(9),
      enemies: g.enemies.map((e) => [e.id, e.x.toFixed(9), e.y.toFixed(9), e.hp.toFixed(6)]),
    });
    expect(snap(b)).toEqual(snap(a));
    expect(a.kills + a.enemies.length).toBeGreaterThan(0);
  });
});
