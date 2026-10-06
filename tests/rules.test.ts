import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/config/enemies';
import { THEMES } from '../src/config/themes';
import { TARGET_NAME, TOWERS } from '../src/config/towers';
import { PLACE_FAIL, QUALITY_NAME, S, fmt } from '../src/ui/strings';

// กฎของโปรเจกต์ (ดู CLAUDE.md): ข้อความ UI ห้ามมีเครื่องหมายคำถาม, ห้ามใช้ alert/confirm/prompt, ทิศทาง import ระหว่างชั้น

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f: string) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const SRC = walk(join(ROOT, 'src')).filter((f) => f.endsWith('.ts'));

describe('ข้อความ UI', () => {
  it('index.html ไม่มีเครื่องหมายคำถามในข้อความ', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<link[^>]*>/g, '');
    const text = html.replace(/<[^>]+>/g, '\n');
    const attrs = [...html.matchAll(/(?:placeholder|title|alt|content)="([^"]*)"/g)].map((m) => m[1]);
    for (const t of [text, ...attrs]) expect(t).not.toContain('?');
  });

  it('ข้อความที่สร้างตอนเล่นไม่มีเครื่องหมายคำถาม', () => {
    const all: string[] = [
      ...Object.values(S),
      ...Object.values(PLACE_FAIL).filter((v): v is string => !!v),
      ...Object.values(QUALITY_NAME),
      ...Object.values(TARGET_NAME),
      ...Object.values(TOWERS).flatMap((t) => [t.name, t.desc]),
      ...Object.values(ENEMIES).map((e) => e.name),
      ...Object.values(THEMES).map((t) => t.name),
      fmt.bestMenu(3, 4),
      fmt.waveLabel(1, '10'),
      fmt.waveDone(1, '∞'),
      fmt.breakSub(2),
      fmt.speed(2),
      fmt.saved('a'),
      fmt.winHeadline(10),
      fmt.endlessHeadline(12),
      fmt.mapSub(1, 2),
    ];
    for (const t of all) expect(t, t).not.toContain('?');
  });

  it('ไม่มี alert / confirm / prompt ของเบราว์เซอร์', () => {
    for (const f of SRC) {
      const code = readFileSync(f, 'utf8');
      expect(code, relative(ROOT, f)).not.toMatch(/(?<![.\w])(alert|confirm|prompt)\s*\(/);
    }
  });
});

describe('ทิศทาง import ระหว่างชั้น', () => {
  // ชั้นล่างห้าม import ชั้นบน: config ← core ← storage ← {render, ui, audio, editor} ← app
  const ALLOWED: Record<string, string[]> = {
    config: ['config'],
    core: ['config', 'core'],
    storage: ['config', 'core', 'storage'],
    render: ['config', 'core', 'render'],
    ui: ['config', 'core', 'storage', 'ui'],
    audio: ['config', 'core', 'audio'],
    editor: ['config', 'core', 'storage', 'render', 'ui', 'editor'],
    app: ['config', 'core', 'storage', 'render', 'ui', 'audio', 'editor', 'app'],
  };
  it('แต่ละไฟล์ import ได้เฉพาะชั้นที่อนุญาต', () => {
    for (const f of SRC) {
      const rel = relative(join(ROOT, 'src'), f).replace(/\\/g, '/');
      const layer = rel.includes('/') ? rel.split('/')[0]! : 'app';
      const code = readFileSync(f, 'utf8');
      for (const m of code.matchAll(/from\s+'(\.[^']+)'/g)) {
        const target = join(f, '..', m[1]!);
        const trel = relative(join(ROOT, 'src'), target).replace(/\\/g, '/');
        const tlayer = trel.includes('/') ? trel.split('/')[0]! : 'app';
        expect(ALLOWED[layer], `${rel} → ${trel}`).toContain(tlayer);
      }
      // ชั้นที่ไม่วาดภาพห้ามใช้ three
      if (['config', 'core', 'storage', 'ui', 'audio'].includes(layer)) expect(code, rel).not.toMatch(/from\s+'three/);
      // EditorModel เป็นกติกาล้วน
      if (rel === 'editor/EditorModel.ts') expect(code).not.toMatch(/from\s+'\.\.\/(render|ui|storage)\//);
    }
  });
});
