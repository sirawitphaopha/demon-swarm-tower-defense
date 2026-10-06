import { SIM_DT } from '../config/constants';
import type { Difficulty } from '../config/difficulty';
import { type Quality } from '../config/quality';
import type { ThemeId } from '../config/themes';
import { TORDER, type TowerId } from '../config/towers';
import type { GameMode } from '../config/waves';
import { Sfx } from '../audio/sfx';
import { loadCustom, type CustomMap } from '../core/customMap';
import { Game } from '../core/Game';
import type { GameEvent } from '../core/events';
import type { MapData } from '../core/map';
import { generateMap } from '../core/mapgen';
import { computeDist, spawnReachable } from '../core/pathfinding';
import { mulberry32, randomSeed } from '../core/rng';
import { Editor } from '../editor/Editor';
import { CameraController } from '../render/CameraController';
import { sharedUniforms } from '../render/materials';
import { Overlays } from '../render/Overlays';
import { cellAt, groundPoint, pickBoxes, type CellHit } from '../render/Picking';
import { SceneManager } from '../render/SceneManager';
import { UnitsView } from '../render/UnitsView';
import { WorldView } from '../render/WorldView';
import { renderTowerThumbs } from '../render/thumbs';
import { loadBest, recordBest } from '../storage/best';
import { deleteMap, loadMaps, type SavedMap } from '../storage/maps';
import { loadSettings, saveSettings, type Settings } from '../storage/settings';
import { $ } from '../ui/dom';
import { hideEnd, showEnd } from '../ui/endOverlay';
import { Hud } from '../ui/hud';
import { renderMapList } from '../ui/mapsScreen';
import { Screens, type ScreenId } from '../ui/screens';
import { PLACE_FAIL, S } from '../ui/strings';
import { toast } from '../ui/toast';
import { Input } from './Input';
import { advance } from './loopMath';

type Mode = 'menu' | 'game' | 'editor';
type MapSource = { kind: 'random' } | { kind: 'custom'; map: CustomMap };

const PAN_SPEED = 0.85;
const ROT_SPEED = 1.8;

/** ประกอบทุกส่วนเข้าด้วยกัน + เจ้าของลูป requestAnimationFrame ตัวเดียว */
export class App {
  readonly sm: SceneManager;
  readonly cam: CameraController;
  readonly world: WorldView;
  readonly units: UnitsView;
  readonly overlays: Overlays;
  readonly sfx = new Sfx();
  readonly input: Input;
  readonly screens: Screens;
  readonly hud: Hud;
  readonly editor: Editor;
  settings: Settings;
  maps: SavedMap[];

  mode: Mode = 'menu';
  game: Game | null = null;
  selType: TowerId | null = null;
  selTowerId = -1;
  private source: MapSource = { kind: 'random' };
  private hoverCell: CellHit | null = null;
  private acc = 0;
  private alpha = 0;
  private last = performance.now();
  private realTime = 0;
  private grabPoint: { x: number; z: number } | null = null;
  /** seed คงที่จาก ?seed= (ทดสอบ) */
  private fixedSeed: number | null;
  readonly testMode: boolean;
  private perf: number[] = [];
  private perfTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    const params = new URLSearchParams(location.search);
    this.testMode = params.has('test');
    const seed = params.get('seed');
    this.fixedSeed = seed !== null && seed !== '' ? Number(seed) >>> 0 : null;

    this.settings = loadSettings();
    this.maps = loadMaps();
    this.sfx.muted = this.settings.muted;

    this.sm = new SceneManager(canvas);
    this.cam = new CameraController(this.sm.camera);
    this.world = new WorldView(this.settings.quality);
    this.units = new UnitsView(this.settings.quality);
    this.overlays = new Overlays();
    this.sm.scene.add(this.world.group, this.units.group, this.overlays.group);
    this.sm.setQuality(this.settings.quality);

    this.screens = new Screens({
      start: () => this.startGame({ kind: 'random' }),
      editor: () => this.openEditor(),
      quit: () => this.quitToMenu(),
      nav: (id) => this.showScreen(id),
      setDifficulty: (d) => this.updateSettings({ difficulty: d }),
      setMode: (m) => this.updateSettings({ mode: m }),
      setTheme: (t) => {
        this.updateSettings({ theme: t });
        this.setMenuBackdrop();
      },
      setQuality: (q) => this.setQuality(q),
    });
    this.hud = new Hud({
      pickType: (id) => this.pickType(id),
      skip: () => this.game?.skipBreak(),
      regen: () => this.regen(),
      upgrade: () => this.upgrade(),
      cycleTarget: () => {
        if (this.game && this.selTowerId >= 0) this.game.cycleTarget(this.selTowerId);
      },
      sell: () => this.sell(),
      pause: () => this.togglePause(),
      speed: () => {
        if (this.game) this.hud.setSpeed(this.game.cycleSpeed());
      },
      mute: () => this.toggleMute(),
      replay: () => this.startGame(this.source),
    });
    this.editor = new Editor({
      world: this.world,
      overlays: this.overlays,
      maps: () => this.maps,
      setMaps: (m) => (this.maps = m),
      play: (m) => this.startGame({ kind: 'custom', map: m }),
    });

    this.input = new Input(canvas, {
      click: (x, y) => this.onClick(x, y),
      rightClick: () => {
        if (this.mode === 'game') this.deselect();
      },
      hover: (x, y) => this.onHover(x, y),
      leave: () => {
        this.hoverCell = null;
        if (this.mode === 'editor') this.editor.hover(null);
      },
      paint: (x, y, erase, first) => {
        if (this.mode === 'editor') this.editor.paint(this.cell(x, y), erase, first);
      },
      paintEnd: () => {},
      grab: (x, y, first) => this.onGrab(x, y, first),
      rotate: (dx, dy) => this.cam.rotate(-dx * 0.006, dy * 0.004),
      zoom: (f, x, y) => this.cam.zoom(f, this.mode === 'menu' ? null : groundPoint(this.sm.camera, canvas, x, y)),
      key: (code, e) => this.onKey(code, e),
    });
    window.addEventListener('resize', () => this.onResize());
    // ปลุกเสียงหลัง user gesture แรก
    window.addEventListener('pointerdown', () => this.sfx.init(), { once: true });

    this.screens.syncSettings(this.settings);
    this.hud.setThumbs(renderTowerThumbs());
    this.showScreen('menuScreen');
    this.setMenuBackdrop();
    this.cam.fit(true);
    requestAnimationFrame(this.frame);
  }

  // ── หน้าจอ / โหมด ─────────────────────────────────
  private showScreen(id: ScreenId): void {
    if (this.mode !== 'menu') {
      this.mode = 'menu';
      this.game = null;
      this.input.paintMode = false;
      this.overlays.hideAll();
      this.cam.setTopDown(false);
    }
    this.cam.orbit = true;
    this.screens.show(id);
    this.updateInset();
    if (id === 'menuScreen') this.refreshBest();
    if (id === 'mapsScreen') this.renderMaps();
  }

  private setMenuBackdrop(): void {
    if (this.mode !== 'menu') return;
    const rng = mulberry32(this.fixedSeed ?? randomSeed());
    const map = generateMap(this.settings.theme, rng);
    this.sm.setTheme(map.theme);
    this.world.setMap(map);
  }

  private refreshBest(): void {
    const b = loadBest(this.settings.mode, this.settings.difficulty);
    this.screens.setBest(b.wave, b.kills);
  }

  private renderMaps(): void {
    renderMapList(
      this.maps,
      (i) => {
        const m = this.maps[i];
        if (m) this.startGame({ kind: 'custom', map: m });
      },
      (i) => {
        this.maps = deleteMap(this.maps, i);
        this.renderMaps();
      },
    );
  }

  quitToMenu(): void {
    this.showScreen('menuScreen');
  }

  private updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.screens.syncSettings(this.settings);
    this.refreshBest();
  }

  setQuality(q: Quality): void {
    this.updateSettings({ quality: q });
    this.sm.setQuality(q);
    this.world.setQuality(q);
    this.units.setQuality(q);
  }

  private updateInset(): void {
    const id = this.mode === 'game' ? 'sidebar' : this.mode === 'editor' ? 'edSidebar' : null;
    const right = id ? $(id).getBoundingClientRect().right : 0;
    this.sm.setInsetLeft(right > 0 ? right : 0);
  }

  private onResize(): void {
    this.sm.resize();
    this.updateInset();
    if (this.mode !== 'game') this.cam.fit();
  }

  // ── เกม ───────────────────────────────────────────
  startGame(source: MapSource): void {
    const seed = this.fixedSeed ?? randomSeed();
    let map: MapData;
    if (source.kind === 'custom') {
      map = loadCustom(source.map);
      if (!spawnReachable(computeDist(map.grid))) {
        toast(S.mapBlocked);
        return;
      }
    } else {
      map = generateMap(this.settings.theme, mulberry32(seed));
    }
    this.source = source;
    this.mode = 'game';
    this.input.paintMode = false;
    this.cam.orbit = false;
    this.cam.setTopDown(false);
    this.sfx.init();
    this.game = new Game({ mode: this.settings.mode, difficulty: this.settings.difficulty, map, seed: seed + 1 });
    this.game.drainEvents();
    this.acc = 0;
    this.alpha = 0;
    this.selType = null;
    this.selTowerId = -1;
    this.perf = [];
    this.perfTime = 0;
    this.sm.setTheme(map.theme);
    this.world.setMap(map);
    this.units.reset();
    this.overlays.hideAll();
    this.screens.showGame();
    hideEnd();
    this.hud.reset(this.sfx.muted);
    this.hud.setSelectedType(null);
    this.updateInset();
    this.cam.fit();
  }

  private regen(): void {
    const g = this.game;
    if (!g || g.over) return;
    if (!(g.phase === 'break' && g.wave === 0)) {
      toast(S.regenOnlyBreak);
      return;
    }
    this.startGame(this.source);
  }

  private pickType(id: TowerId): void {
    if (this.mode !== 'game') return;
    this.selType = id;
    this.selTowerId = -1;
    this.hud.setSelectedType(id);
  }

  private deselect(): void {
    this.selType = null;
    this.selTowerId = -1;
    this.hud.setSelectedType(null);
  }

  private upgrade(): void {
    const g = this.game;
    if (!g || this.selTowerId < 0) return;
    const r = g.upgrade(this.selTowerId);
    if (!r.ok && r.reason === 'gold') toast(S.noGold);
  }

  private sell(): void {
    const g = this.game;
    if (!g || this.selTowerId < 0) return;
    g.sell(this.selTowerId);
    this.selTowerId = -1;
  }

  private togglePause(): void {
    const g = this.game;
    if (!g || g.over) return;
    this.hud.setPaused(g.togglePause());
  }

  private toggleMute(): void {
    this.sfx.muted = !this.sfx.muted;
    if (!this.sfx.muted) this.sfx.init();
    this.updateSettings({ muted: this.sfx.muted });
    this.hud.setMuted(this.sfx.muted);
  }

  openEditor(): void {
    this.mode = 'editor';
    this.game = null;
    this.cam.orbit = false;
    this.screens.showEditor();
    this.input.paintMode = true;
    this.updateInset();
    this.sm.setTheme(this.settings.theme);
    this.editor.open(this.settings.theme);
    this.cam.setTopDown(true);
  }

  // ── อินพุต ─────────────────────────────────────────
  private cell(x: number, y: number): CellHit | null {
    return cellAt(this.sm.camera, this.sm.canvas, x, y);
  }

  private onHover(x: number, y: number): void {
    this.hoverCell = this.cell(x, y);
    if (this.mode === 'editor') this.editor.hover(this.hoverCell);
  }

  private onClick(x: number, y: number): void {
    const g = this.game;
    if (this.mode !== 'game' || !g) return;
    const c = this.cell(x, y);
    if (this.selType) {
      if (!c) return; // คลิกนอกสนามไม่ทำอะไร
      const res = g.place(this.selType, c.c, c.r);
      if (!res.ok) {
        const msg = PLACE_FAIL[res.reason];
        if (msg) toast(msg);
      }
      return;
    }
    const i = pickBoxes(this.sm.camera, this.sm.canvas, x, y, this.units.towerBoxes(g.towers));
    const tw = i >= 0 ? g.towers[i] : c ? g.towerAt(c.c, c.r) : undefined;
    this.selTowerId = tw ? tw.id : -1;
  }

  private onGrab(x: number, y: number, first: boolean): void {
    const p = groundPoint(this.sm.camera, this.sm.canvas, x, y);
    if (!p) return;
    if (first || !this.grabPoint) {
      this.grabPoint = { x: p.x, z: p.z };
      return;
    }
    this.cam.panWorld(this.grabPoint.x - p.x, this.grabPoint.z - p.z);
  }

  private onKey(code: string, e: KeyboardEvent): void {
    if (code === 'KeyF') this.cam.fit();
    if (this.mode !== 'game') return;
    if (code === 'Space') {
      e.preventDefault();
      this.togglePause();
      return;
    }
    if (code === 'Escape') {
      this.deselect();
      return;
    }
    const m = /^(?:Digit|Numpad)([1-6])$/.exec(code);
    if (m) this.pickType(TORDER[Number(m[1]) - 1]!);
  }

  private keyboardCamera(dt: number): void {
    const i = this.input;
    let right = 0;
    let fwd = 0;
    if (i.isHeld('KeyA', 'ArrowLeft')) right -= 1;
    if (i.isHeld('KeyD', 'ArrowRight')) right += 1;
    if (i.isHeld('KeyW', 'ArrowUp')) fwd += 1;
    if (i.isHeld('KeyS', 'ArrowDown')) fwd -= 1;
    if (right || fwd) this.cam.panLocal(right * PAN_SPEED * dt, fwd * PAN_SPEED * dt);
    let rot = 0;
    if (i.isHeld('KeyQ')) rot += 1;
    if (i.isHeld('KeyE')) rot -= 1;
    if (rot) this.cam.rotate(rot * ROT_SPEED * dt, 0);
  }

  // ── ลูปหลัก ────────────────────────────────────────
  private frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const realDt = Math.min(Math.max(0, (now - this.last) / 1000), 0.1);
    this.last = now;
    this.realTime += realDt;
    if (this.mode !== 'menu') this.keyboardCamera(realDt);
    this.cam.update(realDt);
    sharedUniforms.uTime.value = this.realTime;
    sharedUniforms.uWind.value = this.sm.quality === 'low' ? 0 : 1;

    const g = this.game;
    if (this.mode === 'game' && g) {
      const running = !g.paused && !g.over;
      if (running) {
        const a = advance(this.acc, realDt, g.speed);
        for (let s = 0; s < a.steps; s++) g.step(SIM_DT);
        this.acc = a.acc;
        this.alpha = a.alpha;
      }
      this.handleEvents(g.drainEvents(), g);
      if (this.selTowerId >= 0 && !g.towerById(this.selTowerId)) this.selTowerId = -1;
      this.units.selectedTowerId = this.selTowerId;
      this.units.update(g, this.alpha, running ? realDt * g.speed : 0, this.sm.camera);
      this.updatePlacementOverlay(g);
      this.hud.update(g, this.selType, this.selTowerId >= 0 ? g.towerById(this.selTowerId) : undefined);
      if (running) this.watchPerf(realDt);
    } else {
      this.units.update(null, 0, realDt, this.sm.camera);
      if (this.mode === 'editor') this.editor.frame();
    }
    this.overlays.update(this.realTime);
    this.sm.render();
  };

  private handleEvents(events: GameEvent[], g: Game): void {
    if (!events.length) return;
    this.sfx.onEvents(events, performance.now());
    this.units.onEvents(events, g);
    for (const ev of events) {
      if (ev.type === 'enemySpawned' && ev.boss) toast(S.boss);
      else if (ev.type === 'gridChanged') this.world.onGridChanged();
      else if (ev.type === 'gameOver') {
        const best = recordBest(g.mode, g.difficulty, g.wave, g.kills);
        showEnd(ev.win, g.mode, g.wave, g.kills, g.gold, best);
        this.hud.setPaused(false);
      }
    }
  }

  private updatePlacementOverlay(g: Game): void {
    const o = this.overlays;
    const h = this.hoverCell;
    if (this.selType && !g.over) {
      o.showGrid(true, 7, true);
      if (h) {
        o.setCursor(h.x, h.y);
        const fail = g.checkPlace(h.c, h.r);
        o.setGhost(this.selType, h.c, h.r, fail === null);
        o.setHover(h.c, h.r, fail === null);
      } else {
        o.setGhost(null);
        o.setHover(0, 0, null);
      }
    } else {
      o.showGrid(false);
      o.setGhost(null);
      o.setHover(0, 0, null);
    }
    const tw = this.selTowerId >= 0 ? g.towerById(this.selTowerId) : undefined;
    o.setSelected(tw ? tw.kind : null, tw?.c, tw?.r);
  }

  /** ลดคุณภาพอัตโนมัติครั้งเดียว ถ้า 5 วินาทีแรกเฟรมช้ากว่า 22ms */
  private watchPerf(dt: number): void {
    if (this.testMode || this.settings.autoQualityDone || this.settings.quality !== 'high') return;
    this.perfTime += dt;
    if (this.perfTime < 1) return; // ข้ามช่วงโหลด shader
    this.perf.push(dt);
    if (this.perfTime < 6) return;
    const sorted = this.perf.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    this.updateSettings({ autoQualityDone: true });
    if (median > 0.022) {
      this.setQuality('medium');
      toast(S.autoQuality);
    }
  }

  // ── ตัวช่วยสำหรับเทสต์ (?test=1) ────────────────────
  setDifficulty(d: Difficulty): void {
    this.updateSettings({ difficulty: d });
  }
  setMode(m: GameMode): void {
    this.updateSettings({ mode: m });
  }
  setTheme(t: ThemeId): void {
    this.updateSettings({ theme: t });
  }
}
