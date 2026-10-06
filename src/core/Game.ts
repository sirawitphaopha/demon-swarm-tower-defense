import { BREAK_SEC, COLS, Cell, HIT_FLASH_SEC, REF_CELL_PX, SELL_RATIO, SPAWN_ROW, START_GOLD, START_LIVES } from '../config/constants';
import { DIFF, type Difficulty } from '../config/difficulty';
import { ENEMIES, type EnemyId } from '../config/enemies';
import { TARGET_MODES, TOWERS, type TowerId } from '../config/towers';
import { getWaveCfg, type GameMode } from '../config/waves';
import type { Enemy, Projectile, Tower } from './entities';
import type { GameEvent, Phase } from './events';
import type { MapData } from './map';
import { computeDist, nextStep, type DistMap } from './pathfinding';
import { occupied, pathValid, staticFail, type PlaceFail } from './placement';
import { pick, mulberry32, randomSeed, type Rng } from './rng';
import { GROUND_EXIT_X, FLY_EXIT_X, pickTarget } from './targeting';
import { isWin } from './waves';

/** ระยะที่ถือว่ากระสุนถึงเป้า (เท่ากับ 1px ของเวอร์ชันเดิม) */
const HIT_TOL = 1 / REF_CELL_PX;

export type PlaceResult = { ok: true; tower: Tower } | { ok: false; reason: PlaceFail };
export type UpgradeResult = { ok: true } | { ok: false; reason: 'gold' | 'max' };

export interface GameOptions {
  mode: GameMode;
  difficulty: Difficulty;
  map: MapData;
  seed?: number;
}

/** สถานะเกมทั้งหมด + กติกา ไม่แตะ DOM/ภาพ — เรียก step(dt) ด้วย dt คงที่ */
export class Game {
  readonly mode: GameMode;
  readonly difficulty: Difficulty;
  readonly map: MapData;
  readonly rng: Rng;

  dist: DistMap;
  gold = START_GOLD;
  lives = START_LIVES;
  kills = 0;
  wave = 0;
  phase: Phase = 'break';
  waveElapsed = 0;
  spawnTimer = 0;
  bossTimer = 0;
  breakRemain = 0;

  towers: Tower[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];

  speed: 1 | 2 | 3 = 1;
  paused = false;
  over = false;
  won = false;
  /** เวลาจำลองสะสม (วินาที) */
  time = 0;
  /** เพิ่มทุกครั้งที่กริดเปลี่ยน (วาง/ขายป้อม) */
  gridVersion = 0;

  private nextId = 1;
  private events: GameEvent[] = [];

  constructor(opts: GameOptions) {
    this.mode = opts.mode;
    this.difficulty = opts.difficulty;
    this.map = opts.map;
    this.rng = mulberry32(opts.seed ?? randomSeed());
    this.dist = computeDist(this.grid);
    this.beginBreak(); // ช่วงเตรียมตัวก่อน Wave 1 (วางป้อมก่อนได้)
  }

  get grid() {
    return this.map.grid;
  }

  /** ดึงเหตุการณ์ที่สะสมไว้ออกทั้งหมด */
  drainEvents(): GameEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  // ── WAVE ────────────────────────────────────────────
  private beginWave(n: number): void {
    this.wave = n;
    this.phase = 'playing';
    this.waveElapsed = 0;
    this.spawnTimer = 0;
    this.bossTimer = 0;
    this.events.push({ type: 'phaseChanged', phase: 'playing', wave: n });
  }

  private beginBreak(): void {
    this.phase = 'break';
    this.breakRemain = BREAK_SEC;
    this.events.push({ type: 'phaseChanged', phase: 'break', wave: this.wave });
  }

  skipBreak(): void {
    if (this.phase === 'break' && !this.over) this.beginWave(this.wave + 1);
  }

  togglePause(): boolean {
    if (!this.over) this.paused = !this.paused;
    return this.paused;
  }

  cycleSpeed(): 1 | 2 | 3 {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    return this.speed;
  }

  // ── STEP ────────────────────────────────────────────
  step(dt: number): void {
    if (this.over) return;
    this.time += dt;
    for (const e of this.enemies) {
      e.px = e.x;
      e.py = e.y;
    }
    for (const p of this.projectiles) {
      p.px = p.x;
      p.py = p.y;
    }

    const cfg = getWaveCfg(this.wave);
    if (this.phase === 'playing') {
      this.waveElapsed += dt;
      if (this.waveElapsed <= cfg.dur) {
        this.spawnTimer += dt;
        if (this.spawnTimer >= cfg.iv) {
          this.spawnTimer -= cfg.iv;
          this.spawnEnemy(pick(this.rng, cfg.pool));
        }
        if (cfg.bIv > 0) {
          this.bossTimer += dt;
          if (this.bossTimer >= cfg.bIv) {
            this.bossTimer = 0;
            this.spawnEnemy('boss');
          }
        }
      }
      if (this.waveElapsed > cfg.dur && this.enemies.length === 0) {
        if (isWin(this.mode, this.wave)) {
          this.endGame(true);
          return;
        }
        this.beginBreak();
      }
    }

    if (this.phase === 'break') {
      this.breakRemain -= dt;
      if (this.breakRemain <= 0) this.beginWave(this.wave + 1);
    }

    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.enemies = this.enemies.filter((e) => !e.dead && !e.leaked);

    if (this.lives <= 0) this.endGame(false);
  }

  private endGame(win: boolean): void {
    if (this.over) return;
    this.over = true;
    this.won = win;
    this.events.push({ type: 'gameOver', win });
  }

  // ── ENEMIES ─────────────────────────────────────────
  spawnEnemy(kind: EnemyId): Enemy {
    const def = ENEMIES[kind];
    const hp = def.hp * getWaveCfg(this.wave).sc * DIFF[this.difficulty].hp;
    const r = SPAWN_ROW;
    const e: Enemy = {
      id: this.nextId++,
      kind,
      def,
      x: 0.5,
      y: r + 0.5,
      px: 0.5,
      py: r + 0.5,
      hp,
      maxHp: hp,
      spd: def.spd,
      flash: 0,
      dead: false,
      leaked: false,
      col: 0,
      row: r,
      tc: 1,
      tr: r,
      tx: 1.5,
      ty: r + 0.5,
      exiting: false,
    };
    if (!def.fly) this.setNext(e);
    this.enemies.push(e);
    this.events.push({ type: 'enemySpawned', id: e.id, kind, boss: kind === 'boss' });
    return e;
  }

  /** ตั้งช่องเป้าหมายถัดไปจาก flow-field */
  private setNext(e: Enemy): void {
    const st = nextStep(this.grid, this.dist, e.col, e.row);
    if (st.exit) {
      e.exiting = true;
      e.tc = COLS;
      e.tr = e.row;
      e.tx = GROUND_EXIT_X;
      e.ty = e.y;
    } else {
      e.tc = e.col + st.dx;
      e.tr = e.row + st.dy;
      e.tx = e.tc + 0.5;
      e.ty = e.tr + 0.5;
    }
  }

  private leak(e: Enemy): void {
    e.leaked = true;
    this.lives--;
    this.events.push({ type: 'enemyLeaked', id: e.id, kind: e.kind, x: e.x, y: e.y });
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.dead || e.leaked) continue;
      e.flash = Math.max(0, e.flash - dt);

      if (e.def.fly) {
        // บินตรงข้ามป้อม
        e.x += e.spd * dt;
        if (e.x >= FLY_EXIT_X) this.leak(e);
        continue;
      }

      // เดินตาม waypoint โดยส่งต่อระยะที่เหลือข้ามหัวมุม (ระยะเดินตรงตามความเร็ว × เวลา)
      let move = e.spd * dt;
      for (let guard = 0; move > 0 && guard < 16; guard++) {
        const dx = e.tx - e.x;
        const dy = e.ty - e.y;
        const d = Math.hypot(dx, dy);
        if (d <= move) {
          e.x = e.tx;
          e.y = e.ty;
          move -= d;
          if (e.exiting) {
            this.leak(e);
            break;
          }
          e.col = e.tc;
          e.row = e.tr;
          this.setNext(e);
        } else {
          e.x += (dx / d) * move;
          e.y += (dy / d) * move;
          move = 0;
        }
      }
    }
  }

  // ── TOWERS ──────────────────────────────────────────
  private updateTowers(dt: number): void {
    for (const tw of this.towers) {
      tw.cd = Math.max(0, tw.cd - dt);
      if (tw.cd > 0) continue;
      const tgt = pickTarget(tw, this.enemies, this.dist);
      if (!tgt) continue;
      tw.cd = 1 / tw.def.rate;
      tw.angle = Math.atan2(tgt.y - tw.y, tgt.x - tw.x);
      tw.aimId = tgt.id;
      this.projectiles.push({
        id: this.nextId++,
        kind: tw.kind,
        x: tw.x,
        y: tw.y,
        px: tw.x,
        py: tw.y,
        tgt,
        spd: tw.def.pspd,
        dmg: tw.def.dmg,
        aoe: tw.def.aoe,
        towerId: tw.id,
      });
      this.events.push({ type: 'towerFired', towerId: tw.id, kind: tw.kind, aoe: tw.def.aoe > 0 });
    }
  }

  private updateProjectiles(dt: number): void {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      const t = p.tgt;
      if (t.dead || t.leaked) continue; // เป้าตาย/หลุดก่อน → กระสุนหาย
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const d = Math.hypot(dx, dy);
      const mv = p.spd * dt;
      if (d <= mv + HIT_TOL) {
        this.impact(p);
      } else {
        p.x += (dx / d) * mv;
        p.y += (dy / d) * mv;
        keep.push(p);
      }
    }
    this.projectiles = keep;
  }

  private impact(p: Projectile): void {
    const t = p.tgt;
    if (p.aoe > 0) {
      const ar = p.aoe;
      for (const e of this.enemies) {
        if (e.dead || e.leaked) continue;
        const dd = Math.hypot(e.x - t.x, e.y - t.y);
        if (dd <= ar) this.hitEnemy(e, p.dmg * (1 - (dd / ar) * 0.4), p.towerId);
      }
    } else {
      this.hitEnemy(t, p.dmg, p.towerId);
    }
    this.events.push({ type: 'projectileImpact', kind: p.kind, x: t.x, y: t.y, aoe: p.aoe });
  }

  private hitEnemy(e: Enemy, dmg: number, towerId: number): void {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = HIT_FLASH_SEC;
    this.events.push({ type: 'enemyHit', id: e.id });
    if (e.hp <= 0) {
      e.dead = true;
      this.gold += Math.floor(e.def.reward * DIFF[this.difficulty].reward);
      this.kills++;
      const tw = this.towers.find((t) => t.id === towerId);
      if (tw) tw.kills++;
      this.events.push({ type: 'enemyKilled', id: e.id, kind: e.kind, x: e.x, y: e.y, towerId });
    }
  }

  // ── PLACEMENT ───────────────────────────────────────
  private previewCache: { c: number; r: number; version: number; dist: DistMap } | null = null;

  /** dist ถ้าวางป้อมที่ c,r (cache ตามช่อง+เวอร์ชันกริด) */
  private distIfPlaced(c: number, r: number): DistMap {
    const pc = this.previewCache;
    if (pc && pc.c === c && pc.r === r && pc.version === this.gridVersion) return pc.dist;
    this.grid.set(c, r, Cell.Tower);
    const d = computeDist(this.grid);
    this.grid.set(c, r, Cell.Empty);
    this.previewCache = { c, r, version: this.gridVersion, dist: d };
    return d;
  }

  /** เช็คว่าวางป้อมที่ช่องนี้ได้ไหม (ไม่รวมเงิน) — ใช้กับ ghost ตอนเล็งวาง */
  checkPlace(c: number, r: number): PlaceFail | null {
    const sf = staticFail(this.grid, c, r);
    if (sf) return sf;
    if (occupied(this.enemies, c, r)) return 'occupied';
    if (!pathValid(this.distIfPlaced(c, r), this.enemies, c, r)) return 'blocks';
    return null;
  }

  place(kind: TowerId, c: number, r: number): PlaceResult {
    const def = TOWERS[kind];
    if (this.gold < def.cost) return { ok: false, reason: 'gold' };
    const fail = this.checkPlace(c, r);
    if (fail) return { ok: false, reason: fail };

    this.dist = this.distIfPlaced(c, r);
    this.grid.set(c, r, Cell.Tower);
    this.gridVersion++;
    // ศัตรูที่กำลังเดินเข้าช่องนี้ → ย้อนกลับกึ่งกลางช่องเดิมแล้วหาทางใหม่
    for (const e of this.enemies) {
      if (e.def.fly || e.exiting || e.dead || e.leaked) continue;
      if (e.tc === c && e.tr === r) {
        e.tc = e.col;
        e.tr = e.row;
        e.tx = e.col + 0.5;
        e.ty = e.row + 0.5;
      }
    }
    this.gold -= def.cost;
    const tower: Tower = {
      id: this.nextId++,
      kind,
      def,
      c,
      r,
      x: c + 0.5,
      y: r + 0.5,
      cd: 0,
      totalCost: def.cost,
      kills: 0,
      angle: 0,
      aimId: -1,
      target: 'first',
    };
    this.towers.push(tower);
    this.events.push({ type: 'towerPlaced', id: tower.id, kind, c, r }, { type: 'gridChanged' });
    return { ok: true, tower };
  }

  towerAt(c: number, r: number): Tower | undefined {
    return this.towers.find((t) => t.c === c && t.r === r);
  }

  towerById(id: number): Tower | undefined {
    return this.towers.find((t) => t.id === id);
  }

  upgrade(id: number): UpgradeResult {
    const tw = this.towerById(id);
    const nxtId = tw?.def.upgTo;
    if (!tw || !nxtId) return { ok: false, reason: 'max' };
    const nxt = TOWERS[nxtId];
    if (this.gold < nxt.cost) return { ok: false, reason: 'gold' };
    this.gold -= nxt.cost;
    tw.totalCost += nxt.cost;
    tw.def = nxt;
    tw.kind = nxt.id;
    tw.cd = 0;
    this.events.push({ type: 'towerUpgraded', id, kind: nxt.id });
    return { ok: true };
  }

  sellValue(tw: Tower): number {
    return Math.floor(tw.totalCost * SELL_RATIO);
  }

  sell(id: number): boolean {
    const tw = this.towerById(id);
    if (!tw) return false;
    this.gold += this.sellValue(tw);
    this.grid.set(tw.c, tw.r, Cell.Empty);
    this.towers = this.towers.filter((t) => t !== tw);
    this.dist = computeDist(this.grid); // เปิดทางใหม่
    this.gridVersion++;
    this.events.push({ type: 'towerSold', id, c: tw.c, r: tw.r }, { type: 'gridChanged' });
    return true;
  }

  cycleTarget(id: number): void {
    const tw = this.towerById(id);
    if (!tw) return;
    const i = TARGET_MODES.indexOf(tw.target);
    tw.target = TARGET_MODES[(i + 1) % TARGET_MODES.length]!;
  }
}
