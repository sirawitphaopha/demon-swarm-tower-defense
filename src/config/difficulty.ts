export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DiffCfg {
  /** ตัวคูณเลือดศัตรู */
  hp: number;
  /** ตัวคูณเงินรางวัล */
  reward: number;
}

export const DIFF: Record<Difficulty, DiffCfg> = {
  easy: { hp: 0.7, reward: 1.3 },
  normal: { hp: 1, reward: 1 },
  hard: { hp: 1.4, reward: 0.8 },
};

export const DIFF_ORDER: readonly Difficulty[] = ['easy', 'normal', 'hard'];
