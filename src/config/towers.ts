import { px } from './constants';

export type TowerId = 'stone' | 'arrow' | 'crossbow' | 'cannon' | 'machinegun' | 'laser';

export interface TowerDef {
  id: TowerId;
  name: string;
  emoji: string;
  cost: number;
  /** ระยะยิง (ช่อง) */
  range: number;
  dmg: number;
  /** นัดต่อวินาที */
  rate: number;
  /** ความเร็วกระสุน (ช่อง/วินาที) — คำนวณจากค่า px/s เดิม */
  pspd: number;
  /** จำนวนนัดต่อหนึ่งชุดกระสุน ยิงครบแล้วต้องหยุดเติม */
  mag: number;
  /** เวลาเติมกระสุน (วินาที) */
  reload: number;
  /** รัศมีระเบิด (ช่อง) 0 = ไม่มี */
  aoe: number;
  /** สีประจำป้อม (วงระยะยิง/แสง/กระสุน) */
  glow: string;
  upgTo: TowerId | null;
  desc: string;
}

export const TOWERS: Record<TowerId, TowerDef> = {
  stone:      { id: 'stone',      name: 'หินขว้าง', emoji: '🪨', cost: 50,  range: 2.5, dmg: 18,  rate: 1.0, pspd: px(180), mag: 6, reload: 1.5, aoe: 0,   glow: '#b0a090', upgTo: 'arrow',      desc: 'ขว้างหิน ช้าแต่ถูก' },
  arrow:      { id: 'arrow',      name: 'หอธนู',    emoji: '🏹', cost: 100, range: 3.5, dmg: 32,  rate: 1.8, pspd: px(360), mag: 6, reload: 2.5, aoe: 0,   glow: '#70c050', upgTo: 'crossbow',   desc: 'ยิงธนู ระยะไกล' },
  crossbow:   { id: 'crossbow',   name: 'ครอสโบว์', emoji: '🎯', cost: 180, range: 4.0, dmg: 55,  rate: 2.5, pspd: px(480), mag: 10, reload: 3, aoe: 0,   glow: '#d08030', upgTo: 'cannon',     desc: 'แม่นยำ ยิงเร็ว' },
  cannon:     { id: 'cannon',     name: 'ปืนใหญ่',  emoji: '💣', cost: 320, range: 3.0, dmg: 120, rate: 0.7, pspd: px(260), mag: 3, reload: 3.5, aoe: 1.2, glow: '#7070c0', upgTo: 'machinegun', desc: 'ระเบิด AOE' },
  machinegun: { id: 'machinegun', name: 'ปืนกล',    emoji: '🔫', cost: 500, range: 3.8, dmg: 28,  rate: 5.0, pspd: px(620), mag: 30, reload: 4, aoe: 0,   glow: '#d0a030', upgTo: 'laser',      desc: 'ยิงเร็วมาก' },
  laser:      { id: 'laser',      name: 'เลเซอร์',  emoji: '⚡', cost: 800, range: 5.5, dmg: 150, rate: 2.5, pspd: px(950), mag: 10, reload: 4, aoe: 0,   glow: '#4090ff', upgTo: null,         desc: 'พลังสูง ระยะไกล' },
};

/** ลำดับปุ่มป้อม (คีย์ลัด 1-6) */
export const TORDER: readonly TowerId[] = ['stone', 'arrow', 'crossbow', 'cannon', 'machinegun', 'laser'];

export type TargetMode = 'first' | 'last' | 'strong' | 'weak';
export const TARGET_MODES: readonly TargetMode[] = ['first', 'last', 'strong', 'weak'];
export const TARGET_NAME: Record<TargetMode, string> = { first: 'หน้าสุด', last: 'หลังสุด', strong: 'เลือดมาก', weak: 'เลือดน้อย' };
