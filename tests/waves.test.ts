import { describe, expect, it } from 'vitest';
import { BREAK_SEC, START_LIVES } from '../src/config/constants';
import { BASE_WAVES, WAVE_CFG, getWaveCfg } from '../src/config/waves';
import { isWin, waveTotalLabel } from '../src/core/waves';
import { newGame, runSeconds } from './helpers';

describe('ตารางเวฟ', () => {
  it('10 เวฟตรงกับค่าของเวอร์ชันเดิม', () => {
    expect(BASE_WAVES).toBe(10);
    expect(WAVE_CFG.map((w) => [w.dur, w.iv, w.sc, w.bIv, w.pool.join('+')])).toEqual([
      [30, 1.8, 1.0, 0, 'maggot'],
      [32, 1.6, 1.15, 0, 'maggot+beetle'],
      [34, 1.5, 1.3, 0, 'beetle+scarab'],
      [36, 1.3, 1.45, 0, 'maggot+wasp'],
      [38, 1.2, 1.6, 0, 'scarab+wasp'],
      [40, 1.1, 1.8, 0, 'wasp+spider'],
      [42, 1.0, 2.0, 20, 'spider+wasp'],
      [44, 0.95, 2.3, 18, 'spider+scarab'],
      [46, 0.85, 2.6, 15, 'spider+wasp+scarab'],
      [50, 0.75, 3.0, 12, 'spider+wasp+scarab'],
    ]);
  });

  it('เวฟเกิน 10 ใช้สูตรโหมดไม่สิ้นสุดเดิม', () => {
    for (let n = 11; n <= 30; n++) {
      const over = n - 10;
      const w = getWaveCfg(n);
      expect(w.dur).toBe(48);
      expect(w.iv).toBeCloseTo(Math.max(0.45, 0.72 - over * 0.03));
      expect(w.sc).toBeCloseTo(3.0 * Math.pow(1.16, over));
      expect(w.bIv).toBeCloseTo(Math.max(7, 12 - over * 0.4));
      expect(w.pool.length).toBe(over % 4 === 0 ? 4 : 3);
    }
  });

  it('ชนะเฉพาะโหมดปกติหลังเวฟ 10', () => {
    expect(isWin('normal', 10)).toBe(true);
    expect(isWin('normal', 9)).toBe(false);
    expect(isWin('endless', 50)).toBe(false);
    expect(waveTotalLabel('endless')).toBe('∞');
    expect(waveTotalLabel('normal')).toBe('10');
  });
});

describe('ลำดับเวฟในเกม', () => {
  it('เริ่มที่ช่วงเตรียมตัว wave 0 แล้วเข้า Wave 1 เมื่อหมดเวลา', () => {
    const g = newGame();
    expect(g.phase).toBe('break');
    expect(g.wave).toBe(0);
    expect(g.breakRemain).toBe(BREAK_SEC);
    runSeconds(g, BREAK_SEC + 0.05);
    expect(g.phase).toBe('playing');
    expect(g.wave).toBe(1);
  });

  it('ข้ามช่วงพักได้', () => {
    const g = newGame();
    g.skipBreak();
    expect(g.phase).toBe('playing');
    expect(g.wave).toBe(1);
    g.skipBreak(); // ระหว่างเวฟข้ามไม่ได้
    expect(g.wave).toBe(1);
  });

  it('จำนวนศัตรูที่เกิดใน Wave 1 = ตลอด 30 วินาที ทุก 1.8 วินาที', () => {
    const g = newGame();
    g.skipBreak();
    let spawned = 0;
    for (let i = 0; i < 31 * 60; i++) {
      g.step(1 / 60);
      spawned += g.drainEvents().filter((e) => e.type === 'enemySpawned').length;
    }
    expect(spawned).toBe(Math.floor(30 / 1.8));
  });

  it('บอสเกิดตามรอบใน Wave 7', () => {
    const g = newGame({ seed: 3 });
    g.lives = 1e9;
    g.wave = 6;
    g.skipBreak();
    expect(g.wave).toBe(7);
    let boss = 0;
    for (let i = 0; i < 43 * 60; i++) {
      g.step(1 / 60);
      boss += g.drainEvents().filter((e) => e.type === 'enemySpawned' && e.boss).length;
    }
    expect(boss).toBe(2); // วินาทีที่ 20 และ 40
  });

  it('เคลียร์เวฟแล้วเข้าช่วงพัก, เวฟ 10 เคลียร์แล้วชนะ', () => {
    const g = newGame();
    g.wave = 9;
    g.skipBreak();
    g.lives = 1e9;
    // ไม่มีป้อม: รอให้ศัตรูทั้งหมดหลุดออกไป
    runSeconds(g, 50 + 60);
    expect(g.over).toBe(true);
    expect(g.won).toBe(true);
  });

  it('โหมดไม่สิ้นสุดเคลียร์เวฟ 10 แล้วเข้าช่วงพักต่อ', () => {
    const g = newGame({ mode: 'endless' });
    g.wave = 9;
    g.skipBreak();
    g.lives = 1e9;
    runSeconds(g, 50 + 60);
    expect(g.over).toBe(false);
    expect(g.wave).toBeGreaterThanOrEqual(10);
  });

  it('ชีวิตหมด = แพ้', () => {
    const g = newGame();
    g.skipBreak();
    g.lives = 1;
    runSeconds(g, 60);
    expect(g.over).toBe(true);
    expect(g.won).toBe(false);
    expect(g.lives).toBeLessThanOrEqual(0);
    expect(START_LIVES).toBe(20);
  });
});
