import { BASE_WAVES, type GameMode } from '../config/waves';

export { getWaveCfg, BASE_WAVES } from '../config/waves';

/** ชนะเมื่อเคลียร์ครบ 10 เวฟในโหมดปกติ (โหมดไม่สิ้นสุดไม่มีชนะ) */
export function isWin(mode: GameMode, wave: number): boolean {
  return mode === 'normal' && wave >= BASE_WAVES;
}

/** ข้อความจำนวนเวฟทั้งหมด */
export function waveTotalLabel(mode: GameMode): string {
  return mode === 'endless' ? '∞' : String(BASE_WAVES);
}
