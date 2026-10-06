import * as THREE from 'three';
import { TORDER, type TowerId } from '../config/towers';
import { createToonMaterial } from './materials';
import { towerModel } from './models/towers';

/** เรนเดอร์ภาพย่อโมเดลป้อม 3D สำหรับปุ่มเลือกป้อม (ใช้ renderer ชั่วคราวแล้วทิ้ง) */
export function renderTowerThumbs(size = 112): Partial<Record<TowerId, string>> {
  const out: Partial<Record<TowerId, string>> = {};
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5a7a3a, 2.0));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
    sun.position.set(-2, 4, 3);
    scene.add(sun);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    const mat = createToonMaterial();
    for (const id of TORDER) {
      const m = towerModel(id);
      const g = new THREE.Group();
      g.add(new THREE.Mesh(m.base, mat));
      const head = new THREE.Mesh(m.head, mat);
      head.position.y = m.headY;
      head.rotation.y = 0.5;
      g.add(head);
      scene.add(g);
      const h = m.headY + 0.45;
      cam.position.set(1.6, h * 0.5 + 1.15, 2.1);
      cam.lookAt(0, h * 0.45, 0);
      cam.zoom = 1.35 / Math.max(1, h * 0.85);
      cam.updateProjectionMatrix();
      renderer.render(scene, cam);
      out[id] = canvas.toDataURL('image/png');
      scene.remove(g);
    }
    mat.dispose();
  } catch {
    // เปิด WebGL ไม่ได้ → ใช้ emoji ตามเดิม
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  return out;
}
