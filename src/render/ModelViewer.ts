import * as THREE from 'three';
import { ENEMIES, type EnemyId } from '../config/enemies';
import type { ObstacleType } from '../config/themes';
import { TOWERS, type TowerId } from '../config/towers';
import { createAnimDepthMaterial, createOutlineMaterial, createToonMaterial } from './materials';
import { insectModel } from './models/insects';
import { obstacleModel } from './models/nature';
import { towerModel } from './models/towers';
import { enemyScale } from './UnitsView';

// ตัวดูโมเดล 3D ของสารานุกรม: renderer แยก (canvas ของตัวเอง) ใช้โมเดล/วัสดุชุดเดียวกับในเกม
// ไม่มี requestAnimationFrame ของตัวเอง — App เรียก frame(dt) จากลูปหลัก

export type ViewModel = { kind: 'tower'; id: TowerId } | { kind: 'enemy'; id: EnemyId } | { kind: 'prop'; type: ObstacleType; variant: number };

const UP = new THREE.Vector3(0, 1, 0);
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();

interface Part {
  mesh: THREE.InstancedMesh;
  outline: THREE.InstancedMesh | null;
  phase: THREE.InstancedBufferAttribute;
  flash: THREE.InstancedBufferAttribute;
}

export class ModelViewer {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
  private root = new THREE.Group();
  private ground: THREE.Mesh;
  private tile: THREE.LineSegments;
  private range: THREE.Mesh;
  private flash: THREE.Mesh;
  private toon = createToonMaterial({ flash: true });
  private wingMat = createToonMaterial({ transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  private outlineMat = createOutlineMaterial(0.016, 0x1d2a12);
  private depthMat = createAnimDepthMaterial();
  private parts: Part[] = [];
  private model: ViewModel | null = null;
  private time = 0;
  private lastFire = 0;
  private headYaw = 0;
  private spin = 0;
  private yaw = 0.7;
  private pitch = 0.42;
  private dist = 4;
  private fitDist = 4;
  private center = new THREE.Vector3();
  private dragging = false;
  private lx = 0;
  private ly = 0;
  private idle = 0;
  autoRotate = true;
  animate = true;
  showRange = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cx-viewer-canvas';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x6a8a40, 1.5));
    const sun = new THREE.DirectionalLight(0xfff1d8, 2.2);
    sun.position.set(-3, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 3;
    sun.shadow.bias = -0.0008;
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -4;
    sc.right = sc.top = 4;
    sc.near = 0.5;
    sc.far = 20;
    this.scene.add(sun);

    // แผ่นดินกลม (ไดโอรามา) + กรอบ 1 ช่องไว้เทียบขนาด
    const g = new THREE.CylinderGeometry(1.6, 1.75, 0.18, 40);
    g.translate(0, -0.09, 0);
    this.ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x86d843 }));
    this.ground.receiveShadow = true;
    const side = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.6, 0.35, 40).translate(0, -0.355, 0), new THREE.MeshLambertMaterial({ color: 0x8a5a32 }));
    this.ground.add(side);
    const tg = new THREE.BufferGeometry().setFromPoints(
      [
        [-0.5, -0.5, 0.5, -0.5],
        [0.5, -0.5, 0.5, 0.5],
        [0.5, 0.5, -0.5, 0.5],
        [-0.5, 0.5, -0.5, -0.5],
      ].flatMap(([a, b, c, d]) => [new THREE.Vector3(a, 0.005, b), new THREE.Vector3(c, 0.005, d)]),
    );
    this.tile = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0x2e6b12, transparent: true, opacity: 0.55 }));
    // วงระยะยิง
    const rg = new THREE.RingGeometry(0.965, 1, 96).rotateX(-Math.PI / 2);
    this.range = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
    this.range.add(disc);
    this.range.position.y = 0.01;
    this.range.visible = false;
    // แสงปากกระบอก
    this.flash = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flash.visible = false;
    this.scene.add(this.ground, this.tile, this.range, this.root, this.flash);

    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lx = e.clientX;
      this.ly = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.yaw -= (e.clientX - this.lx) * 0.01;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - this.ly) * 0.008, -0.1, 1.45);
      this.lx = e.clientX;
      this.ly = e.clientY;
      this.idle = 0;
    });
    const up = () => (this.dragging = false);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.dist = THREE.MathUtils.clamp(this.dist * Math.exp(e.deltaY * 0.0012), this.fitDist * 0.35, this.fitDist * 4);
        this.idle = 0;
      },
      { passive: false },
    );
    this.canvas.addEventListener('dblclick', () => this.resetView());
  }

  private clear(): void {
    for (const p of this.parts) {
      this.root.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.dispose();
      if (p.outline) {
        this.root.remove(p.outline);
        p.outline.dispose();
      }
    }
    this.parts = [];
  }

  /** สร้าง InstancedMesh (count=1) ให้ท่าเคลื่อนไหวใน shader ทำงานเหมือนในเกม */
  private part(geo: THREE.BufferGeometry, mat: THREE.Material, outline: boolean): Part {
    const g = geo.clone();
    const phase = new THREE.InstancedBufferAttribute(new Float32Array(1), 1);
    const flash = new THREE.InstancedBufferAttribute(new Float32Array(1), 1);
    g.setAttribute('aPhase', phase);
    g.setAttribute('aFlash', flash);
    const mesh = new THREE.InstancedMesh(g, mat, 1);
    mesh.castShadow = true;
    mesh.customDepthMaterial = this.depthMat;
    mesh.frustumCulled = false;
    this.root.add(mesh);
    let ol: THREE.InstancedMesh | null = null;
    if (outline) {
      ol = new THREE.InstancedMesh(g, this.outlineMat, 1);
      ol.instanceMatrix = mesh.instanceMatrix;
      ol.frustumCulled = false;
      this.root.add(ol);
    }
    const p = { mesh, outline: ol, phase, flash };
    this.parts.push(p);
    return p;
  }

  setModel(m: ViewModel): void {
    this.clear();
    this.model = m;
    this.time = 0;
    this.lastFire = 0;
    let rangeR = 0;
    let rangeColor = '#ffffff';
    // กล่องครอบโมเดล (ใช้คำนวณระยะกล้องให้เห็นทั้งตัว)
    const box = new THREE.Box3();
    const addBox = (g: THREE.BufferGeometry, mat: THREE.Matrix4) => {
      if (!g.boundingBox) g.computeBoundingBox();
      box.union(g.boundingBox!.clone().applyMatrix4(mat));
    };
    if (m.kind === 'tower') {
      const tm = towerModel(m.id);
      this.part(tm.base, this.toon, true);
      this.part(tm.head, this.toon, true);
      addBox(tm.base, new THREE.Matrix4());
      addBox(tm.head, new THREE.Matrix4().makeTranslation(0, tm.headY, 0));
      rangeR = TOWERS[m.id].range;
      rangeColor = TOWERS[m.id].glow;
    } else if (m.kind === 'enemy') {
      const im = insectModel(m.id);
      this.part(im.body, this.toon, true);
      if (im.wings) this.part(im.wings, this.wingMat, false);
      const s = enemyScale(m.id);
      const mat = new THREE.Matrix4().compose(new THREE.Vector3(0, im.hover * 0.6, 0), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      addBox(im.body, mat);
      if (im.wings) addBox(im.wings, mat);
    } else {
      const g = obstacleModel(m.type, m.variant);
      this.part(g, this.toon, true);
      addBox(g, new THREE.Matrix4());
    }
    box.expandByPoint(new THREE.Vector3(0, 0, 0));
    const size = box.getSize(new THREE.Vector3());
    box.getCenter(this.center);
    const radius = Math.max(0.5, size.length() / 2);
    this.fitDist = (radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.02;
    this.range.scale.setScalar(Math.max(0.01, rangeR));
    (this.range.material as THREE.MeshBasicMaterial).color.set(rangeColor);
    ((this.range.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(rangeColor);
    this.resetView();
    this.writeMatrices(0);
  }

  resetView(): void {
    this.yaw = 0.7;
    this.pitch = 0.42;
    this.dist = this.fitDist;
    this.idle = 0;
  }

  /** ปรับขนาดตามกล่องที่ canvas อยู่ */
  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    const cur = this.renderer.getSize(tmpV2);
    if (cur.x !== w || cur.y !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  private writeMatrices(dt: number): void {
    const m = this.model;
    if (!m) return;
    if (m.kind === 'tower') {
      const tm = towerModel(m.id);
      const def = TOWERS[m.id];
      // หัวป้อมกวาดซ้ายขวาแล้วยิงทุก 1.4 วินาที
      this.headYaw = Math.sin(this.time * 0.8) * 0.7;
      const since = this.time - this.lastFire;
      if (this.animate && since > 1.4) {
        this.lastFire = this.time;
      }
      const s2 = this.time - this.lastFire;
      const recoil = this.animate ? tm.recoil * Math.exp(-s2 * 14) : 0;
      if (m.id === 'machinegun') this.spin += dt * (this.animate && s2 < 0.5 ? 24 : 1.5);
      const [base, head] = this.parts;
      tmpM.identity();
      base!.mesh.setMatrixAt(0, tmpM);
      tmpQ.setFromAxisAngle(UP, this.headYaw);
      tmpV.set(-Math.cos(this.headYaw) * recoil, tm.headY + (m.id === 'laser' ? Math.sin(this.time * 2.2) * 0.04 : 0), Math.sin(this.headYaw) * recoil);
      tmpM.compose(tmpV, tmpQ, tmpS.setScalar(1));
      head!.mesh.setMatrixAt(0, tmpM);
      head!.phase.setX(0, this.spin);
      head!.flash.setX(0, m.id === 'laser' && this.animate ? Math.exp(-s2 * 8) * 0.5 : 0);
      // แสงปากกระบอก
      const f = this.animate ? Math.exp(-s2 * 18) : 0;
      this.flash.visible = f > 0.05;
      if (this.flash.visible) {
        const fx = Math.cos(this.headYaw) * tm.muzzle[0];
        const fz = -Math.sin(this.headYaw) * tm.muzzle[0];
        this.flash.position.set(fx, tm.headY + tm.muzzle[1], fz);
        this.flash.scale.setScalar(0.6 + f * 1.6);
        (this.flash.material as THREE.MeshBasicMaterial).color.set(def.glow).multiplyScalar(2.2 * f);
      }
    } else if (m.kind === 'enemy') {
      const im = insectModel(m.id);
      const s = enemyScale(m.id);
      const def = ENEMIES[m.id];
      const gait = this.animate ? this.time * (def.spd * 7 + (def.fly ? 3 : 0)) : 0;
      const bob = im.hover > 0 ? Math.sin(this.time * 5) * 0.06 : Math.abs(Math.sin(gait)) * 0.015 * s;
      tmpQ.identity();
      tmpM.compose(tmpV.set(0, im.hover * 0.6 + bob, 0), tmpQ, tmpS.setScalar(s));
      for (const p of this.parts) {
        p.mesh.setMatrixAt(0, tmpM);
        p.phase.setX(0, gait);
      }
      this.flash.visible = false;
    } else {
      tmpM.identity();
      this.parts[0]!.mesh.setMatrixAt(0, tmpM);
      this.flash.visible = false;
    }
    for (const p of this.parts) {
      p.mesh.instanceMatrix.needsUpdate = true;
      p.phase.needsUpdate = true;
      p.flash.needsUpdate = true;
    }
  }

  /** อัปเดต + วาดหนึ่งเฟรม */
  frame(dt: number): void {
    if (!this.model) return;
    this.resize();
    this.time += dt;
    this.idle += dt;
    if (this.autoRotate && !this.dragging && this.idle > 1.5) this.yaw += dt * 0.35;
    this.writeMatrices(dt);
    const showRange = this.showRange && this.model.kind === 'tower';
    this.range.visible = showRange;
    const want = showRange ? Math.max(this.fitDist, (TOWERS[(this.model as { id: TowerId }).id].range + 0.5) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.05) : this.dist;
    const d = showRange ? want : this.dist;
    const target = showRange ? new THREE.Vector3(0, 0, 0) : this.center;
    const pitch = showRange ? Math.max(this.pitch, 0.9) : this.pitch;
    this.camera.position.set(target.x + Math.sin(this.yaw) * Math.cos(pitch) * d, target.y + Math.sin(pitch) * d, target.z + Math.cos(this.yaw) * Math.cos(pitch) * d);
    this.camera.lookAt(target);
    this.ground.scale.setScalar(showRange ? Math.max(1, (TOWERS[(this.model as { id: TowerId }).id].range + 0.6) / 1.6) : 1);
    this.renderer.render(this.scene, this.camera);
  }

  /** ภาพนิ่งของโมเดล (ใช้ทำภาพย่อบนการ์ด) */
  snapshot(m: ViewModel, size = 200): string {
    const prevModel = this.model;
    const prevSize = this.renderer.getSize(new THREE.Vector2());
    const prevAspect = this.camera.aspect;
    const prev = { yaw: this.yaw, pitch: this.pitch, dist: this.dist, range: this.showRange, time: this.time };
    this.setModel(m);
    this.renderer.setSize(size, size, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    this.showRange = false;
    this.time = 0.3;
    this.ground.visible = false;
    this.tile.visible = false;
    this.writeMatrices(0);
    const cp = Math.cos(0.5);
    this.camera.position.set(Math.sin(0.7) * cp * this.fitDist * 0.92, this.center.y + Math.sin(0.5) * this.fitDist * 0.92, Math.cos(0.7) * cp * this.fitDist * 0.92);
    this.camera.lookAt(this.center);
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    this.ground.visible = true;
    this.tile.visible = true;
    this.renderer.setSize(prevSize.x, prevSize.y, false);
    this.camera.aspect = prevAspect;
    this.camera.updateProjectionMatrix();
    if (prevModel) this.setModel(prevModel);
    else {
      this.clear();
      this.model = null;
    }
    Object.assign(this, { yaw: prev.yaw, pitch: prev.pitch, dist: prev.dist, showRange: prev.range, time: prev.time });
    return url;
  }

  get current(): ViewModel | null {
    return this.model;
  }
}

const tmpV2 = new THREE.Vector2();
