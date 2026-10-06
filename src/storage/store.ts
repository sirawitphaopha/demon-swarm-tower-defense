// การเข้าถึง localStorage แบบปลอดภัย (โหมดส่วนตัว/บล็อก storage จะไม่ทำให้เกมพัง)

export function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* เขียนไม่ได้ก็ข้าม */
  }
}
