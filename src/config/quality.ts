export type Quality = 'low' | 'medium' | 'high';
export const QUALITY_ORDER: readonly Quality[] = ['low', 'medium', 'high'];

export interface QualityCfg {
  /** pixelRatio สูงสุด */
  maxPixelRatio: number;
  /** ขนาด shadow map (0 = ไม่มีเงาจริง ใช้เงาวงกลมใต้ตัวแทน) */
  shadowMap: number;
  /** แสงเรือง (bloom) + MSAA */
  post: boolean;
  /** จำนวนอนุภาคสูงสุด */
  particles: number;
  /** ความละเอียด water mask (px ต่อช่อง) */
  waterRes: number;
  /** ใบไม้ไหวตามลม */
  wind: boolean;
  /** เส้นขอบการ์ตูน */
  outline: boolean;
}

export const QUALITY: Record<Quality, QualityCfg> = {
  low: { maxPixelRatio: 1, shadowMap: 0, post: false, particles: 512, waterRes: 8, wind: false, outline: true },
  medium: { maxPixelRatio: 1.5, shadowMap: 2048, post: true, particles: 1024, waterRes: 16, wind: true, outline: true },
  high: { maxPixelRatio: 2, shadowMap: 4096, post: true, particles: 2048, waterRes: 16, wind: true, outline: true },
};
