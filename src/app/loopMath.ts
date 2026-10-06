import { SIM_DT } from '../config/constants';

/** จำนวน step สูงสุดต่อเฟรม — เครื่องช้ามากจะกลายเป็น slow motion แทนการค้าง */
export const MAX_STEPS = 24;
/** เวลาจริงสูงสุดต่อเฟรม (กันกระโดดไกลหลังสลับแท็บ) */
export const MAX_FRAME_DT = 0.1;

export interface Advance {
  steps: number;
  acc: number;
  /** สัดส่วนระหว่าง step ล่าสุดกับ step ถัดไป (ใช้คำนวณตำแหน่งภาพ) */
  alpha: number;
}

/** คำนวณว่าเฟรมนี้ต้องจำลองกี่ step (fixed timestep) */
export function advance(acc: number, realDt: number, speed: number): Advance {
  acc += Math.min(Math.max(realDt, 0), MAX_FRAME_DT) * speed;
  let steps = Math.floor(acc / SIM_DT + 1e-9);
  if (steps > MAX_STEPS) {
    steps = MAX_STEPS;
    acc = 0;
  } else {
    acc = Math.max(0, acc - steps * SIM_DT);
  }
  return { steps, acc, alpha: Math.min(1, acc / SIM_DT) };
}
