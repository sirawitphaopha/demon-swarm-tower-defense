import * as THREE from 'three';

// วัสดุการ์ตูนกลาง: toon 4 ขั้น + vertex colors + ส่วนเรืองแสง (aGlow) + กะพริบตอนโดนยิง (aFlash)
// + ท่าเคลื่อนไหวใน vertex shader (ขาแมลง/ปีก/หนอน/ลำกล้องหมุน/ใบไม้ไหว)
// โค้ด shader ท่าเคลื่อนไหวใช้ร่วมกันทั้งวัสดุสี, เส้นขอบ และเงา (customDepthMaterial)

/** ชนิดชิ้นส่วน (attribute aPart) */
export const Part = {
  Body: 0,
  LegA: 1,
  LegB: 2,
  Wing: 3,
  Worm: 4,
  Spin: 5,
  Sway: 6,
} as const;

/** uniform เวลาที่ใช้ร่วมกันทุกวัสดุ */
export const sharedUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
};

let gradient: THREE.DataTexture | null = null;
/** ไล่แสงแบบการ์ตูน 4 ขั้น */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([120, 172, 218, 255]);
  gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const ANIM_DECL = /* glsl */ `
uniform float uTime;
uniform float uWind;
attribute float aPart;
attribute vec3 aPivot;
#ifdef USE_INSTANCING
attribute float aPhase;
#endif
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
vec3 animate(vec3 p) {
  float ph = 0.0;
  #ifdef USE_INSTANCING
  ph = aPhase;
  #endif
  if (aPart > 0.5 && aPart < 2.5) {
    // ขาแมลง: สองชุดแกว่งสลับกัน (tripod gait) + ยกขา
    float s = aPart < 1.5 ? 1.0 : -1.0;
    float w = sin(ph) * s;
    vec3 q = p - aPivot;
    q = rotY(q, w * 0.42 * sign(aPivot.z + 1e-4));
    q.y += max(0.0, w) * 0.05 * length(q.xz);
    p = q + aPivot;
  } else if (aPart > 2.5 && aPart < 3.5) {
    // ปีก: กระพือรอบแกนตามลำตัว
    float side = sign(aPivot.z + 1e-4);
    vec3 q = p - aPivot;
    q = rotX(q, sin(ph * 6.0) * 0.75 * side);
    p = q + aPivot;
  } else if (aPart > 3.5 && aPart < 4.5) {
    // หนอน: คลื่นบิดตัวตามความยาว
    float k = aPivot.x;
    p.z += sin(ph - k * 2.2) * 0.05 * (1.0 + k * 0.3);
    p.y += max(0.0, sin(ph * 1.0 - k * 2.2 + 1.2)) * 0.03;
  } else if (aPart > 4.5 && aPart < 5.5) {
    // ลำกล้องหมุนรอบแกน X ที่จุด pivot
    vec3 q = p - aPivot;
    q = rotX(q, ph);
    p = q + aPivot;
  } else if (aPart > 5.5) {
    // ใบไม้/ยอดไม้ไหวตามลม (มากขึ้นตามความสูง)
    float h = max(0.0, p.y - aPivot.y);
    vec4 wp = vec4(p, 1.0);
    #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
    #endif
    float t = uTime * 1.6 + wp.x * 0.35 + wp.z * 0.23;
    p.x += sin(t) * 0.035 * h * uWind;
    p.z += cos(t * 0.8) * 0.025 * h * uWind;
  }
  return p;
}
`;

function injectAnim(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uTime = sharedUniforms.uTime;
  shader.uniforms.uWind = sharedUniforms.uWind;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${ANIM_DECL}`)
    .replace('#include <begin_vertex>', 'vec3 transformed = animate(vec3(position));');
}

export interface ToonOpts {
  /** มี attribute aFlash ต่อ instance (กะพริบขาว) */
  flash?: boolean;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

/** วัสดุ toon หลักของโมเดลทั้งหมด (ต้องมี attribute color, aGlow, aPart, aPivot) */
export function createToonMaterial(opts: ToonOpts = {}): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: toonGradient(),
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
  const flash = opts.flash ?? false;
  mat.onBeforeCompile = (shader) => {
    injectAnim(shader);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aGlow;
varying float vGlow;
${flash ? 'attribute float aFlash;\nvarying float vFlash;' : ''}`,
      )
      .replace('#include <color_vertex>', `#include <color_vertex>\nvGlow = aGlow;${flash ? '\nvFlash = aFlash;' : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vGlow;${flash ? '\nvarying float vFlash;' : ''}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * vGlow * 1.7;
${flash ? 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), vFlash * 0.75);\ntotalEmissiveRadiance += vec3(vFlash * 0.55);' : ''}`,
      );
  };
  mat.customProgramCacheKey = () => `toon-${flash ? 'f' : 'n'}`;
  return mat;
}

/** วัสดุเงา (depth) ที่ขยับตามท่าเคลื่อนไหวเดียวกัน */
export function createAnimDepthMaterial(): THREE.MeshDepthMaterial {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (shader) => injectAnim(shader);
  mat.customProgramCacheKey = () => 'anim-depth';
  return mat;
}

/** เส้นขอบการ์ตูนแบบ inverted hull: ด้านหลังของโมเดล ดันออกตาม smooth normal */
export function createOutlineMaterial(width = 0.028, color = 0x1d2a12): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    injectAnim(shader);
    shader.uniforms.uOutline = { value: width };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aSmooth;\nuniform float uOutline;')
      .replace(
        'vec3 transformed = animate(vec3(position));',
        'vec3 transformed = animate(vec3(position));\ntransformed += normalize(aSmooth) * uOutline;',
      );
  };
  mat.customProgramCacheKey = () => `outline-${width}`;
  return mat;
}
