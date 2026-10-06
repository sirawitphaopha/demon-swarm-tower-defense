// ข้อความ UI ที่สร้างตอนเล่น (ข้อความคงที่อยู่ใน index.html)
// กฎ: ภาษาไทยทางการ · ห้ามใช้เครื่องหมายคำถามในข้อความ UI · ไม่ใช้ alert/confirm/prompt

import type { PlaceFail } from '../core/placement';
import type { Quality } from '../config/quality';

/** ข้อความแจ้งเมื่อวางป้อมไม่ได้ (null = ไม่ต้องแจ้ง เหมือนเวอร์ชันเดิม) */
export const PLACE_FAIL: Record<PlaceFail, string | null> = {
  gold: 'ไม่มีเงินพอ 💸',
  guard: 'ห้ามวางใกล้จุด IN เกิน 2 ช่อง 🚫',
  obstacle: 'วางบนสิ่งกีดขวางไม่ได้ 🌳',
  water: 'วางบนแอ่งน้ำไม่ได้ 💧',
  blocks: 'วางตรงนี้จะปิดทางศัตรูทั้งหมด 🚫',
  occupied: 'มีศัตรูอยู่ในช่องนี้ วางไม่ได้ 🐛',
  tower: null,
  outside: null,
};

export const S = {
  noGold: 'ไม่มีเงินพอ 💸',
  boss: '⚠️ ราชาแมลงปรากฏตัว',
  regenOnlyBreak: 'สุ่มแมพได้เฉพาะช่วงเตรียมตัวก่อนเริ่ม 🗺️',
  infoIdle: '← เลือกป้อมเพื่อวาง<br>คลิกป้อมที่วางแล้วเพื่อดูข้อมูล',
  waving: 'กำลังบุก...',
  prepStart: 'เตรียมพร้อมก่อนเริ่ม',
  prepping: 'ช่วงเตรียมตัว',
  pause: '⏸ Pause',
  resume: '▶️ Resume',
  muteOn: '🔇 เสียง: ปิด',
  muteOff: '🔊 เสียง: เปิด',
  maxLevel: '🏆 Max Level',
  win: '🏆 ชนะ',
  lose: '💀 แพ้',
  loseNormal: 'แมลงปีศาจบุกทะลวงแล้ว',
  // หน้าสร้างแมพ
  edNeedName: 'ใส่ชื่อแมพก่อนบันทึก ✏️',
  edBlockedSave: 'แมพปิดทางศัตรู เปิดทางก่อนบันทึก 🚫',
  edBlockedPlay: 'แมพปิดทางศัตรู เปิดทางก่อนเล่น 🚫',
  mapBlocked: 'แมพนี้ปิดทางศัตรู เล่นไม่ได้ 🚫',
  mapsEmpty: 'ยังไม่มีแมพที่บันทึกไว้<br>กด "สร้างแมพ" เพื่อสร้างแมพแรกของพี่กัน',
  play: '▶️ เล่น',
  del: '🗑️ ลบ',
  autoQuality: 'เครื่องทำงานหนัก ปรับคุณภาพภาพเป็น "กลาง" ให้อัตโนมัติ ⚙️',
  webglFail: 'เบราว์เซอร์นี้เปิดภาพ 3D ไม่ได้ ลองเปิดการเร่งกราฟิก (hardware acceleration)',
} as const;

export const QUALITY_NAME: Record<Quality, string> = { low: 'ต่ำ', medium: 'กลาง', high: 'สูง' };

export const fmt = {
  bestMenu: (wave: number, kills: number) => `🏅 สถิติสูงสุด: ถึง Wave ${wave} | ฆ่า ${kills} ตัว`,
  waveLabel: (wave: number, total: string) => `Wave ${wave} / ${total}`,
  waveDone: (wave: number, total: string) => `Wave ${wave} / ${total} เสร็จแล้ว`,
  breakSub: (nextWave: number) => `วิ ก่อน Wave ${nextWave}`,
  speed: (s: number) => `⚡ Speed x${s}`,
  saved: (name: string) => `บันทึกแมพ "${name}" แล้ว ✅`,
  winHeadline: (waves: number) => `ปกป้องดินแดนสำเร็จทั้ง ${waves} Wave`,
  endlessHeadline: (wave: number) => `ยืนหยัดได้ถึง Wave ${wave}`,
  mapSub: (obstacles: number, water: number) => `ต้นไม้/หิน ${obstacles} · ช่องน้ำ ${water}`,
};
