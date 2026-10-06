// กราฟ SVG ของสารานุกรม (ซีรีส์เดียวต่อกราฟ · เส้น 2px · แท่ง ≤24px ปลายมน 4px · เส้นกริดบาง · มี tooltip ตอนชี้)
// ข้อความทุกชิ้นใส่ด้วย textContent

const NS = 'http://www.w3.org/2000/svg';
export const CHART_COLOR = '#2f8a1f';
const INK = '#23331a';
const MUTED = '#6f7a66';
const GRID = '#dfe6d4';
const AXIS = '#b9c4ac';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

function text(parent: Element, x: number, y: number, s: string, attrs: Record<string, string | number> = {}): SVGTextElement {
  const t = el('text', { x, y, fill: MUTED, 'font-size': 12, ...attrs }, parent);
  t.textContent = s;
  return t;
}

/** ตัวเลขแกนแบบกลมๆ */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(Number(v.toFixed(6)));
  if (out[out.length - 1]! < max) out.push(Number((out[out.length - 1]! + step).toFixed(6)));
  return out;
}

const fmtTick = (v: number) => (v >= 1000 ? v.toLocaleString('th-TH') : String(Number(v.toFixed(2))));

// ── tooltip (Popover API ถ้ามี) ─────────────────────
let tipEl: HTMLElement | null = null;
function tip(): HTMLElement {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'cx-tip';
  tipEl.setAttribute('popover', 'manual');
  document.body.appendChild(tipEl);
  return tipEl;
}

export function showTip(x: number, y: number, value: string, label: string): void {
  const t = tip();
  t.replaceChildren();
  const v = document.createElement('strong');
  v.textContent = value;
  const l = document.createElement('span');
  l.textContent = label;
  t.append(v, l);
  t.style.left = `${Math.round(x + 14)}px`;
  t.style.top = `${Math.round(y - 12)}px`;
  if (typeof t.showPopover === 'function') {
    if (!t.matches(':popover-open')) t.showPopover();
  } else t.style.display = 'block';
}

export function hideTip(): void {
  const t = tipEl;
  if (!t) return;
  if (typeof t.hidePopover === 'function') {
    if (t.matches(':popover-open')) t.hidePopover();
  } else t.style.display = 'none';
}

function frame(title: string, sub?: string): { fig: HTMLElement; svgHost: HTMLElement } {
  const fig = document.createElement('figure');
  fig.className = 'cx-chart';
  const cap = document.createElement('figcaption');
  const h = document.createElement('b');
  h.textContent = title;
  cap.appendChild(h);
  if (sub) {
    const s = document.createElement('span');
    s.textContent = sub;
    cap.appendChild(s);
  }
  fig.appendChild(cap);
  const host = document.createElement('div');
  fig.appendChild(host);
  return { fig, svgHost: host };
}

/** path ของแท่งที่ปลายมน 4px ฝั่งค่า และเหลี่ยมฝั่งฐาน */
function roundedEnd(x: number, y: number, w: number, h: number, horizontal: boolean): string {
  const r = Math.min(4, horizontal ? w : h, (horizontal ? h : w) / 2);
  if (horizontal) return `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export interface BarRow {
  label: string;
  value: number;
  display: string;
}

/** แท่งแนวนอน (เทียบขนาด) — ค่าอยู่ปลายแท่ง */
export function barChart(rows: readonly BarRow[], title: string, sub?: string): HTMLElement {
  const { fig, svgHost } = frame(title, sub);
  const W = 560;
  const labelW = 120;
  const rowH = 30;
  const top = 6;
  const H = top + rows.length * rowH + 26;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });
  const max = Math.max(...rows.map((r) => r.value));
  const ticks = niceTicks(max);
  const scaleMax = ticks[ticks.length - 1]!;
  const plotW = W - labelW - 70;
  const sx = (v: number) => labelW + (v / scaleMax) * plotW;
  for (const t of ticks) {
    el('line', { x1: sx(t), x2: sx(t), y1: top, y2: H - 22, stroke: GRID, 'stroke-width': 1 }, svg);
    text(svg, sx(t), H - 6, fmtTick(t), { 'text-anchor': 'middle', 'font-size': 11 });
  }
  el('line', { x1: labelW, x2: labelW, y1: top, y2: H - 22, stroke: AXIS, 'stroke-width': 1 }, svg);
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const bh = 18;
    const by = y + (rowH - bh) / 2;
    text(svg, labelW - 8, y + rowH / 2 + 4, r.label, { 'text-anchor': 'end', fill: INK, 'font-size': 12.5 });
    const w = Math.max(1, sx(r.value) - labelW);
    const bar = el('path', { d: roundedEnd(labelW, by, w, bh, true), fill: CHART_COLOR, class: 'cx-mark' }, svg);
    text(svg, labelW + w + 6, by + bh / 2 + 4, r.display, { fill: INK, 'font-size': 12, 'font-weight': 600 });
    const hit = el('rect', { x: 0, y, width: W, height: rowH, fill: 'transparent', tabindex: 0 }, svg);
    const on = (e: PointerEvent | FocusEvent) => {
      bar.classList.add('hover');
      const rr = hit.getBoundingClientRect();
      const px = 'clientX' in e ? e.clientX : rr.left + rr.width / 2;
      const py = 'clientY' in e ? e.clientY : rr.top;
      showTip(px, py, r.display, r.label);
    };
    const off = () => {
      bar.classList.remove('hover');
      hideTip();
    };
    hit.addEventListener('pointermove', on);
    hit.addEventListener('focus', on);
    hit.addEventListener('pointerleave', off);
    hit.addEventListener('blur', off);
  });
  svgHost.appendChild(svg);
  return fig;
}

/** แท่งแนวตั้ง (ค่าตามลำดับ เช่น ต่อเวฟ) */
export function columnChart(rows: readonly BarRow[], title: string, sub?: string): HTMLElement {
  const { fig, svgHost } = frame(title, sub);
  const W = 560;
  const H = 220;
  const left = 54;
  const bottom = 26;
  const top = 18;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });
  const max = Math.max(...rows.map((r) => r.value));
  const ticks = niceTicks(max);
  const scaleMax = ticks[ticks.length - 1]!;
  const plotH = H - top - bottom;
  const sy = (v: number) => top + plotH - (v / scaleMax) * plotH;
  for (const t of ticks) {
    el('line', { x1: left, x2: W - 6, y1: sy(t), y2: sy(t), stroke: GRID, 'stroke-width': 1 }, svg);
    text(svg, left - 6, sy(t) + 4, fmtTick(t), { 'text-anchor': 'end', 'font-size': 11 });
  }
  const band = (W - left - 10) / rows.length;
  const bw = Math.min(24, band * 0.6);
  rows.forEach((r, i) => {
    const cx = left + band * (i + 0.5);
    const h = Math.max(1, plotH - (sy(r.value) - top));
    const col = el('path', { d: roundedEnd(cx - bw / 2, sy(r.value), bw, h, false), fill: CHART_COLOR, class: 'cx-mark' }, svg);
    text(svg, cx, H - 8, r.label, { 'text-anchor': 'middle', 'font-size': 11 });
    const hit = el('rect', { x: cx - band / 2, y: top, width: band, height: plotH, fill: 'transparent', tabindex: 0 }, svg);
    const on = (e: PointerEvent | FocusEvent) => {
      col.classList.add('hover');
      const rr = hit.getBoundingClientRect();
      showTip('clientX' in e ? e.clientX : rr.left + rr.width / 2, 'clientY' in e ? e.clientY : rr.top, r.display, r.label);
    };
    const off = () => {
      col.classList.remove('hover');
      hideTip();
    };
    hit.addEventListener('pointermove', on);
    hit.addEventListener('focus', on);
    hit.addEventListener('pointerleave', off);
    hit.addEventListener('blur', off);
  });
  el('line', { x1: left, x2: W - 6, y1: sy(0), y2: sy(0), stroke: AXIS, 'stroke-width': 1 }, svg);
  svgHost.appendChild(svg);
  return fig;
}

export interface LinePoint {
  x: number;
  y: number;
}

/** เส้น (การเปลี่ยนแปลงตามลำดับ) + crosshair หาจุดใกล้สุด */
export function lineChart(
  pts: readonly LinePoint[],
  title: string,
  opts: { sub?: string; xLabel: (x: number) => string; yFmt: (y: number) => string; yMin?: number },
): HTMLElement {
  const { fig, svgHost } = frame(title, opts.sub);
  const W = 560;
  const H = 210;
  const left = 54;
  const right = 64;
  const top = 14;
  const bottom = 26;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });
  const xs = pts.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const ticks = niceTicks(Math.max(...pts.map((p) => p.y)));
  const yMin = opts.yMin ?? 0;
  const yMax = ticks[ticks.length - 1]!;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const sx = (x: number) => left + ((x - minX) / Math.max(1e-9, maxX - minX)) * plotW;
  const sy = (y: number) => top + plotH - ((y - yMin) / Math.max(1e-9, yMax - yMin)) * plotH;
  for (const t of ticks) {
    if (t < yMin) continue;
    el('line', { x1: left, x2: left + plotW, y1: sy(t), y2: sy(t), stroke: GRID, 'stroke-width': 1 }, svg);
    text(svg, left - 6, sy(t) + 4, fmtTick(t), { 'text-anchor': 'end', 'font-size': 11 });
  }
  const span = maxX - minX;
  const step = span >= 6 ? Math.round(span / 6) : span / 4;
  for (let x = minX; x <= maxX + step * 0.01; x += step) text(svg, sx(x), H - 8, opts.xLabel(x), { 'text-anchor': 'middle', 'font-size': 11 });
  el('line', { x1: left, x2: left + plotW, y1: top + plotH, y2: top + plotH, stroke: AXIS, 'stroke-width': 1 }, svg);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  el('path', { d: `${d} L${sx(maxX)},${top + plotH} L${sx(minX)},${top + plotH} Z`, fill: CHART_COLOR, 'fill-opacity': 0.1 }, svg);
  el('path', { d, fill: 'none', stroke: CHART_COLOR, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  const last = pts[pts.length - 1]!;
  el('circle', { cx: sx(last.x), cy: sy(last.y), r: 4, fill: CHART_COLOR, stroke: '#fbfdf6', 'stroke-width': 2 }, svg);
  text(svg, sx(last.x) + 8, sy(last.y) + 4, opts.yFmt(last.y), { fill: INK, 'font-size': 12, 'font-weight': 600 });
  // crosshair
  const cross = el('line', { x1: 0, x2: 0, y1: top, y2: top + plotH, stroke: MUTED, 'stroke-width': 1, visibility: 'hidden' }, svg);
  const dot = el('circle', { r: 4, fill: CHART_COLOR, stroke: '#fbfdf6', 'stroke-width': 2, visibility: 'hidden' }, svg);
  const hit = el('rect', { x: left, y: top, width: plotW, height: plotH, fill: 'transparent', tabindex: 0 }, svg);
  const pick = (clientX: number): LinePoint => {
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    let best = pts[0]!;
    for (const p of pts) if (Math.abs(sx(p.x) - vx) < Math.abs(sx(best.x) - vx)) best = p;
    return best;
  };
  const show = (p: LinePoint, cx: number, cy: number) => {
    cross.setAttribute('x1', String(sx(p.x)));
    cross.setAttribute('x2', String(sx(p.x)));
    cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', String(sx(p.x)));
    dot.setAttribute('cy', String(sy(p.y)));
    dot.setAttribute('visibility', 'visible');
    showTip(cx, cy, opts.yFmt(p.y), opts.xLabel(p.x));
  };
  hit.addEventListener('pointermove', (e) => show(pick(e.clientX), e.clientX, e.clientY));
  hit.addEventListener('focus', () => {
    const r = hit.getBoundingClientRect();
    show(last, r.right, r.top);
  });
  const off = () => {
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
    hideTip();
  };
  hit.addEventListener('pointerleave', off);
  hit.addEventListener('blur', off);
  svgHost.appendChild(svg);
  return fig;
}
