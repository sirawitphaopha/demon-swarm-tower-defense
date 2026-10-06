import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Part } from '../materials';

export interface AddOpts {
  pos?: [number, number, number];
  /** หมุน (เรเดียน) ลำดับ XYZ */
  rot?: [number, number, number];
  scale?: number | [number, number, number];
  /** ความสว่างเรืองแสง 0..1 */
  glow?: number;
  part?: number;
  /** จุดหมุนของชิ้นส่วน (ขา/ปีก/ลำกล้อง) หรือค่าพิเศษของ Part.Worm/Sway */
  pivot?: [number, number, number];
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

/**
 * ประกอบโมเดล low-poly จากรูปทรงพื้นฐาน → geometry เดียว (non-indexed)
 * พร้อม attribute: color, aGlow, aPart, aPivot, aSmooth (normal เฉลี่ยสำหรับเส้นขอบ)
 */
export class ModelBuilder {
  private parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: AddOpts = {}): this {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const s = o.scale ?? 1;
    tmpS.set(...(typeof s === 'number' ? ([s, s, s] as [number, number, number]) : s));
    tmpQ.setFromEuler(tmpE.set(...(o.rot ?? [0, 0, 0])));
    tmpP.set(...(o.pos ?? [0, 0, 0]));
    tmpM.compose(tmpP, tmpQ, tmpS);
    g.applyMatrix4(tmpM);
    const n = g.attributes.position!.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    const glow = new Float32Array(n).fill(o.glow ?? 0);
    const part = new Float32Array(n).fill(o.part ?? Part.Body);
    const piv = new Float32Array(n * 3);
    const pv = o.pivot ?? [0, 0, 0];
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      piv[i * 3] = pv[0];
      piv[i * 3 + 1] = pv[1];
      piv[i * 3 + 2] = pv[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
    g.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3));
    this.parts.push(g);
    return this;
  }

  /** เพิ่มทรงกระบอกจากจุด a ไปจุด b (ใช้ทำขา/เสา/ลำกล้อง) */
  limb(a: [number, number, number], b: [number, number, number], r0: number, r1: number, color: THREE.ColorRepresentation, o: AddOpts = {}, sides = 5): this {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const geo = new THREE.CylinderGeometry(r1, r0, len, sides, 1);
    geo.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    geo.applyQuaternion(q);
    geo.translate(va.x, va.y, va.z);
    return this.add(geo, color, { ...o, pos: undefined, rot: undefined, scale: undefined });
  }

  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false);
    if (!g) throw new Error('merge failed');
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    addSmoothNormals(g);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** normal เฉลี่ยตามตำแหน่ง vertex (ให้เส้นขอบไม่แตกตรงขอบคม) */
export function addSmoothNormals(g: THREE.BufferGeometry): void {
  const pos = g.attributes.position!;
  const nor = g.attributes.normal!;
  const map = new Map<string, THREE.Vector3>();
  const key = (i: number) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const v = map.get(k) ?? new THREE.Vector3();
    v.x += nor.getX(i);
    v.y += nor.getY(i);
    v.z += nor.getZ(i);
    map.set(k, v);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = map.get(key(i))!;
    const l = v.length() || 1;
    out[i * 3] = v.x / l;
    out[i * 3 + 1] = v.y / l;
    out[i * 3 + 2] = v.z / l;
  }
  g.setAttribute('aSmooth', new THREE.BufferAttribute(out, 3));
}

// ── รูปทรงพื้นฐาน low-poly ─────────────────────────
export const sphere = (r = 1, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
export const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
export const cyl = (rt: number, rb: number, h: number, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
export const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg, 1);
export const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
export const octa = (r: number) => new THREE.OctahedronGeometry(r, 0);
export const dodeca = (r: number) => new THREE.DodecahedronGeometry(r, 0);
export const torus = (r: number, tube: number, rs = 5, ts = 10, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, rs, ts, arc);

/** ทรงก้อนหินบิดเบี้ยวจาก seed */
export function rockGeo(r: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 0);
  const p = g.attributes.position!;
  let s = Math.floor(seed * 1e6) || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const seen = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let f = seen.get(k);
    if (f === undefined) {
      f = 0.78 + rnd() * 0.4;
      seen.set(k, f);
    }
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.8, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return g;
}
