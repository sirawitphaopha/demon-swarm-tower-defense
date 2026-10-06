import { DIFF, type Difficulty } from '../config/difficulty';
import { QUALITY, type Quality } from '../config/quality';
import { THEMES, type ThemeId } from '../config/themes';
import type { GameMode } from '../config/waves';
import { readJson, writeJson } from './store';

export const SETTINGS_KEY = 'demonSwarmSettings';

export interface Settings {
  difficulty: Difficulty;
  mode: GameMode;
  theme: ThemeId;
  quality: Quality;
  muted: boolean;
  /** ปรับคุณภาพลงอัตโนมัติไปแล้ว (ทำครั้งเดียว) */
  autoQualityDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'normal',
  mode: 'normal',
  theme: 'meadow',
  quality: 'high',
  muted: false,
  autoQualityDone: false,
};

export function loadSettings(): Settings {
  const s = readJson<Partial<Settings>>(SETTINGS_KEY) ?? {};
  return {
    difficulty: s.difficulty && s.difficulty in DIFF ? s.difficulty : DEFAULT_SETTINGS.difficulty,
    mode: s.mode === 'endless' || s.mode === 'normal' ? s.mode : DEFAULT_SETTINGS.mode,
    theme: s.theme && s.theme in THEMES ? s.theme : DEFAULT_SETTINGS.theme,
    quality: s.quality && s.quality in QUALITY ? s.quality : DEFAULT_SETTINGS.quality,
    muted: s.muted === true,
    autoQualityDone: s.autoQualityDone === true,
  };
}

export function saveSettings(s: Settings): void {
  writeJson(SETTINGS_KEY, s);
}
