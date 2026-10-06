import * as THREE from 'three';
import { HIT_FLASH_SEC } from '../config/constants';
import { ENEMIES, ENEMY_ORDER, type EnemyId } from '../config/enemies';
import { QUALITY, type Quality } from '../config/quality';
import { TORDER, TOWERS, type TowerId } from '../config/towers';
import type { Enemy, Tower } from '../core/entities';
import type { GameEvent } from '../core/events';
import type { Game } from '../core/Game';
import { wx, wz } from './coords';
import { Effects } from './Effects';
import { createAnimDepthMaterial, createOutlineMaterial, createToonMaterial } from './materials';
import { insectModel } from './models/insects';
import { towerModel } from './models/towers';

// ป้อม + ศัตรู + กระสุน + แถบเลือด + เอฟเฟกต์ (InstancedMesh ทั้งหมด เขียน matrix ใหม่ทุกเฟรม)

const tmpM = new THREE.Matrix4();
const tmpM2 = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const XAXIS = new THREE.Vector3(1, 0, 0);
const OUTLINE_DARK = new THREE.Color(0x1d2a12);

/** ขนาดโมเดลศัตรูจาก sz (เดิมรัศมี sz ช่อง → ยาว ~2.1·sz) */
export const enemyScale = (id: EnemyId): number => ENEMIES[id].sz * 2.15;

/** ความสูงกึ่งกลางตัวศัตรู (จุดที่กระสุนพุ่งเข้า) */
export function enemyCenterY(id: EnemyId): number {
  const m = insectModel(id);
  return m.hover + m.centerY * enemyScale(id);
}

interface Pool {
  mesh: THREE.InstancedMesh;
  outline: THREE.InstancedMesh | null;
  extra: THREE.InstancedMesh | null;
  flash: THREE.InstancedBufferAttribute;
  phase: THREE.InstancedBufferAttribute;
  cap: number;
}

interface Corpse {
  kind: EnemyId;
  X: number;
  Z: number;
  yaw: number;
  t: number;
}

interface TowerAnim {
  yaw: number;
  fired: number;
  placed: number;
  spin: number;
}

interface ProjAnim {
  d0: number;
  h0: number;
  X: number;
  Y: number;
  Z: number;
}

const PROJ_SHAPES: Record<TowerId, { geo: () => THREE.BufferGeometry; color: string; k: number; arc: number }> = {
  stone: { geo: () => new THREE.DodecahedronGeometry(0.08, 0), color: '#8a8478', k: 1, arc: 0.7 },
  arrow: { geo: () => new THREE.BoxGeometry(0.34, 0.025, 0.025), color: '#9ae070', k: 1.6, arc: 0.15 },
  crossbow: { geo: () => new THREE.BoxGeometry(0.3, 0.035, 0.035), color: '#ffa040', k: 2.2, arc: 0.05 },
  cannon: { geo: () => new THREE.SphereGeometry(0.12, 8, 6), color: '#3a3a44', k: 1, arc: 0.9 },
  machinegun: { geo: () => new THREE.BoxGeometry(0.22, 0.035, 0.035), color: '#ffd050', k: 3, arc: 0 },
  laser: { geo: () => new THREE.CapsuleGeometry(0.05, 0.5, 2, 6).rotateZ(Math.PI / 2), color: '#5aa8ff', k: 4.5, arc: 0 },
};

export class UnitsView {
  readonly group = new THREE.Group();
  readonly effects: Effects;
  private unitMat = createToonMaterial({ flash: true });
  private wingMat = createToonMaterial({ transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  private outlineMat = createOutlineMaterial(0.016, 0xffffff);
  private depthMat = createAnimDepthMaterial();
  private enemyPools = new Map<EnemyId, Pool>();
  private towerBase = new Map<TowerId, Pool>();
  private towerHead = new Map<TowerId, Pool>();
  private projMeshes = new Map<TowerId, THREE.InstancedMesh>();
  private barBg: THREE.InstancedMesh;
  private barFill: THREE.InstancedMesh;
  private blobs: THREE.InstancedMesh;
  private yaw = new Map<number, number>();
  private towerAnim = new Map<number, TowerAnim>();
  private projAnim = new Map<number, ProjAnim>();
  private corpses: Corpse[] = [];
  private time = 0;
  private shadows = true;
  private outlines = true;
  selectedTowerId = -1;

  constructor(quality: Quality) {
    this.effects = new Effects(QUALITY[quality].particles);
    this.group.add(this.effects.group);
    for (const id of ENEMY_ORDER) this.enemyPools.set(id, this.makeEnemyPool(id, 64));
    for (const id of TORDER) {
      const m = towerModel(id);
      this.towerBase.set(id, this.makePool(m.base, 32, true));
      this.towerHead.set(id, this.makePool(m.head, 32, true));
    }
    for (const id of TORDER) {
      const s = PROJ_SHAPES[id];
      const c = new THREE.Color(s.color).multiplyScalar(s.k);
      const mesh = new THREE.InstancedMesh(s.geo(), new THREE.MeshBasicMaterial({ color: c }), 256);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.projMeshes.set(id, mesh);
      this.group.add(mesh);
    }
    // แถบเลือด (billboard)
    const barGeo = new THREE.PlaneGeometry(1, 1);
    this.barBg = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false, transparent: true, opacity: 0.85 }), 512);
    this.barFill = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }), 512);
    this.barFill.setColorAt(0, tmpC.set(0xffffff));
    for (const m of [this.barBg, this.barFill]) {
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.barBg.renderOrder = 20;
    this.barFill.renderOrder = 21;
    // เงาวงกลมใต้ตัว (คุณภาพต่ำ / ตัวบิน)
    const blobGeo = new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2);
    this.blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }), 768);
    this.blobs.count = 0;
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 2;
    this.group.add(this.blobs);
    this.setQuality(quality);
  }

  setQuality(q: Quality): void {
    const cfg = QUALITY[q];
    this.shadows = cfg.shadowMap > 0;
    this.outlines = cfg.outline;
    this.effects.setMax(cfg.particles);
    const all = [...this.enemyPools.values(), ...this.towerBase.values(), ...this.towerHead.values()];
    for (const p of all) p.mesh.castShadow = this.shadows;
  }

  private makePool(geo: THREE.BufferGeometry, cap: number, withOutline: boolean): Pool {
    const g = geo.clone();
    const flash = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    const phase = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    g.setAttribute('aFlash', flash);
    g.setAttribute('aPhase', phase);
    const mesh = new THREE.InstancedMesh(g, this.unitMat, cap);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = this.depthMat;
    this.group.add(mesh);
    let outline: THREE.InstancedMesh | null = null;
    if (withOutline) {
      outline = new THREE.InstancedMesh(g, this.outlineMat, cap);
      outline.instanceMatrix = mesh.instanceMatrix;
      outline.count = 0;
      outline.frustumCulled = false;
      const oc = new Float32Array(cap * 3);
      for (let i = 0; i < cap; i++) OUTLINE_DARK.toArray(oc, i * 3);
      outline.instanceColor = new THREE.InstancedBufferAttribute(oc, 3);
      this.group.add(outline);
    }
    return { mesh, outline, extra: null, flash, phase, cap };
  }

  private makeEnemyPool(id: EnemyId, cap: number): Pool {
    const m = insectModel(id);
    const p = this.makePool(m.body, cap, true);
    if (m.wings) {
      const wg = m.wings.clone();
      wg.setAttribute('aPhase', p.phase);
      const extra = new THREE.InstancedMesh(wg, this.wingMat, cap);
      extra.instanceMatrix = p.mesh.instanceMatrix;
      extra.count = 0;
      extra.frustumCulled = false;
      extra.renderOrder = 3;
      this.group.add(extra);
      p.extra = extra;
    }
    return p;
  }

  /** ขยายความจุเมื่อจำนวนเกิน (ทีละเท่าตัว) */
  private ensure(map: Map<EnemyId, Pool> | Map<TowerId, Pool>, key: string, need: number, rebuild: (cap: number) => Pool): Pool {
    const m = map as Map<string, Pool>;
    let p = m.get(key)!;
    if (need <= p.cap) return p;
    let cap = p.cap;
    while (cap < need) cap *= 2;
    for (const mesh of [p.mesh, p.outline, p.extra]) {
      if (!mesh) continue;
      this.group.remove(mesh);
      mesh.geometry.dispose();
      mesh.dispose();
    }
    p = rebuild(cap);
    m.set(key, p);
    return p;
  }

  reset(): void {
    this.yaw.clear();
    this.towerAnim.clear();
    this.projAnim.clear();
    this.corpses = [];
    this.selectedTowerId = -1;
    this.effects.clear();
  }

  /** แปลงเหตุการณ์ของเกมเป็นเอฟเฟกต์ภาพ */
  onEvents(events: readonly GameEvent[], game: Game): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'enemyKilled': {
          const def = ENEMIES[ev.kind];
          const X = wx(ev.x);
          const Z = wz(ev.y);
          const y = enemyCenterY(ev.kind);
          this.effects.burst(X, y, Z, def.col, 10, { speed: 2.4, up: 2.2, size: 0.07 + def.sz * 0.08 });
          this.effects.burst(X, y, Z, '#ffffff', 4, { speed: 1.2, up: 1.2, size: 0.12, glow: true, life: 0.3, intensity: 1.4 });
          this.corpses.push({ kind: ev.kind, X, Z, yaw: this.yaw.get(ev.id) ?? 0, t: this.time });
          this.yaw.delete(ev.id);
          break;
        }
        case 'enemyLeaked': {
          this.effects.burst(wx(ev.x), 0.4, wz(ev.y), '#ff3030', 8, { speed: 2.6, up: 2.4, glow: true, intensity: 2.2, size: 0.1 });
          this.yaw.delete(ev.id);
          break;
        }
        case 'projectileImpact': {
          const X = wx(ev.x);
          const Z = wz(ev.y);
          if (ev.aoe > 0) {
            this.effects.burst(X, 0.35, Z, '#ff8030', 14, { speed: 3.2, up: 2.6, glow: true, intensity: 2.4, size: 0.12, life: 0.5 });
            this.effects.burst(X, 0.2, Z, '#6a6a6a', 8, { speed: 1.4, up: 1.4, size: 0.14, grav: -0.6, life: 0.8, drag: 3 });
            this.effects.ring(X, Z, '#ffa040', ev.aoe, 0.45, 2.2);
          } else {
            const c = TOWERS[ev.kind].glow;
            this.effects.burst(X, 0.35, Z, c, 3, { speed: 1.6, up: 1.2, glow: true, intensity: 2, size: 0.07, life: 0.25 });
          }
          break;
        }
        case 'towerFired': {
          const tw = game.towerById(ev.towerId);
          const a = this.towerAnim.get(ev.towerId);
          if (a) a.fired = this.time;
          if (tw) {
            const m = towerModel(tw.kind);
            const yaw = a?.yaw ?? 0;
            const fx = Math.cos(yaw) * m.muzzle[0];
            const fz = -Math.sin(yaw) * m.muzzle[0];
            this.effects.burst(wx(tw.x) + fx, m.headY + m.muzzle[1], wz(tw.y) + fz, tw.def.glow, 2, {
              speed: 0.5,
              up: 0.4,
              glow: true,
              intensity: 2.6,
              size: tw.kind === 'laser' ? 0.2 : 0.12,
              life: 0.1,
              grav: 0,
            });
          }
          break;
        }
        case 'towerPlaced': {
          this.towerAnim.set(ev.id, { yaw: 0, fired: -9, placed: this.time, spin: 0 });
          this.effects.burst(wx(ev.c + 0.5), 0.1, wz(ev.r + 0.5), '#c8b48c', 10, { speed: 2.2, up: 1.2, size: 0.08, spread: 0.5, life: 0.5 });
          break;
        }
        case 'towerUpgraded': {
          const tw = game.towerById(ev.id);
          const a = this.towerAnim.get(ev.id);
          if (a) a.placed = this.time;
          if (tw) {
            this.effects.burst(wx(tw.x), 0.6, wz(tw.y), '#ffd84a', 16, { speed: 1.4, up: 3.2, glow: true, intensity: 2.2, size: 0.08, grav: 1.5, spread: 0.6, life: 0.8 });
            this.effects.ring(wx(tw.x), wz(tw.y), tw.def.glow, 0.9, 0.5, 2);
          }
          break;
        }
        case 'towerSold': {
          this.towerAnim.delete(ev.id);
          this.effects.burst(wx(ev.c + 0.5), 0.3, wz(ev.r + 0.5), '#ffd84a', 10, { speed: 1.8, up: 2.4, glow: true, intensity: 1.8, size: 0.08, life: 0.6 });
          break;
        }
        default:
          break;
      }
    }
  }

  /** อัปเดตภาพทุกเฟรม: alpha = สัดส่วนระหว่าง step, dt = เวลาภาพ (คูณ speed แล้ว) */
  update(game: Game | null, alpha: number, dt: number, camera: THREE.Camera): void {
    this.time += dt;
    this.effects.update(dt);
    if (!game) {
      this.hideAll();
      return;
    }
    this.updateTowers(game, alpha, dt);
    const bars = this.updateEnemies(game, alpha, dt, camera);
    this.updateProjectiles(game, alpha);
    this.barBg.count = bars;
    this.barFill.count = bars;
    this.barBg.visible = this.barFill.visible = bars > 0;
    this.barBg.instanceMatrix.needsUpdate = true;
    this.barFill.instanceMatrix.needsUpdate = true;
    if (this.barFill.instanceColor) this.barFill.instanceColor.needsUpdate = true;
  }

  private hideAll(): void {
    for (const p of [...this.enemyPools.values(), ...this.towerBase.values(), ...this.towerHead.values()]) this.commit(p, 0);
    for (const m of this.projMeshes.values()) {
      m.count = 0;
      m.visible = false;
    }
    this.barBg.count = this.barFill.count = this.blobs.count = 0;
    this.barBg.visible = this.barFill.visible = this.blobs.visible = false;
  }

  /** ตำแหน่งศัตรูที่คำนวณระหว่างเฟรม */
  private lerpPos(e: Enemy, alpha: number): [number, number] {
    return [e.px + (e.x - e.px) * alpha, e.py + (e.y - e.py) * alpha];
  }

  private updateTowers(game: Game, alpha: number, dt: number): void {
    const counts = new Map<TowerId, number>();
    for (const id of TORDER) counts.set(id, 0);
    for (const tw of game.towers) counts.set(tw.kind, counts.get(tw.kind)! + 1);
    for (const id of TORDER) {
      const n = counts.get(id)!;
      this.ensure(this.towerBase, id, n, (cap) => this.makePool(towerModel(id).base, cap, true));
      this.ensure(this.towerHead, id, n, (cap) => this.makePool(towerModel(id).head, cap, true));
      counts.set(id, 0);
    }
    const enemiesById = new Map<number, Enemy>();
    for (const e of game.enemies) enemiesById.set(e.id, e);

    for (const tw of game.towers) {
      const i = counts.get(tw.kind)!;
      counts.set(tw.kind, i + 1);
      const m = towerModel(tw.kind);
      let a = this.towerAnim.get(tw.id);
      if (!a) {
        a = { yaw: -tw.angle, fired: -9, placed: -9, spin: 0 };
        this.towerAnim.set(tw.id, a);
      }
      // หันหัวเข้าหาเป้า (ตำแหน่งระหว่างเฟรม)
      const tgt = enemiesById.get(tw.aimId);
      let goal = -tw.angle;
      if (tgt && !tgt.dead) {
        const [ex, ey] = this.lerpPos(tgt, alpha);
        goal = -Math.atan2(ey - tw.y, ex - tw.x);
      }
      let dYaw = goal - a.yaw;
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      a.yaw += dYaw * (1 - Math.exp(-dt * 14));
      const since = this.time - a.fired;
      const recoil = m.recoil * Math.exp(-since * 14) * (since >= 0 ? 1 : 0);
      if (tw.kind === 'machinegun') a.spin += dt * (since < 0.4 ? 26 : 2);
      // เด้งตอนวาง/อัปเกรด
      const pt = this.time - a.placed;
      const pop = pt < 0.35 ? 1 + Math.sin((pt / 0.35) * Math.PI) * 0.18 - (1 - pt / 0.35) * 0.25 : 1;
      const X = wx(tw.x);
      const Z = wz(tw.y);

      const base = this.towerBase.get(tw.kind)!;
      tmpM.compose(tmpV.set(X, 0, Z), tmpQ.identity(), tmpS.set(pop, pop, pop));
      base.mesh.setMatrixAt(i, tmpM);
      base.flash.setX(i, 0);
      base.phase.setX(i, 0);
      const head = this.towerHead.get(tw.kind)!;
      tmpQ.setFromAxisAngle(UP, a.yaw);
      tmpV.set(X - Math.cos(a.yaw) * recoil, m.headY * pop, Z + Math.sin(a.yaw) * recoil);
      if (tw.kind === 'laser') tmpV.y += Math.sin(this.time * 2.2 + tw.id) * 0.04;
      tmpM.compose(tmpV, tmpQ, tmpS.set(pop, pop, pop));
      head.mesh.setMatrixAt(i, tmpM);
      head.flash.setX(i, tw.kind === 'laser' ? Math.max(0, Math.exp(-since * 8) * 0.5) : 0);
      head.phase.setX(i, a.spin);
      const sel = tw.id === this.selectedTowerId;
      tmpC.set(sel ? tw.def.glow : OUTLINE_DARK);
      if (sel) tmpC.multiplyScalar(2.2);
      base.outline?.setColorAt(i, tmpC);
      head.outline?.setColorAt(i, tmpC);
    }
    for (const id of TORDER) {
      const n = counts.get(id)!;
      for (const p of [this.towerBase.get(id)!, this.towerHead.get(id)!]) this.commit(p, n);
    }
  }

  private commit(p: Pool, n: number): void {
    p.mesh.count = n;
    p.mesh.visible = n > 0;
    p.mesh.instanceMatrix.needsUpdate = true;
    p.flash.needsUpdate = true;
    p.phase.needsUpdate = true;
    if (p.outline) {
      p.outline.count = n;
      p.outline.visible = n > 0 && this.outlines;
      if (p.outline.instanceColor) p.outline.instanceColor.needsUpdate = true;
    }
    if (p.extra) {
      p.extra.count = n;
      p.extra.visible = n > 0;
    }
  }

  private updateEnemies(game: Game, alpha: number, dt: number, camera: THREE.Camera): number {
    const counts = new Map<EnemyId, number>();
    for (const id of ENEMY_ORDER) counts.set(id, 0);
    for (const e of game.enemies) if (!e.dead && !e.leaked) counts.set(e.kind, counts.get(e.kind)! + 1);
    this.corpses = this.corpses.filter((c) => this.time - c.t < 0.32);
    for (const c of this.corpses) counts.set(c.kind, counts.get(c.kind)! + 1);
    for (const id of ENEMY_ORDER) {
      this.ensure(this.enemyPools, id, counts.get(id)!, (cap) => this.makeEnemyPool(id, cap));
      counts.set(id, 0);
    }

    const camQ = camera.quaternion;
    const camRight = tmpV2.set(1, 0, 0).applyQuaternion(camQ);
    let bars = 0;
    let blobs = 0;
    const lowShadow = !this.shadows;

    const put = (kind: EnemyId, X: number, Z: number, yaw: number, scale: number, flash: number, phase: number, y: number) => {
      const p = this.enemyPools.get(kind)!;
      const i = counts.get(kind)!;
      counts.set(kind, i + 1);
      tmpQ.setFromAxisAngle(UP, yaw);
      tmpM.compose(tmpV.set(X, y, Z), tmpQ, tmpS.setScalar(scale));
      p.mesh.setMatrixAt(i, tmpM);
      p.flash.setX(i, flash);
      p.phase.setX(i, phase);
    };

    for (const e of game.enemies) {
      if (e.dead || e.leaked) continue;
      const [x, y] = this.lerpPos(e, alpha);
      const X = wx(x);
      const Z = wz(y);
      // หันหน้าตามทิศเดิน (นุ่มนวล)
      const vx = e.x - e.px;
      const vy = e.y - e.py;
      let yaw = this.yaw.get(e.id);
      if (vx * vx + vy * vy > 1e-8) {
        const goal = -Math.atan2(vy, vx);
        if (yaw === undefined) yaw = goal;
        let d = goal - yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw += d * (1 - Math.exp(-dt * 12));
      }
      yaw ??= 0;
      this.yaw.set(e.id, yaw);
      const model = insectModel(e.kind);
      const sc = enemyScale(e.kind);
      const gait = this.time * (e.spd * 7 + (e.def.fly ? 3 : 0)) + e.id * 1.7;
      const bob = model.hover > 0 ? Math.sin(this.time * 5 + e.id) * 0.06 : Math.abs(Math.sin(gait)) * 0.015 * sc;
      put(e.kind, X, Z, yaw, sc, e.flash / HIT_FLASH_SEC, gait, model.hover + bob);

      if (lowShadow || model.hover > 0) {
        const r = sc * 0.55;
        tmpM.compose(tmpV.set(X, 0.03, Z), tmpQ.identity(), tmpS.set(r * 1.4, 1, r));
        this.blobs.setMatrixAt(blobs++, tmpM);
      }
      // แถบเลือด
      if (e.hp < e.maxHp && bars < this.barBg.instanceMatrix.count) {
        const pct = Math.max(0, e.hp / e.maxHp);
        const w = e.def.sz * 2.6;
        const h = 0.075;
        const by = model.hover + model.topY * sc + 0.22;
        tmpM.compose(tmpV.set(X, by, Z), camQ, tmpS.set(w + 0.04, h + 0.035, 1));
        this.barBg.setMatrixAt(bars, tmpM);
        const off = -(1 - pct) * w * 0.5;
        tmpM2.compose(tmpV.set(X + camRight.x * off, by + camRight.y * off, Z + camRight.z * off), camQ, tmpS.set(Math.max(0.001, w * pct), h, 1));
        this.barFill.setMatrixAt(bars, tmpM2);
        this.barFill.setColorAt(bars, tmpC.set(pct > 0.6 ? '#3db83d' : pct > 0.3 ? '#c8c030' : '#c03030'));
        bars++;
      }
    }
    // ซากตอนตาย: กะพริบขาวแล้วหดหาย
    for (const c of this.corpses) {
      const f = (this.time - c.t) / 0.32;
      const model = insectModel(c.kind);
      put(c.kind, c.X, c.Z, c.yaw, enemyScale(c.kind) * (1 - f * 0.85), 1 - f * 0.5, 0, model.hover * (1 - f));
    }
    for (const id of ENEMY_ORDER) this.commit(this.enemyPools.get(id)!, counts.get(id)!);
    this.blobs.count = blobs;
    this.blobs.visible = blobs > 0;
    this.blobs.instanceMatrix.needsUpdate = true;
    return bars;
  }

  private updateProjectiles(game: Game, alpha: number): void {
    const counts = new Map<TowerId, number>();
    for (const id of TORDER) counts.set(id, 0);
    const alive = new Set<number>();
    for (const p of game.projectiles) {
      const mesh = this.projMeshes.get(p.kind)!;
      const i = counts.get(p.kind)!;
      if (i >= mesh.instanceMatrix.count) continue;
      counts.set(p.kind, i + 1);
      alive.add(p.id);
      const x = p.px + (p.x - p.px) * alpha;
      const y = p.py + (p.y - p.py) * alpha;
      const tx = p.tgt.px + (p.tgt.x - p.tgt.px) * alpha;
      const ty = p.tgt.py + (p.tgt.y - p.tgt.py) * alpha;
      const d = Math.hypot(tx - x, ty - y);
      let a = this.projAnim.get(p.id);
      if (!a) {
        const tm = towerModel(p.kind);
        a = { d0: Math.max(0.3, d), h0: tm.headY + tm.muzzle[1], X: wx(x), Y: tm.headY + tm.muzzle[1], Z: wz(y) };
        this.projAnim.set(p.id, a);
      }
      const prog = THREE.MathUtils.clamp(1 - d / a.d0, 0, 1);
      const ht = enemyCenterY(p.tgt.kind);
      const Y = a.h0 + (ht - a.h0) * prog + Math.sin(prog * Math.PI) * PROJ_SHAPES[p.kind].arc;
      const X = wx(x);
      const Z = wz(y);
      tmpV2.set(X - a.X, Y - a.Y, Z - a.Z);
      if (tmpV2.lengthSq() < 1e-8) tmpV2.set(tx - x, 0, ty - y);
      tmpQ.setFromUnitVectors(XAXIS, tmpV2.normalize());
      if (p.kind === 'stone' || p.kind === 'cannon') tmpQ.setFromAxisAngle(UP, this.time * 9 + p.id);
      tmpM.compose(tmpV.set(X, Y, Z), tmpQ, tmpS.setScalar(1));
      mesh.setMatrixAt(i, tmpM);
      a.X = X;
      a.Y = Y;
      a.Z = Z;
      if (p.kind === 'cannon' || p.kind === 'laser') {
        if (Math.random() < 0.5) this.effects.burst(X, Y, Z, p.kind === 'cannon' ? '#ff9040' : '#6ab0ff', 1, { speed: 0.2, up: 0.2, glow: true, intensity: 1.6, size: 0.07, life: 0.22, grav: 0 });
      }
    }
    for (const id of this.projAnim.keys()) if (!alive.has(id)) this.projAnim.delete(id);
    for (const id of TORDER) {
      const mesh = this.projMeshes.get(id)!;
      mesh.count = counts.get(id)!;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** กล่องสำหรับคลิกเลือกป้อม (ลำดับเดียวกับ game.towers) */
  towerBoxes(towers: readonly Tower[]): THREE.Box3[] {
    return towers.map((tw) => {
      const h = towerModel(tw.kind).headY + 0.45;
      const X = wx(tw.x);
      const Z = wz(tw.y);
      return new THREE.Box3(new THREE.Vector3(X - 0.45, 0, Z - 0.45), new THREE.Vector3(X + 0.45, h, Z + 0.45));
    });
  }

  /** จำนวน draw call โดยประมาณของหน่วย (ใช้ทดสอบ) */
  get meshCount(): number {
    let n = 0;
    this.group.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).count > 0 && o.visible) n++;
    });
    return n;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (m.isInstancedMesh) {
        m.geometry.dispose();
        m.dispose();
      }
    });
    this.effects.dispose();
    this.unitMat.dispose();
    this.wingMat.dispose();
    this.outlineMat.dispose();
    this.depthMat.dispose();
    for (const m of this.projMeshes.values()) (m.material as THREE.Material).dispose();
  }
}
