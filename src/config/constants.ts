// ค่าคงที่หลักของเกม — แก้ที่นี่เพื่อปรับขนาดสนาม/จังหวะเกม

export const COLS = 50;
export const ROWS = 28;
/** แถวที่ศัตรูเกิด (ฝั่งซ้าย กลางสนาม) */
export const SPAWN_ROW = Math.floor(ROWS / 2);
/** จำนวนคอลัมน์ฝั่งซ้ายที่ห้ามวางป้อม */
export const SPAWN_GUARD = 2;
/** เวลาพักระหว่างเวฟ (วินาที) */
export const BREAK_SEC = 18;

export const START_GOLD = 200;
export const START_LIVES = 20;
/** สัดส่วนเงินคืนเมื่อขายป้อม (คิดจากเงินที่ลงไปทั้งหมดรวมอัปเกรด) */
export const SELL_RATIO = 0.5;
/** ระยะเวลากะพริบขาวเมื่อศัตรูโดนยิง (วินาที) */
export const HIT_FLASH_SEC = 0.12;

/** ความถี่การจำลองเกม (ครั้ง/วินาที) — ใช้ fixed timestep เพื่อให้เร่ง x2/x3 ได้ผลตรง */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

/**
 * ขนาดช่องอ้างอิง (px) ของเวอร์ชัน 2D เดิม ใช้แปลงความเร็วเดิม (px/วินาที) เป็น ช่อง/วินาที
 * เวอร์ชันเดิมขนาดช่องเปลี่ยนตามจอ (~23px บนโน้ตบุ๊ก, ~34px บน Full HD) ทำให้จอใหญ่เล่นง่ายกว่า
 * ค่านี้คือค่ากลาง — เพิ่มค่า = ศัตรู/กระสุนช้าลงทั้งเกม, ลดค่า = เร็วขึ้น
 */
export const REF_CELL_PX = 28;
/** แปลงความเร็ว px/วินาที (ตัวเลขเดิม) เป็น ช่อง/วินาที */
export const px = (v: number): number => v / REF_CELL_PX;

/** รหัสช่องในกริด: เดินผ่านได้เฉพาะ Empty */
export const Cell = {
  Empty: 0,
  Tower: 1,
  /** ต้นไม้/หิน/แอ่งน้ำแบบสุ่ม */
  Obstacle: 2,
  /** น้ำที่วาดเองในหน้าสร้างแมพ */
  Water: 3,
} as const;
export type CellCode = (typeof Cell)[keyof typeof Cell];
