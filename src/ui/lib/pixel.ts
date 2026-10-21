import type { Gender, OutfitId, Stage } from '../../engine/types';

export const CHAR_W = 48;
export const CHAR_H = 64;

/**
 * 全局调色板。所有像素图都从这里取色，保证整屏是同一套颜色。
 * 上限 64 色（规格 §9.1）。
 */
export const PALETTE = {
  outline: '#241d16',
  skin: '#e6bd97',
  skinShade: '#c9a077',
  skinOld: '#dcc3ab',
  hairDark: '#2a2118',
  hairBrown: '#4a3524',
  hairGray: '#9a958c',
  hairWhite: '#d8d4cc',
  eye: '#1a1510',
  white: '#f2efe6',
  blue: '#456d8f',
  blueDark: '#2f4d68',
  gray: '#6d6a63',
  grayDark: '#3b3934',
  green: '#4d6b45',
  greenDark: '#33482e',
  brown: '#7a5a3a',
  brownDark: '#553d27',
  red: '#9c3f35',
  warm: '#b98a5e',
  navy: '#2b3a52',
  cream: '#ded3bd',
  skyHigh: '#7f8f99',
  skyLow: '#b9bba6',
  hill: '#55603f',
  grass: '#5c6547',
  grassDark: '#424a33',
  road: '#4a4741',
  roadLight: '#6a665d',
  wall: '#b6a98f',
  wallDark: '#8d8270',
  floor: '#6b5b46',
  glass: '#9fb6b8',
  lampLight: '#d9c07a',
} as const;

type OutfitColors = { main: string; shade: string; trim: string };

const OUTFITS: Record<OutfitId, OutfitColors> = {
  school: { main: PALETTE.cream, shade: PALETTE.gray, trim: PALETTE.blue },
  farm: { main: PALETTE.blue, shade: PALETTE.blueDark, trim: PALETTE.grayDark },
  factory: { main: PALETTE.navy, shade: PALETTE.grayDark, trim: PALETTE.gray },
  armycoat: { main: PALETTE.green, shade: PALETTE.greenDark, trim: PALETTE.brownDark },
  suit: { main: PALETTE.navy, shade: PALETTE.grayDark, trim: PALETTE.white },
  whitecoat: { main: PALETTE.white, shade: PALETTE.gray, trim: PALETTE.blue },
  casual: { main: PALETTE.warm, shade: PALETTE.brownDark, trim: PALETTE.cream },
  pajamas: { main: PALETTE.blueDark, shade: PALETTE.navy, trim: PALETTE.cream },
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
  if (age >= 70) return role === 'none' ? 'pajamas' : 'casual';
  if (age >= 62) return role === 'none' ? 'pajamas' : 'casual';
  if (role === 'farmer') return 'farm';
  if (role === 'worker') return 'factory';
  if (role === 'teacher') return 'whitecoat';
  if (role === 'office') return gender === 'male' ? 'suit' : 'whitecoat';
  if (role === 'student') return 'school';
  return 'casual';
}

const STAGE_SCALE: Record<Stage, number> = {
  infant: 0.55,
  child: 0.74,
  student: 0.9,
  work: 1,
  midlife: 1,
  elder: 0.96,
};

export interface SpriteSpec {
  stage: Stage;
  gender: Gender;
  outfit: OutfitId;
  age: number;
  health: number;
  happiness: number;
}

function hairColors(tier: HairTier, gender: Gender): string {
  if (tier === 3) return PALETTE.hairWhite;
  if (tier === 2) return PALETTE.hairGray;
  if (tier === 1) return gender === 'male' ? PALETTE.hairGray : PALETTE.hairBrown;
  return gender === 'male' ? PALETTE.hairDark : PALETTE.hairBrown;
}

/**
 * 在 48×64 的逻辑画布上画一个小人。脚底基线固定在 y=62，
 * 所以不同阶段的角色站在一起时不会漂。
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, spec: SpriteSpec): void {
  const s = STAGE_SCALE[spec.stage];
  const frail = spec.health < 30;
  const skin = spec.age >= 60 ? PALETTE.skinOld : PALETTE.skin;
  const outfit = OUTFITS[spec.outfit];
  const hair = hairColors(hairTier(spec.age), spec.gender);

  const px = (x: number, y: number, w: number, h: number, color: string): void => {
    const X = Math.round(24 + (x - 24) * s);
    const Y = Math.round(62 - (62 - y) * s);
    const W = Math.max(1, Math.round(w * s));
    const H = Math.max(1, Math.round(h * s));
    const cx = Math.min(Math.max(X, 0), CHAR_W - 1);
    const cy = Math.min(Math.max(Y, 0), CHAR_H - 1);
    ctx.fillStyle = color;
    ctx.fillRect(cx, cy, Math.min(W, CHAR_W - cx), Math.min(H, CHAR_H - cy));
  };

  const headDrop = frail ? 1 : 0;
  const shoulder = frail ? 1 : 0;

  // 头发
  px(15, 3 + headDrop, 18, 5, hair);
  px(14, 6 + headDrop, 4, spec.gender === 'female' ? 16 : 8, hair);
  px(30, 6 + headDrop, 4, spec.gender === 'female' ? 16 : 8, hair);

  // 头与五官
  px(17, 8 + headDrop, 14, 10, skin);
  px(20, 11 + headDrop, 2, 2, PALETTE.eye);
  px(26, 11 + headDrop, 2, 2, PALETTE.eye);
  px(22, 15 + headDrop, 4, 1, PALETTE.skinShade);

  // 脖子与身体
  px(22, 18 + headDrop, 4, 3, PALETTE.skinShade);
  px(16 + shoulder, 21 + headDrop, 16 - shoulder * 2, 10, outfit.main);
  px(16 + shoulder, 31 + headDrop, 16 - shoulder * 2, 10, outfit.shade);
  px(22, 21 + headDrop, 4, 20, outfit.trim);
  px(16 + shoulder, 30 + headDrop, 16 - shoulder * 2, 2, PALETTE.grayDark);
  px(19 + shoulder, 24 + headDrop, 3, 3, outfit.trim);

  // 手臂与手
  const armY = 22 + headDrop;
  px(12 + shoulder, armY, 4, 15, outfit.main);
  px(32 - shoulder, armY, 4, 15, outfit.main);
  px(12 + shoulder, armY + 15, 4, 3, skin);
  px(32 - shoulder, armY + 15, 4, 3, skin);

  // 腿与鞋
  px(18, 41 + headDrop, 5, 19, outfit.shade);
  px(25, 41 + headDrop, 5, 19, outfit.shade);
  px(17, 58 + headDrop, 6, 4, PALETTE.outline);
  px(25, 58 + headDrop, 6, 4, PALETTE.outline);
}
