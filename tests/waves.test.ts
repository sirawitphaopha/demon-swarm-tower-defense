import { describe, expect, it } from 'vitest';
import { BREAK_SEC, START_LIVES } from '../src/config/constants';
import { BASE_WAVES, WAVE_CFG, getWaveCfg } from '../src/config/waves';
import { isWin, waveTotalLabel } from '../src/core/waves';
import { newGame, runSeconds } from './helpers';

describe('ตารางเวฟ', () => {
  it('10 เวฟ: ยิ่งหลังยิ่งเกิดถี่ เลือดหนา บอสมาบ่อย', () => {
    expect(BASE_WAVES).toBe(10);
    for (let i = 1; i < WAVE_CFG.length; i++) {
      const a = WAVE_CFG[i - 1]!;
      const b = WAVE_CFG[i]!;
      expect(b.iv, `W${i + 1} iv`).toBeLessThanOrEqual(a.iv);
      expect(b.sc, `W${i + 1} sc`).toBeGreaterThan(a.sc);
      expect(b.dur, `W${i + 1} dur`).toBeGreaterThanOrEqual(a.dur);
      if (a.bIv > 0) expect(b.bIv, `W${i + 1} bIv`).toBeLessThanOrEqual(a.bIv);
    }
    expect(WAVE_CFG.some((w) => w.bIv > 0)).toBe(true);
  });

  it('เวฟเกิน 10 ใช้สูตรโหมดไม่สิ้นสุด ต่อเนื่องจาก Wave 10', () => {
    for (let n = 11; n <= 30; n++) {
      const over = n - 10;
      const w = getWaveCfg(n);
      expect(w.dur).toBe(48);
      expect(w.iv).toBeCloseTo(Math.max(0.35, 0.58 - over * 0.02));
      expect(w.sc).toBeCloseTo(WAVE_CFG[9]!.sc * Math.pow(1.16, over));
      expect(w.bIv).toBeCloseTo(Math.max(6, 10 - over * 0.4));
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

  it('จำนวนศัตรูที่เกิดใน Wave 1 = ตลอดเวลาเวฟ ทุกช่วงเกิด', () => {
    const g = newGame();
    g.skipBreak();
    let spawned = 0;
    const w1 = WAVE_CFG[0]!;
    while (g.wave === 1) {
      g.step(1 / 60);
      spawned += g.drainEvents().filter((e) => e.type === 'enemySpawned').length;
    }
    expect(spawned).toBe(Math.floor(w1.dur / w1.iv));
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
    expect(boss).toBe(Math.floor(WAVE_CFG[6]!.dur / WAVE_CFG[6]!.bIv));
  });

  it('เวฟถัดไปมาต่อทันทีเมื่อหมดเวลาปล่อยศัตรู ไม่รอเคลียร์สนาม ไม่มีช่วงพัก', () => {
    const g = newGame();
    g.lives = 1e9;
    g.skipBreak();
    runSeconds(g, WAVE_CFG[0]!.dur - 0.5);
    expect(g.wave).toBe(1);
    runSeconds(g, 1);
    expect(g.wave).toBe(2);
    expect(g.phase).toBe('playing');
    expect(g.enemies.length).toBeGreaterThan(0); // ศัตรูของเวฟก่อนยังอยู่บนสนาม
    let sawBreak = false;
    for (let i = 0; i < 200 * 60 && !g.over; i++) {
      g.step(1 / 60);
      if (g.phase === 'break') sawBreak = true;
    }
    expect(sawBreak).toBe(false);
  });

  it('Wave 10 ปล่อยครบแล้วรอเคลียร์สนามจึงชนะ', () => {
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
