import { describe, expect, it } from 'vitest';
import { SPAWN_ROW } from '../src/config/constants';
import { ENEMIES } from '../src/config/enemies';
import { TOWERS } from '../src/config/towers';
import { newGame, runSeconds } from './helpers';

describe('การยิง', () => {
  it('ป้อมยิงเมื่อศัตรูเข้าระยะ cooldown = 1/rate', () => {
    const g = newGame();
    const res = g.place('arrow', 6, SPAWN_ROW - 1);
    if (!res.ok) throw new Error();
    const e = g.spawnEnemy('scarab');
    e.x = 5.5;
    e.spd = 0;
    g.drainEvents();
    let fired = 0;
    for (let i = 0; i < 120; i++) {
      g.step(1 / 60);
      fired += g.drainEvents().filter((e) => e.type === 'towerFired').length;
    }
    // อยู่ในระยะตลอด 2 วินาที → ยิงประมาณ rate × 2 นัด
    expect(fired).toBeGreaterThanOrEqual(3);
    expect(fired).toBeLessThanOrEqual(Math.ceil(TOWERS.arrow.rate * 2) + 1);
  });

  it('ฆ่าศัตรูได้เงินตามรางวัล × ความยาก (ปัดลง) และนับ kill ของป้อม', () => {
    for (const [diff, mul] of [
      ['easy', 1.3],
      ['normal', 1],
      ['hard', 0.8],
    ] as const) {
      const g = newGame({ difficulty: diff });
      const res = g.place('laser' as const, 6, SPAWN_ROW - 1);
      expect(res.ok).toBe(false); // เงินไม่พอ
      g.gold = 1000;
      const r2 = g.place('laser', 6, SPAWN_ROW - 1);
      if (!r2.ok) throw new Error();
      const goldBefore = g.gold;
      g.spawnEnemy('beetle');
      runSeconds(g, 1.5);
      expect(g.kills).toBe(1);
      expect(r2.tower.kills).toBe(1);
      expect(g.gold - goldBefore).toBe(Math.floor(ENEMIES.beetle.reward * mul));
    }
  });

  it('ปืนใหญ่ระเบิด AOE ดาเมจลดตามระยะสูงสุด 40%', () => {
    const g = newGame();
    g.gold = 1000;
    const res = g.place('cannon', 5, SPAWN_ROW - 2);
    if (!res.ok) throw new Error();
    const a = g.spawnEnemy('boss');
    const b = g.spawnEnemy('boss');
    a.x = 5.5;
    b.x = 5.5 + 0.6; // ครึ่งรัศมี → ดาเมจ ×0.8
    a.spd = 0;
    b.spd = 0;
    a.hp = b.hp = a.maxHp = b.maxHp = 10000;
    runSeconds(g, 1.2);
    const dmgA = 10000 - a.hp;
    const dmgB = 10000 - b.hp;
    expect(dmgA).toBeCloseTo(TOWERS.cannon.dmg, 4);
    expect(dmgB).toBeCloseTo(TOWERS.cannon.dmg * (1 - 0.5 * 0.4), 4);
  });

  it('กระสุนหายถ้าเป้าตายก่อนถึง', () => {
    const g = newGame();
    const res = g.place('stone', 6, SPAWN_ROW - 2);
    if (!res.ok) throw new Error();
    const e = g.spawnEnemy('maggot');
    e.x = 6.5;
    e.spd = 0;
    g.step(1 / 60);
    expect(g.projectiles).toHaveLength(1);
    e.dead = true;
    g.step(1 / 60);
    expect(g.projectiles).toHaveLength(0);
  });

  it('เลือดศัตรูคูณสเกลเวฟและความยาก', () => {
    const g = newGame({ difficulty: 'hard' });
    g.wave = 7;
    const e = g.spawnEnemy('spider');
    expect(e.maxHp).toBeCloseTo(150 * 2.0 * 1.4);
  });
});
