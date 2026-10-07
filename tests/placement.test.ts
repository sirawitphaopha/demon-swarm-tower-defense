import { describe, expect, it } from 'vitest';
import { Cell, ROWS, SPAWN_ROW, START_GOLD } from '../src/config/constants';
import { TOWERS } from '../src/config/towers';
import { generateMap } from '../src/core/mapgen';
import { mulberry32 } from '../src/core/rng';
import { emptyMap, newGame, runSeconds } from './helpers';

describe('Game.place', () => {
  it('วางได้: หักเงิน เพิ่มป้อม ช่องเป็นป้อม', () => {
    const g = newGame();
    const res = g.place('stone', 10, 5);
    expect(res.ok).toBe(true);
    expect(g.gold).toBe(START_GOLD - TOWERS.stone.cost);
    expect(g.towers).toHaveLength(1);
    expect(g.grid.get(10, 5)).toBe(Cell.Tower);
    const ev = g.drainEvents().map((e) => e.type);
    expect(ev).toEqual(['towerPlaced', 'gridChanged']);
  });

  it('เช็คเงินก่อนเงื่อนไขอื่น', () => {
    const g = newGame();
    expect(g.place('laser', 0, 0)).toEqual({ ok: false, reason: 'gold' });
  });

  it('เหตุผลที่วางไม่ได้แต่ละแบบ', () => {
    const m = emptyMap();
    m.grid.set(10, 3, Cell.Obstacle);
    m.grid.set(11, 3, Cell.Water);
    const g = newGame({ map: m });
    expect(g.place('stone', 1, 3)).toEqual({ ok: false, reason: 'guard' });
    expect(g.place('stone', 10, 3)).toEqual({ ok: false, reason: 'obstacle' });
    expect(g.place('stone', 11, 3)).toEqual({ ok: false, reason: 'water' });
    expect(g.place('stone', -1, 3)).toEqual({ ok: false, reason: 'outside' });
    g.place('stone', 12, 3);
    expect(g.place('stone', 12, 3)).toEqual({ ok: false, reason: 'tower' });
  });

  it('ห้ามปิดทางทั้งหมด', () => {
    const g = newGame();
    g.gold = 100000;
    for (let r = 0; r < ROWS - 1; r++) expect(g.place('stone', 20, r).ok).toBe(true);
    expect(g.place('stone', 20, ROWS - 1)).toEqual({ ok: false, reason: 'blocks' });
  });

  it('ห้ามวางบนช่องที่ศัตรูเดินดินยืนอยู่', () => {
    const g = newGame();
    const e = g.spawnEnemy('maggot');
    e.x = 7.3;
    e.y = SPAWN_ROW + 0.5;
    expect(g.place('stone', 7, SPAWN_ROW)).toEqual({ ok: false, reason: 'occupied' });
  });

  it('ศัตรูบินไม่นับว่ายืนขวาง', () => {
    const g = newGame();
    const e = g.spawnEnemy('wasp');
    e.x = 7.3;
    expect(g.place('stone', 7, SPAWN_ROW).ok).toBe(true);
  });

  it('ศัตรูที่กำลังเดินเข้าช่องที่เพิ่งวาง ย้อนกลับช่องเดิม', () => {
    const g = newGame();
    const e = g.spawnEnemy('maggot');
    Object.assign(e, { col: 5, row: SPAWN_ROW, tc: 6, tr: SPAWN_ROW, tx: 6.5, ty: SPAWN_ROW + 0.5, x: 5.8, y: SPAWN_ROW + 0.5 });
    expect(g.place('stone', 6, SPAWN_ROW).ok).toBe(true);
    expect([e.tc, e.tr, e.tx]).toEqual([5, SPAWN_ROW, 5.5]);
    // เดินกลับถึงกึ่งกลางช่องเดิมแล้วอ้อมป้อม
    runSeconds(g, 1);
    expect(e.row).not.toBe(SPAWN_ROW);
  });

  it('สุ่มแมพ + วางป้อมระหว่างเวฟ: ศัตรูเดินดินไม่เคยเข้าช่องป้อม', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const rng = mulberry32(seed * 977);
      const g = newGame({ map: generateMap('meadow', rng), seed });
      g.gold = 1e9;
      g.skipBreak();
      for (let step = 0; step < 900; step++) {
        if (step % 3 === 0) {
          const c = 2 + Math.floor(rng() * 46);
          const r = Math.floor(rng() * ROWS);
          g.place('stone', c, r);
        }
        g.step(1 / 60);
        for (const e of g.enemies) {
          if (e.def.fly || e.exiting) continue;
          const bc = Math.floor(e.x);
          const br = Math.floor(e.y);
          expect(g.grid.get(bc, br)).not.toBe(Cell.Tower);
          expect(g.grid.get(e.tc, e.tr) === Cell.Tower).toBe(false);
        }
      }
    }
  });

  it('checkPlace ใช้กับ ghost ได้ (ไม่สนเงิน)', () => {
    const g = newGame();
    g.gold = 0;
    expect(g.checkPlace(10, 10)).toBeNull();
    expect(g.checkPlace(0, 10)).toBe('guard');
  });
});

describe('upgrade / sell / target', () => {
  it('อัปเกรดตามสาย หักเงิน รวมต้นทุน รีเซ็ต cooldown', () => {
    const g = newGame();
    g.gold = 1000;
    const res = g.place('stone', 10, 10);
    if (!res.ok) throw new Error('place');
    const tw = res.tower;
    tw.cd = 0.5;
    expect(g.upgrade(tw.id)).toEqual({ ok: true });
    expect(tw.kind).toBe('arrow');
    expect(tw.totalCost).toBe(150);
    expect(tw.cd).toBe(0);
    expect(g.gold).toBe(1000 - 50 - 100);
  });

  it('อัปเกรดเงินไม่พอ / สุดสาย', () => {
    const g = newGame();
    g.gold = 900;
    const res = g.place('machinegun', 10, 10);
    if (!res.ok) throw new Error('place');
    expect(g.upgrade(res.tower.id)).toEqual({ ok: false, reason: 'gold' });
    g.gold = 800;
    expect(g.upgrade(res.tower.id).ok).toBe(true);
    expect(g.upgrade(res.tower.id)).toEqual({ ok: false, reason: 'max' });
  });

  it('ขายได้ 50% ของต้นทุนรวม (ปัดลง) และเปิดทางคืน', () => {
    const g = newGame();
    g.gold = 1000;
    const res = g.place('stone', 10, 10);
    if (!res.ok) throw new Error('place');
    g.upgrade(res.tower.id); // ต้นทุนรวม 150
    const gold = g.gold;
    expect(g.sell(res.tower.id)).toBe(true);
    expect(g.gold).toBe(gold + 75);
    expect(g.grid.get(10, 10)).toBe(Cell.Empty);
    expect(g.towers).toHaveLength(0);
  });

  it('เปลี่ยนโหมดเล็งวนครบ 4 แบบ', () => {
    const g = newGame();
    const res = g.place('stone', 10, 10);
    if (!res.ok) throw new Error('place');
    const seen = [res.tower.target];
    for (let i = 0; i < 4; i++) {
      g.cycleTarget(res.tower.id);
      seen.push(res.tower.target);
    }
    expect(seen).toEqual(['first', 'last', 'strong', 'weak', 'first']);
  });
});
