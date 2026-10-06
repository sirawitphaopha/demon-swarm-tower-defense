import type { ThemeId } from '../config/themes';
import type { CustomMap } from '../core/customMap';
import { mulberry32, randomSeed } from '../core/rng';
import type { Overlays } from '../render/Overlays';
import type { WorldView } from '../render/WorldView';
import type { CellHit } from '../render/Picking';
import { upsertMap, type SavedMap } from '../storage/maps';
import { $ } from '../ui/dom';
import { S, fmt } from '../ui/strings';
import { toast } from '../ui/toast';
import { EditorModel, type Dirty, type EdTool } from './EditorModel';

export interface EditorHost {
  world: WorldView;
  overlays: Overlays;
  maps(): SavedMap[];
  setMaps(m: SavedMap[]): void;
  play(m: CustomMap): void;
}

/** หน้าสร้างแมพ: ปุ่มเครื่องมือ/ธีม/บันทึก + การวาดด้วยเมาส์ */
export class Editor {
  model = new EditorModel('meadow');
  tool: EdTool = 'tree';
  private rng = mulberry32(randomSeed());
  private dirty: Dirty = { water: false, props: false, decor: false };
  private lastPaint = '';
  private name = $<HTMLInputElement>('edName');

  constructor(private host: EditorHost) {
    document.querySelectorAll<HTMLElement>('#edTools .edtool').forEach((b) => b.addEventListener('click', () => this.setTool(b.dataset.tool as EdTool)));
    document.querySelectorAll<HTMLElement>('#edThemes .edth').forEach((b) => b.addEventListener('click', () => this.setTheme(b.dataset.th as ThemeId)));
    $('edSaveBtn').addEventListener('click', () => this.save());
    $('edPlayBtn').addEventListener('click', () => this.play());
    $('edClearBtn').addEventListener('click', () => this.clear());
  }

  open(theme: ThemeId): void {
    this.model = new EditorModel(theme);
    this.setTool('tree');
    this.syncTheme();
    this.name.value = '';
    this.host.world.setMap(this.model.map);
    this.host.overlays.hideAll();
    this.host.overlays.showGrid(true, 999, true);
  }

  setTool(t: EdTool): void {
    this.tool = t;
    document.querySelectorAll<HTMLElement>('#edTools .edtool').forEach((b) => b.classList.toggle('sel', b.dataset.tool === t));
  }

  private syncTheme(): void {
    document.querySelectorAll<HTMLElement>('#edThemes .edth').forEach((b) => b.classList.toggle('sel', b.dataset.th === this.model.map.theme));
  }

  setTheme(t: ThemeId): void {
    this.model.setTheme(t);
    this.syncTheme();
    this.host.world.setMap(this.model.map);
  }

  paint(cell: CellHit | null, erase: boolean, first: boolean): void {
    if (first) this.lastPaint = '';
    if (!cell) return;
    const key = `${cell.c},${cell.r},${erase}`;
    if (key === this.lastPaint) return;
    this.lastPaint = key;
    const d = this.model.paint(cell.c, cell.r, erase ? 'erase' : this.tool, this.rng);
    if (d) {
      this.dirty.water ||= d.water;
      this.dirty.props ||= d.props;
      this.dirty.decor ||= d.decor;
    }
  }

  hover(cell: CellHit | null): void {
    if (!cell) {
      this.host.overlays.setHover(0, 0, null);
      return;
    }
    this.host.overlays.setHover(cell.c, cell.r, EditorModel.canPaint(cell.c, cell.r));
    this.host.overlays.setCursor(cell.x, cell.y);
  }

  /** วาดภาพส่วนที่เปลี่ยน (รวมครั้งเดียวต่อเฟรม) */
  frame(): void {
    const d = this.dirty;
    if (d.water || d.props || d.decor) {
      this.host.world.onMapEdited(d.water, d.props, d.decor);
      this.dirty = { water: false, props: false, decor: false };
    }
  }

  private save(): void {
    const name = this.name.value.trim();
    if (!name) {
      toast(S.edNeedName);
      return;
    }
    if (!this.model.valid()) {
      toast(S.edBlockedSave);
      return;
    }
    this.host.setMaps(upsertMap(this.host.maps(), this.model.toSaved(name)));
    toast(fmt.saved(name));
  }

  private play(): void {
    if (!this.model.valid()) {
      toast(S.edBlockedPlay);
      return;
    }
    this.host.play(this.model.toSaved(''));
  }

  private clear(): void {
    this.model.clear();
    this.host.world.setMap(this.model.map);
  }
}
