import { COLS, SELL_RATIO } from '../config/constants';
import { DIFF, DIFF_ORDER, type Difficulty } from '../config/difficulty';
import { ENEMIES, ENEMY_ORDER, type EnemyId } from '../config/enemies';
import { OBSTACLE_TYPES, THEMES, THORDER, type ObstacleType } from '../config/themes';
import { TORDER, TOWERS, type TowerId } from '../config/towers';
import { BASE_WAVES } from '../config/waves';
import { ModelViewer, type ViewModel } from '../render/ModelViewer';
import { $, escapeHtml } from '../ui/dom';
import { barChart, columnChart, hideTip, lineChart } from './charts';
import {
  CATEGORIES,
  CONTROLS,
  ENEMY_TEXT,
  FORMULAS,
  HOWTO,
  MECHANICS,
  OBSTACLE_TEXT,
  THEME_TEXT,
  TOWER_TEXT,
  TUNING_INTRO,
  type CategoryId,
  type Section,
} from './content';
import { aoeMultiplier, crossTime, endlessCurve, enemyHp, enemyReward, timeToKill, towerStats, tunables, upgradeChain, waveGold, waveTable, wavesWithEnemy } from './data';
import { pathDemo, targetingDemo } from './demos';

export interface CodexHost {
  /** สารานุกรมเปิด (หยุดเกม/ปิดอินพุตเกม) */
  onOpen(): void;
  onClose(): void;
}

const PREFIX = '#codex';
const num = (v: number, d = 2) => v.toLocaleString('th-TH', { maximumFractionDigits: d });
const DIFF_NAME: Record<Difficulty, string> = { easy: '🟢 ง่าย', normal: '🟡 ปกติ', hard: '🔴 ยาก' };

/** HTML string → fragment (ใช้กับเนื้อหาของเกมเองเท่านั้น) */
function frag(html: string): DocumentFragment {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content;
}

const sectionHtml = (s: Section) => `<section class="cx-section"><h3>${s.title}</h3>${s.body.map((p) => `<p>${p}</p>`).join('')}</section>`;
const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ');

interface SearchItem {
  title: string;
  sub: string;
  href: string;
  hay: string;
}

/** สารานุกรมในเกม: หมวด/การ์ด/รายละเอียด + ลิงก์ตรงผ่าน #codex/... */
export class Codex {
  isOpen = false;
  private screen = $('codexScreen');
  private main = $('cxMain');
  private nav = $('cxNav');
  private search = $<HTMLInputElement>('cxSearch');
  private crumb = $('cxCrumb');
  private viewer: ModelViewer | null = null;
  private thumbs = new Map<string, string>();
  private route: string[] = [];
  private index: SearchItem[] | null = null;
  private viewerHost: HTMLElement | null = null;

  constructor(private host: CodexHost) {
    this.nav.replaceChildren(
      frag(
        `<a class="cx-nav-item" href="${PREFIX}" data-cat="">🏠 หน้าแรก</a>` +
          CATEGORIES.map((c) => `<a class="cx-nav-item" href="${PREFIX}/${c.id}" data-cat="${c.id}">${c.icon} ${c.title}</a>`).join(''),
      ),
    );
    $('cxClose').addEventListener('click', () => this.close());
    this.search.addEventListener('input', () => this.transition(() => this.render()));
    window.addEventListener('hashchange', () => this.sync());
  }

  // ── เปิด/ปิด/เส้นทาง ───────────────────────────────
  /** เปิดที่เส้นทาง เช่น '' / 'towers' / 'towers/laser' */
  openAt(route = ''): void {
    const target = route ? `${PREFIX}/${route}` : PREFIX;
    if (location.hash === target) this.sync();
    else location.hash = target;
  }

  /** อ่าน location.hash แล้วเปิด/ปิด/วาดหน้าตามนั้น */
  sync(): void {
    const h = decodeURIComponent(location.hash);
    if (h === PREFIX || h.startsWith(`${PREFIX}/`)) {
      const route = h.slice(PREFIX.length + 1).split('/').filter(Boolean);
      const first = !this.isOpen;
      if (first) {
        this.isOpen = true;
        this.screen.style.display = 'grid';
        this.host.onOpen();
      }
      this.route = route;
      this.search.value = '';
      if (first) this.render();
      else this.transition(() => this.render());
      this.main.scrollTop = 0;
    } else if (this.isOpen) this.close(false);
  }

  close(fromButton = true): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.screen.style.display = 'none';
    hideTip();
    this.detachViewer();
    if (fromButton && location.hash.startsWith(PREFIX)) history.replaceState(null, '', location.pathname + location.search);
    this.host.onClose();
  }

  /** Esc: รายละเอียด → หมวด → หน้าแรก → ปิด */
  back(): void {
    if (this.search.value) {
      this.search.value = '';
      this.render();
      return;
    }
    if (this.route.length >= 2) location.hash = `${PREFIX}/${this.route[0]}`;
    else if (this.route.length === 1) location.hash = PREFIX;
    else this.close();
  }

  /** เรียกจากลูปหลักของ App */
  frame(dt: number): void {
    if (this.viewer && this.viewerHost?.isConnected) this.viewer.frame(dt);
  }

  private transition(fn: () => void): void {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (doc.startViewTransition && !reduce) doc.startViewTransition(fn);
    else fn();
  }

  private getViewer(): ModelViewer {
    this.viewer ??= new ModelViewer();
    return this.viewer;
  }

  private detachViewer(): void {
    this.viewerHost = null;
    this.viewer?.canvas.remove();
  }

  private thumb(key: string, m: ViewModel): string {
    let url = this.thumbs.get(key);
    if (!url) {
      try {
        url = this.getViewer().snapshot(m);
      } catch {
        url = '';
      }
      this.thumbs.set(key, url);
    }
    return url;
  }

  // ── วาดหน้า ────────────────────────────────────────
  private render(): void {
    hideTip();
    this.detachViewer();
    const q = this.search.value.trim();
    const [cat, id] = this.route as [CategoryId | undefined, string | undefined];
    this.nav.querySelectorAll<HTMLElement>('.cx-nav-item').forEach((a) => a.classList.toggle('sel', !q && (a.dataset.cat ?? '') === (cat ?? '')));
    this.main.replaceChildren();
    if (q) {
      this.setCrumb([['สารานุกรม', ''], [`ผลการค้นหา "${q}"`, null]]);
      this.renderSearch(q);
      return;
    }
    const c = CATEGORIES.find((x) => x.id === cat);
    if (!c) {
      this.setCrumb([['สารานุกรม', null]]);
      this.renderHome();
      return;
    }
    if (cat === 'towers' && id && id in TOWERS) return this.renderTower(id as TowerId);
    if (cat === 'enemies' && id && id in ENEMIES) return this.renderEnemy(id as EnemyId);
    if (cat === 'themes' && id && (OBSTACLE_TYPES as readonly string[]).includes(id)) return this.renderProp(id as ObstacleType);
    this.setCrumb([['สารานุกรม', ''], [`${c.icon} ${c.title}`, null]]);
    const head = frag(`<header class="cx-page-head"><h2>${c.icon} ${c.title}</h2><p>${c.blurb}</p></header>`);
    this.main.appendChild(head);
    switch (c.id) {
      case 'howto':
        this.main.appendChild(frag(HOWTO.map(sectionHtml).join('')));
        break;
      case 'controls':
        this.renderControls();
        break;
      case 'towers':
        this.renderTowers();
        break;
      case 'enemies':
        this.renderEnemies();
        break;
      case 'waves':
        this.renderWaves();
        break;
      case 'difficulty':
        this.renderDifficulty();
        break;
      case 'mechanics':
        this.renderMechanics();
        break;
      case 'themes':
        this.renderThemes();
        break;
      case 'tuning':
        this.renderTuning();
        break;
    }
  }

  private setCrumb(items: [string, string | null][]): void {
    this.crumb.replaceChildren(
      ...items.flatMap(([label, href], i) => {
        const node = href === null ? document.createElement('span') : document.createElement('a');
        node.textContent = label;
        if (href !== null) (node as HTMLAnchorElement).href = href ? `${PREFIX}/${href}` : PREFIX;
        return i ? [document.createTextNode(' › '), node] : [node];
      }),
    );
  }

  private renderHome(): void {
    const tile = (v: string, l: string) => `<div class="cx-stat"><b>${v}</b><span>${l}</span></div>`;
    this.main.appendChild(
      frag(`
      <header class="cx-hero">
        <h2>📚 สารานุกรม Demon Swarm TD</h2>
        <p>รวมทุกอย่างของเกมไว้ในที่เดียว ทั้งวิธีเล่น ตัวคูณ และกลไกเบื้องหลัง ตัวเลขทุกตัวดึงจากโค้ดของเกมโดยตรง จึงตรงกับเกมจริงเสมอ</p>
        <div class="cx-stats">
          ${tile(String(TORDER.length), 'ป้อม')}${tile(String(ENEMY_ORDER.length), 'ศัตรู')}${tile(`${BASE_WAVES} + ∞`, 'เวฟ')}${tile(String(THORDER.length), 'ธีมแมพ')}
        </div>
      </header>
      <div class="cx-cards cats">
        ${CATEGORIES.map((c) => `<a class="cx-card cat" href="${PREFIX}/${c.id}"><span class="ic">${c.icon}</span><b>${c.title}</b><span>${c.blurb}</span></a>`).join('')}
      </div>`),
    );
  }

  private renderControls(): void {
    this.main.appendChild(
      frag(
        CONTROLS.map(
          (g) => `<section class="cx-section"><h3>${g.group}</h3><table class="cx-table"><tbody>${g.rows.map(([a, k]) => `<tr><td>${a}</td><td class="keys">${k}</td></tr>`).join('')}</tbody></table></section>`,
        ).join(''),
      ),
    );
  }

  // ── ป้อม ───────────────────────────────────────────
  private renderTowers(): void {
    const cards = TORDER.map((id) => {
      const t = TOWERS[id];
      const s = towerStats(id);
      return `<a class="cx-card unit" href="${PREFIX}/towers/${id}" style="view-transition-name: cx-t-${id}">
        <img src="${this.thumb(`t-${id}`, { kind: 'tower', id })}" alt="" loading="lazy">
        <b>${t.emoji} ${t.name}</b><span class="role">${TOWER_TEXT[id].role}</span>
        <span class="meta">💰${t.cost} · DPS ${num(s.dps, 1)}</span></a>`;
    }).join('');
    this.main.appendChild(frag(`<div class="cx-cards units">${cards}</div>`));
    const charts = document.createElement('div');
    charts.className = 'cx-grid2';
    charts.append(
      barChart(
        TORDER.map((id) => ({ label: `${TOWERS[id].emoji} ${TOWERS[id].name}`, value: towerStats(id).dps, display: `${num(towerStats(id).dps, 1)} /วิ` })),
        'ดาเมจต่อวินาที (DPS)',
        'ระยะยาว รวมเวลาหยุดเติมกระสุน (ต่อเป้าหนึ่งตัว)',
      ),
      barChart(
        TORDER.map((id) => ({ label: `${TOWERS[id].emoji} ${TOWERS[id].name}`, value: towerStats(id).dpsPerGold, display: num(towerStats(id).dpsPerGold, 3) })),
        'ความคุ้มราคา (DPS ต่อทอง)',
        'ยิ่งมากยิ่งคุ้ม · ปืนใหญ่ยังได้ดาเมจระเบิดเพิ่มอีก',
      ),
    );
    this.main.appendChild(charts);
    const chain = upgradeChain();
    this.main.appendChild(
      frag(`<section class="cx-section"><h3>⬆️ สายอัปเกรด</h3>
      <p>อัปเกรดต้องจ่ายราคาของขั้นถัดไปเต็มจำนวน ราคาขายคืน ${num(SELL_RATIO * 100)}% ของเงินทั้งหมดที่ลงไป การวางป้อมขั้นสูงตรงๆ จึงถูกกว่าการอัปเกรดไล่ขั้น</p>
      <div class="cx-chain">${chain
        .map(
          (s, i) =>
            `${i ? '<span class="arrow">→</span>' : ''}<a class="cx-chain-step" href="${PREFIX}/towers/${s.id}"><b>${TOWERS[s.id].emoji} ${TOWERS[s.id].name}</b><span>วางตรง ${s.cost}</span><span>อัปเกรดไล่มา ${s.cumulative}</span><span>ขายได้ ${s.sellDirect} / ${s.sellUpgraded}</span></a>`,
        )
        .join('')}</div></section>
      <section class="cx-section"><h3>📋 ตารางค่าพลังทั้งหมด</h3><div class="cx-scroll"><table class="cx-table num">
      <thead><tr><th>ป้อม</th><th>ราคา</th><th>ระยะยิง</th><th>ดาเมจ/นัด</th><th>นัด/วิ</th><th>กระสุน/ชุด</th><th>เติม (วิ)</th><th>DPS รัว</th><th>DPS ระยะยาว</th><th>DPS/ทอง</th><th>ระเบิด</th><th>กระสุน (ช่อง/วิ)</th></tr></thead>
      <tbody>${TORDER.map((id) => {
        const t = TOWERS[id];
        const s = towerStats(id);
        return `<tr><td><a href="${PREFIX}/towers/${id}">${t.emoji} ${t.name}</a></td><td>${t.cost}</td><td>${t.range}</td><td>${t.dmg}</td><td>${t.rate}</td><td>${t.mag}</td><td>${t.reload}</td><td>${num(s.burstDps, 1)}</td><td>${num(s.dps, 1)}</td><td>${num(s.dpsPerGold, 3)}</td><td>${t.aoe ? `${t.aoe} ช่อง` : '-'}</td><td>${num(s.pspd, 1)}</td></tr>`;
      }).join('')}</tbody></table></div></section>`),
    );
  }

  /** กล่องตัวดูโมเดล + ปุ่มควบคุม */
  private viewerBox(m: ViewModel, vtName: string, opts: { range?: boolean; variants?: number } = {}): HTMLElement {
    const v = this.getViewer();
    v.showRange = false;
    v.setModel(m);
    const box = document.createElement('div');
    box.className = 'cx-viewer';
    box.style.setProperty('view-transition-name', vtName);
    const tools = document.createElement('div');
    tools.className = 'cx-viewer-tools';
    const toggle = (label: string, get: () => boolean, set: (b: boolean) => void) => {
      const b = document.createElement('button');
      b.className = 'cx-btn';
      b.textContent = label;
      b.setAttribute('aria-pressed', String(get()));
      b.addEventListener('click', () => {
        set(!get());
        b.setAttribute('aria-pressed', String(get()));
      });
      return b;
    };
    tools.append(
      toggle('🔄 หมุนอัตโนมัติ', () => v.autoRotate, (b) => (v.autoRotate = b)),
      toggle('▶️ ท่าเคลื่อนไหว', () => v.animate, (b) => (v.animate = b)),
    );
    if (opts.range) tools.append(toggle('🎯 แสดงระยะยิง', () => v.showRange, (b) => (v.showRange = b)));
    if (opts.variants && m.kind === 'prop') {
      for (let i = 0; i < opts.variants; i++) {
        const b = document.createElement('button');
        b.className = 'cx-btn';
        b.textContent = `แบบที่ ${i + 1}`;
        b.addEventListener('click', () => v.setModel({ ...m, variant: i }));
        tools.append(b);
      }
    }
    const reset = document.createElement('button');
    reset.className = 'cx-btn';
    reset.textContent = '⟲ รีเซ็ตมุม';
    reset.addEventListener('click', () => v.resetView());
    tools.append(reset);
    const hint = document.createElement('small');
    hint.textContent = 'ลากเพื่อหมุน · ล้อเมาส์ซูม · ดับเบิลคลิกรีเซ็ต';
    box.append(v.canvas, tools, hint);
    this.viewerHost = box;
    return box;
  }

  private detailNav(cat: CategoryId, ids: readonly string[], id: string, label: (k: string) => string): string {
    const i = ids.indexOf(id);
    const prev = ids[(i - 1 + ids.length) % ids.length]!;
    const next = ids[(i + 1) % ids.length]!;
    return `<nav class="cx-prevnext"><a href="${PREFIX}/${cat}/${prev}">← ${label(prev)}</a><a href="${PREFIX}/${cat}/${next}">${label(next)} →</a></nav>`;
  }

  private renderTower(id: TowerId): void {
    const t = TOWERS[id];
    const s = towerStats(id);
    const txt = TOWER_TEXT[id];
    const chain = upgradeChain().find((c) => c.id === id)!;
    this.setCrumb([['สารานุกรม', ''], ['🏰 ป้อม', 'towers'], [`${t.emoji} ${t.name}`, null]]);
    const layout = document.createElement('div');
    layout.className = 'cx-detail';
    layout.appendChild(this.viewerBox({ kind: 'tower', id }, `cx-t-${id}`, { range: true }));
    const stat = (l: string, v: string) => `<div><dt>${l}</dt><dd>${v}</dd></div>`;
    const ttkWaves = [1, 5, 10];
    layout.appendChild(
      frag(`<div class="cx-info">
        <h2>${t.emoji} ${t.name}</h2><p class="role">${txt.role} · ขั้นที่ ${s.tier} ของสายอัปเกรด</p><p>${txt.lore}</p>
        <dl class="cx-statgrid">
          ${stat('ราคา', `💰 ${t.cost}`)}${stat('ระยะยิง', `${t.range} ช่อง`)}${stat('ดาเมจต่อนัด', String(t.dmg))}${stat('นัดต่อวินาที', String(t.rate))}
          ${stat('กระสุนต่อชุด', `${t.mag} นัด`)}${stat('เวลาเติมกระสุน', `${t.reload} วิ`)}${stat('DPS ขณะยิงรัว', num(s.burstDps, 1))}${stat('DPS ระยะยาว', num(s.dps, 1))}${stat('DPS ต่อทอง', num(s.dpsPerGold, 3))}${stat('ระเบิด', t.aoe ? `รัศมี ${t.aoe} ช่อง` : 'ไม่มี')}${stat('ความเร็วกระสุน', `${num(s.pspd, 1)} ช่อง/วิ`)}
          ${stat('cooldown', `${num(s.cooldown, 2)} วิ`)}${stat('ขายได้ (วางตรง)', `💰 ${chain.sellDirect}`)}${stat('ต้นทุนถ้าอัปเกรดไล่มา', `💰 ${chain.cumulative}`)}${stat('อัปเกรดเป็น', t.upgTo ? `${TOWERS[t.upgTo].emoji} ${TOWERS[t.upgTo].name} (💰${TOWERS[t.upgTo].cost})` : '🏆 ขั้นสูงสุด')}
        </dl>
        <h3>💡 เคล็ดลับ</h3><ul>${txt.tips.map((x) => `<li>${x}</li>`).join('')}</ul>
      </div>`),
    );
    this.main.appendChild(layout);
    this.main.appendChild(
      frag(`<section class="cx-section"><h3>⏱️ เวลาที่ป้อมนี้ 1 ป้อมใช้ฆ่าศัตรูหนึ่งตัว (ความยากปกติ)</h3>
      <p>คิดจาก เลือดศัตรู ÷ DPS ยิงต่อเนื่องไม่พลาด ยิ่งน้อยยิ่งดี</p>
      <div class="cx-scroll"><table class="cx-table num"><thead><tr><th>ศัตรู</th>${ttkWaves.map((w) => `<th>Wave ${w}</th>`).join('')}</tr></thead>
      <tbody>${ENEMY_ORDER.map((e) => `<tr><td><a href="${PREFIX}/enemies/${e}">${ENEMIES[e].emoji} ${ENEMIES[e].name}</a></td>${ttkWaves.map((w) => `<td>${num(timeToKill(e, id, w, 'normal'), 1)} วิ</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
      <details class="cx-edit"><summary>🛠️ แก้ค่าของป้อมนี้</summary><ul>${(['cost', 'range', 'dmg', 'rate', 'pspd', 'aoe', 'upgTo', 'desc'] as const).map((k) => `<li><code>config/towers.ts → TOWERS.${id}.${k}</code></li>`).join('')}<li><code>src/render/models/towers.ts → ${id}()</code> (หน้าตาโมเดล)</li><li><code>src/codex/content.ts → TOWER_TEXT.${id}</code> (ข้อความสารานุกรม)</li></ul></details>
      ${this.detailNav('towers', TORDER, id, (k) => `${TOWERS[k as TowerId].emoji} ${TOWERS[k as TowerId].name}`)}`),
    );
  }

  // ── ศัตรู ──────────────────────────────────────────
  private renderEnemies(): void {
    const cards = ENEMY_ORDER.map((id) => {
      const e = ENEMIES[id];
      return `<a class="cx-card unit" href="${PREFIX}/enemies/${id}" style="view-transition-name: cx-e-${id}">
        <img src="${this.thumb(`e-${id}`, { kind: 'enemy', id })}" alt="" loading="lazy">
        <b>${e.emoji} ${e.name}</b><span class="role">${e.fly ? '🦟 บินข้ามป้อม' : '🦶 เดินดิน'} · อันตราย${ENEMY_TEXT[id].threat}</span>
        <span class="meta">❤️${e.hp} · 💰${e.reward}</span></a>`;
    }).join('');
    this.main.appendChild(frag(`<div class="cx-cards units">${cards}</div>`));
    const charts = document.createElement('div');
    charts.className = 'cx-grid2';
    charts.append(
      barChart(
        ENEMY_ORDER.map((id) => ({ label: `${ENEMIES[id].emoji} ${ENEMIES[id].name}`, value: ENEMIES[id].hp, display: num(ENEMIES[id].hp, 0) })),
        'เลือดพื้นฐาน',
        'ก่อนคูณตัวคูณเวฟและความยาก',
      ),
      barChart(
        ENEMY_ORDER.map((id) => ({ label: `${ENEMIES[id].emoji} ${ENEMIES[id].name}`, value: ENEMIES[id].spd, display: `${num(ENEMIES[id].spd, 2)} ช่อง/วิ` })),
        'ความเร็ว',
        'ช่องต่อวินาที',
      ),
    );
    this.main.appendChild(charts);
    this.main.appendChild(
      frag(`<section class="cx-section"><h3>📋 ตารางศัตรู</h3><div class="cx-scroll"><table class="cx-table num">
      <thead><tr><th>ศัตรู</th><th>เลือด</th><th>ความเร็ว (ช่อง/วิ)</th><th>ข้ามสนามทางตรง</th><th>รางวัล (ปกติ)</th><th>ประเภท</th><th>ปรากฏใน Wave</th></tr></thead>
      <tbody>${ENEMY_ORDER.map((id) => {
        const e = ENEMIES[id];
        return `<tr><td><a href="${PREFIX}/enemies/${id}">${e.emoji} ${e.name}</a></td><td>${e.hp}</td><td>${num(e.spd, 2)}</td><td>${num(crossTime(id), 1)} วิ</td><td>${enemyReward(id, 'normal')}</td><td>${e.fly ? 'บิน' : 'เดินดิน'}</td><td>${wavesWithEnemy(id).join(', ') || '-'}</td></tr>`;
      }).join('')}</tbody></table></div></section>`),
    );
  }

  private renderEnemy(id: EnemyId): void {
    const e = ENEMIES[id];
    const txt = ENEMY_TEXT[id];
    const waves = wavesWithEnemy(id);
    this.setCrumb([['สารานุกรม', ''], ['🐛 ศัตรู', 'enemies'], [`${e.emoji} ${e.name}`, null]]);
    const layout = document.createElement('div');
    layout.className = 'cx-detail';
    layout.appendChild(this.viewerBox({ kind: 'enemy', id }, `cx-e-${id}`));
    const stat = (l: string, v: string) => `<div><dt>${l}</dt><dd>${v}</dd></div>`;
    layout.appendChild(
      frag(`<div class="cx-info">
        <h2>${e.emoji} ${e.name}</h2><p class="role">${e.fly ? '🦟 บินข้ามป้อม' : '🦶 เดินดิน'} · ระดับอันตราย: ${txt.threat}</p><p>${txt.lore}</p>
        <dl class="cx-statgrid">
          ${stat('เลือดพื้นฐาน', `❤️ ${e.hp}`)}${stat('ความเร็ว', `${num(e.spd, 2)} ช่อง/วิ`)}${stat('ข้ามสนามทางตรง', `${num(crossTime(id), 1)} วิ`)}${stat('ขนาดตัว', `${e.sz}`)}
          ${DIFF_ORDER.map((d) => stat(`รางวัล ${DIFF_NAME[d]}`, `💰 ${enemyReward(id, d)}`)).join('')}${stat('ปรากฏใน Wave', waves.length ? waves.join(', ') : 'โหมดไม่สิ้นสุด')}
        </dl>
        <h3>🛡️ วิธีรับมือ</h3><ul>${txt.counter.map((x) => `<li>${x}</li>`).join('')}</ul>
      </div>`),
    );
    this.main.appendChild(layout);
    const ws = waves.length ? waves : [11, 12, 13, 14, 15];
    this.main.appendChild(
      columnChart(
        ws.map((w) => ({ label: `W${w}`, value: enemyHp(id, w, 'normal'), display: `❤️ ${num(enemyHp(id, w, 'normal'), 0)}` })),
        'เลือดจริงในแต่ละเวฟ (ความยากปกติ)',
        'เลือดพื้นฐาน × ตัวคูณเลือดของเวฟ',
      ),
    );
    this.main.appendChild(
      frag(`<section class="cx-section"><h3>📋 เลือดจริงตามความยาก</h3><div class="cx-scroll"><table class="cx-table num">
      <thead><tr><th>Wave</th>${DIFF_ORDER.map((d) => `<th>${DIFF_NAME[d]}</th>`).join('')}</tr></thead>
      <tbody>${ws.map((w) => `<tr><td>Wave ${w}</td>${DIFF_ORDER.map((d) => `<td>${num(enemyHp(id, w, d), 0)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
      <details class="cx-edit"><summary>🛠️ แก้ค่าของศัตรูนี้</summary><ul>${(['hp', 'spd', 'reward', 'sz', 'fly', 'col'] as const).map((k) => `<li><code>config/enemies.ts → ENEMIES.${id}.${k}</code></li>`).join('')}<li><code>src/render/models/insects.ts → ${id}()</code> (หน้าตาโมเดล)</li><li><code>src/codex/content.ts → ENEMY_TEXT.${id}</code> (ข้อความสารานุกรม)</li></ul></details>
      ${this.detailNav('enemies', ENEMY_ORDER, id, (k) => `${ENEMIES[k as EnemyId].emoji} ${ENEMIES[k as EnemyId].name}`)}`),
    );
  }

  // ── เวฟ ────────────────────────────────────────────
  private renderWaves(): void {
    const icons = (pool: readonly EnemyId[]) => pool.map((p) => `<a href="${PREFIX}/enemies/${p}" title="${ENEMIES[p].name}">${ENEMIES[p].emoji}</a>`).join(' ');
    this.main.appendChild(
      frag(`<section class="cx-section"><h3>🏁 โหมด 10 เวฟ</h3>
      <p>แต่ละเวฟปล่อยศัตรูต่อเนื่องตามเวลาที่กำหนด สุ่มชนิดจากรายการ หมดเวลาแล้วเวฟถัดไปมาต่อทันทีไม่มีช่วงพัก (ช่วงเตรียมตัวมีครั้งเดียวก่อน Wave 1) ชนะเมื่อ Wave 10 ปล่อยศัตรูครบและไม่มีศัตรูเหลือบนสนาม</p>
      <div class="cx-scroll"><table class="cx-table num">
      <thead><tr><th>Wave</th><th>เวลา (วิ)</th><th>เกิดทุก (วิ)</th><th>จำนวนศัตรู</th><th>บอส</th><th>เลือด ×</th><th>ชนิดศัตรู</th><th>เงินรวมโดยประมาณ</th></tr></thead>
      <tbody>${waveTable()
        .map(
          (w) =>
            `<tr><td>${w.n}</td><td>${w.dur}</td><td>${w.iv}</td><td>${w.spawns}</td><td>${w.bosses ? `👾 ${w.bosses} (ทุก ${w.bIv} วิ)` : '-'}</td><td>×${num(w.sc)}</td><td class="icons">${icons(w.pool)}</td><td>💰 ${waveGold(w.n, 'normal')}</td></tr>`,
        )
        .join('')}</tbody></table></div>
      <p class="cx-note">เงินรวมโดยประมาณ = ฆ่าครบทุกตัวที่ความยากปกติ (ใช้รางวัลเฉลี่ยของชนิดที่สุ่มได้)</p></section>
      <section class="cx-section"><h3>♾️ โหมดไม่สิ้นสุด (Wave 11 ขึ้นไป)</h3>
      <p>หลัง Wave 10 เกมสร้างเวฟอัตโนมัติ ทุกเวฟปล่อยศัตรู 48 วินาที เลือดคูณเพิ่ม 16% ต่อเวฟ ศัตรูเกิดถี่ขึ้นจนถึงทุก 0.45 วินาที และบอสมาถี่ขึ้นจนถึงทุก 7 วินาที ทุก 4 เวฟจะมีด้วงนรกผสมมาด้วย</p></section>`),
    );
    const curve = endlessCurve(11, 40);
    const grid = document.createElement('div');
    grid.className = 'cx-grid3';
    const xl = (x: number) => `W${x}`;
    grid.append(
      lineChart(curve.map((w) => ({ x: w.n, y: w.sc })), 'ตัวคูณเลือด', { xLabel: xl, yFmt: (y) => `×${num(y, 1)}` }),
      lineChart(curve.map((w) => ({ x: w.n, y: w.iv })), 'ศัตรูเกิดทุก (วินาที)', { xLabel: xl, yFmt: (y) => `${num(y, 2)} วิ` }),
      lineChart(curve.map((w) => ({ x: w.n, y: w.bIv })), 'บอสเกิดทุก (วินาที)', { xLabel: xl, yFmt: (y) => `${num(y, 1)} วิ` }),
    );
    this.main.appendChild(grid);
  }

  // ── ความยาก/ตัวคูณ ─────────────────────────────────
  private renderDifficulty(): void {
    this.main.appendChild(
      frag(`<section class="cx-section"><h3>⚖️ ตัวคูณความยาก</h3><div class="cx-scroll"><table class="cx-table num">
      <thead><tr><th>ความยาก</th><th>เลือดศัตรู ×</th><th>เงินรางวัล ×</th></tr></thead>
      <tbody>${DIFF_ORDER.map((d) => `<tr><td>${DIFF_NAME[d]}</td><td>×${DIFF[d].hp}</td><td>×${DIFF[d].reward}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="cx-section"><h3>🧮 สูตรของเกม</h3><div class="cx-formulas">${FORMULAS.map(
        (f, i) =>
          `<div class="cx-formula"><b>${f.name}</b><code>${f.formula}</code><button class="cx-info-btn" popovertarget="cx-f${i}" style="anchor-name: --cxf${i}" aria-label="คำอธิบาย">ℹ️</button><div class="cx-pop" id="cx-f${i}" popover style="position-anchor: --cxf${i}">${f.note}</div></div>`,
      ).join('')}</div></section>`),
    );
    this.main.appendChild(this.calculator());
  }

  private calculator(): HTMLElement {
    const sec = document.createElement('section');
    sec.className = 'cx-section cx-calc';
    sec.appendChild(
      frag(`<h3>🔢 เครื่องคำนวณเลือดศัตรู</h3>
      <div class="cx-calc-form">
        <label>ศัตรู <select id="cxCalcEnemy">${ENEMY_ORDER.map((id) => `<option value="${id}">${ENEMIES[id].emoji} ${ENEMIES[id].name}</option>`).join('')}</select></label>
        <label>Wave <input id="cxCalcWave" type="number" min="1" max="80" value="10"></label>
        <fieldset><legend>ความยาก</legend>${DIFF_ORDER.map((d) => `<label class="cx-radio"><input type="radio" name="cxCalcDiff" value="${d}" ${d === 'normal' ? 'checked' : ''}> ${DIFF_NAME[d]}</label>`).join('')}</fieldset>
      </div>
      <div id="cxCalcOut" class="cx-calc-out" aria-live="polite"></div>`),
    );
    const out = sec.querySelector<HTMLElement>('#cxCalcOut')!;
    const update = () => {
      const enemy = (sec.querySelector<HTMLSelectElement>('#cxCalcEnemy')!.value || 'maggot') as EnemyId;
      const wave = Math.max(1, Math.min(80, Math.round(Number(sec.querySelector<HTMLInputElement>('#cxCalcWave')!.value) || 1)));
      const diff = (sec.querySelector<HTMLInputElement>('input[name=cxCalcDiff]:checked')?.value ?? 'normal') as Difficulty;
      const hp = enemyHp(enemy, wave, diff);
      out.replaceChildren(
        frag(`<div class="cx-stats small"><div class="cx-stat"><b>${num(hp, 0)}</b><span>เลือดจริง</span></div><div class="cx-stat"><b>💰 ${enemyReward(enemy, diff)}</b><span>เงินรางวัล</span></div></div>
        <table class="cx-table num"><thead><tr><th>ป้อม 1 ป้อม</th><th>เวลาฆ่า</th><th>จำนวนนัด</th></tr></thead><tbody>${TORDER.map(
          (t) => `<tr><td>${TOWERS[t].emoji} ${TOWERS[t].name}</td><td>${num(timeToKill(enemy, t, wave, diff), 1)} วิ</td><td>${Math.ceil(hp / TOWERS[t].dmg)}</td></tr>`,
        ).join('')}</tbody></table>`),
      );
    };
    sec.addEventListener('input', update);
    sec.addEventListener('change', update);
    update();
    return sec;
  }

  // ── กลไกเกม ────────────────────────────────────────
  private renderMechanics(): void {
    MECHANICS.forEach((s, i) => {
      this.main.appendChild(frag(sectionHtml(s)));
      if (i === 0) this.main.appendChild(pathDemo());
      if (s.title.includes('เล็งเป้า')) this.main.appendChild(targetingDemo());
      if (s.title.includes('ระเบิด')) {
        const r = TOWERS.cannon.aoe;
        const pts = Array.from({ length: 13 }, (_, k) => ({ x: (k / 12) * r, y: aoeMultiplier((k / 12) * r, r) * 100 }));
        this.main.appendChild(
          lineChart(pts, `ดาเมจระเบิดของปืนใหญ่ตามระยะจากจุดตก (รัศมี ${r} ช่อง)`, {
            xLabel: (x) => `${num(x, 1)} ช่อง`,
            yFmt: (y) => `${num(y, 0)}%`,
            sub: `ดาเมจเต็ม ${TOWERS.cannon.dmg} ที่กึ่งกลาง`,
          }),
        );
      }
    });
  }

  // ── ธีม/สิ่งกีดขวาง ────────────────────────────────
  private renderThemes(): void {
    const sw = (c: string, l: string) => `<span class="cx-swatch"><i style="background:${c}"></i>${l}</span>`;
    this.main.appendChild(
      frag(`<div class="cx-cards themes">${THORDER.map((id) => {
        const t = THEMES[id];
        return `<article class="cx-card theme" style="--top:${t.top};--bot:${t.bot};--sky:${t.sky}">
          <div class="cx-theme-band"></div><b>${t.emoji} ${t.name}</b><p>${THEME_TEXT[id]}</p>
          <div class="cx-swatches">${sw(t.top, 'หญ้าบน')}${sw(t.bot, 'หญ้าล่าง')}${sw(t.sky, 'ท้องฟ้า')}${sw(t.hill, 'เนิน')}${sw(t.soil, 'ดิน')}</div>
          <span class="meta">แอ่งน้ำ ${t.ponds[0]}-${t.ponds[1]} แอ่ง · สิ่งกีดขวาง: ${t.obs.map((o) => OBSTACLE_TEXT[o].name).join(', ')}</span></article>`;
      }).join('')}</div>
      <section class="cx-section"><h3>🌳 สิ่งกีดขวาง (กดดูโมเดล 3D)</h3><p>แมพสุ่มมีต้นไม้/หิน 10-19 ชิ้น และแอ่งน้ำตามธีม ทุกชิ้นวางป้อมทับไม่ได้ ศัตรูเดินดินต้องอ้อม แต่แตนบินข้ามได้ ระบบสุ่มจะไม่วางจนปิดทางเด็ดขาด</p></section>`),
    );
    this.main.appendChild(
      frag(`<div class="cx-cards units">${OBSTACLE_TYPES.map(
        (o) => `<a class="cx-card unit" href="${PREFIX}/themes/${o}" style="view-transition-name: cx-o-${o}"><img src="${this.thumb(`o-${o}`, { kind: 'prop', type: o, variant: 0 })}" alt="" loading="lazy"><b>${OBSTACLE_TEXT[o].name}</b><span class="role">${THORDER.filter((t) => THEMES[t].obs.includes(o)).map((t) => THEMES[t].name).join(', ') || 'หน้าสร้างแมพ'}</span></a>`,
      ).join('')}</div>`),
    );
  }

  private renderProp(type: ObstacleType): void {
    const o = OBSTACLE_TEXT[type];
    this.setCrumb([['สารานุกรม', ''], ['🗺️ ธีมแมพ', 'themes'], [o.name, null]]);
    const layout = document.createElement('div');
    layout.className = 'cx-detail';
    layout.appendChild(this.viewerBox({ kind: 'prop', type, variant: 0 }, `cx-o-${type}`, { variants: 2 }));
    layout.appendChild(
      frag(`<div class="cx-info"><h2>${o.name}</h2><p>${o.text}</p>
      <p class="role">พบในธีม: ${THORDER.filter((t) => THEMES[t].obs.includes(type)).map((t) => `${THEMES[t].emoji} ${THEMES[t].name}`).join(', ') || 'วาดเองในหน้าสร้างแมพ'}</p>
      <p>แต่ละต้น/ก้อนสุ่มการหมุน ขนาด และเฉดสีจากค่า seed ของแมพ และมี 2 แบบให้ดูไม่ซ้ำกัน ใบไม้ไหวตามลม</p></div>`),
    );
    this.main.appendChild(layout);
    this.main.appendChild(
      frag(`<details class="cx-edit"><summary>🛠️ แก้ไขสิ่งกีดขวางนี้</summary><ul><li><code>src/render/models/nature.ts → ${type}()</code> (หน้าตาโมเดล)</li><li><code>config/themes.ts → THEMES.*.obs</code> (ธีมที่ใช้)</li><li><code>src/codex/content.ts → OBSTACLE_TEXT.${type}</code></li></ul></details>
      ${this.detailNav('themes', OBSTACLE_TYPES, type, (k) => OBSTACLE_TEXT[k as ObstacleType].name)}`),
    );
  }

  // ── ปรับเกม ────────────────────────────────────────
  private renderTuning(): void {
    this.main.appendChild(frag(`<section class="cx-section">${TUNING_INTRO.map((p) => `<p>${p}</p>`).join('')}</section>`));
    const rows = tunables();
    const groups = [...new Set(rows.map((r) => r.group))];
    const table = document.createElement('div');
    table.className = 'cx-scroll';
    table.appendChild(
      frag(`<table class="cx-table tuning"><thead><tr><th>ค่า</th><th>ปัจจุบัน</th><th>แก้ที่</th></tr></thead><tbody>${groups
        .map(
          (g) =>
            `<tr class="group"><th colspan="3">${escapeHtml(g)}</th></tr>${rows
              .filter((r) => r.group === g)
              .map((r) => `<tr><td>${escapeHtml(r.label)}</td><td class="val">${escapeHtml(r.value)}</td><td><code>${escapeHtml(r.path)}</code><button class="cx-copy" data-copy="${escapeHtml(r.path)}" aria-label="คัดลอก">📋</button></td></tr>`)
              .join('')}`,
        )
        .join('')}</tbody></table>`),
    );
    table.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.cx-copy');
      if (!b?.dataset.copy) return;
      void navigator.clipboard?.writeText(b.dataset.copy).then(() => {
        b.textContent = '✅';
        setTimeout(() => (b.textContent = '📋'), 1200);
      });
    });
    this.main.appendChild(table);
    this.main.appendChild(frag(`<p class="cx-note">ขนาดสนาม ${COLS} คอลัมน์ · ความเร็วทุกอย่างเก็บเป็นค่า px/s เดิม แล้วหารด้วย REF_CELL_PX เป็นช่องต่อวินาที</p>`));
  }

  // ── ค้นหา ──────────────────────────────────────────
  private buildIndex(): SearchItem[] {
    const items: SearchItem[] = [];
    const add = (title: string, sub: string, href: string, extra = '') => items.push({ title, sub, href, hay: `${title} ${sub} ${extra}`.toLowerCase() });
    for (const c of CATEGORIES) add(`${c.icon} ${c.title}`, c.blurb, `${PREFIX}/${c.id}`);
    for (const id of TORDER) add(`${TOWERS[id].emoji} ${TOWERS[id].name}`, `ป้อม · ${TOWER_TEXT[id].role}`, `${PREFIX}/towers/${id}`, `${id} ${TOWERS[id].desc} ${TOWER_TEXT[id].lore} ${TOWER_TEXT[id].tips.join(' ')}`);
    for (const id of ENEMY_ORDER) add(`${ENEMIES[id].emoji} ${ENEMIES[id].name}`, `ศัตรู · อันตราย${ENEMY_TEXT[id].threat}`, `${PREFIX}/enemies/${id}`, `${id} ${stripTags(ENEMY_TEXT[id].lore)} ${ENEMY_TEXT[id].counter.join(' ')}`);
    for (const id of THORDER) add(`${THEMES[id].emoji} ${THEMES[id].name}`, 'ธีมแมพ', `${PREFIX}/themes`, THEME_TEXT[id]);
    for (const o of OBSTACLE_TYPES) add(OBSTACLE_TEXT[o].name, 'สิ่งกีดขวาง', `${PREFIX}/themes/${o}`, OBSTACLE_TEXT[o].text);
    for (const s of MECHANICS) add(s.title, 'กลไกเกม', `${PREFIX}/mechanics`, stripTags(s.body.join(' ')));
    for (const s of HOWTO) add(s.title, 'วิธีเล่น', `${PREFIX}/howto`, stripTags(s.body.join(' ')));
    for (const f of FORMULAS) add(`🧮 ${f.name}`, f.formula, `${PREFIX}/difficulty`, f.note);
    for (const g of CONTROLS) for (const [a, k] of g.rows) add(a, `การควบคุม · ${stripTags(k)}`, `${PREFIX}/controls`);
    for (const r of tunables()) add(`🛠️ ${r.label}`, `${r.group} · ${r.value}`, `${PREFIX}/tuning`, r.path);
    return items;
  }

  private renderSearch(q: string): void {
    this.index ??= this.buildIndex();
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = this.index.filter((it) => terms.every((t) => it.hay.includes(t))).slice(0, 60);
    const list = document.createElement('div');
    list.className = 'cx-results';
    const head = document.createElement('p');
    head.className = 'cx-note';
    head.textContent = hits.length ? `พบ ${hits.length} รายการ` : `ไม่พบรายการที่ตรงกับ "${q}"`;
    list.appendChild(head);
    list.addEventListener('click', (e) => {
      // ผลลัพธ์ที่ชี้ไปหน้าปัจจุบัน: hash ไม่เปลี่ยน → ล้างคำค้นแล้ววาดเอง
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.cx-result');
      if (a && a.hash === location.hash) {
        e.preventDefault();
        this.search.value = '';
        this.transition(() => this.render());
      } else if (a) this.search.value = '';
    });
    for (const h of hits) {
      const a = document.createElement('a');
      a.className = 'cx-result';
      a.href = h.href;
      const b = document.createElement('b');
      b.textContent = h.title;
      const s = document.createElement('span');
      s.textContent = h.sub;
      a.append(b, s);
      list.appendChild(a);
    }
    this.main.appendChild(list);
  }
}
