import type { Difficulty } from '../config/difficulty';
import type { GameMode } from '../config/waves';
import { readJson, writeJson } from './store';

/** สถิติสูงสุดแยกตามโหมด+ความยาก (key เก่า 'demonSwarmBest' ของเวอร์ชัน 2D ไม่แตะ) */
export const BEST_KEY = 'demonSwarmBest2';

export interface Best {
  wave: number;
  kills: number;
}

type BestTable = Record<string, Best>;

const slot = (mode: GameMode, diff: Difficulty) => `${mode}_${diff}`;

export function loadBest(mode: GameMode, diff: Difficulty): Best {
  const t = readJson<BestTable>(BEST_KEY);
  const b = t?.[slot(mode, diff)];
  return b && typeof b.wave === 'number' && typeof b.kills === 'number' ? b : { wave: 0, kills: 0 };
}

/** บันทึกถ้าดีกว่าเดิม (เวฟมากกว่า หรือเวฟเท่ากันแต่ฆ่ามากกว่า) คืนสถิติล่าสุด */
export function recordBest(mode: GameMode, diff: Difficulty, wave: number, kills: number): Best {
  const t = readJson<BestTable>(BEST_KEY) ?? {};
  const best = loadBest(mode, diff);
  if (wave > best.wave || (wave === best.wave && kills > best.kills)) {
    const nb = { wave, kills };
    t[slot(mode, diff)] = nb;
    writeJson(BEST_KEY, t);
    return nb;
  }
  return best;
}
