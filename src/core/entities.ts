import type { EnemyDef, EnemyId } from '../config/enemies';
import type { TargetMode, TowerDef, TowerId } from '../config/towers';

/** ศัตรู — พิกัด x,y หน่วยช่อง (กึ่งกลางช่อง c คือ c+0.5) */
export interface Enemy {
  id: number;
  kind: EnemyId;
  def: EnemyDef;
  x: number;
  y: number;
  /** ตำแหน่งตอนเริ่ม step ล่าสุด (ไว้ให้ภาพคำนวณตำแหน่งระหว่างเฟรม) */
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  /** ช่อง/วินาที */
  spd: number;
  /** เวลากะพริบขาวที่เหลือ (วินาที) */
  flash: number;
  dead: boolean;
  /** หลุดออกทางขวาแล้ว */
  leaked: boolean;
  // ── การเดินบนกริด (ศัตรูเดินดิน) ──
  /** ช่องล่าสุดที่เดินถึงกึ่งกลาง */
  col: number;
  row: number;
  /** ช่องเป้าหมายถัดไป */
  tc: number;
  tr: number;
  /** จุดเป้าหมายถัดไป (หน่วยช่อง) */
  tx: number;
  ty: number;
  /** กำลังเดินออกขอบขวา */
  exiting: boolean;
}

export interface Tower {
  id: number;
  kind: TowerId;
  def: TowerDef;
  c: number;
  r: number;
  x: number;
  y: number;
  /** cooldown ที่เหลือก่อนยิงนัดถัดไป */
  cd: number;
  /** เงินที่ลงไปทั้งหมด (รวมอัปเกรด) */
  totalCost: number;
  kills: number;
  /** มุมเล็งล่าสุด (เรเดียน ในระนาบ x,y ของสนาม) */
  angle: number;
  /** id ศัตรูที่เล็งล่าสุด (-1 = ไม่มี) */
  aimId: number;
  target: TargetMode;
}

export interface Projectile {
  id: number;
  kind: TowerId;
  x: number;
  y: number;
  px: number;
  py: number;
  tgt: Enemy;
  /** ช่อง/วินาที */
  spd: number;
  dmg: number;
  aoe: number;
  towerId: number;
}
