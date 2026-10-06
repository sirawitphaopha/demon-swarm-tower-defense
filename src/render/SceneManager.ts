import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { QUALITY, type Quality } from '../config/quality';
import { THEMES, type ThemeId } from '../config/themes';

/** renderer + ฉาก + กล้อง + แสง + post-processing (bloom) */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.5, 420);
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  width = 1;
  height = 1;
  quality: Quality = 'high';
  /** ความกว้าง (px) ของแผงด้านซ้ายที่บังฉาก — เลื่อนจุดกึ่งกลางภาพไปทางขวา */
  insetLeft = 0;

  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private skyTex: THREE.CanvasTexture | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // นับ draw call รวมทุก pass ของเฟรม (reset เองตอนเริ่ม render)
    this.renderer.info.autoReset = false;

    this.hemi = new THREE.HemisphereLight(0xeaf6ff, 0x6a8a40, 1.55);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff1d8, 2.3);
    this.sun.position.set(-26, 44, 30);
    this.sun.target.position.set(0, 0, 0);
    const sc = this.sun.shadow.camera;
    sc.left = -36;
    sc.right = 36;
    sc.top = 26;
    sc.bottom = -26;
    sc.near = 10;
    sc.far = 110;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.resize();
  }

  setTheme(theme: ThemeId): void {
    const th = THEMES[theme];
    // ท้องฟ้าไล่สี (screen-space) + หมอกที่ขอบฟ้า
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, th.sky);
    grd.addColorStop(1, th.horizon);
    g.fillStyle = grd;
    g.fillRect(0, 0, 2, 256);
    this.skyTex?.dispose();
    this.skyTex = new THREE.CanvasTexture(c);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTex;
    this.scene.fog = new THREE.Fog(new THREE.Color(th.horizon), 95, 230);
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const cfg = QUALITY[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.maxPixelRatio));
    const sm = cfg.shadowMap;
    this.renderer.shadowMap.enabled = sm > 0;
    this.sun.castShadow = sm > 0;
    this.sun.shadow.radius = q === 'high' ? 3 : 2;
    if (sm > 0 && this.sun.shadow.mapSize.x !== sm) {
      this.sun.shadow.mapSize.set(sm, sm);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    // ต้อง compile วัสดุใหม่เมื่อเปิด/ปิดเงา
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => (mm.needsUpdate = true));
    });
    this.setupPost(cfg.post);
    this.resize();
  }

  private setupPost(on: boolean): void {
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    if (!on) return;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.applyViewOffset();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.bloom?.resolution.set(w / 2, h / 2);
  }

  setInsetLeft(px: number): void {
    this.insetLeft = px;
    this.applyViewOffset();
  }

  private applyViewOffset(): void {
    const off = this.insetLeft / 2;
    if (off > 0) this.camera.setViewOffset(this.width, this.height, -off, 0, this.width, this.height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.info.reset();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
