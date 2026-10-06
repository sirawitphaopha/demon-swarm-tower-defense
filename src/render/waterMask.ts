import * as THREE from 'three';
import { COLS, ROWS, Cell } from '../config/constants';
import type { MapData, Pond } from '../core/map';
import { pondRadius } from '../core/pond';

/**
 * water mask ของสนาม (texture ขนาด COLS*res × ROWS*res)
 * R = น้ำ · G = ทรายชายหาด · B = ดินโคลนรอบนอก · A = ความลึก (เบลอมาก ยิ่งกลางแอ่งยิ่งลึก)
 * แอ่งน้ำสุ่มใช้รูปทรง pondRadius จริง · น้ำที่วาดเองใช้วงกลมซ้อนต่อช่องเหมือนเวอร์ชันเดิม
 */
export class WaterMask {
  readonly texture: THREE.DataTexture;
  private data: Uint8Array;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;
  hasWater = false;

  constructor(readonly res: number) {
    this.w = COLS * res;
    this.h = ROWS * res;
    this.data = new Uint8Array(this.w * this.h * 4);
    this.texture = new THREE.DataTexture(this.data, this.w, this.h, THREE.RGBAFormat);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  update(map: MapData): void {
    const res = this.res;
    const water: [number, number][] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (map.grid.get(c, r) === Cell.Water) water.push([c, r]);
    this.hasWater = water.length > 0 || map.ponds.length > 0;

    const layer = (pondScale: number, cellR: number, blurCells: number): Uint8ClampedArray => {
      const g = this.ctx;
      g.filter = 'none';
      g.fillStyle = '#000';
      g.fillRect(0, 0, this.w, this.h);
      g.filter = blurCells > 0 ? `blur(${(blurCells * res).toFixed(2)}px)` : 'none';
      g.fillStyle = '#fff';
      for (const p of map.ponds) this.blob(p, pondScale);
      for (const [c, r] of water) {
        g.beginPath();
        g.arc((c + 0.5) * res, (r + 0.5) * res, cellR * res, 0, Math.PI * 2);
        g.fill();
      }
      return g.getImageData(0, 0, this.w, this.h).data;
    };
    const R = layer(1.0, 0.68, 0.06);
    const G = layer(1.07, 0.86, 0.12);
    const B = layer(1.16, 1.02, 0.25);
    const A = layer(0.92, 0.6, 0.9);
    const d = this.data;
    for (let i = 0; i < this.w * this.h; i++) {
      d[i * 4] = R[i * 4]!;
      d[i * 4 + 1] = G[i * 4]!;
      d[i * 4 + 2] = B[i * 4]!;
      d[i * 4 + 3] = A[i * 4]!;
    }
    this.texture.needsUpdate = true;
  }

  private blob(p: Pond, scale: number): void {
    const g = this.ctx;
    const res = this.res;
    const cx = (p.cx + 0.5) * res;
    const cy = (p.cy + 0.5) * res;
    const steps = 72;
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const w = pondRadius(p, a) * scale;
      const x = cx + Math.cos(a) * p.rx * res * w;
      const y = cy + Math.sin(a) * p.ry * res * w;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
  }

  dispose(): void {
    this.texture.dispose();
  }
}
