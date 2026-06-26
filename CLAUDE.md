# CLAUDE.md — คู่มือโครงสร้างโค้ด Demon Swarm TD

คู่มือนี้สำหรับ Claude/นักพัฒนา เพื่อเข้าใจโครงสร้างก่อนแก้ไข **อ่านก่อนเริ่มงานเสมอ**

## ภาพรวม

- เกม Tower Defense **ไฟล์เดียวจบ**: `index.html` (HTML + `<style>` + `<script>`)
- ไม่มี build step, ไม่มี dependency, ไม่มี backend — เป็น static page ล้วน
- เปิดทดสอบผ่านเซิร์ฟเวอร์ static (`npx serve .` หรือ `python -m http.server`) แนะนำให้รันผ่าน `http://` เพราะ `localStorage`/Web Audio ทำงานเต็มที่
- **เวอร์ชัน** อยู่ที่บรรทัดแรกของ `index.html`: `<!-- Demon Swarm TD vX.Y.Z -->` — แก้ที่นี่ที่เดียว (ไม่แสดงใน UI)

## เค้าโครง `index.html`

1. `<style>` — UI ทั้งหมด ธีมโทนสว่าง (เขียวสด) สีหลัก: เขียว `#6fc233`/`#2e6b12`, ทอง `#c47a00`, แดง `#e0705a`
2. `<body>` — หน้าจอแบบ overlay สลับด้วย `display`:
   - `#menuScreen`, `#settingsScreen`, `#helpScreen`, `#mapsScreen` (fullscreen)
   - `#editorScreen` (หน้าสร้างแมพ — sidebar + canvas)
   - `#gameUI` (sidebar + canvas เกม)
3. `<script>` — ตรรกะเกมทั้งหมด (`'use strict'`, ฟังก์ชัน global ล้วน ไม่มี module)

## ค่าคงที่ / คอนฟิกหลัก (แก้ที่นี่เพื่อปรับสมดุลเกม)

| สิ่งที่ต้องการแก้ | ตัวแปร |
|---|---|
| ขนาดกริด | `COLS=50, ROWS=28` |
| จุดเกิดศัตรู / โซนห้ามวาง / เวลาพัก | `SPAWN_ROW`, `SPAWN_GUARD`, `BREAK_SEC` |
| ป้อม (ราคา/ดาเมจ/ระยะ/เรท/อัปเกรด) | `TOWERS`, ลำดับ `TORDER` |
| ศัตรู (เลือด/สปีด/รางวัล/`fly`) | `ENEMIES` |
| เวฟ (จำนวน/ชนิด/สเกล/บอส) | `WAVE_CFG` (10 เวฟ) + `getWaveCfg(n)` สร้างเวฟเกิน 10 สำหรับโหมดไม่สิ้นสุด |
| ความยาก | `DIFF` |
| ธีมแมพ (สีพื้น/สิ่งกีดขวาง/ของตกแต่ง/จำนวนแอ่งน้ำ) | `THEMES`, ลำดับ `THORDER` |
| โหมดเล็งเป้า | `TARGET_MODES` |

## ระบบสำคัญ

### กริด (`grid[row][col]`)
ค่าในแต่ละช่อง: `0`=ว่าง · `1`=ป้อม · `2`=สิ่งกีดขวาง(ต้นไม้/หิน + แอ่งน้ำแบบสุ่ม) · `3`=น้ำแบบวาดเอง
เดินผ่านได้เฉพาะ `grid===0` (ค่าอื่นเป็นกำแพง)

### การหาทาง (Pathfinding)
- `computeDist()` — BFS flow-field จากขอบขวา (ทางออก) คืน distance map
- `recomputePaths()` ตั้งค่า global `dist` — เรียกทุกครั้งที่กริดเปลี่ยน (วาง/ขายป้อม, สร้างแมพ)
- `nextStep(col,row)` — ศัตรูเดินไปช่องเพื่อนบ้านที่ `dist` ต่ำสุด
- `pathValid(d)` — เช็คว่ายังมีทางจาก spawn + ศัตรูทุกตัวเดินออกได้ → ใช้กันวางป้อม/วาดแมพปิดทางตาย
- ศัตรูที่มี `fly:true` (แตน) บินตรงข้ามทุกอย่าง ไม่สนกริด

### เวฟ
- `gamePhase` = `'playing'` หรือ `'break'`; `wave===0` ในช่วง break คือ "เตรียมตัวก่อนเริ่ม"
- โหมด: `gameMode` = `'normal'`(10 เวฟ) / `'endless'`; ชนะเช็คด้วย `isWin()`

### แมพ
- **แมพสุ่ม**: `generateMap()` สร้าง `ponds[]` (แอ่งน้ำ parametric ขอบหยักธรรมชาติ) + `mapObstacles[]` (ต้นไม้/หิน) + `decor[]` (หญ้า/ดอก)
- แอ่งน้ำ parametric: รูปทรงจาก `makePondShape()`/`pondRadius()` (ผลรวมคลื่นหลายความถี่ → organic), วาดด้วย `drawPond()`
- **แมพที่สร้างเอง**: น้ำเก็บเป็นช่อง `grid===3`, วาดด้วย `drawWaterCells()` (วงกลม overlap หลายชั้น + ประกายรวม clip)

### เครื่องมือสร้างแมพ (Map Editor)
- เข้าด้วย `openEditor()` ใช้ canvas `#edc` แยก, render ด้วย `renderEditor()` (loop แยก `editLoop`)
- `editTool` = tree/water/rock/grass/flower/erase; `edPaintCell()` ลงสิ่งของ (ลากเมาส์)
- บันทึก/โหลด: `customMaps` ↔ `localStorage['demonSwarmMaps']` ผ่าน `loadMaps()`/`saveMaps()`
- เล่นแมพที่สร้าง: `startCustomGame()` ตั้ง `activeCustomMap` → `initGame()` เรียก `loadCustomIntoGame()` แทน `generateMap()`

### เสียง / สถิติ
- `sfx(type)` สังเคราะห์เสียงด้วย Web Audio (ไม่มีไฟล์เสียง); `audioCtx` สร้างหลัง user gesture (`initAudio()`)
- สถิติสูงสุด: `loadBest()`/`saveBest()` ↔ `localStorage['demonSwarmBest']`

### ลูป / เรนเดอร์
- เกม: `loop()` → `update(dt)` + `render()`; editor: `editLoop()` → `renderEditor()`
- ใช้ global `raf` ตัวเดียว — สลับลูปด้วย `cancelAnimationFrame` ก่อนเริ่มลูปใหม่
- **ลำดับการวาดในสนาม**: พื้นธีม → texture → `decor` → `ponds`/`drawWaterCells` → `mapObstacles` → ป้อม → ศัตรู → projectiles → particles

## ⚠️ ข้อควรระวัง

- **`ctx.beginPath()` ก่อน `roundRect`/`arc` ที่จะ fill เสมอ** — native `roundRect` ไม่ล้าง path เอง เคยทำให้ป้อมตัวใหม่ fill ทับ emoji ตัวเก่า (บั๊ก texture หาย)
- **`resize()` ต้องถูกเรียกตอนหน้าจอแสดงแล้ว** — `initGame()`/`openEditor()` เรียก `resize()` เอง เพราะถ้าวัดตอนหน้าจอ `display:none` จะได้ขนาด 0 (สนามเล็กผิด)
- `resize()` และ global `canvas`/`ctx` สลับระหว่างเกม (`#gc`) กับ editor (`#edc`) — ฟังก์ชันที่ตั้งโหมดต้องตั้ง `canvas`/`ctx`/เรียก `resize()` ให้ถูก
- ห้ามวางป้อม/วาดแมพปิดทางทั้งหมด — เช็คด้วย `pathValid()` ก่อนยืนยันเสมอ

## ข้อตกลงภาษา UI

- ข้อความใน UI ใช้**ภาษาไทยเป็นหลัก** น้ำเสียงทางการ (ไม่ใช้ ค่ะ/นะคะ)
- **ห้ามใช้เครื่องหมาย `?` ในข้อความ UI** ทุกที่ (ปุ่ม/หัวข้อ/popup)
- ไม่ใช้ browser `alert/confirm/prompt` — ใช้ `toast()` หรือ UI ในเกมแทน
