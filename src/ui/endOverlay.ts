import type { GameMode } from '../config/waves';
import { BASE_WAVES, waveTotalLabel } from '../core/waves';
import type { Best } from '../storage/best';
import { $ } from './dom';
import { S, fmt } from './strings';

/** หน้าจอจบเกม (ข้อความเดียวกับเวอร์ชันเดิม) */
export function showEnd(win: boolean, mode: GameMode, wave: number, kills: number, gold: number, best: Best): void {
  $('endTitle').textContent = win ? S.win : S.lose;
  const headline = win ? fmt.winHeadline(BASE_WAVES) : mode === 'endless' ? fmt.endlessHeadline(wave) : S.loseNormal;
  $('endSub').innerHTML = `${headline}<br>
    💀 ฆ่า: ${kills} ตัว | Wave: ${wave}/${waveTotalLabel(mode)} | 💰 Gold: ${gold}<br>
    🏅 สถิติสูงสุด: Wave ${best.wave} | ฆ่า ${best.kills} ตัว`;
  $('endOverlay').style.display = 'flex';
}

export function hideEnd(): void {
  $('endOverlay').style.display = 'none';
}
