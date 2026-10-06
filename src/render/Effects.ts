import * as THREE from 'three';

// อนุภาค (สะเก็ด/ระเบิด/ฝุ่น/ประกาย) + วงระเบิดบนพื้น — pool คงที่ ใช้ InstancedMesh

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  r: number;
  g: number;
  b: number;
  grav: number;
  drag: number;
  glow: boolean;
}

interface Ring {
  x: number;
  z: number;
  life: number;
  max: number;
  radius: number;
  r: number;
  g: number;
  b: number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

export interface BurstOpts {
  speed?: number;
  up?: number;
  size?: number;
  life?: number;
  grav?: number;
  glow?: boolean;
  spread?: number;
  drag?: number;
  /** ความสว่าง (>1 = เรืองแสงกับ bloom) */
  intensity?: number;
}

export class Effects {
  readonly group = new THREE.Group();
  private parts: Particle[] = [];
  private rings: Ring[] = [];
  private solid: THREE.InstancedMesh;
  private glow: THREE.InstancedMesh;
  private ringMesh: THREE.InstancedMesh;

  constructor(private max: number) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    this.solid = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    this.glow = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
      max,
    );
    const rg = new THREE.RingGeometry(0.82, 1, 40, 1);
    this.ringMesh = new THREE.InstancedMesh(
      rg,
      new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      64,
    );
    for (const m of [this.solid, this.glow, this.ringMesh]) {
      m.count = 0;
      m.frustumCulled = false;
      m.setColorAt(0, tmpC.setRGB(1, 1, 1));
      this.group.add(m);
    }
    this.glow.renderOrder = 5;
    this.ringMesh.renderOrder = 4;
  }

  setMax(max: number): void {
    this.max = Math.min(max, this.solid.instanceMatrix.count);
  }

  burst(x: number, y: number, z: number, color: THREE.ColorRepresentation, n: number, o: BurstOpts = {}): void {
    tmpC.set(color);
    const k = o.intensity ?? 1;
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.max) this.parts.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 2.2) * (0.5 + Math.random() * 0.7);
      const life = (o.life ?? 0.55) * (0.75 + Math.random() * 0.5);
      const spread = o.spread ?? 0;
      this.parts.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread * 0.5,
        z: z + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * sp,
        vy: (o.up ?? 1.6) * (0.4 + Math.random() * 0.8),
        vz: Math.sin(a) * sp,
        life,
        max: life,
        size: (o.size ?? 0.07) * (0.7 + Math.random() * 0.6),
        r: tmpC.r * k,
        g: tmpC.g * k,
        b: tmpC.b * k,
        grav: o.grav ?? 6,
        drag: o.drag ?? 2.2,
        glow: o.glow ?? false,
      });
    }
  }

  ring(x: number, z: number, color: THREE.ColorRepresentation, radius: number, life = 0.45, intensity = 1.6): void {
    if (this.rings.length >= 64) this.rings.shift();
    tmpC.set(color);
    this.rings.push({ x, z, life, max: life, radius, r: tmpC.r * intensity, g: tmpC.g * intensity, b: tmpC.b * intensity });
  }

  update(dt: number): void {
    let ns = 0;
    let ng = 0;
    const keep: Particle[] = [];
    for (const p of this.parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vz *= d;
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.02) {
        p.y = 0.02;
        p.vy *= -0.3;
      }
      keep.push(p);
      const f = p.life / p.max;
      const mesh = p.glow ? this.glow : this.solid;
      const idx = p.glow ? ng++ : ns++;
      tmpM.compose(tmpV.set(p.x, p.y, p.z), tmpQ.identity(), tmpS.setScalar(p.size * (p.glow ? 0.4 + f * 0.8 : Math.min(1, f * 2.2))));
      mesh.setMatrixAt(idx, tmpM);
      mesh.setColorAt(idx, p.glow ? tmpC.setRGB(p.r * f, p.g * f, p.b * f) : tmpC.setRGB(p.r, p.g, p.b));
    }
    this.parts = keep;
    this.solid.count = ns;
    this.glow.count = ng;
    for (const m of [this.solid, this.glow]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    let nr = 0;
    this.rings = this.rings.filter((r) => (r.life -= dt) > 0);
    for (const r of this.rings) {
      const f = r.life / r.max;
      const rad = r.radius * (0.35 + (1 - f) * 0.75);
      tmpM.compose(tmpV.set(r.x, 0.06, r.z), FLAT, tmpS.set(rad, rad, rad));
      this.ringMesh.setMatrixAt(nr, tmpM);
      this.ringMesh.setColorAt(nr, tmpC.setRGB(r.r * f, r.g * f, r.b * f));
      nr++;
    }
    this.ringMesh.count = nr;
    this.ringMesh.instanceMatrix.needsUpdate = true;
    if (this.ringMesh.instanceColor) this.ringMesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.parts = [];
    this.rings = [];
    this.update(0);
  }

  get activeCount(): number {
    return this.parts.length;
  }

  dispose(): void {
    this.solid.geometry.dispose();
    this.ringMesh.geometry.dispose();
    for (const m of [this.solid, this.glow, this.ringMesh]) {
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
  }
}
