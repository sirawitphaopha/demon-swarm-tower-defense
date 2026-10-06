import { $ } from './dom';

let timer: ReturnType<typeof setTimeout> | undefined;

/** ข้อความแจ้งเตือนสั้นๆ ด้านบนจอ (แทน alert) */
export function toast(msg: string): void {
  const el = $('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(timer);
  timer = setTimeout(() => (el.style.display = 'none'), 1800);
}
