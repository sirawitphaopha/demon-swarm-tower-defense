/** ดึง element ตาม id (โยน error ถ้าไม่มี — id ทั้งหมดอยู่ใน index.html) */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** เขียน textContent เฉพาะเมื่อค่าเปลี่ยน (ลดงาน DOM ทุกเฟรม) */
export function setText(el: HTMLElement, v: string): void {
  if (el.textContent !== v) el.textContent = v;
}

export function setDisplay(el: HTMLElement, v: string): void {
  if (el.style.display !== v) el.style.display = v;
}
