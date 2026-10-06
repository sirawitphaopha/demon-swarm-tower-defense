import { describe, expect, it } from 'vitest';
import { SPAWN_ROW } from '../src/config/constants';
import { generateMap } from '../src/core/mapgen';
import { mulberry32 } from '../src/core/rng';
import { newGame } from './helpers';

describe('เล่นครบ 10 เวฟแบบ headless', () => {
  it('ป้อมแน่นพอ → ชนะ, ไม่มีป้อม → แพ้', () => {
    const g = newGame({ map: generateMap('meadow', mulberry32(5)), seed: 5 });
    g.gold = 1e7;
    for (let c = 4; c < 46; c += 2) {
      for (const dr of [-2, 2]) g.place('laser', c, SPAWN_ROW + dr);
    }
    expect(g.towers.length).toBeGreaterThan(20);
    let steps = 0;
    while (!g.over && steps < 60 * 60 * 20) {
      g.step(1 / 60);
      g.drainEvents();
      steps++;
    }
    expect(g.over).toBe(true);
    expect(g.won).toBe(true);
    expect(g.wave).toBe(10);

    const lose = newGame({ seed: 5 });
    lose.skipBreak();
    while (!lose.over && lose.time < 2000) lose.step(1 / 60);
    expect(lose.won).toBe(false);
  });
});
