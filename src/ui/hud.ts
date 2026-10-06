import { TARGET_NAME, TORDER, TOWERS, type TowerId } from '../config/towers';
import type { Tower } from '../core/entities';
import type { Game } from '../core/Game';
import { getWaveCfg, waveTotalLabel } from '../core/waves';
import { $, setDisplay, setText } from './dom';
import { S, fmt } from './strings';

export interface HudActions {
  pickType(id: TowerId): void;
  skip(): void;
  regen(): void;
  upgrade(): void;
  cycleTarget(): void;
  sell(): void;
  pause(): void;
  speed(): void;
  mute(): void;
  replay(): void;
}

/** แผงข้อมูลในเกม (ซ้าย) — เขียน DOM เฉพาะค่าที่เปลี่ยน */
export class Hud {
  private el = {
    gold: $('sGold'),
    lives: $('sLives'),
    kills: $('sKills'),
    breakBox: $('breakBox'),
    waveBox: $('waveBox'),
    bnum: $('bnum'),
    bsub: $('bsub'),
    regen: $('btnRegen'),
    wlabel: $('wlabel'),
    wstatus: $('wstatus'),
    wpbar: $('wpbar'),
    info: $('info'),
    acts: $('acts'),
    upg: $<HTMLButtonElement>('btnUpg'),
    target: $('btnTarget'),
    sell: $('btnSell'),
    pause: $('btnPause'),
    spd: $('btnSpd'),
    mute: $('btnMute'),
    pauseOverlay: $('pauseOverlay'),
  };
  private btns = new Map<TowerId, HTMLElement>();
  private infoKey = '';

  constructor(actions: HudActions) {
    const cont = $('towerBtns');
    cont.innerHTML = '';
    TORDER.forEach((id, i) => {
      const t = TOWERS[id];
      const d = document.createElement('div');
      d.className = 'tbtn';
      d.id = `tb-${id}`;
      d.innerHTML = `<span class="thumb-emoji">${t.emoji}</span><div class="tn">${t.name} <span class="tk">[${i + 1}]</span></div><div class="tc">💰${t.cost}</div><div class="ts">📏${t.range} ⚔️${t.dmg} ⏱${t.rate}/s</div>`;
      d.addEventListener('click', () => actions.pickType(id));
      cont.appendChild(d);
      this.btns.set(id, d);
    });
    $('btnSkip').addEventListener('click', actions.skip);
    this.el.regen.addEventListener('click', actions.regen);
    this.el.upg.addEventListener('click', actions.upgrade);
    this.el.target.addEventListener('click', actions.cycleTarget);
    this.el.sell.addEventListener('click', actions.sell);
    this.el.pause.addEventListener('click', actions.pause);
    this.el.spd.addEventListener('click', actions.speed);
    this.el.mute.addEventListener('click', actions.mute);
    $('btnReplay').addEventListener('click', actions.replay);
  }

  /** ใส่ภาพย่อโมเดล 3D แทน emoji บนปุ่มป้อม */
  setThumbs(urls: Partial<Record<TowerId, string>>): void {
    for (const [id, url] of Object.entries(urls) as [TowerId, string][]) {
      const b = this.btns.get(id);
      if (!b || !url) continue;
      b.querySelector('.thumb-emoji')?.remove();
      let img = b.querySelector<HTMLImageElement>('img.thumb');
      if (!img) {
        img = document.createElement('img');
        img.className = 'thumb';
        img.alt = '';
        b.prepend(img);
      }
      img.src = url;
    }
  }

  reset(muted: boolean): void {
    setText(this.el.pause, S.pause);
    this.el.pause.classList.remove('pause-active');
    setText(this.el.spd, fmt.speed(1));
    setText(this.el.mute, muted ? S.muteOn : S.muteOff);
    this.setPaused(false);
    this.infoKey = '';
  }

  setPaused(p: boolean): void {
    setText(this.el.pause, p ? S.resume : S.pause);
    this.el.pause.classList.toggle('pause-active', p);
    setDisplay(this.el.pauseOverlay, p ? 'block' : 'none');
    document.body.classList.toggle('paused', p);
  }

  setSpeed(s: number): void {
    setText(this.el.spd, fmt.speed(s));
  }

  setMuted(m: boolean): void {
    setText(this.el.mute, m ? S.muteOn : S.muteOff);
  }

  setSelectedType(id: TowerId | null): void {
    for (const [k, b] of this.btns) b.classList.toggle('sel', k === id);
  }

  update(g: Game, selType: TowerId | null, selTower: Tower | undefined): void {
    const e = this.el;
    setText(e.gold, String(g.gold));
    setText(e.lives, String(Math.max(0, g.lives)));
    setText(e.kills, String(g.kills));
    for (const [id, b] of this.btns) {
      const poor = g.gold < TOWERS[id].cost;
      if (b.classList.contains('poor') !== poor) b.classList.toggle('poor', poor);
    }
    const total = waveTotalLabel(g.mode);
    if (g.phase === 'playing') {
      setDisplay(e.breakBox, 'none');
      const cfg = getWaveCfg(g.wave);
      const pct = Math.min(100, (g.waveElapsed / cfg.dur) * 100);
      setText(e.wlabel, fmt.waveLabel(g.wave, total));
      setText(e.wstatus, S.waving);
      const w = `${pct.toFixed(1)}%`;
      if (e.wpbar.style.width !== w) e.wpbar.style.width = w;
    } else {
      setDisplay(e.breakBox, 'block');
      setDisplay(e.regen, g.wave === 0 ? 'block' : 'none');
      setText(e.bnum, String(Math.max(0, Math.ceil(g.breakRemain))));
      setText(e.bsub, fmt.breakSub(g.wave + 1));
      setText(e.wlabel, g.wave === 0 ? S.prepStart : fmt.waveDone(g.wave, total));
      setText(e.wstatus, S.prepping);
      if (e.wpbar.style.width !== '100%') e.wpbar.style.width = '100%';
    }
    this.updateInfo(g, selType, selTower);
  }

  private updateInfo(g: Game, selType: TowerId | null, tw: Tower | undefined): void {
    const e = this.el;
    if (tw) {
      const nxt = tw.def.upgTo ? TOWERS[tw.def.upgTo] : null;
      const key = `t${tw.id}:${tw.kind}:${tw.kills}:${tw.target}:${g.gold >= (nxt?.cost ?? 0)}`;
      if (key === this.infoKey) return;
      this.infoKey = key;
      e.info.innerHTML = `<b>${tw.def.emoji} ${tw.def.name}</b><br>⚔️${tw.def.dmg} 📏${tw.def.range} ⏱${tw.def.rate}/s<br>💀 ฆ่า: ${tw.kills} ตัว${
        nxt ? `<br>⬆️→${nxt.emoji}${nxt.name} (${nxt.cost}g)` : `<br>${S.maxLevel}`
      }`;
      setDisplay(e.acts, 'flex');
      setText(e.upg, nxt ? `⬆️ Upgrade→${nxt.name} (${nxt.cost}g)` : S.maxLevel);
      e.upg.disabled = !nxt;
      setText(e.target, `🎯 เป้า: ${TARGET_NAME[tw.target]}`);
      setText(e.sell, `🗑️ ขาย (${g.sellValue(tw)}g)`);
      return;
    }
    setDisplay(e.acts, 'none');
    if (selType) {
      const key = `p${selType}`;
      if (key === this.infoKey) return;
      this.infoKey = key;
      const t = TOWERS[selType];
      e.info.innerHTML = `<b>${t.emoji} ${t.name}</b><br>💰${t.cost} | 📏${t.range} | ⚔️${t.dmg}<br>⏱${t.rate}นัด/วิ${t.aoe ? ' | 💥AOE' : ''}<br><i>${t.desc}</i>`;
      return;
    }
    if (this.infoKey !== 'idle') {
      this.infoKey = 'idle';
      e.info.innerHTML = S.infoIdle;
    }
  }
}
