import type { Difficulty } from '../config/difficulty';
import type { Quality } from '../config/quality';
import type { ThemeId } from '../config/themes';
import type { GameMode } from '../config/waves';
import type { Settings } from '../storage/settings';
import { $, setDisplay } from './dom';
import { fmt } from './strings';

export type ScreenId = 'menuScreen' | 'settingsScreen' | 'helpScreen' | 'mapsScreen';
const FULL: readonly ScreenId[] = ['menuScreen', 'settingsScreen', 'helpScreen', 'mapsScreen'];

export interface ScreenActions {
  start(): void;
  editor(): void;
  quit(): void;
  nav(id: ScreenId): void;
  setDifficulty(d: Difficulty): void;
  setMode(m: GameMode): void;
  setTheme(t: ThemeId): void;
  setQuality(q: Quality): void;
}

/** หน้าจอเต็ม (เมนู/ตั้งค่า/วิธีเล่น/แมพของฉัน) + การสลับไปเกม/หน้าสร้างแมพ */
export class Screens {
  constructor(a: ScreenActions) {
    $('btnStart').addEventListener('click', a.start);
    $('btnEditor').addEventListener('click', a.editor);
    document.querySelectorAll<HTMLElement>('[data-nav]').forEach((b) => b.addEventListener('click', () => a.nav(b.dataset.nav as ScreenId)));
    document.querySelectorAll<HTMLElement>('[data-action="quit"]').forEach((b) => b.addEventListener('click', a.quit));
    document.querySelectorAll<HTMLElement>('[data-diff]').forEach((b) => b.addEventListener('click', () => a.setDifficulty(b.dataset.diff as Difficulty)));
    document.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.addEventListener('click', () => a.setMode(b.dataset.mode as GameMode)));
    document.querySelectorAll<HTMLElement>('[data-theme]').forEach((b) => b.addEventListener('click', () => a.setTheme(b.dataset.theme as ThemeId)));
    document.querySelectorAll<HTMLElement>('[data-quality]').forEach((b) => b.addEventListener('click', () => a.setQuality(b.dataset.quality as Quality)));
  }

  /** แสดงหน้าจอเต็มหนึ่งหน้า (ซ่อนเกม/หน้าสร้างแมพ) */
  show(id: ScreenId): void {
    for (const s of FULL) setDisplay($(s), s === id ? 'flex' : 'none');
    setDisplay($('gameUI'), 'none');
    setDisplay($('editorScreen'), 'none');
    document.body.classList.remove('paused');
  }

  showGame(): void {
    for (const s of FULL) setDisplay($(s), 'none');
    setDisplay($('editorScreen'), 'none');
    setDisplay($('gameUI'), 'block');
    setDisplay($('endOverlay'), 'none');
  }

  showEditor(): void {
    for (const s of FULL) setDisplay($(s), 'none');
    setDisplay($('gameUI'), 'none');
    setDisplay($('editorScreen'), 'block');
    document.body.classList.remove('paused');
  }

  /** ปุ่มตั้งค่าที่เลือกอยู่ */
  syncSettings(s: Settings): void {
    const sel = (attr: string, v: string) =>
      document.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((b) => b.classList.toggle('sel', b.dataset[attr] === v));
    sel('diff', s.difficulty);
    sel('mode', s.mode);
    sel('theme', s.theme);
    sel('quality', s.quality);
  }

  setBest(wave: number, kills: number): void {
    $('bestMenu').textContent = wave > 0 ? fmt.bestMenu(wave, kills) : '';
  }
}
