import { describe, expect, it } from 'vitest';
import { REF_CELL_PX } from '../src/config/constants';
import { DIFF } from '../src/config/difficulty';
import { ENEMIES, ENEMY_ORDER } from '../src/config/enemies';
import { OBSTACLE_TYPES, THORDER } from '../src/config/themes';
import { TARGET_MODES, TORDER, TOWERS } from '../src/config/towers';
import { BASE_WAVES } from '../src/config/waves';
import * as content from '../src/codex/content';
import { aoeMultiplier, countSpawns, crossTime, enemyHp, enemyReward, endlessCurve, towerStats, tunables, upgradeChain, waveTable, wavesWithEnemy } from '../src/codex/data';
import { newGame } from './helpers';

describe('ตัวเลขสารานุกรมตรงกับเกม', () => {
  it('จำนวนศัตรู/บอสต่อเวฟ = ผลจำลอง Game จริงทุกเวฟ', () => {
    for (let n = 1; n <= BASE_WAVES + 3; n++) {
      const g = newGame({ mode: 'endless', seed: n });
      g.lives = 1e9;
      g.wave = n - 1;
      g.skipBreak();
      let spawns = 0;
      let bosses = 0;
      // เวฟต่อกันไม่มีพัก → นับจนกว่าเลขเวฟจะเปลี่ยน
      while (g.wave === n && g.time < 400) {
        g.step(1 / 60);
        for (const ev of g.drainEvents()) if (ev.type === 'enemySpawned') ev.boss ? bosses++ : spawns++;
      }
      expect(countSpawns(n), `wave ${n}`).toEqual({ spawns, bosses });
    }
  });

  it('สายอัปเกรดครบ 6 ขั้น ต้นทุนสะสม/ราคาขายถูกต้อง', () => {
    const chain = upgradeChain();
    expect(chain.map((s) => s.id)).toEqual([...TORDER]);
    let cum = 0;
    for (const s of chain) {
      cum += TOWERS[s.id].cost;
      expect(s.cumulative).toBe(cum);
      expect(s.sellUpgraded).toBe(Math.floor(cum * 0.5));
      expect(s.sellDirect).toBe(Math.floor(TOWERS[s.id].cost * 0.5));
    }
  });

  it('DPS ขณะยิงรัว = ดาเมจ × เรท · DPS ระยะยาวรวมเวลาเติมกระสุน · ความเร็วกระสุนแปลงกลับเป็น px/s เดิมได้', () => {
    const L = TOWERS.laser;
    expect(towerStats('laser').burstDps).toBe(L.dmg * L.rate);
    expect(towerStats('laser').dps).toBeCloseTo((L.dmg * L.mag) / ((L.mag - 1) / L.rate + L.reload));
    expect(towerStats('machinegun').dpsPerGold).toBeCloseTo(towerStats('machinegun').dps / TOWERS.machinegun.cost);
    expect(towerStats('arrow').pspdPx).toBeCloseTo(360);
    expect(towerStats('stone').tier).toBe(1);
    expect(towerStats('laser').tier).toBe(6);
  });

  it('เลือด/รางวัลศัตรูตามสูตร', () => {
    expect(enemyHp('spider', 7, 'hard')).toBeCloseTo(150 * 2.8 * DIFF.hard.hp);
    expect(enemyHp('maggot', 12, 'normal')).toBeCloseTo(70 * 4.8 * 1.16 ** 2);
    expect(enemyReward('scarab', 'easy')).toBe(Math.floor(ENEMIES.scarab.reward * 1.3));
    expect(crossTime('wasp')).toBeCloseTo(50 / ENEMIES.wasp.spd);
    expect(ENEMIES.boss.spd * REF_CELL_PX).toBeCloseTo(30);
  });

  it('เวฟที่ศัตรูปรากฏ + ตาราง + เส้นโค้ง', () => {
    expect(wavesWithEnemy('maggot')).toEqual([1, 2, 4]);
    expect(wavesWithEnemy('boss')).toEqual([7, 8, 9, 10]);
    expect(waveTable()).toHaveLength(BASE_WAVES);
    const curve = endlessCurve(11, 40);
    expect(curve).toHaveLength(30);
    expect(curve[29]!.sc).toBeGreaterThan(curve[0]!.sc);
  });

  it('ระเบิด: เต็มที่กลางวง เหลือ 60% ที่ขอบ นอกวง 0', () => {
    expect(aoeMultiplier(0, 1.2)).toBe(1);
    expect(aoeMultiplier(1.2, 1.2)).toBeCloseTo(0.6);
    expect(aoeMultiplier(1.3, 1.2)).toBe(0);
  });

  it('ตารางปรับเกมมีครบทุกป้อม/ศัตรู/เวฟ และระบุไฟล์', () => {
    const t = tunables();
    for (const id of TORDER) expect(t.some((r) => r.path.includes(`TOWERS.${id}.cost`))).toBe(true);
    for (const id of ENEMY_ORDER) expect(t.some((r) => r.path.includes(`ENEMIES.${id}.hp`))).toBe(true);
    for (let i = 0; i < BASE_WAVES; i++) expect(t.some((r) => r.path.includes(`WAVE_CFG[${i}]`))).toBe(true);
    for (const r of t) expect(r.path).toMatch(/^(config|core)\//);
  });
});

describe('DPS ระยะยาวตรงกับการยิงจริงในเกม', () => {
  it('ทุกป้อม ยิงเป้าที่ไม่ตายนาน 60 วินาที ดาเมจเฉลี่ยใกล้ DPS ระยะยาว', () => {
    for (const id of TORDER) {
      const g = newGame();
      g.gold = 1e6;
      const res = g.place(id, 6, 13);
      if (!res.ok) throw new Error(id);
      const e = g.spawnEnemy('boss');
      e.x = 6.5;
      e.y = 14.5;
      e.spd = 0;
      e.hp = e.maxHp = 1e12;
      for (let i = 0; i < 60 * 60; i++) {
        g.step(1 / 60);
        g.enemies = [e]; // ตัดศัตรูของเวฟที่เกิดเองออก ให้ยิงเป้าเดียว
      }
      const ratio = (1e12 - e.hp) / 60 / towerStats(id).dps;
      expect(ratio, id).toBeGreaterThan(0.93);
      expect(ratio, id).toBeLessThan(1.07);
    }
  });
});

describe('เนื้อหาสารานุกรมครบ', () => {
  it('ทุกป้อม/ศัตรู/ธีม/สิ่งกีดขวาง/โหมดเล็งมีคำอธิบาย', () => {
    for (const id of TORDER) expect(content.TOWER_TEXT[id]?.lore, id).toBeTruthy();
    for (const id of ENEMY_ORDER) expect(content.ENEMY_TEXT[id]?.lore, id).toBeTruthy();
    for (const id of THORDER) expect(content.THEME_TEXT[id], id).toBeTruthy();
    for (const id of OBSTACLE_TYPES) expect(content.OBSTACLE_TEXT[id]?.name, id).toBeTruthy();
    for (const m of TARGET_MODES) expect(content.TARGET_TEXT[m], m).toBeTruthy();
    expect(content.CATEGORIES.map((c) => c.id)).toEqual(['howto', 'controls', 'towers', 'enemies', 'waves', 'difficulty', 'mechanics', 'themes', 'tuning']);
  });
});
