// เมาส์ + คีย์บอร์ด: แยก "คลิก" กับ "ลาก" (ขยับเกิน 5px = ลาก เหมือนเกณฑ์เดิมของคลิกขวา)
// ใช้ e.code ทำให้ปุ่มลัดทำงานแม้เปิดแป้นพิมพ์ภาษาไทยอยู่

const DRAG_PX = 5;

export interface InputHandlers {
  /** คลิกซ้าย (ไม่ลาก) */
  click(x: number, y: number): void;
  /** คลิกขวา (ไม่ลาก) */
  rightClick(x: number, y: number): void;
  hover(x: number, y: number): void;
  leave(): void;
  /** ลากเมาส์ซ้าย/ขวาเพื่อวาด (หน้าสร้างแมพ) */
  paint(x: number, y: number, erase: boolean, first: boolean): void;
  paintEnd(): void;
  /** เลื่อนกล้องแบบจับพื้น */
  grab(x: number, y: number, first: boolean): void;
  rotate(dx: number, dy: number): void;
  zoom(factor: number, x: number, y: number): void;
  key(code: string, e: KeyboardEvent): void;
}

export class Input {
  /** หน้าสร้างแมพ: ลากซ้าย/ขวา = วาด/ลบ (แทนการหมุนกล้อง) */
  paintMode = false;
  enabled = true;
  readonly held = new Set<string>();
  private down = -1;
  private sx = 0;
  private sy = 0;
  private lx = 0;
  private ly = 0;
  private dragging = false;
  private painting = false;

  constructor(
    private el: HTMLElement,
    private h: InputHandlers,
  ) {
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointerleave', () => this.h.leave());
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('auxclick', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled || this.down !== -1) return;
    this.down = e.button;
    this.sx = this.lx = e.clientX;
    this.sy = this.ly = e.clientY;
    this.dragging = false;
    this.el.setPointerCapture?.(e.pointerId);
    if (e.button === 1) {
      e.preventDefault();
      this.h.grab(e.clientX, e.clientY, true);
    }
    if (this.paintMode && (e.button === 0 || e.button === 2)) {
      this.painting = true;
      this.h.paint(e.clientX, e.clientY, e.button === 2, true);
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.enabled) return;
    const dx = e.clientX - this.lx;
    const dy = e.clientY - this.ly;
    this.lx = e.clientX;
    this.ly = e.clientY;
    if (this.down !== -1 && Math.hypot(e.clientX - this.sx, e.clientY - this.sy) > DRAG_PX) this.dragging = true;
    if (e.target === this.el || this.down !== -1) this.h.hover(e.clientX, e.clientY);
    if (this.down === 1) this.h.grab(e.clientX, e.clientY, false);
    else if (this.painting) this.h.paint(e.clientX, e.clientY, this.down === 2, false);
    else if (this.down === 2 && this.dragging) this.h.rotate(dx, dy);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.button !== this.down) return;
    const wasDrag = this.dragging;
    this.down = -1;
    this.dragging = false;
    if (this.painting) {
      this.painting = false;
      this.h.paintEnd();
      return;
    }
    if (!this.enabled || wasDrag || e.target !== this.el) return;
    if (e.button === 0) this.h.click(e.clientX, e.clientY);
    else if (e.button === 2) this.h.rightClick(e.clientX, e.clientY);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (!this.enabled) return;
    const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    this.h.zoom(Math.exp(THREE_CLAMP(d, -300, 300) * 0.0011), e.clientX, e.clientY);
  };

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!e.repeat) this.h.key(e.code, e);
    this.held.add(e.code);
  };

  isHeld(...codes: string[]): boolean {
    return codes.some((c) => this.held.has(c));
  }
}

function THREE_CLAMP(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
