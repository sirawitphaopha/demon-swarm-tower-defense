# CLAUDE.md — คู่มือโครงสร้างโค้ด Demon Swarm TD (3D)

คู่มือนี้สำหรับ Claude/นักพัฒนา เพื่อเข้าใจโครงสร้างก่อนแก้ไข **อ่านก่อนเริ่มงานเสมอ**

## ภาพรวม

- เกม Tower Defense แบบ **3D บนเว็บ** (เล่นบนคอม เมาส์ + คีย์บอร์ด) เขียนด้วย **TypeScript + Three.js + Vite**
- ไม่มี React/Next.js, ไม่มี backend — build ออกมาเป็นเว็บ static ใน `dist/`
- โมเดล 3D ทั้งหมด **ปั้นด้วยโค้ด** (ไม่มีไฟล์โมเดล/texture ภายนอก), เสียงสังเคราะห์ด้วย Web Audio
- **เวอร์ชัน** อยู่ที่ `package.json` ที่เดียว (ไม่แสดงใน UI)
- เวอร์ชัน 2D เดิม (ไฟล์เดียว) เก็บไว้ที่ branch `legacy/v0.2.0-2d`

## คำสั่ง

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` | เปิดเซิร์ฟเวอร์พัฒนา (รีเฟรชอัตโนมัติ) |
| `npm run build` | build เว็บลง `dist/` |
| `npm run typecheck` | ตรวจชนิดข้อมูล (TypeScript strict) |
| `npm test` | unit test (Vitest) — กติกาเกม/การบันทึก/กฎโปรเจกต์ |
| `npm run test:e2e` | ทดสอบเล่นจริงในเบราว์เซอร์ (Playwright) |

**ก่อน commit ทุกครั้ง:** `npm run typecheck && npm test && npm run build`

## โครงสร้าง `src/` (แบ่งชั้น — ชั้นล่างห้าม import ชั้นบน)

```
config ← core ← storage ← {render, ui, audio, editor, codex} ← app
```
`tests/rules.test.ts` บังคับกฎนี้ (และห้าม `config/core/storage/ui/audio` import three)

| โฟลเดอร์ | หน้าที่ |
|---|---|
| `config/` | **ค่าสมดุลเกมทั้งหมด** — แก้ที่นี่เพื่อปรับเกม |
| `core/` | กติกาเกมล้วน (ไม่แตะ DOM/three/เวลาจริง) — `Game.step(dt)` |
| `storage/` | localStorage (สถิติ/แมพ/ตั้งค่า) ห่อ try/catch + validate |
| `render/` | ภาพ 3D ทั้งหมด (Three.js) + โมเดลที่ปั้นด้วยโค้ดใน `render/models/` |
| `ui/` | DOM: เมนู, แผงข้อมูล (HUD), toast, จบเกม, แมพของฉัน + **ข้อความทั้งหมดใน `ui/strings.ts`** |
| `audio/` | เสียง Web Audio เล่นตามเหตุการณ์ของเกม |
| `editor/` | หน้าสร้างแมพ: `EditorModel` (กติกาล้วน) + `Editor` (ปุ่ม/การวาด) |
| `codex/` | **สารานุกรม** (📚): `data.ts` ตัวเลขที่คำนวณจาก config, `content.ts` ข้อความไทย, `Codex.ts` หน้าจอ/routing/ค้นหา, `charts.ts` กราฟ SVG, `demos.ts` ตัวอย่างกดเล่นได้ |
| `app/` | `App` ประกอบทุกส่วน + ลูปเดียว, `Input` (เมาส์/คีย์), `loopMath` (fixed timestep) |

## ค่าคงที่ / คอนฟิกหลัก

| สิ่งที่ต้องการแก้ | ไฟล์ / ตัวแปร |
|---|---|
| ขนาดกริด, จุดเกิด, โซนห้ามวาง, เวลาเตรียมตัวก่อน Wave 1, เงิน/ชีวิตเริ่มต้น, % ขาย | `config/constants.ts` (`COLS=50, ROWS=28`, `SPAWN_ROW`, `SPAWN_GUARD`, `BREAK_SEC`, `START_GOLD=300`, `SELL_RATIO`) |
| **ความเร็วทั้งเกม** | `config/constants.ts` → `REF_CELL_PX` (เพิ่ม = ช้าลง) — ความเร็วใน config เขียนเป็น px/s เดิมผ่าน `px()` |
| ป้อม (ราคา/ดาเมจ/ระยะ/เรท/**กระสุนต่อชุด `mag`/เวลาเติม `reload`**/อัปเกรด) | `config/towers.ts` → `TOWERS`, ลำดับ `TORDER` |
| ศัตรู (เลือด/สปีด/รางวัล/`fly`) | `config/enemies.ts` → `ENEMIES` (รางวัลลดครึ่งหนึ่งใน 0.3.1) |
| เวฟ | `config/waves.ts` → `WAVE_CFG` (10 เวฟ ถี่ขึ้น/เลือดหนาขึ้น/บอสบ่อยขึ้นทุกเวฟ) + `getWaveCfg(n)` (โหมดไม่สิ้นสุด ต่อจาก Wave 10) |
| ความยาก | `config/difficulty.ts` → `DIFF` |
| ธีมแมพ (สีพื้น/ท้องฟ้า/สิ่งกีดขวาง/ของตกแต่ง/จำนวนแอ่งน้ำ) | `config/themes.ts` → `THEMES`, `THORDER` |
| ระดับคุณภาพภาพ | `config/quality.ts` → `QUALITY` |

## ระบบสำคัญ

### หน่วยและพิกัด
- core ใช้หน่วย **"ช่อง"**: กึ่งกลางช่อง c คือ `c + 0.5`, ความเร็วเป็นช่อง/วินาที
- render แปลงเป็นโลก 3D: 1 หน่วย = 1 ช่อง, `X = x − COLS/2`, `Z = y − ROWS/2` (`render/coords.ts`) — พื้นสนามแบนที่ y=0

### กริด (`core/grid.ts`)
รหัสช่อง `Cell`: `Empty=0` · `Tower=1` · `Obstacle=2` (ต้นไม้/หิน/แอ่งน้ำสุ่ม) · `Water=3` (น้ำวาดเอง) — เดินได้เฉพาะ Empty

### การหาทาง (`core/pathfinding.ts`, `core/placement.ts`)
- `computeDist(grid)` BFS flow-field จากขอบขวา, `nextStep()` เลือกเพื่อนบ้านระยะต่ำสุด (ลำดับ ขวา-ล่าง-บน-ซ้าย)
- `pathValid(dist, enemies, c, r)` — จุดเกิดยังไปถึงทางออก + ช่องถัดไปของศัตรูเดินดินทุกตัวยังไปได้ → **เช็คก่อนวางป้อม/บันทึกแมพเสมอ**
- ห้ามวางป้อมบนช่องที่ตัวศัตรูเดินดินยืนอยู่ (`occupied`), ศัตรูที่กำลังเดินเข้าช่องที่เพิ่งวางจะย้อนกลับ
- ศัตรู `fly:true` (แตน) บินตรงข้ามทุกอย่าง

### เกม (`core/Game.ts`)
- `step(dt)` ด้วย dt คงที่ (`SIM_DT = 1/60`) ลำดับ: เวฟ → ศัตรู → ป้อม → กระสุน → ลบตัวตาย → เช็คชีวิต
- คำสั่ง `place/upgrade/sell/cycleTarget/skipBreak` คืน **เหตุผล** (เช่น `{ok:false, reason:'gold'}`) — UI แปลงเป็นข้อความเอง (`PLACE_FAIL` ใน `ui/strings.ts`)
- เหตุการณ์ (`core/events.ts`) สะสมในคิว → `App` ดึง `drainEvents()` ครั้งเดียวต่อเฟรม ส่งต่อ ภาพ/เสียง/UI
- เป้า "หน้าสุด/หลังสุด" วัดจาก **ระยะทางเดินที่เหลือ** (`core/targeting.ts` → `remaining()`)
- `gamePhase` = `'playing' | 'break'`; **`break` มีครั้งเดียวคือช่วงเตรียมตัวก่อน Wave 1** (`wave===0`); โหมด `'normal'`/`'endless'`, ชนะเช็คด้วย `isWin()`
- **เวฟต่อเนื่อง**: พอเวฟปล่อยศัตรูครบ `dur` วินาที เวฟถัดไปเริ่มทันที ไม่รอเคลียร์สนาม ไม่มีพัก · Wave 10 ของโหมดปกติปล่อยครบแล้วรอสนามว่างจึงชนะ
- **รีโหลด**: ป้อมมี `ammo` (กระสุนที่เหลือในชุด) กับ `reloadLeft` (เวลาเติมที่เหลือ) — ยิงจนหมดชุด (`def.mag`) แล้วหยุดยิง `def.reload` วินาที เติมเสร็จได้เต็มชุด · อัปเกรดแล้วเต็มชุดทันที · เหตุการณ์ `towerReloading` / `towerReloaded`
- สุ่มด้วย `mulberry32(seed)` — URL `?seed=42` ทำให้แมพ/เกมซ้ำได้ (ใช้ทดสอบ)

### ลูป (`app/App.ts` + `app/loopMath.ts`)
- `requestAnimationFrame` **ตัวเดียว** ตลอดอายุแอป สลับโหมด `menu | game | editor` ด้วยตัวแปร `mode`
- fixed timestep: เร่ง x2/x3 = จำลองจำนวน step มากขึ้น (ผลเหมือนกันทุกความเร็ว), ภาพใช้ `alpha` คำนวณตำแหน่งระหว่าง step

### ภาพ 3D (`render/`)
- `SceneManager` — renderer, แสง, เงา, bloom (post-processing), ท้องฟ้า/หมอกตามธีม, `setInsetLeft()` เลื่อนกึ่งกลางภาพหลบแผงซ้าย
- `CameraController` — หมุนรอบจุดเป้า: ล้อเมาส์ซูม, WASD/ลากปุ่มกลางเลื่อน, Q/E/ลากขวาหมุน, `F` รีเซ็ต, `fit()` คำนวณระยะให้เห็นทั้งสนาม, `setTopDown()` สำหรับหน้าสร้างแมพ
- `WorldView` — พื้นสนาม + เนินรอบนอก + น้ำ + ต้นไม้/หิน + ของตกแต่ง + ประตู IN/OUT
- `waterMask.ts` — น้ำทั้งสองแบบ (แอ่งสุ่ม `pondRadius` + ช่องน้ำวาดเอง) วาดลง mask เดียว → shader น้ำ/ทราย/โคลน
- `UnitsView` — ป้อม/ศัตรู/กระสุน/แถบเลือด เป็น `InstancedMesh` ทั้งหมด เขียน matrix ใหม่ทุกเฟรม (draw call คงที่ ไม่ขึ้นกับจำนวนตัว)
  - **วงเติมกระสุน** (`reloadRing`): วงแหวนบนพื้นรอบฐานป้อมที่กำลังเติม ส่วนสีส้มเพิ่มตามเข็มนาฬิกาตาม `1 − reloadLeft/reload` (shader ใน `createReloadRingMaterial`, attribute `aProg`) — 1 draw call ความจุ `COLS×ROWS`
- `materials.ts` — วัสดุ toon กลาง + **ท่าเคลื่อนไหวใน vertex shader** (ขาแมลง/ปีก/หนอน/ลำกล้องหมุน/ใบไม้ไหว) ใช้ร่วมกับเส้นขอบ (inverted hull) และเงา (`customDepthMaterial`)
- `models/` — `ModelBuilder` ประกอบรูปทรงพื้นฐานเป็น geometry เดียว พร้อม attribute `color, aGlow, aPart, aPivot, aSmooth`
- `Overlays` — เส้นกริด (shader), กรอบช่องที่ชี้, ป้อมผี, วงระยะยิง

### เครื่องมือสร้างแมพ (`editor/`)
- เข้าด้วย `App.openEditor()` กล้องมองลงตรง, ลากซ้ายวาด / ลากขวาลบ
- บันทึก/โหลด: `storage/maps.ts` ↔ `localStorage['demonSwarmMaps']` (**รูปแบบเดียวกับเวอร์ชัน 2D** — ห้ามเปลี่ยนโดยไม่ทำ migration)
- เล่นแมพที่สร้าง: `App.startGame({ kind: 'custom', map })`

### สารานุกรม (`codex/`)
- เปิดจากปุ่ม 📚 บนเมนู/แผงเกม (เกมหยุดให้อัตโนมัติ ปิดแล้วเล่นต่อ) หรือลิงก์ตรง `/#codex/<หมวด>/<id>` เช่น `#codex/towers/laser`
- หมวด: `howto, controls, towers, enemies, waves, difficulty, mechanics, themes, tuning` (ลำดับใน `CATEGORIES`)
- **ตัวเลขทุกตัวดึงจาก config ผ่าน `codex/data.ts`** — ห้ามเขียนตัวเลขเกมลงใน `content.ts`
- **เพิ่มป้อม/ศัตรู/ธีม/สิ่งกีดขวางใหม่ ต้องเพิ่มข้อความใน `codex/content.ts`** (`TOWER_TEXT`, `ENEMY_TEXT`, `THEME_TEXT`, `OBSTACLE_TEXT`) — `tests/codex.test.ts` ตรวจความครบ
- ตัวดูโมเดล `render/ModelViewer.ts` ใช้ WebGL context แยก แต่ **ไม่มี requestAnimationFrame ของตัวเอง** — `App.frame` เรียก `codex.frame(dt)` (ขณะเปิดสารานุกรม ฉากหลักหยุดวาด)
- ใช้ View Transitions, Popover API + Anchor Positioning, container queries, `@starting-style`, `:has()` แบบ progressive enhancement (เบราว์เซอร์เก่าใช้งานได้ปกติ)
- หน้า "ปรับเกม" สร้างจาก `tunables()` — ถ้าเพิ่มค่าปรับได้ใหม่ใน config ให้เพิ่มแถวที่นี่ด้วย

### การบันทึก (`storage/`)
- `demonSwarmMaps` แมพของผู้เล่น · `demonSwarmBest2` สถิติแยกตาม `โหมด_ความยาก` (key เก่า `demonSwarmBest` ไม่แตะ) · `demonSwarmSettings` ตั้งค่า

### เทสต์
- `tests/*.test.ts` (Vitest) — กติกาเกม, เล่นครบ 10 เวฟแบบ headless, การบันทึก, editor, กฎโปรเจกต์
- `tests/codex.test.ts` — ตัวเลขสารานุกรมตรงกับการจำลองเกมจริง (รวม DPS ระยะยาวที่นับเวลาเติมกระสุน เทียบกับการยิงจริง 60 วินาที) + ความครบของเนื้อหา
- `tests/combat.test.ts` — การยิง รวมรีโหลด (ยิงครบชุด → หยุดเติม → ได้เต็มชุด, อัปเกรดระหว่างเติม) · `tests/waves.test.ts` — เวฟต่อเนื่องไม่มีพัก และความแรงที่เพิ่มขึ้นทุกเวฟ
- `towerStats()` ใน `codex/data.ts`: `burstDps` = ดาเมจ × เรท, `dps` = ระยะยาว = ดาเมจ × mag ÷ ((mag−1)/rate + reload)
- `tests/e2e/codex.spec.ts` — ทุกหมวด, ลิงก์ตรง, ตัวดูโมเดล, ค้นหา, ตัวอย่างหาทาง, เปิดระหว่างเล่น
- `tests/e2e/smoke.spec.ts` (Playwright) — URL `?test=1` เปิด `window.__DSTD__` (`app/testHook.ts`) ไว้อ่าน state/แปลงช่องเป็นตำแหน่งจอ/เสกศัตรู/วัด draw call

## ⚠️ ข้อควรระวัง

- **อย่าเพิ่ม `requestAnimationFrame` ตัวที่สอง** — ทุกอย่างวิ่งผ่าน `App.frame`
- core ต้องไม่รู้จักเวลาจริง/ภาพ — อะไรที่เป็นภาพล้วน (อนุภาค, มุมหันนุ่มๆ, ซากศัตรู) อยู่ใน `render/`
- `InstancedMesh` ที่ใช้ geometry จาก cache (`obstacleModel`, `towerModel`, `insectModel`) — **ห้าม dispose geometry ที่ cache ไว้**
- ถ้าเพิ่มชิ้นส่วนที่ขยับใน shader ต้องใส่ `aPart/aPivot` ผ่าน `ModelBuilder` (เงาและเส้นขอบจะขยับตามเอง)
- ห้ามวางป้อม/วาดแมพปิดทางทั้งหมด — เช็คด้วย `pathValid()`/`EditorModel.valid()` ก่อนยืนยันเสมอ
- การ deploy (Cloudflare): `wrangler.jsonc` ชี้ `assets.directory` ไปที่ `./dist` — ต้องตั้ง Build command = `npm ci && npm run build`

## ข้อตกลงภาษา UI

- ข้อความใน UI ใช้**ภาษาไทยเป็นหลัก** น้ำเสียงทางการ (ไม่ใช้ ค่ะ/นะคะ)
- **ห้ามใช้เครื่องหมาย `?` ในข้อความ UI** ทุกที่ (ปุ่ม/หัวข้อ/popup) — มีเทสต์ตรวจ
- ไม่ใช้ browser `alert/confirm/prompt` — ใช้ `toast()` หรือ UI ในเกมแทน — มีเทสต์ตรวจ
- ข้อความที่สร้างตอนเล่นรวมไว้ที่ `ui/strings.ts`, ข้อความคงที่อยู่ใน `index.html`
