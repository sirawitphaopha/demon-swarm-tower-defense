import type { EnemyId } from '../config/enemies';
import type { TowerId } from '../config/towers';

/** เหตุการณ์ที่เกิดระหว่างจำลองเกม — App ดึงออกครั้งเดียวต่อเฟรม ส่งให้ภาพ/เสียง/UI */
export type GameEvent =
  | { type: 'enemySpawned'; id: number; kind: EnemyId; boss: boolean }
  | { type: 'enemyHit'; id: number }
  | { type: 'enemyKilled'; id: number; kind: EnemyId; x: number; y: number; towerId: number }
  | { type: 'enemyLeaked'; id: number; kind: EnemyId; x: number; y: number }
  | { type: 'towerFired'; towerId: number; kind: TowerId; aoe: boolean }
  | { type: 'projectileImpact'; kind: TowerId; x: number; y: number; aoe: number }
  | { type: 'towerPlaced'; id: number; kind: TowerId; c: number; r: number }
  | { type: 'towerUpgraded'; id: number; kind: TowerId }
  | { type: 'towerSold'; id: number; c: number; r: number }
  | { type: 'gridChanged' }
  | { type: 'phaseChanged'; phase: Phase; wave: number }
  | { type: 'gameOver'; win: boolean };

export type Phase = 'playing' | 'break';
