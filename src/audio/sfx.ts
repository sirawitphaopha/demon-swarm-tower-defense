// เสียงสังเคราะห์ด้วย Web Audio (ไม่มีไฟล์เสียง) — พารามิเตอร์เดียวกับเวอร์ชันเดิม

import type { GameEvent } from '../core/events';

export type SfxType = 'shoot' | 'cannon' | 'die' | 'place' | 'hurt' | 'boss' | 'upg' | 'win' | 'lose';

const P: Record<SfxType, { f: number; dur: number; wv: OscillatorType; vol: number }> = {
  shoot: { f: 900, dur: 0.04, wv: 'square', vol: 0.022 },
  cannon: { f: 130, dur: 0.18, wv: 'sawtooth', vol: 0.09 },
  die: { f: 320, dur: 0.07, wv: 'triangle', vol: 0.06 },
  place: { f: 520, dur: 0.1, wv: 'sine', vol: 0.08 },
  hurt: { f: 170, dur: 0.16, wv: 'sawtooth', vol: 0.1 },
  boss: { f: 70, dur: 0.5, wv: 'sawtooth', vol: 0.13 },
  upg: { f: 680, dur: 0.12, wv: 'sine', vol: 0.08 },
  win: { f: 620, dur: 0.45, wv: 'triangle', vol: 0.11 },
  lose: { f: 140, dur: 0.65, wv: 'sawtooth', vol: 0.12 },
};

/** เว้นระยะเสียงยิงขั้นต่ำ (ms) กันเสียงซ้อนจนแตก */
const SHOOT_GAP_MS = 55;

export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;
  private lastShoot = 0;

  /** สร้าง/ปลุก AudioContext — ต้องเรียกหลัง user gesture */
  init(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(type: SfxType): void {
    const ctx = this.ctx;
    if (this.muted || !ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    const { f, dur, wv, vol } = P[type];
    o.type = wv;
    o.frequency.setValueAtTime(f, t);
    if (type === 'die') o.frequency.exponentialRampToValueAtTime(f * 0.5, t + dur);
    if (type === 'win') o.frequency.linearRampToValueAtTime(f * 1.7, t + dur);
    if (type === 'upg') o.frequency.linearRampToValueAtTime(f * 1.4, t + dur);
    if (type === 'lose' || type === 'boss') o.frequency.exponentialRampToValueAtTime(f * 0.5, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** เล่นเสียงตามเหตุการณ์ของเกม */
  onEvents(events: readonly GameEvent[], nowMs: number): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'towerFired':
          if (nowMs - this.lastShoot > SHOOT_GAP_MS) {
            this.lastShoot = nowMs;
            this.play(ev.aoe ? 'cannon' : 'shoot');
          }
          break;
        case 'enemyKilled':
          this.play('die');
          break;
        case 'enemyLeaked':
          this.play('hurt');
          break;
        case 'enemySpawned':
          if (ev.boss) this.play('boss');
          break;
        case 'towerPlaced':
          this.play('place');
          break;
        case 'towerUpgraded':
          this.play('upg');
          break;
        case 'gameOver':
          this.play(ev.win ? 'win' : 'lose');
          break;
        default:
          break;
      }
    }
  }
}
