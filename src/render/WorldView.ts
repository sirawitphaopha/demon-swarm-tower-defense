import * as THREE from 'three';
import { COLS, ROWS, SPAWN_ROW, Cell } from '../config/constants';
import { QUALITY, type Quality } from '../config/quality';
import { THEMES, type ObstacleType, type ThemeDef } from '../config/themes';
import type { MapData } from '../core/map';
import { pondRadius } from '../core/pond';
import { mulberry32 } from '../core/rng';
import { HALF_H, HALF_W, wx, wz } from './coords';
import { createAnimDepthMaterial, createToonMaterial, sharedUniforms } from './materials';
import { FLOWER_COLORS, bushModel, flowerModel, grassModel, obstacleModel, reedModel } from './models/nature';
import { ModelBuilder, box, cyl, rockGeo, torus } from './models/geom';
import { WaterMask } from './waterMask';

// ฉากคงที่ของแมพ: พื้นสนาม + เนินรอบนอก + น้ำ + ต้นไม้/หิน + ของตกแต่ง + ประตู IN/OUT

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/** ระยะห่างจากขอบสนาม (0 = ในสนาม) */
function outsideDist(X: number, Z: number): number {
  const dx = Math.max(0, Math.abs(X) - HALF_W);
  const dz = Math.max(0, Math.abs(Z) - HALF_H);
  return Math.hypot(dx, dz);
}

/** ความสูงพื้นรอบนอก (เนินเขา) — ในสนามแบนที่ 0 เสมอ */
export function terrainHeight(X: number, Z: number): number {
  const d = outsideDist(X, Z);
  if (d <= 1.2) return 0;
  const n = Math.sin(X * 0.21 + Math.cos(Z * 0.17) * 1.7) * 0.5 + Math.sin(Z * 0.33 - X * 0.12) * 0.35 + Math.sin((X + Z) * 0.07) * 0.6;
  const ramp = THREE.MathUtils.smoothstep(d, 1.2, 14);
  return ramp * (1.6 + n * 1.3 + d * 0.12);
}

/** InstancedMesh พร้อมเส้นขอบ + เงา จากโมเดล toon */
function propMesh(geo: THREE.BufferGeometry, mat: THREE.Material, count: number, shadows: boolean): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
  m.count = count;
  m.castShadow = shadows;
  m.receiveShadow = true;
  m.customDepthMaterial = sharedDepth();
  m.frustumCulled = false;
  return m;
}

let depthMat: THREE.MeshDepthMaterial | null = null;
const sharedDepth = () => (depthMat ??= createAnimDepthMaterial());

export class WorldView {
  readonly group = new THREE.Group();
  private mask: WaterMask;
  private toon = createToonMaterial();
  private fieldMat: THREE.MeshLambertMaterial;
  private waterMat: THREE.ShaderMaterial;
  private dynamic = new THREE.Group();
  private decorGroup = new THREE.Group();
  private disposables: { dispose(): void }[] = [];
  private map: MapData | null = null;
  private theme: ThemeDef = THEMES.meadow;
  private portalMat: THREE.ShaderMaterial;

  constructor(private quality: Quality) {
    this.mask = new WaterMask(QUALITY[quality].waterRes);
    this.fieldMat = this.makeFieldMaterial();
    this.waterMat = this.makeWaterMaterial();
    this.portalMat = this.makePortalMaterial();
    this.group.add(this.dynamic, this.decorGroup);
  }

  // ── วัสดุพื้น: สีหญ้าตามธีม + แถบโคลน/ทรายจาก water mask ──
  private makeFieldMaterial(): THREE.MeshLambertMaterial {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMask = { value: this.mask.texture };
      sh.uniforms.uSand = { value: new THREE.Color('#e8d49a') };
      sh.uniforms.uMud = { value: new THREE.Color('#9c8250') };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFieldUv;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvFieldUv = vec2((position.x + ${HALF_W.toFixed(1)}) / ${COLS.toFixed(1)}, (position.z + ${HALF_H.toFixed(1)}) / ${ROWS.toFixed(1)});`);
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec2 vFieldUv;
uniform sampler2D uMask;
uniform vec3 uSand;
uniform vec3 uMud;
float fhash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float fnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fhash(i), fhash(i + vec2(1.0, 0.0)), f.x), mix(fhash(i + vec2(0.0, 1.0)), fhash(i + vec2(1.0, 1.0)), f.x), f.y);
}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec2 gp = vFieldUv * vec2(${COLS.toFixed(1)}, ${ROWS.toFixed(1)});
float gn = fnoise(gp * 0.45) * 0.6 + fnoise(gp * 2.3) * 0.3 + fnoise(gp * 9.0) * 0.1;
diffuseColor.rgb *= 0.9 + gn * 0.2;
vec4 wm = (vFieldUv.x >= 0.0 && vFieldUv.x <= 1.0 && vFieldUv.y >= 0.0 && vFieldUv.y <= 1.0) ? texture2D(uMask, vFieldUv) : vec4(0.0);
diffuseColor.rgb = mix(diffuseColor.rgb, uMud, smoothstep(0.25, 0.6, wm.b) * 0.85);
diffuseColor.rgb = mix(diffuseColor.rgb, uSand, smoothstep(0.3, 0.65, wm.g));
diffuseColor.rgb = mix(diffuseColor.rgb, uMud * 0.55, smoothstep(0.4, 0.9, wm.r));`,
        );
    };
    mat.customProgramCacheKey = () => 'field';
    return mat;
  }

  // ── น้ำ: plane เดียว ใช้ mask กำหนดขอบ/ความลึก + ระลอกคลื่น/ฟอง/ประกาย ──
  private makeWaterMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uMask: { value: null },
          uTime: sharedUniforms.uTime,
          uShallow: { value: new THREE.Color('#5ec4f0') },
          uDeep: { value: new THREE.Color('#1a6aa8') },
        },
      ]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
          vUv = vec2((position.x + ${HALF_W.toFixed(1)}) / ${COLS.toFixed(1)}, (position.z + ${HALF_H.toFixed(1)}) / ${ROWS.toFixed(1)});
          vPos = position;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform sampler2D uMask;
        uniform float uTime;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        varying vec2 vUv;
        varying vec3 vPos;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        void main() {
          vec4 m = texture2D(uMask, vUv);
          float w = m.r;
          if (w < 0.42) discard;
          float edge = smoothstep(0.42, 0.5, w);
          float depth = smoothstep(0.15, 0.95, m.a);
          vec3 col = mix(uShallow, uDeep, depth);
          // ระลอกคลื่นเคลื่อนไหว (noise สองชั้นเลื่อนสวนกัน)
          vec2 q = vPos.xz;
          float n1 = vnoise(q * 1.6 + vec2(uTime * 0.35, uTime * 0.21));
          float n2 = vnoise(q * 2.9 - vec2(uTime * 0.27, -uTime * 0.31));
          float rip = n1 + n2 - 1.0;
          col += vec3(0.06, 0.08, 0.09) * rip * 1.6;
          // ประกายแดดเป็นหย่อม
          float glint = smoothstep(0.86, 0.98, n1 * n2 * 1.75) * smoothstep(0.55, 0.75, w);
          col += vec3(0.9, 0.97, 1.0) * glint * 0.32;
          // ฟองริมฝั่ง
          float foam = (1.0 - smoothstep(0.5, 0.66, w)) * (0.65 + 0.35 * sin(uTime * 2.0 + vPos.x * 4.0 + vPos.z * 3.0));
          col = mix(col, vec3(0.93, 0.98, 1.0), foam * 0.75);
          gl_FragColor = vec4(col, edge * 0.94);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
  }

  // ── พอร์ทัล IN: วังวนสีแดงเรืองแสง ──
  private makePortalMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: { uTime: sharedUniforms.uTime },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv;
        void main(){
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;
          float a = atan(p.y, p.x);
          float sw = sin(a * 3.0 + r * 9.0 - uTime * 4.0) * 0.5 + 0.5;
          vec3 c = mix(vec3(0.55, 0.02, 0.18), vec3(2.6, 0.45, 0.25), sw * (1.0 - r * 0.6));
          c += vec3(2.2, 0.9, 0.5) * pow(1.0 - r, 3.0);
          gl_FragColor = vec4(c, smoothstep(1.0, 0.82, r) * 0.95);
        }`,
    });
  }

  setQuality(q: Quality): void {
    if (q === this.quality) return;
    this.quality = q;
    const res = QUALITY[q].waterRes;
    if (res !== this.mask.res) {
      this.mask.dispose();
      this.mask = new WaterMask(res);
      this.fieldMat.dispose();
      this.fieldMat = this.makeFieldMaterial();
    }
    if (this.map) this.setMap(this.map);
  }

  private track<T extends { dispose(): void }>(o: T): T {
    this.disposables.push(o);
    return o;
  }

  private clear(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.dynamic.clear();
    this.decorGroup.clear();
  }

  /** สร้างฉากใหม่ทั้งหมดตามแมพ */
  setMap(map: MapData): void {
    this.clear();
    this.map = map;
    this.theme = THEMES[map.theme];
    const shadows = QUALITY[this.quality].shadowMap > 0;
    const rng = mulberry32(1234 + map.obstacles.length * 7 + map.decor.length);

    this.buildField(rng);
    this.buildSurroundings(shadows);
    this.buildGates();
    this.mask.update(map);
    this.buildWater();
    this.rebuildProps();
    this.rebuildDecor();
  }

  /** เรียกเมื่อกริดเปลี่ยน (วาง/ขายป้อม หรือวาดแมพ) — ซ่อนของตกแต่งใต้ป้อม */
  onGridChanged(): void {
    this.rebuildDecor();
  }

  /** เรียกเมื่อแมพถูกแก้ไขในหน้าสร้างแมพ */
  onMapEdited(water: boolean, props: boolean, decor: boolean): void {
    if (!this.map) return;
    if (water) {
      this.mask.update(this.map);
      this.buildWater();
    }
    if (props) this.rebuildProps();
    if (decor) this.rebuildDecor();
  }

  private buildField(rng: () => number): void {
    const th = this.theme;
    const geo = this.track(new THREE.PlaneGeometry(COLS, ROWS, COLS * 2, ROWS * 2));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position!;
    const cols = new Float32Array(pos.count * 3);
    const top = new THREE.Color(th.top);
    const bot = new THREE.Color(th.bot);
    const tex = new THREE.Color(th.tex);
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i);
      const Z = pos.getZ(i);
      const t = (Z + HALF_H) / ROWS;
      tmpC.copy(top).lerp(bot, t);
      const n = Math.sin(X * 1.7 + Z * 0.9) * 0.5 + Math.sin(X * 0.43 - Z * 1.31) * 0.5;
      tmpC.lerp(tex, 0.08 + 0.08 * n + rng() * 0.06);
      cols[i * 3] = tmpC.r;
      cols[i * 3 + 1] = tmpC.g;
      cols[i * 3 + 2] = tmpC.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const field = new THREE.Mesh(geo, this.fieldMat);
    field.receiveShadow = true;
    field.name = 'field';
    this.dynamic.add(field);
  }

  private buildSurroundings(shadows: boolean): void {
    const th = this.theme;
    // พื้นรอบนอก: เนินเขาสีตามธีม (ใต้สนามต่ำลงเล็กน้อย)
    const W = 190;
    const H = 150;
    const geo = this.track(new THREE.PlaneGeometry(W, H, 95, 75));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position!;
    const cols = new Float32Array(pos.count * 3);
    const hill = new THREE.Color(th.hill);
    const grass = new THREE.Color(th.bot);
    const soil = new THREE.Color(th.soil);
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i);
      const Z = pos.getZ(i);
      const d = outsideDist(X, Z);
      const y = d < 0.01 ? -0.04 : terrainHeight(X, Z);
      pos.setY(i, y);
      tmpC.copy(grass).lerp(hill, THREE.MathUtils.smoothstep(d, 0.5, 10));
      if (d > 0 && d < 1.0) tmpC.lerp(soil, 0.35 * (1 - d));
      tmpC.multiplyScalar(0.93 + Math.sin(X * 0.9) * Math.sin(Z * 0.8) * 0.05 + y * 0.012);
      cols[i * 3] = tmpC.r;
      cols[i * 3 + 1] = tmpC.g;
      cols[i * 3 + 2] = tmpC.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, this.track(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    ground.receiveShadow = true;
    this.dynamic.add(ground);

    // ต้นไม้ล้อมรอบสนาม
    const rng = mulberry32(777);
    const types: ObstacleType[] = [...th.obs.filter((o) => o !== 'rock'), 'tree'];
    const spots: { t: ObstacleType; v: number; X: number; Z: number; s: number; a: number }[] = [];
    for (let i = 0; i < 520 && spots.length < 190; i++) {
      const X = (rng() - 0.5) * 120;
      const Z = (rng() - 0.5) * 92;
      const d = outsideDist(X, Z);
      if (d < 2.2 || d > 26) continue;
      if (Math.abs(Z - wz(SPAWN_ROW + 0.5)) < 3 && X < -HALF_W - 0.5 && X > -HALF_W - 8) continue; // เว้นหน้าพอร์ทัล
      if (rng() > 0.35 + d * 0.04) continue;
      spots.push({ t: types[Math.floor(rng() * types.length)]!, v: rng() < 0.5 ? 0 : 1, X, Z, s: 1.1 + rng() * 0.9, a: rng() * 6.28 });
    }
    // หินประปราย
    for (let i = 0; i < 40; i++) {
      const X = (rng() - 0.5) * 110;
      const Z = (rng() - 0.5) * 84;
      const d = outsideDist(X, Z);
      if (d < 1.5 || d > 22) continue;
      spots.push({ t: 'rock', v: rng() < 0.5 ? 0 : 1, X, Z, s: 0.8 + rng() * 1.2, a: rng() * 6.28 });
    }
    this.instanceSpots(spots, shadows);

    // หินขอบสนาม (บน/ล่าง + ซ้ายยกเว้นหน้าพอร์ทัล)
    const curb = new ModelBuilder();
    const crng = mulberry32(99);
    const addCurb = (X: number, Z: number) => curb.add(rockGeo(0.2 + crng() * 0.08, crng()), crng() < 0.5 ? '#a49c8c' : '#8e877a', { pos: [X, 0.08, Z], rot: [0, crng() * 6, 0] });
    for (let c = 0; c <= COLS; c += 1) {
      addCurb(c - HALF_W, -HALF_H - 0.35);
      addCurb(c - HALF_W, HALF_H + 0.35);
    }
    for (let r = 0; r < ROWS; r++) if (Math.abs(r - SPAWN_ROW) > 1) addCurb(-HALF_W - 0.35, r + 0.5 - HALF_H);
    const curbMesh = new THREE.Mesh(this.track(curb.build()), this.toon);
    curbMesh.castShadow = shadows;
    curbMesh.receiveShadow = true;
    this.dynamic.add(curbMesh);
  }

  private instanceSpots(spots: { t: ObstacleType; v: number; X: number; Z: number; s: number; a: number }[], shadows: boolean): void {
    const groups = new Map<string, typeof spots>();
    for (const s of spots) {
      const k = `${s.t}${s.v}`;
      const list = groups.get(k) ?? [];
      list.push(s);
      groups.set(k, list);
    }
    for (const [, list] of groups) {
      const first = list[0]!;
      const mesh = propMesh(obstacleModel(first.t, first.v), this.toon, list.length, shadows);
      list.forEach((s, i) => {
        tmpQ.setFromAxisAngle(UP, s.a);
        tmpM.compose(tmpV.set(s.X, terrainHeight(s.X, s.Z) - 0.05, s.Z), tmpQ, tmpS.setScalar(s.s));
        mesh.setMatrixAt(i, tmpM);
        mesh.setColorAt(i, tmpC.setScalar(0.88 + ((s.a * 13.7) % 1) * 0.2));
      });
      this.dynamic.add(mesh);
      this.disposables.push({ dispose: () => mesh.dispose() });
    }
  }

  private buildGates(): void {
    // พอร์ทัล IN (ซ้าย)
    const z = wz(SPAWN_ROW + 0.5);
    const b = new ModelBuilder();
    b.add(torus(0.9, 0.16, 5, 12, Math.PI), '#4a3a4e', { rot: [0, Math.PI / 2, 0] });
    for (const s of [1, -1]) {
      b.add(box(0.36, 0.5, 0.36), '#3a2e3e', { pos: [0, 0.25, 0.9 * s] });
      b.add(box(0.06, 0.3, 0.2), '#ff3a2a', { pos: [0.19, 0.6, 0.9 * s], glow: 1 });
    }
    for (let i = 0; i < 5; i++) {
      const a = 0.35 + (i / 4) * (Math.PI - 0.7);
      b.add(box(0.05, 0.16, 0.08), '#ff4a2a', { pos: [0.17, Math.sin(a) * 0.9, Math.cos(a) * 0.9], rot: [-a + Math.PI / 2, 0, 0], glow: 1 });
    }
    const arch = new THREE.Mesh(this.track(b.build()), this.toon);
    arch.position.set(-HALF_W - 0.25, 0, z);
    arch.scale.setScalar(1.5);
    arch.castShadow = true;
    this.dynamic.add(arch);
    const disc = new THREE.Mesh(this.track(new THREE.CircleGeometry(0.8, 32)), this.portalMat);
    disc.rotation.y = Math.PI / 2;
    disc.position.set(-HALF_W - 0.25, 0.93, z);
    disc.scale.set(1.5, 1.3, 1.5);
    this.dynamic.add(disc);

    // แนว OUT (ขวา): แถบเรืองแสงฟ้า + ลูกศรบนพื้น
    const out = new ModelBuilder();
    out.add(box(0.1, 0.04, ROWS), '#5ab8ff', { pos: [0, 0.02, 0], glow: 0.55 });
    for (let r = 1; r < ROWS; r += 3) {
      const zz = r + 0.5 - HALF_H;
      for (const s of [1, -1]) out.add(box(0.36, 0.02, 0.07), '#8ad0ff', { pos: [-0.55, 0.012, zz + 0.12 * s], rot: [0, 0.6 * s, 0], glow: 0.45 });
    }
    for (const s of [1, -1]) {
      out.add(cyl(0.07, 0.09, 1.4, 6), '#e8e0d0', { pos: [0.25, 0.7, s * (HALF_H + 0.2)] });
      out.add(box(0.03, 0.5, 0.5), '#3a8ae0', { pos: [0.25, 1.1, s * (HALF_H + 0.2) - s * 0.28], glow: 0.25 });
    }
    const outMesh = new THREE.Mesh(this.track(out.build()), this.toon);
    outMesh.position.set(HALF_W, 0, 0);
    this.dynamic.add(outMesh);
  }

  private buildWater(): void {
    const old = this.dynamic.getObjectByName('water');
    if (old) {
      this.dynamic.remove(old);
      (old as THREE.Mesh).geometry.dispose();
    }
    if (!this.mask.hasWater) return;
    const geo = new THREE.PlaneGeometry(COLS, ROWS, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.waterMat.uniforms.uMask!.value = this.mask.texture;
    const water = new THREE.Mesh(geo, this.waterMat);
    water.position.y = 0.05;
    water.name = 'water';
    water.renderOrder = 1;
    this.dynamic.add(water);
  }

  private propsGroup = new THREE.Group();

  /** ต้นไม้/หินในสนาม + กกริมแอ่ง */
  rebuildProps(): void {
    const map = this.map;
    if (!map) return;
    this.propsGroup.children.forEach((c) => (c as THREE.InstancedMesh).dispose());
    this.propsGroup.clear();
    this.dynamic.add(this.propsGroup);
    const shadows = QUALITY[this.quality].shadowMap > 0;
    const variants = this.quality === 'low' ? 1 : 2;
    const groups = new Map<string, { type: ObstacleType; v: number; items: MapData['obstacles'] }>();
    for (const o of map.obstacles) {
      const v = variants > 1 && o.seed >= 0.5 ? 1 : 0;
      const k = `${o.type}${v}`;
      const g = groups.get(k) ?? { type: o.type, v, items: [] };
      g.items.push(o);
      groups.set(k, g);
    }
    for (const g of groups.values()) {
      const mesh = propMesh(obstacleModel(g.type, g.v), this.toon, g.items.length, shadows);
      g.items.forEach((o, i) => {
        const s = o.seed;
        tmpQ.setFromAxisAngle(UP, s * Math.PI * 2);
        tmpM.compose(tmpV.set(wx(o.c + 0.5), 0, wz(o.r + 0.5)), tmpQ, tmpS.setScalar(1.08 + ((s * 7.31) % 1) * 0.26));
        mesh.setMatrixAt(i, tmpM);
        mesh.setColorAt(i, tmpC.setScalar(0.9 + ((s * 3.7) % 1) * 0.18));
      });
      this.propsGroup.add(mesh);
    }
    // กกริมแอ่งน้ำ
    const reeds: [number, number, number][] = [];
    for (const p of map.ponds) {
      for (const g of p.grass) {
        const w = pondRadius(p, g.ang) * 1.04;
        reeds.push([p.cx + 0.5 + Math.cos(g.ang) * p.rx * w, p.cy + 0.5 + Math.sin(g.ang) * p.ry * w, g.s]);
      }
    }
    if (reeds.length) {
      const mesh = propMesh(reedModel(), this.toon, reeds.length, false);
      reeds.forEach(([x, y, s], i) => {
        tmpQ.setFromAxisAngle(UP, x * 3.1);
        tmpM.compose(tmpV.set(wx(x), 0, wz(y)), tmpQ, tmpS.setScalar(s * 1.3));
        mesh.setMatrixAt(i, tmpM);
      });
      this.propsGroup.add(mesh);
    }
  }

  /** ของตกแต่งพื้น (ไม่แสดงในช่องที่มีสิ่งกีดขวาง/น้ำ/ป้อม) */
  rebuildDecor(): void {
    const map = this.map;
    if (!map) return;
    this.decorGroup.children.forEach((c) => (c as THREE.InstancedMesh).dispose());
    this.decorGroup.clear();
    const buckets = new Map<string, MapData['decor']>();
    for (const d of map.decor) {
      const c = Math.min(COLS - 1, Math.floor(d.fx * COLS));
      const r = Math.min(ROWS - 1, Math.floor(d.fy * ROWS));
      if (map.grid.get(c, r) !== Cell.Empty) continue;
      const k = d.type === 'flower' ? `flower${Math.floor(d.seed * FLOWER_COLORS.length)}` : d.type;
      const list = buckets.get(k) ?? [];
      list.push(d);
      buckets.set(k, list);
    }
    for (const [k, list] of buckets) {
      const geo = k === 'grass' ? grassModel() : k === 'bush' ? bushModel() : flowerModel(Number(k.slice(6)));
      const mesh = propMesh(geo, this.toon, list.length, false);
      list.forEach((d, i) => {
        tmpQ.setFromAxisAngle(UP, d.seed * 40);
        const sc = d.type === 'bush' ? d.s * 1.25 : d.s * 1.7;
        tmpM.compose(tmpV.set(wx(d.fx * COLS), 0, wz(d.fy * ROWS)), tmpQ, tmpS.setScalar(sc));
        mesh.setMatrixAt(i, tmpM);
      });
      this.decorGroup.add(mesh);
    }
  }

  dispose(): void {
    this.clear();
    this.propsGroup.children.forEach((c) => (c as THREE.InstancedMesh).dispose());
    this.mask.dispose();
    this.toon.dispose();
    this.fieldMat.dispose();
    this.waterMat.dispose();
    this.portalMat.dispose();
  }
}
