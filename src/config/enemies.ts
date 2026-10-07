import { px } from './constants';

export type EnemyId = 'maggot' | 'beetle' | 'scarab' | 'wasp' | 'spider' | 'boss';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  emoji: string;
  hp: number;
  /** ความเร็ว (ช่อง/วินาที) — คำนวณจากค่า px/s เดิม */
  spd: number;
  reward: number;
  /** สีลำตัว */
  col: string;
  /** ขนาดตัว (สัดส่วนของช่อง) */
  sz: number;
  /** บินตรงข้ามทุกอย่าง ไม่สนกริด */
  fly: boolean;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  maggot: { id: 'maggot', name: 'หนอนปีศาจ', emoji: '🐛', hp: 70,   spd: px(55),  reward: 10,  col: '#7a3a1a', sz: 0.38, fly: false },
  beetle: { id: 'beetle', name: 'ด้วงนรก',   emoji: '🪲', hp: 45,   spd: px(100), reward: 12,  col: '#2a5a1a', sz: 0.33, fly: false },
  scarab: { id: 'scarab', name: 'มอดเกราะ',  emoji: '🦗', hp: 240,  spd: px(38),  reward: 28,  col: '#6a5a10', sz: 0.48, fly: false },
  wasp:   { id: 'wasp',   name: 'แตนปีศาจ',  emoji: '🦟', hp: 90,   spd: px(115), reward: 15,  col: '#7a2080', sz: 0.36, fly: true },
  spider: { id: 'spider', name: 'แมงมุมผี',  emoji: '🕷️', hp: 150,  spd: px(72),  reward: 20,  col: '#3a1a6a', sz: 0.43, fly: false },
  boss:   { id: 'boss',   name: 'ราชาแมลง',  emoji: '👾', hp: 1100, spd: px(30),  reward: 100, col: '#8a1010', sz: 0.70, fly: false },
};

export const ENEMY_ORDER: readonly EnemyId[] = ['maggot', 'beetle', 'scarab', 'wasp', 'spider', 'boss'];
