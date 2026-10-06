export type ThemeId = 'meadow' | 'forest' | 'bloom' | 'oasis';
export type ObstacleType = 'tree' | 'pine' | 'blossom' | 'palm' | 'rock';
export type DecorType = 'grass' | 'flower' | 'bush';

export const OBSTACLE_TYPES: readonly ObstacleType[] = ['tree', 'pine', 'blossom', 'palm', 'rock'];
export const DECOR_TYPES: readonly DecorType[] = ['grass', 'flower', 'bush'];

export interface ThemeDef {
  id: ThemeId;
  name: string;
  emoji: string;
  /** สีหญ้าฝั่งบน → ล่างของสนาม */
  top: string;
  bot: string;
  /** สีจุดลายหญ้า */
  tex: string;
  /** ชนิดสิ่งกีดขวางที่สุ่ม (และที่เครื่องมือ "ต้นไม้" ในหน้าสร้างแมพใช้) */
  obs: readonly ObstacleType[];
  /** ชนิดของตกแต่งที่สุ่ม */
  dec: readonly DecorType[];
  /** จำนวนแอ่งน้ำสุ่ม [ต่ำสุด, สูงสุด] */
  ponds: readonly [number, number];
  // ── ฉาก 3D ──
  /** ท้องฟ้า (บน → ขอบฟ้า) */
  sky: string;
  horizon: string;
  /** สีเนินรอบสนาม */
  hill: string;
  /** สีดินด้านข้างเกาะ */
  soil: string;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  meadow: { id: 'meadow', name: 'ทุ่งหญ้า',   emoji: '🌳', top: '#9be84f', bot: '#73cf38', tex: '#3c9614', obs: ['tree'],         dec: ['grass', 'flower'],  ponds: [1, 2], sky: '#7cc8ff', horizon: '#e4f6ff', hill: '#6cc23a', soil: '#8a5a32' },
  forest: { id: 'forest', name: 'ป่าสน',      emoji: '🌲', top: '#86d843', bot: '#5fb82d', tex: '#28780f', obs: ['pine', 'rock'],  dec: ['grass', 'bush'],    ponds: [1, 2], sky: '#8cc4e8', horizon: '#e8f4ee', hill: '#4f9f2c', soil: '#7a4e2c' },
  bloom:  { id: 'bloom',  name: 'ทุ่งดอกไม้', emoji: '🌸', top: '#aef061', bot: '#8ce046', tex: '#50aa1e', obs: ['blossom'],      dec: ['flower', 'flower'], ponds: [1, 2], sky: '#a8d4ff', horizon: '#fff0f6', hill: '#86d24a', soil: '#946038' },
  oasis:  { id: 'oasis',  name: 'โอเอซิส',    emoji: '🏝️', top: '#a4e85a', bot: '#7ad84a', tex: '#46a028', obs: ['palm'],         dec: ['grass', 'flower'],  ponds: [2, 3], sky: '#6cc4f4', horizon: '#fff6dc', hill: '#c8d27a', soil: '#b48450' },
};

export const THORDER: readonly ThemeId[] = ['meadow', 'forest', 'bloom', 'oasis'];
