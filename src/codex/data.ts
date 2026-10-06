// ตัวเลขของสารานุกรม — คำนวณจาก config ตรงๆ ทุกครั้ง (แก้ค่าเกมแล้วสารานุกรมเปลี่ยนตาม)
// ไฟล์นี้เป็นข้อมูลล้วน: ไม่แตะ DOM/ภาพ

import { BREAK_SEC, COLS, HIT_FLASH_SEC, REF_CELL_PX, ROWS, SELL_RATIO, SIM_DT, SIM_HZ, SPAWN_GUARD, START_GOLD, START_LIVES } from '../config/constants';
import { DIFF, DIFF_ORDER, type Difficulty } from '../config/difficulty';
import { ENEMIES, ENEMY_ORDER, type EnemyId } from '../config/enemies';
import { QUALITY, QUALITY_ORDER } from '../config/quality';
import { THEMES, THORDER } from '../config/themes';
import { TORDER, TOWERS, type TowerDef, type TowerId } from '../config/towers';
import { BASE_WAVES, WAVE_CFG, getWaveCfg } from '../config/waves';
import { FLY_EXIT_X, GROUND_EXIT_X } from '../core/targeting';

/** ค่าลดดาเมจระเบิดที่ขอบรัศมี (ตรงกับ Game.impact) */
export const AOE_EDGE_FALLOFF = 0.4;

// ── ป้อม ─────────────────────────────────────────────
export interface ChainStep {
  id: TowerId;
  /** ราคาขั้นนี้ (วางตรงหรืออัปเกรดเข้าขั้นนี้) */
  cost: number;
  /** เงินรวมถ้าเริ่มจากขั้นแรกแล้วอัปเกรดมาจนถึงขั้นนี้ */
  cumulative: number;
  /** ราคาขายเมื่ออัปเกรดมาถึงขั้นนี้ */
  sellUpgraded: number;
  /** ราคาขายเมื่อวางขั้นนี้ตรงๆ */
  sellDirect: number;
}

/** สายอัปเกรดทั้งหมด (เริ่มจากป้อมที่ไม่มีใครอัปเกรดมาถึง) */
export function upgradeChain(): ChainStep[] {
  const targets = new Set(TORDER.map((id) => TOWERS[id].upgTo).filter(Boolean));
  let cur: TowerId | null = TORDER.find((id) => !targets.has(id)) ?? TORDER[0]!;
  const out: ChainStep[] = [];
  let cum = 0;
  const seen = new Set<TowerId>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const t: TowerDef = TOWERS[cur];
    cum += t.cost;
    out.push({ id: cur, cost: t.cost, cumulative: cum, sellUpgraded: Math.floor(cum * SELL_RATIO), sellDirect: Math.floor(t.cost * SELL_RATIO) });
    cur = t.upgTo;
  }
  return out;
}

export interface TowerStats {
  id: TowerId;
  /** ดาเมจต่อวินาที (ต่อเป้าเดียว) */
  dps: number;
  dpsPerGold: number;
  /** ระยะเวลาระหว่างนัด (วินาที) */
  cooldown: number;
  /** ความเร็วกระสุน ช่อง/วินาที และค่า px/s เดิม */
  pspd: number;
  pspdPx: number;
  /** พื้นที่ครอบคลุม (ตารางช่อง) ≈ πr² */
  coverage: number;
  /** ลำดับในสายอัปเกรด (เริ่ม 1) */
  tier: number;
}

export function towerStats(id: TowerId): TowerStats {
  const t = TOWERS[id];
  const dps = t.dmg * t.rate;
  const tier = upgradeChain().findIndex((s) => s.id === id) + 1;
  return {
    id,
    dps,
    dpsPerGold: dps / t.cost,
    cooldown: 1 / t.rate,
    pspd: t.pspd,
    pspdPx: t.pspd * REF_CELL_PX,
    coverage: Math.PI * t.range * t.range,
    tier,
  };
}

// ── ศัตรู ────────────────────────────────────────────
export function enemyHp(id: EnemyId, wave: number, diff: Difficulty): number {
  return ENEMIES[id].hp * getWaveCfg(Math.max(1, wave)).sc * DIFF[diff].hp;
}

export function enemyReward(id: EnemyId, diff: Difficulty): number {
  return Math.floor(ENEMIES[id].reward * DIFF[diff].reward);
}

/** ระยะทางตรงจากจุดเกิดถึงจุดหลุด (ช่อง) */
export function straightDistance(id: EnemyId): number {
  return (ENEMIES[id].fly ? FLY_EXIT_X : GROUND_EXIT_X) - 0.5;
}

/** เวลาเดิน/บินข้ามสนามทางตรง (วินาที) — ทางจริงในเขาวงกตยาวกว่านี้ */
export function crossTime(id: EnemyId): number {
  return straightDistance(id) / ENEMIES[id].spd;
}

/** เวฟ 1-10 ที่ศัตรูชนิดนี้ปรากฏ */
export function wavesWithEnemy(id: EnemyId): number[] {
  const out: number[] = [];
  for (let n = 1; n <= BASE_WAVES; n++) {
    const w = WAVE_CFG[n - 1]!;
    if (id === 'boss' ? w.bIv > 0 : w.pool.includes(id)) out.push(n);
  }
  return out;
}

/** ดาเมจที่ต้องใช้ฆ่าศัตรูตัวนี้ ÷ DPS ของป้อม = เวลาที่ป้อมหนึ่งป้อมใช้ (วินาที) */
export function timeToKill(enemy: EnemyId, tower: TowerId, wave: number, diff: Difficulty): number {
  return enemyHp(enemy, wave, diff) / towerStats(tower).dps;
}

// ── เวฟ ──────────────────────────────────────────────
export interface WaveRow {
  n: number;
  dur: number;
  iv: number;
  sc: number;
  bIv: number;
  pool: readonly EnemyId[];
  /** จำนวนศัตรูปกติที่เกิด (จำลองแบบเดียวกับ Game.step) */
  spawns: number;
  bosses: number;
}

/** นับจำนวนเกิดด้วยตัวจับเวลาแบบเดียวกับ Game.step (dt คงที่) */
export function countSpawns(n: number): { spawns: number; bosses: number } {
  const cfg = getWaveCfg(n);
  let elapsed = 0;
  let spawnTimer = 0;
  let bossTimer = 0;
  let spawns = 0;
  let bosses = 0;
  const steps = Math.ceil(cfg.dur / SIM_DT) + 2;
  for (let i = 0; i < steps; i++) {
    elapsed += SIM_DT;
    if (elapsed > cfg.dur) break;
    spawnTimer += SIM_DT;
    if (spawnTimer >= cfg.iv) {
      spawnTimer -= cfg.iv;
      spawns++;
    }
    if (cfg.bIv > 0) {
      bossTimer += SIM_DT;
      if (bossTimer >= cfg.bIv) {
        bossTimer = 0;
        bosses++;
      }
    }
  }
  return { spawns, bosses };
}

export function waveRow(n: number): WaveRow {
  const c = getWaveCfg(n);
  return { n, dur: c.dur, iv: c.iv, sc: c.sc, bIv: c.bIv, pool: c.pool, ...countSpawns(n) };
}

export function waveTable(): WaveRow[] {
  return Array.from({ length: BASE_WAVES }, (_, i) => waveRow(i + 1));
}

/** เส้นโค้งโหมดไม่สิ้นสุด */
export function endlessCurve(from = BASE_WAVES + 1, to = 40): WaveRow[] {
  const out: WaveRow[] = [];
  for (let n = from; n <= to; n++) out.push(waveRow(n));
  return out;
}

/** เงินรางวัลสูงสุดโดยประมาณของเวฟ (ฆ่าครบทุกตัว ใช้ค่าเฉลี่ยของ pool) */
export function waveGold(n: number, diff: Difficulty): number {
  const r = waveRow(n);
  const avg = r.pool.reduce((s, id) => s + enemyReward(id, diff), 0) / r.pool.length;
  return Math.round(avg * r.spawns + enemyReward('boss', diff) * r.bosses);
}

// ── ระเบิด ───────────────────────────────────────────
/** ตัวคูณดาเมจตามระยะห่างจากจุดระเบิด (d = 0..r) */
export function aoeMultiplier(d: number, r: number): number {
  if (d > r) return 0;
  return 1 - (d / r) * AOE_EDGE_FALLOFF;
}

// ── ตารางค่าที่ปรับได้ ───────────────────────────────
export interface Tunable {
  group: string;
  label: string;
  value: string;
  /** ไฟล์ → ตัวแปรที่ต้องแก้ */
  path: string;
}

const fmtN = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))));

export function tunables(): Tunable[] {
  const C = 'config/constants.ts';
  const rows: Tunable[] = [
    { group: 'สนามและกติกา', label: 'ขนาดสนาม (คอลัมน์ × แถว)', value: `${COLS} × ${ROWS}`, path: `${C} → COLS, ROWS` },
    { group: 'สนามและกติกา', label: 'โซนห้ามวางฝั่งซ้าย (คอลัมน์)', value: fmtN(SPAWN_GUARD), path: `${C} → SPAWN_GUARD` },
    { group: 'สนามและกติกา', label: 'เวลาพักระหว่างเวฟ (วินาที)', value: fmtN(BREAK_SEC), path: `${C} → BREAK_SEC` },
    { group: 'สนามและกติกา', label: 'เงินเริ่มต้น', value: fmtN(START_GOLD), path: `${C} → START_GOLD` },
    { group: 'สนามและกติกา', label: 'ชีวิตเริ่มต้น (ศัตรูหลุดได้)', value: fmtN(START_LIVES), path: `${C} → START_LIVES` },
    { group: 'สนามและกติกา', label: 'สัดส่วนเงินคืนเมื่อขาย', value: `${fmtN(SELL_RATIO * 100)}%`, path: `${C} → SELL_RATIO` },
    { group: 'สนามและกติกา', label: 'ดาเมจระเบิดลดลงที่ขอบรัศมี', value: `${fmtN(AOE_EDGE_FALLOFF * 100)}%`, path: 'core/Game.ts → impact()' },
    { group: 'สนามและกติกา', label: 'เวลากะพริบตอนโดนยิง (วินาที)', value: fmtN(HIT_FLASH_SEC), path: `${C} → HIT_FLASH_SEC` },
    { group: 'สนามและกติกา', label: 'ความถี่จำลองเกม (ครั้ง/วินาที)', value: fmtN(SIM_HZ), path: `${C} → SIM_HZ` },
    { group: 'สนามและกติกา', label: 'ขนาดช่องอ้างอิง (ปรับความเร็วทั้งเกม)', value: `${fmtN(REF_CELL_PX)} px`, path: `${C} → REF_CELL_PX` },
  ];
  for (const id of TORDER) {
    const t = TOWERS[id];
    const p = `config/towers.ts → TOWERS.${id}`;
    const g = `ป้อม: ${t.emoji} ${t.name}`;
    rows.push(
      { group: g, label: 'ราคา', value: fmtN(t.cost), path: `${p}.cost` },
      { group: g, label: 'ระยะยิง (ช่อง)', value: fmtN(t.range), path: `${p}.range` },
      { group: g, label: 'ดาเมจต่อนัด', value: fmtN(t.dmg), path: `${p}.dmg` },
      { group: g, label: 'นัดต่อวินาที', value: fmtN(t.rate), path: `${p}.rate` },
      { group: g, label: 'ความเร็วกระสุน (px/s เดิม)', value: fmtN(Math.round(t.pspd * REF_CELL_PX)), path: `${p}.pspd` },
      { group: g, label: 'รัศมีระเบิด (ช่อง)', value: t.aoe ? fmtN(t.aoe) : '-', path: `${p}.aoe` },
      { group: g, label: 'อัปเกรดเป็น', value: t.upgTo ? TOWERS[t.upgTo].name : '-', path: `${p}.upgTo` },
    );
  }
  for (const id of ENEMY_ORDER) {
    const e = ENEMIES[id];
    const p = `config/enemies.ts → ENEMIES.${id}`;
    const g = `ศัตรู: ${e.emoji} ${e.name}`;
    rows.push(
      { group: g, label: 'เลือดพื้นฐาน', value: fmtN(e.hp), path: `${p}.hp` },
      { group: g, label: 'ความเร็ว (px/s เดิม)', value: fmtN(Math.round(e.spd * REF_CELL_PX)), path: `${p}.spd` },
      { group: g, label: 'เงินรางวัล', value: fmtN(e.reward), path: `${p}.reward` },
      { group: g, label: 'ขนาดตัว', value: fmtN(e.sz), path: `${p}.sz` },
      { group: g, label: 'บินข้ามป้อม', value: e.fly ? 'ใช่' : 'ไม่', path: `${p}.fly` },
    );
  }
  WAVE_CFG.forEach((w, i) => {
    rows.push({
      group: 'เวฟ (โหมด 10 เวฟ)',
      label: `Wave ${i + 1}`,
      value: `${w.dur} วิ · ทุก ${w.iv} วิ · เลือด ×${w.sc}${w.bIv ? ` · บอสทุก ${w.bIv} วิ` : ''}`,
      path: `config/waves.ts → WAVE_CFG[${i}]`,
    });
  });
  rows.push(
    { group: 'เวฟ (โหมดไม่สิ้นสุด)', label: 'เวลาปล่อยศัตรูต่อเวฟ', value: '48 วิ', path: 'config/waves.ts → getWaveCfg() dur' },
    { group: 'เวฟ (โหมดไม่สิ้นสุด)', label: 'ช่วงเกิด', value: 'max(0.45, 0.72 − 0.03×n)', path: 'config/waves.ts → getWaveCfg() iv' },
    { group: 'เวฟ (โหมดไม่สิ้นสุด)', label: 'ตัวคูณเลือด', value: '3.0 × 1.16ⁿ', path: 'config/waves.ts → getWaveCfg() sc' },
    { group: 'เวฟ (โหมดไม่สิ้นสุด)', label: 'รอบบอส', value: 'max(7, 12 − 0.4×n) วิ', path: 'config/waves.ts → getWaveCfg() bIv' },
  );
  for (const d of DIFF_ORDER) {
    rows.push({ group: 'ความยาก', label: d, value: `เลือด ×${DIFF[d].hp} · เงิน ×${DIFF[d].reward}`, path: `config/difficulty.ts → DIFF.${d}` });
  }
  for (const id of THORDER) {
    const t = THEMES[id];
    rows.push({ group: 'ธีมแมพ', label: `${t.emoji} ${t.name}`, value: `แอ่งน้ำ ${t.ponds[0]}-${t.ponds[1]} · สิ่งกีดขวาง: ${t.obs.join(', ')}`, path: `config/themes.ts → THEMES.${id}` });
  }
  for (const q of QUALITY_ORDER) {
    const c = QUALITY[q];
    rows.push({ group: 'คุณภาพภาพ', label: q, value: `pixelRatio ≤${c.maxPixelRatio} · เงา ${c.shadowMap || 'ไม่มี'} · bloom ${c.post ? 'มี' : 'ไม่มี'} · อนุภาค ${c.particles}`, path: `config/quality.ts → QUALITY.${q}` });
  }
  return rows;
}
