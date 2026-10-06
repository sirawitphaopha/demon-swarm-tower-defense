import { COLS, ROWS, Cell, type CellCode } from '../config/constants';

/** กริดสนาม เก็บรหัสช่องแบบแบน index = row*COLS + col */
export class Grid {
  readonly cells: Uint8Array;

  constructor(cells?: Uint8Array) {
    this.cells = cells ? cells : new Uint8Array(COLS * ROWS);
  }

  static inBounds(c: number, r: number): boolean {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  }

  get(c: number, r: number): CellCode {
    return this.cells[r * COLS + c] as CellCode;
  }

  set(c: number, r: number, v: CellCode): void {
    this.cells[r * COLS + c] = v;
  }

  isEmpty(c: number, r: number): boolean {
    return Grid.inBounds(c, r) && this.cells[r * COLS + c] === Cell.Empty;
  }

  clone(): Grid {
    return new Grid(this.cells.slice());
  }

  /** รายการช่องน้ำที่วาดเอง [[col,row],...] (รูปแบบเดียวกับที่บันทึกแมพ) */
  waterCells(): [number, number][] {
    const out: [number, number][] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.get(c, r) === Cell.Water) out.push([c, r]);
    return out;
  }
}

/** กึ่งกลางช่อง (หน่วยช่อง) */
export const center = (i: number): number => i + 0.5;
