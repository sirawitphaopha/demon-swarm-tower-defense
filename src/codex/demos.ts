// ตัวอย่างแบบกดเล่นได้ในหมวดกลไกเกม — ใช้โค้ดหาทางตัวจริงของเกม
import { COLS, ROWS, SPAWN_GUARD, SPAWN_ROW, Cell } from '../config/constants';
import { TARGET_MODES, TARGET_NAME, type TargetMode } from '../config/towers';
import { Grid } from '../core/grid';
import { computeDist, distAt, nextStep, spawnReachable } from '../core/pathfinding';
import { mulberry32 } from '../core/rng';
import { TARGET_TEXT } from './content';
import { hideTip, showTip } from './charts';

// ramp สีน้ำเงินแบบ sequential (ใกล้ทางออก = อ่อน · ไกล = เข้ม)
const RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
const WALL = '#4a4a44';
const PATH = '#eb6834';

function btn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'cx-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** สนามจริง 50×28: คลิก/ลากวางกำแพง แล้วดูระยะทางและเส้นทางศัตรูเปลี่ยนทันที */
export function pathDemo(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cx-demo';
  const bar = document.createElement('div');
  bar.className = 'cx-demo-bar';
  const status = document.createElement('span');
  status.className = 'cx-demo-status';
  const canvas = document.createElement('canvas');
  canvas.className = 'cx-path-canvas';
  canvas.setAttribute('aria-label', 'สนามตัวอย่างการหาทาง');
  const legend = document.createElement('div');
  legend.className = 'cx-legend';
  legend.innerHTML = `<span><i style="background:${RAMP[1]}"></i>ใกล้ทางออก</span><span><i style="background:${RAMP[11]}"></i>ไกลทางออก</span><span><i style="background:${WALL}"></i>กำแพง (ป้อม)</span><span><i class="line" style="background:${PATH}"></i>ทางที่ศัตรูเดิน</span>`;

  const grid = new Grid();
  let dist = computeDist(grid);
  let blockedMsg = -Infinity;

  const randomWalls = () => {
    grid.cells.fill(0);
    const rng = mulberry32(Math.floor(Math.random() * 1e9));
    // แนวกำแพงซิกแซกแบบที่ผู้เล่นมักสร้าง + กำแพงสุ่ม
    for (let k = 0; k < 6; k++) {
      const c = 8 + k * 6;
      const gapTop = k % 2 === 0;
      for (let r = 0; r < ROWS; r++) if (gapTop ? r > 2 : r < ROWS - 3) grid.set(c, r, Cell.Tower);
    }
    for (let i = 0; i < 40; i++) {
      const c = SPAWN_GUARD + Math.floor(rng() * (COLS - SPAWN_GUARD));
      const r = Math.floor(rng() * ROWS);
      if (grid.get(c, r) !== Cell.Empty) continue;
      grid.set(c, r, Cell.Tower);
      if (!spawnReachable(computeDist(grid))) grid.set(c, r, Cell.Empty);
    }
    dist = computeDist(grid);
    draw();
  };

  const draw = () => {
    const w = Math.max(200, wrap.clientWidth || 560);
    const cell = w / COLS;
    const h = cell * ROWS;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
    }
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    let maxD = 1;
    for (let i = 0; i < dist.length; i++) maxD = Math.max(maxD, dist[i]!);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const v = grid.get(c, r);
        const d = distAt(dist, c, r);
        g.fillStyle = v !== Cell.Empty ? WALL : d < 0 ? '#e4e2da' : RAMP[Math.min(RAMP.length - 1, Math.floor((d / maxD) * (RAMP.length - 1)))]!;
        g.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
      }
    // โซนห้ามวาง
    g.fillStyle = 'rgba(224,80,60,0.18)';
    g.fillRect(0, 0, SPAWN_GUARD * cell, h);
    // เส้นทางของศัตรูจากจุดเกิด
    g.strokeStyle = PATH;
    g.lineWidth = Math.max(2, cell * 0.28);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    let c = 0;
    let r = SPAWN_ROW;
    let steps = 0;
    g.moveTo(cell * 0.5, (r + 0.5) * cell);
    for (let i = 0; i < COLS * ROWS; i++) {
      const st = nextStep(grid, dist, c, r);
      if (st.exit) {
        g.lineTo((COLS + 0.5) * cell, (r + 0.5) * cell);
        steps++;
        break;
      }
      c += st.dx;
      r += st.dy;
      steps++;
      g.lineTo((c + 0.5) * cell, (r + 0.5) * cell);
    }
    g.stroke();
    // จุดเกิด
    g.fillStyle = '#e0503a';
    g.beginPath();
    g.arc(cell * 0.5, (SPAWN_ROW + 0.5) * cell, cell * 0.45, 0, Math.PI * 2);
    g.fill();
    if (performance.now() - blockedMsg < 1600) status.textContent = '🚫 ปิดทางทั้งหมดไม่ได้ ต้องเหลือทางอย่างน้อยหนึ่งเส้นเสมอ';
    else status.textContent = `ศัตรูต้องเดิน ${steps} ก้าว (ทางตรงไม่มีสิ่งกีดขวาง ${COLS} ก้าว) · ยาวขึ้น ×${(steps / COLS).toFixed(2)}`;
  };

  const cellAt = (e: PointerEvent): [number, number] => {
    const rr = canvas.getBoundingClientRect();
    return [Math.floor(((e.clientX - rr.left) / rr.width) * COLS), Math.floor(((e.clientY - rr.top) / rr.height) * ROWS)];
  };
  let paintVal: number | null = null;
  const paint = (c: number, r: number) => {
    if (!Grid.inBounds(c, r) || c < SPAWN_GUARD || paintVal === null) return;
    if (grid.get(c, r) === paintVal) return;
    grid.set(c, r, paintVal as 0 | 1);
    const d = computeDist(grid);
    if (paintVal === Cell.Tower && !spawnReachable(d)) {
      grid.set(c, r, Cell.Empty);
      blockedMsg = performance.now();
      setTimeout(draw, 1700); // คืนข้อความสถานะปกติ
    } else dist = d;
    draw();
  };
  canvas.addEventListener('pointerdown', (e) => {
    const [c, r] = cellAt(e);
    if (!Grid.inBounds(c, r)) return;
    paintVal = grid.get(c, r) === Cell.Tower ? Cell.Empty : Cell.Tower;
    canvas.setPointerCapture(e.pointerId);
    paint(c, r);
  });
  canvas.addEventListener('pointermove', (e) => {
    const [c, r] = cellAt(e);
    if (paintVal !== null) paint(c, r);
    if (Grid.inBounds(c, r)) {
      const d = distAt(dist, c, r);
      const v = grid.get(c, r);
      showTip(e.clientX, e.clientY, v !== Cell.Empty ? 'กำแพง' : d < 0 ? 'ไปไม่ถึง' : `${d} ก้าว`, `ช่อง (${c}, ${r}) ระยะถึงทางออก`);
    }
  });
  const up = () => (paintVal = null);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', hideTip);

  bar.append(
    btn('🧱 สุ่มเขาวงกต', randomWalls),
    btn('🧹 ล้างสนาม', () => {
      grid.cells.fill(0);
      dist = computeDist(grid);
      draw();
    }),
    status,
  );
  wrap.append(bar, canvas, legend);
  new ResizeObserver(() => draw()).observe(wrap);
  randomWalls();
  return wrap;
}

// ── การเล็งเป้า 4 แบบ ────────────────────────────────
interface DemoEnemy {
  key: string;
  x: number;
  y: number;
  /** ระยะทางเดินที่เหลือถึงทางออก */
  left: number;
  hp: number;
}

/** ภาพอธิบายการเล็ง: เขาวงกตรูปตัว S ตัวที่ใกล้ทางออกที่สุดอยู่ซ้ายกว่าตัวอื่น */
export function targetingDemo(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cx-demo';
  const bar = document.createElement('div');
  bar.className = 'cx-demo-bar';
  const note = document.createElement('p');
  note.className = 'cx-demo-note';
  const NSs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NSs, 'svg');
  svg.setAttribute('viewBox', '0 0 560 220');
  svg.classList.add('cx-target-svg');
  const path: [number, number][] = [
    [20, 40],
    [480, 40],
    [480, 110],
    [110, 110],
    [110, 180],
    [545, 180],
  ];
  const len = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const total = path.slice(1).reduce((s, p, i) => s + len(path[i]!, p), 0);
  const along = (x: number, y: number) => {
    // ระยะที่เดินมาแล้วถึงจุด (x,y) บนเส้นทาง
    let acc = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const onSeg = (a[0] === b[0] && Math.abs(x - a[0]) < 1 && y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1])) || (a[1] === b[1] && Math.abs(y - a[1]) < 1 && x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]));
      if (onSeg) return acc + Math.hypot(x - a[0], y - a[1]);
      acc += len(a, b);
    }
    return acc;
  };
  const enemies: DemoEnemy[] = [
    { key: 'A', x: 430, y: 40, left: 0, hp: 0.3 },
    { key: 'B', x: 260, y: 110, left: 0, hp: 1.0 },
    { key: 'C', x: 210, y: 180, left: 0, hp: 0.6 },
    { key: 'D', x: 90, y: 40, left: 0, hp: 0.85 },
  ];
  for (const e of enemies) e.left = total - along(e.x, e.y);
  const tower = { x: 300, y: 150 };

  const mk = (tag: string, attrs: Record<string, string | number>) => {
    const n = document.createElementNS(NSs, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    svg.appendChild(n);
    return n;
  };
  const render = (mode: TargetMode) => {
    svg.replaceChildren();
    mk('polyline', { points: path.map((p) => p.join(',')).join(' '), fill: 'none', stroke: '#d9cfae', 'stroke-width': 26, 'stroke-linejoin': 'round' });
    mk('polyline', { points: path.map((p) => p.join(',')).join(' '), fill: 'none', stroke: '#b9a874', 'stroke-width': 2, 'stroke-dasharray': '6 6' });
    const exit = mk('text', { x: 540, y: 206, 'text-anchor': 'end', 'font-size': 12, fill: '#3a6e1c' });
    exit.textContent = 'ทางออก →';
    const start = mk('text', { x: 20, y: 22, 'font-size': 12, fill: '#b03020' });
    start.textContent = 'จุดเกิด';
    const pickBy: Record<TargetMode, (e: DemoEnemy) => number> = { first: (e) => -e.left, last: (e) => e.left, strong: (e) => e.hp, weak: (e) => -e.hp };
    let tgt = enemies[0]!;
    for (const e of enemies) if (pickBy[mode](e) > pickBy[mode](tgt)) tgt = e;
    mk('line', { x1: tower.x, y1: tower.y, x2: tgt.x, y2: tgt.y, stroke: '#e0503a', 'stroke-width': 2, 'stroke-dasharray': '5 4' });
    mk('rect', { x: tower.x - 12, y: tower.y - 12, width: 24, height: 24, rx: 5, fill: '#5a4a2a', stroke: '#fbfdf6', 'stroke-width': 2 });
    for (const e of enemies) {
      const sel = e === tgt;
      if (sel) mk('circle', { cx: e.x, cy: e.y, r: 15, fill: 'none', stroke: '#e0503a', 'stroke-width': 2.5 });
      mk('circle', { cx: e.x, cy: e.y, r: 10, fill: '#43207a', stroke: '#fbfdf6', 'stroke-width': 2 });
      const t = mk('text', { x: e.x, y: e.y + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#fff', 'font-weight': 700 });
      t.textContent = e.key;
      mk('rect', { x: e.x - 14, y: e.y - 22, width: 28, height: 4, fill: '#222', rx: 1 });
      mk('rect', { x: e.x - 14, y: e.y - 22, width: 28 * e.hp, height: 4, fill: e.hp > 0.6 ? '#3db83d' : e.hp > 0.3 ? '#c8c030' : '#c03030', rx: 1 });
    }
    note.innerHTML = `<b>${TARGET_NAME[mode]}</b> → เลือกตัว <b>${tgt.key}</b> · ${TARGET_TEXT[mode]}${mode === 'first' ? '<br>ถ้าใช้ตำแหน่งซ้าย-ขวาแบบเวอร์ชันเก่า จะเลือกตัว A ซึ่งยังต้องเดินอ้อมอีกไกล (ผิดตัว)' : ''}`;
    bar.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.mode === mode));
  };
  for (const m of TARGET_MODES) {
    const b = btn(`🎯 ${TARGET_NAME[m]}`, () => render(m));
    b.dataset.mode = m;
    bar.appendChild(b);
  }
  wrap.append(bar, svg, note);
  render('first');
  return wrap;
}
