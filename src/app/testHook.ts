import * as THREE from 'three';
import type { EnemyId } from '../config/enemies';
import type { Quality } from '../config/quality';
import type { TowerId } from '../config/towers';
import { wx, wz } from '../render/coords';
import type { App } from './App';

/** ตัวช่วยสำหรับเทสต์อัตโนมัติ — เปิดเฉพาะเมื่อ URL มี ?test=1 */
export function installTestHook(app: App): void {
  const api = {
    app,
    state() {
      const g = app.game;
      return {
        mode: app.mode,
        gold: g?.gold ?? null,
        lives: g?.lives ?? null,
        kills: g?.kills ?? null,
        wave: g?.wave ?? null,
        phase: g?.phase ?? null,
        towers: g?.towers.map((t) => ({ id: t.id, kind: t.kind, c: t.c, r: t.r })) ?? [],
        enemies: g?.enemies.length ?? 0,
        paused: g?.paused ?? false,
        speed: g?.speed ?? 1,
        over: g?.over ?? false,
        selTowerId: app.selTowerId,
        quality: app.settings.quality,
      };
    },
    /** ตำแหน่งบนจอของกึ่งกลางช่อง (c,r) */
    cellToScreen(c: number, r: number) {
      const cam = app.sm.camera;
      cam.updateMatrixWorld();
      const v = new THREE.Vector3(wx(c + 0.5), 0, wz(r + 0.5)).project(cam);
      const rect = app.sm.canvas.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    },
    /** สถิติการเรนเดอร์เฟรมล่าสุด */
    info() {
      const i = app.sm.renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
    },
    spawn(kind: EnemyId, n: number) {
      for (let k = 0; k < n; k++) app.game?.spawnEnemy(kind);
    },
    setGold(n: number) {
      if (app.game) app.game.gold = n;
    },
    place(kind: TowerId, c: number, r: number) {
      return app.game?.place(kind, c, r).ok ?? false;
    },
    setQuality(q: Quality) {
      app.setQuality(q);
    },
    /** ข้ามเวลาเกมไปข้างหน้า (วินาที) */
    advance(sec: number) {
      const g = app.game;
      if (!g) return;
      for (let i = 0; i < Math.round(sec * 60); i++) g.step(1 / 60);
    },
  };
  (window as unknown as { __DSTD__: typeof api }).__DSTD__ = api;
}
