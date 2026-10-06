import * as THREE from 'three';
import { COLS, ROWS, SPAWN_GUARD } from '../config/constants';
import { TOWERS, type TowerId } from '../config/towers';
import { HALF_H, HALF_W, wx, wz } from './coords';
import { towerModel } from './models/towers';

// ตัวช่วยตอนวางป้อม/วาดแมพ: เส้นกริด, กรอบช่องที่ชี้, ป้อมผี (ghost), วงระยะยิง

const OK = new THREE.Color('#5aff5a');
const BAD = new THREE.Color('#ff4a3a');

function rangeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float dash = step(0.0, sin(a * 36.0 + uTime * 1.5));
        float ring = smoothstep(0.955, 0.975, r) * (0.45 + 0.55 * dash);
        float fill = 0.09 + 0.05 * smoothstep(0.6, 1.0, r);
        gl_FragColor = vec4(uColor * (1.0 + ring * 0.6), max(fill, ring * 0.85));
      }`,
  });
}

export class Overlays {
  readonly group = new THREE.Group();
  private grid: THREE.Mesh;
  private gridMat: THREE.ShaderMaterial;
  private hover: THREE.Mesh;
  private hoverMat: THREE.MeshBasicMaterial;
  private ghost = new THREE.Group();
  private ghostMat = new THREE.MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.45, depthWrite: false });
  private ghostType: TowerId | null = null;
  private range: THREE.Mesh;
  private rangeMat = rangeMaterial();
  private selRange: THREE.Mesh;
  private selRangeMat = rangeMaterial();

  constructor() {
    // เส้นกริด (เขียนใน shader จางออกห่างจากเคอร์เซอร์) + แถบแดงโซนห้ามวาง
    this.gridMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCursor: { value: new THREE.Vector2(0, 0) },
        uRadius: { value: 7 },
        uGuard: { value: 1 },
        uAlpha: { value: 1 },
      },
      vertexShader: /* glsl */ `varying vec2 vCell; void main(){ vCell = vec2(position.x + ${HALF_W.toFixed(1)}, position.z + ${HALF_H.toFixed(1)}); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec2 uCursor; uniform float uRadius; uniform float uGuard; uniform float uAlpha;
        varying vec2 vCell;
        void main(){
          vec2 f = abs(fract(vCell) - 0.5);
          float w = fwidth(vCell.x) * 1.2;
          float line = smoothstep(0.5 - w * 1.5, 0.5 - w * 0.2, max(f.x, f.y));
          float fade = 1.0 - smoothstep(uRadius * 0.55, uRadius, distance(vCell, uCursor));
          float guard = uGuard * step(vCell.x, ${SPAWN_GUARD.toFixed(1)});
          vec3 col = mix(vec3(0.08, 0.25, 0.04), vec3(0.85, 0.15, 0.1), guard);
          float a = max(line * 0.32 * fade, guard * 0.16);
          if (a < 0.003) discard;
          gl_FragColor = vec4(col, a * uAlpha);
        }`,
    });
    const g = new THREE.PlaneGeometry(COLS, ROWS, 1, 1);
    g.rotateX(-Math.PI / 2);
    this.grid = new THREE.Mesh(g, this.gridMat);
    this.grid.position.y = 0.075;
    this.grid.renderOrder = 6;
    this.grid.visible = false;

    // กรอบช่องที่เมาส์ชี้
    const hg = new THREE.RingGeometry(0.62, 0.7, 4, 1, Math.PI / 4);
    hg.rotateX(-Math.PI / 2);
    this.hoverMat = new THREE.MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.9, depthWrite: false });
    this.hover = new THREE.Mesh(hg, this.hoverMat);
    this.hover.renderOrder = 7;
    this.hover.visible = false;

    const rg = new THREE.PlaneGeometry(2, 2);
    rg.rotateX(-Math.PI / 2);
    this.range = new THREE.Mesh(rg, this.rangeMat);
    this.range.renderOrder = 6;
    this.range.visible = false;
    this.selRange = new THREE.Mesh(rg, this.selRangeMat);
    this.selRange.renderOrder = 6;
    this.selRange.visible = false;

    this.ghost.visible = false;
    this.group.add(this.grid, this.hover, this.range, this.selRange, this.ghost);
  }

  /** เส้นกริด: radius = รัศมีที่แสดงรอบเคอร์เซอร์ (ช่อง), guard = แสดงโซนห้ามวาง */
  showGrid(on: boolean, radius = 7, guard = true): void {
    this.grid.visible = on;
    this.gridMat.uniforms.uRadius!.value = radius;
    this.gridMat.uniforms.uGuard!.value = guard ? 1 : 0;
  }

  setCursor(x: number, y: number): void {
    (this.gridMat.uniforms.uCursor!.value as THREE.Vector2).set(x, y);
  }

  setHover(c: number, r: number, ok: boolean | null): void {
    if (ok === null) {
      this.hover.visible = false;
      return;
    }
    this.hover.visible = true;
    this.hover.position.set(wx(c + 0.5), 0.09, wz(r + 0.5));
    this.hoverMat.color.copy(ok ? OK : BAD);
  }

  /** ป้อมผีตอนเล็งวาง (type null = ซ่อน) */
  setGhost(type: TowerId | null, c = 0, r = 0, ok = true): void {
    if (type !== this.ghostType) {
      this.ghost.clear();
      this.ghostType = type;
      if (type) {
        const m = towerModel(type);
        const base = new THREE.Mesh(m.base, this.ghostMat);
        const head = new THREE.Mesh(m.head, this.ghostMat);
        head.position.y = m.headY;
        this.ghost.add(base, head);
      }
    }
    if (!type) {
      this.ghost.visible = false;
      this.range.visible = false;
      return;
    }
    this.ghost.visible = true;
    this.ghost.position.set(wx(c + 0.5), 0.02, wz(r + 0.5));
    this.ghostMat.color.copy(ok ? OK : BAD);
    if (ok) this.placeRange(this.range, this.rangeMat, TOWERS[type].range, TOWERS[type].glow, c, r);
    else this.range.visible = false;
  }

  /** วงระยะยิงของป้อมที่เลือก */
  setSelected(type: TowerId | null, c = 0, r = 0): void {
    if (!type) {
      this.selRange.visible = false;
      return;
    }
    this.placeRange(this.selRange, this.selRangeMat, TOWERS[type].range, TOWERS[type].glow, c, r);
  }

  private placeRange(mesh: THREE.Mesh, mat: THREE.ShaderMaterial, range: number, color: string, c: number, r: number): void {
    mesh.visible = true;
    mesh.position.set(wx(c + 0.5), 0.08, wz(r + 0.5));
    mesh.scale.set(range, 1, range);
    (mat.uniforms.uColor!.value as THREE.Color).set(color);
  }

  update(time: number): void {
    this.rangeMat.uniforms.uTime!.value = time;
    this.selRangeMat.uniforms.uTime!.value = time;
  }

  hideAll(): void {
    this.showGrid(false);
    this.setHover(0, 0, null);
    this.setGhost(null);
    this.setSelected(null);
  }

  dispose(): void {
    this.grid.geometry.dispose();
    this.hover.geometry.dispose();
    this.range.geometry.dispose();
    this.gridMat.dispose();
    this.hoverMat.dispose();
    this.ghostMat.dispose();
    this.rangeMat.dispose();
    this.selRangeMat.dispose();
  }
}
