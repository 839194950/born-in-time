import type { Gender, OutfitId, Stage } from '../../engine/types';

export const CHAR_W = 48;
export const CHAR_H = 64;

/**
 * 全局调色板 —— v2「暖纸高饱和」。
 *
 * 设计依据：参照 1in8b.life 的视觉语言——米白纸底、亮天蓝、饱和草绿、
 * 明确的暖色轮廓线。v1 的暗炭底 + 低饱和橄榄绿在手机上会糊成一片，
 * 且与"年代人生"的怀旧体温不符。
 *
 * 上限 64 色（规格 §9.1）。任何新颜色都必须先在这里登记，不许就地写 hex。
 */
export const PALETTE = {
  // 描边与基础
  outline: '#3d2f24',
  outlineSoft: '#6b5744',
  white: '#ffffff',
  paper: '#fdf6e3',

  // 皮肤
  skin: '#ffd9b3',
  skinShade: '#f0bd93',
  skinOld: '#f2d6bc',
  blush: '#f7a8a0',

  // 头发
  hairDark: '#3b2a1b',
  hairBrown: '#7a4f2a',
  hairGray: '#b7b0a4',
  hairWhite: '#efe9dd',
  eye: '#2b2118',

  // 服装
  blue: '#5b9bd5',
  blueDark: '#3f7cb0',
  navy: '#34495e',
  gray: '#8d99a6',
  grayDark: '#5d6b78',
  green: '#6fbf4a',
  greenDark: '#4e9a35',
  brown: '#a9713f',
  brownDark: '#7d5027',
  red: '#e05a4f',
  redDark: '#b8433b',
  warm: '#ef9f6b',
  cream: '#fdf6e3',
  pink: '#f2a3b3',
  purple: '#9b8ec4',

  // 天空与远景
  skyHigh: '#8ecfe8',
  skyMid: '#b3e0f0',
  skyLow: '#d8f0f8',
  sun: '#ffd166',
  sunRing: '#fff0bf',
  cloud: '#ffffff',
  cloudShade: '#e8f4f9',
  hill: '#a8dd7a',
  hillDark: '#8ccb5e',
  // 远山：蓝灰，和草地拉开距离。原来的远山是绿的，看起来像两片草地叠在一起
  hillFar: '#bcd3de',
  hillFarDark: '#a2bfcd',

  // 地面
  grass: '#7ec850',
  grassLight: '#98d964',
  grassDark: '#63ab3c',
  dirt: '#e0b97e',
  dirtDark: '#c79a5f',
  road: '#b9b3a8',
  roadLight: '#d6d1c6',

  // 植物
  trunk: '#8b5a2b',
  trunkDark: '#6f4520',
  leaf: '#4fa83d',
  leafDark: '#3a8a2c',
  leafLight: '#6cc44f',

  // 建筑与室内
  wall: '#fdf6e3',
  wallDark: '#efe2c4',
  roof: '#d9534f',
  roofDark: '#b8433f',
  glass: '#bfe6f5',
  frame: '#9b7a52',
  door: '#a0522d',
  brick: '#d4715a',
  wood: '#c99b6a',
  woodDark: '#a87b4f',
  lampLight: '#ffe6a8',
} as const;

type OutfitColors = { main: string; shade: string; trim: string };

const OUTFITS: Record<OutfitId, OutfitColors> = {
  school: { main: PALETTE.white, shade: PALETTE.blueDark, trim: PALETTE.red },
  farm: { main: PALETTE.blue, shade: PALETTE.blueDark, trim: PALETTE.cream },
  factory: { main: PALETTE.grayDark, shade: PALETTE.navy, trim: PALETTE.gray },
  armycoat: { main: PALETTE.greenDark, shade: PALETTE.greenDark, trim: PALETTE.brownDark },
  suit: { main: PALETTE.navy, shade: PALETTE.navy, trim: PALETTE.white },
  whitecoat: { main: PALETTE.white, shade: PALETTE.gray, trim: PALETTE.blueDark },
  casual: { main: PALETTE.warm, shade: PALETTE.brownDark, trim: PALETTE.cream },
  pajamas: { main: PALETTE.purple, shade: PALETTE.grayDark, trim: PALETTE.cream },
};

export type OutfitRole = 'student' | 'worker' | 'teacher' | 'farmer' | 'office' | 'none';

/** 0 = 全黑, 3 = 全白 */
export type HairTier = 0 | 1 | 2 | 3;

export function hairTier(age: number): HairTier {
  if (age < 45) return 0;
  if (age < 60) return 1;
  if (age < 75) return 2;
  return 3;
}

/** 衣服跟着年龄和身份走，不单独建模 */
export function outfitFor(age: number, gender: Gender, role: OutfitRole): OutfitId {
  if (age < 18) return 'school';
  if (age >= 62) return role === 'none' ? 'pajamas' : 'casual';
  if (role === 'farmer') return 'farm';
  if (role === 'worker') return 'factory';
  if (role === 'teacher') return 'whitecoat';
  if (role === 'office') return gender === 'male' ? 'suit' : 'whitecoat';
  if (role === 'student') return 'school';
  return 'casual';
}

const STAGE_SCALE: Record<Stage, number> = {
  infant: 0.72,
  child: 0.95,
  student: 1.12,
  work: 1.22,
  midlife: 1.22,
  elder: 1.16,
};

export interface SpriteSpec {
  stage: Stage;
  gender: Gender;
  outfit: OutfitId;
  age: number;
  health: number;
  happiness: number;
  /**
   * 待机呼吸帧（0 / 1）。只让上半身上浮 1px —— 幅度小到不像动画，
   * 但两帧交替后人就不再是贴纸。传 undefined 表示静帧（截图与测试用）。
   */
  breath?: 0 | 1;
}

function hairColors(tier: HairTier, gender: Gender): string {
  if (tier === 3) return PALETTE.hairWhite;
  if (tier === 2) return PALETTE.hairGray;
  if (tier === 1) return gender === 'male' ? PALETTE.hairGray : PALETTE.hairBrown;
  return gender === 'male' ? PALETTE.hairDark : PALETTE.hairBrown;
}

/** 一个色块。`detail: true` 的块不参与描边（眼睛、腮红这类内部细节）。 */
interface Part {
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
  detail?: boolean;
}

/** 角色站立基线（48×64 画布内的脚底 y） */
const FEET_Y = 60;
/** 角色中心 x */
const CX = 24;

/**
 * 在 48×64 的逻辑画布上画一个小人（v2 起是 chibi 比例 + 1px 暖色描边）。
 *
 * 实现要点：
 * - 所有形状先收集成 Part[]，再统一走「描边一遍、填色一遍」两趟。
 *   这样描边是完整的闭合轮廓，不会出现 v1 那种无描边、和背景糊在一起的问题。
 * - 只用 fillRect：引擎无关，也兼容测试里的录制式 ctx。
 * - 脚底基线固定在 y=60，不同阶段站在一起不漂。
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, spec: SpriteSpec): void {
  const s = STAGE_SCALE[spec.stage];
  const frail = spec.health < 30;
  const skin = spec.age >= 60 ? PALETTE.skinOld : PALETTE.skin;
  const outfit = OUTFITS[spec.outfit];
  const hair = hairColors(hairTier(spec.age), spec.gender);
  const female = spec.gender === 'female';
  const drop = frail ? 1 : 0;
  // v2：幸福真的影响表现（规格 §9.2）。v1 把这个字段一路传进来却从没读过。
  const sad = spec.happiness < 40;
  const glad = spec.happiness >= 68;
  // 呼吸只动上半身：腿脚是站定的锚点，跟着动就会"飘"
  const bob = spec.breath === 1 ? -1 : 0;
  const up = drop + bob;

  /** 设计坐标 → 实际坐标（绕脚底中心缩放） */
  const map = (x: number, y: number, w: number, h: number): [number, number, number, number] => {
    const X = Math.round(CX + (x - CX) * s);
    const Y = Math.round(FEET_Y - (FEET_Y - y) * s);
    const W = Math.max(1, Math.round(w * s));
    const H = Math.max(1, Math.round(h * s));
    return [X, Y, W, H];
  };

  const parts: Part[] = [];
  const add = (x: number, y: number, w: number, h: number, c: string, detail = false): void => {
    const [X, Y, W, H] = map(x, y + drop, w, h);
    parts.push({ x: X, y: Y, w: W, h: H, c, detail });
  };

  // ---- 头发（后层，先画，会被脸盖住） ----
  if (female) {
    add(12, 17 + up, 24, 17, hair);
    add(11, 20 + up, 3, 13, hair);
    add(34, 20 + up, 3, 13, hair);
  } else {
    add(13, 15 + up, 22, 5, hair);
    add(12, 19 + up, 3, 6, hair);
    add(33, 19 + up, 3, 6, hair);
  }

  // ---- 脸 ----
  add(14, 19 + up, 20, 15, skin);
  // 刘海
  add(14, 19 + up, 20, 3, hair);

  // ---- 身体 ----
  add(21, 33 + up, 6, 3, PALETTE.skinShade); // 脖子
  add(15, 36 + up, 18, 14, outfit.main); // 躯干
  add(15, 46 + up, 18, 4, outfit.shade); // 下摆

  // ---- 手臂 ----
  // 手垂得比肩低一点 = 垂头丧气；健康好的人手臂抬一点、露出手更完整
  const armDrop = up + (frail ? 1 : 0);
  add(11, 37 + armDrop, 4, 12, outfit.main);
  add(33, 37 + armDrop, 4, 12, outfit.main);
  add(11, 49 + armDrop, 4, 4, skin);
  add(33, 49 + armDrop, 4, 4, skin);

  // ---- 腿脚（站定的锚，不随呼吸动） ----
  add(17, 50 + drop, 6, 7, outfit.shade);
  add(26, 50 + drop, 6, 7, outfit.shade);
  add(16, 57 + drop, 7, 3, PALETTE.outline);
  add(26, 57 + drop, 7, 3, PALETTE.outline);

  // ---- 服装细节 ----
  if (spec.outfit === 'suit') {
    add(21, 36, 6, 8, PALETTE.white, true);
    add(23, 40, 2, 6, outfit.trim === PALETTE.white ? PALETTE.red : outfit.trim, true);
  } else if (spec.outfit === 'school') {
    // 红领巾：两块三角近似
    add(20, 36, 8, 2, PALETTE.red, true);
    add(22, 38, 4, 3, PALETTE.red, true);
    add(15, 44, 18, 2, PALETTE.blueDark, true);
  } else if (spec.outfit === 'whitecoat') {
    add(23, 36, 2, 12, PALETTE.gray, true);
    add(19, 36, 4, 3, PALETTE.cream, true);
    add(25, 36, 4, 3, PALETTE.cream, true);
  } else if (spec.outfit === 'farm' || spec.outfit === 'factory') {
    add(23, 36, 2, 10, outfit.trim, true);
  }

  // ---- 五官（不描边） ----
  const eyeY = 24 + up;
  if (sad) {
    // 眼睑下垂：只画下半，上沿留出皮肤
    add(18, eyeY + 1, 3, 2, PALETTE.eye, true);
    add(28, eyeY + 1, 3, 2, PALETTE.eye, true);
  } else if (glad) {
    // 弯眼：眼尾上挑，中间压低一格
    add(18, eyeY + 1, 1, 2, PALETTE.eye, true);
    add(19, eyeY, 1, 2, PALETTE.eye, true);
    add(20, eyeY + 1, 1, 2, PALETTE.eye, true);
    add(28, eyeY + 1, 1, 2, PALETTE.eye, true);
    add(29, eyeY, 1, 2, PALETTE.eye, true);
    add(30, eyeY + 1, 1, 2, PALETTE.eye, true);
  } else {
    add(18, eyeY, 3, 3, PALETTE.eye, true);
    add(28, eyeY, 3, 3, PALETTE.eye, true);
    add(19, eyeY, 1, 1, PALETTE.white, true);
    add(29, eyeY, 1, 1, PALETTE.white, true);
  }
  // 腮红：高兴时更宽更深
  const blushW = glad ? 3 : 2;
  if (!sad) {
    add(16, eyeY + 4, blushW, 1, PALETTE.blush, true);
    add(31 - blushW, eyeY + 4, blushW, 1, PALETTE.blush, true);
  }
  // 嘴：三段式——向下、平、向上
  if (glad) {
    add(22, eyeY + 5, 1, 1, PALETTE.skinShade, true);
    add(23, eyeY + 6, 3, 1, PALETTE.skinShade, true);
    add(26, eyeY + 5, 1, 1, PALETTE.skinShade, true);
  } else if (sad) {
    add(22, eyeY + 6, 1, 1, PALETTE.skinShade, true);
    add(23, eyeY + 5, 3, 1, PALETTE.skinShade, true);
    add(26, eyeY + 6, 1, 1, PALETTE.skinShade, true);
  } else {
    add(23, eyeY + 5, 3, 1, PALETTE.skinShade, true);
  }

  // ---- 两趟绘制：先描边，后填色 ----
  ctx.fillStyle = PALETTE.outline;
  for (const p of parts) {
    if (p.detail) continue;
    stamp(ctx, p.x - 1, p.y, p.w, p.h);
    stamp(ctx, p.x + 1, p.y, p.w, p.h);
    stamp(ctx, p.x, p.y - 1, p.w, p.h);
    stamp(ctx, p.x, p.y + 1, p.w, p.h);
  }
  for (const p of parts) {
    ctx.fillStyle = p.c;
    stamp(ctx, p.x, p.y, p.w, p.h);
  }
}

/** 画一个矩形，并裁到 48×64 画布内（保证不越界，测试依赖这条） */
function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(CHAR_W, x + w);
  const y1 = Math.min(CHAR_H, y + h);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}
