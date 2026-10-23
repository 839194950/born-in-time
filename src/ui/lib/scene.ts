import { SCENES, propsForYear, type SceneId } from '../../data/props';
import {
  dadStage,
  getImage,
  momStage,
  otherSet,
  plateFor,
  plateUrl,
  protagonistSet,
  spriteUrl,
  stageKeyForAge,
} from './assets';
import { PALETTE, drawCharacter, type SpriteSpec } from './pixel';

export const SCENE_W = 960;
export const SCENE_H = 540;

/**
 * 场景像素单位：1 个场景像素 = 3 个屏幕像素。
 * 960×540 的画布因此是 320×180 个"场景像素"，与角色（48×64 @ scale 3）密度一致。
 * v1 的问题正是角色按 3px 画、背景按 1px 画，两种密度叠在一帧里。
 */
const U = 3;
const UW = SCENE_W / U; // 320
const UH = SCENE_H / U; // 180

/** 角色脚底基线在 48×64 画布内的位置（与 pixel.ts 的 FEET_Y 一致） */
const SPRITE_FEET = 60;
const SPRITE_SCALE = 3;

export type CompanionKind = 'father' | 'mother' | 'spouse' | 'child';

export interface SceneSpec {
  year: number;
  urban: boolean;
  scene: SceneId;
  sprite: SpriteSpec;
  /** 种子决定主角抽哪套脸；缺省 0 */
  seed?: number;
  /** companions 的 x 仍然是 960 像素坐标，方便沿用旧调用 */
  companions?: { sprite: SpriteSpec; x: number; kind?: CompanionKind; age?: number }[];
}

type Rect = (x: number, y: number, w: number, h: number, color: string) => void;

function makeRect(ctx: CanvasRenderingContext2D): Rect {
  return (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * U), Math.round(y * U), Math.round(w * U), Math.round(h * U));
  };
}

/** 像素圆：逐行求半宽，画成一条条横带 */
function disc(r: Rect, cx: number, cy: number, radius: number, color: string): void {
  for (let dy = -radius; dy <= radius; dy++) {
    const span = Math.floor(Math.sqrt(radius * radius - dy * dy));
    if (span <= 0) continue;
    r(cx - span, cy + dy, span * 2, 1, color);
  }
}

/** 抖动过渡：两种颜色棋盘交错一行——像素画里代替渐变的标准手法，
 *  用来把天空的三条硬色带缝起来，避免"色块贴纸"感 */
function ditherBand(r: Rect, y: number, rows: number, colorA: string, colorB: string): void {
  for (let row = 0; row < rows; row++) {
    const density = (row + 1) / (rows + 1); // B 色占比从上到下递增
    for (let x = 0; x < UW; x++) {
      const cell = ((x * 7 + row * 13) % 4) / 4;
      r(x, y + row, 1, 1, cell < density ? colorB : colorA);
    }
  }
}

/** 云：平底 + 两三个圆顶，底部只留一线极淡的影（不画"笑脸"，否则像动物头） */
function cloud(r: Rect, x: number, y: number, k: number): void {
  disc(r, x + k * 2, y + k * 0.6, k * 2.2, PALETTE.cloud);
  disc(r, x + k * 5, y - k * 0.4, k * 2.8, PALETTE.cloud);
  disc(r, x + k * 8, y + k * 0.4, k * 2, PALETTE.cloud);
  r(x - k * 0.2, y + k * 1.8, k * 10, k * 1.4, PALETTE.cloud);
  r(x, y + k * 3.2, k * 9.4, k * 0.5, PALETTE.cloudShade);
}

/** 树：树干上细下粗，树冠用不等大的圆叠出蓬松感（对称圆会变成"米奇头"） */
function tree(r: Rect, x: number, groundY: number, size: number): void {
  r(x - 2, groundY - 20, 5, 20, PALETTE.trunkDark);
  r(x - 1, groundY - 20, 3, 20, PALETTE.trunk);

  const cy = groundY - size * 0.82;
  disc(r, x, cy, size * 0.52, PALETTE.leafDark);
  disc(r, x - size * 0.34, cy + size * 0.12, size * 0.4, PALETTE.leafDark);
  disc(r, x + size * 0.36, cy + size * 0.1, size * 0.38, PALETTE.leafDark);

  disc(r, x - size * 0.06, cy - size * 0.06, size * 0.44, PALETTE.leaf);
  disc(r, x - size * 0.32, cy + size * 0.02, size * 0.3, PALETTE.leaf);
  disc(r, x + size * 0.3, cy + size * 0.02, size * 0.28, PALETTE.leaf);
  disc(r, x - size * 0.16, cy - size * 0.24, size * 0.24, PALETTE.leafLight);
}

function bush(r: Rect, x: number, groundY: number, k: number): void {
  disc(r, x, groundY - k * 0.7, k, PALETTE.leafDark);
  disc(r, x - k * 0.8, groundY - k * 0.5, k * 0.75, PALETTE.leaf);
  disc(r, x + k * 0.8, groundY - k * 0.5, k * 0.7, PALETTE.leaf);
  disc(r, x - k * 0.3, groundY - k * 0.9, k * 0.4, PALETTE.leafLight);
}

function windowPane(r: Rect, x: number, y: number, w: number, h: number): void {
  r(x - 1, y - 1, w + 2, h + 2, PALETTE.frame);
  r(x, y, w, h, PALETTE.glass);
  r(x + Math.round(w / 2) - 1, y, 2, h, PALETTE.frame);
  r(x, y + Math.round(h / 2) - 1, w, 2, PALETTE.frame);
  r(x + 1, y + 1, Math.round(w / 3), 2, PALETTE.white);
}

function fence(r: Rect, x: number, groundY: number, width: number): void {
  const top = groundY - 20;
  for (let i = 0; i <= width; i += 11) {
    r(x + i, top, 4, 20, PALETTE.cream);
    r(x + i + 3, top, 1, 20, PALETTE.woodDark);
    r(x + i, top, 4, 1, PALETTE.white);
  }
  r(x, top + 4, width + 4, 3, PALETTE.cream);
  r(x, top + 4, width + 4, 1, PALETTE.white);
  r(x, top + 12, width + 4, 3, PALETTE.cream);
  r(x, top + 12, width + 4, 1, PALETTE.white);
}

/**
 * 房子：按年代换代，且**农村不跟着城市化**——那年农村盖的仍是砖房，
 * 不该出现三层楼（v2 之前 1998 年后连农村都变成了多层楼）。
 */
function building(r: Rect, year: number, urban: boolean, x: number, groundY: number): void {
  const raw = propsForYear(year).find((p) => p.slot === 'building')?.id ?? 'earth';
  const id = !urban && (raw === 'midrise' || raw === 'tower') ? 'brick' : raw;

  if (id === 'tower') {
    r(x, groundY - 104, 112, 104, PALETTE.wallDark);
    r(x, groundY - 104, 112, 4, PALETTE.gray);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 4; col++) {
        r(x + 9 + col * 24, groundY - 96 + row * 13, 15, 7, PALETTE.glass);
        r(x + 9 + col * 24, groundY - 96 + row * 13, 15, 1, PALETTE.gray);
      }
    }
    r(x + 42, groundY - 18, 28, 18, PALETTE.frame);
    return;
  }

  if (id === 'midrise') {
    r(x, groundY - 74, 108, 74, PALETTE.wall);
    r(x - 2, groundY - 78, 112, 5, PALETTE.wallDark);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        r(x + 10 + col * 31, groundY - 66 + row * 20, 18, 12, PALETTE.glass);
        r(x + 10 + col * 31, groundY - 66 + row * 20, 18, 1, PALETTE.frame);
      }
    }
    r(x + 40, groundY - 22, 24, 22, PALETTE.frame);
    return;
  }

  // 土坯 / 砖房：坡屋顶 + 院门
  const wallColor = id === 'brick' ? PALETTE.brick : PALETTE.wall;
  const wallShade = id === 'brick' ? PALETTE.roofDark : PALETTE.wallDark;
  const w = 104;
  const bodyTop = groundY - 62;
  r(x, bodyTop, w, 62, wallColor);
  r(x, bodyTop, w, 3, wallShade);
  r(x + 99, bodyTop, 5, 62, wallShade);

  // 墙面肌理：平涂一堵墙是"简陋"最大的来源，给它砌法和岁月
  if (id === 'brick') {
    // 砖缝：横线每 4 格一行，竖缝逐行错半块
    for (let ry = bodyTop + 4; ry < groundY - 2; ry += 4) {
      r(x + 1, ry, w - 2, 1, PALETTE.brickDark);
      const off = ((ry - bodyTop) / 4) % 2 === 0 ? 0 : 7;
      for (let bx = x + 6 + off; bx < x + w - 4; bx += 14) r(bx, ry + 1, 1, 3, PALETTE.brickDark);
    }
    // 向阳面高光砖：零星几块亮砖，破掉整面一个色
    for (let i = 0; i < 7; i++) r(x + 8 + ((i * 31) % 88), bodyTop + 6 + ((i * 17) % 44), 6, 3, PALETTE.brickLight);
  } else if (id === 'earth') {
    // 土坯墙：横向抹痕 + 底部返潮的深色带 + 两道裂纹
    for (let ry = bodyTop + 7; ry < groundY - 8; ry += 8) r(x + 2, ry, w - 6, 1, PALETTE.wallDark);
    r(x, groundY - 9, w, 9, PALETTE.woodDark);
    r(x, groundY - 9, w, 1, PALETTE.wood);
    r(x + 18, bodyTop + 14, 1, 12, PALETTE.woodDark);
    r(x + 19, bodyTop + 22, 1, 8, PALETTE.woodDark);
    r(x + 84, bodyTop + 30, 1, 10, PALETTE.woodDark);
  }
  // 房基接地影：房子不再像贴在草地上
  r(x - 3, groundY - 1, w + 6, 2, 'rgba(61,47,36,0.13)');

  // 屋顶：三级台阶近似的人字顶。砖房是红瓦，土坯房是旧灰瓦——
  // 1965 年的土坯房顶一层鲜红瓦，年代感就穿帮了
  const roofColor = id === 'brick' ? PALETTE.roof : PALETTE.woodDark;
  const seamColor = id === 'brick' ? PALETTE.roofDark : PALETTE.brownDark;
  r(x - 8, bodyTop - 6, w + 16, 6, roofColor);
  r(x - 2, bodyTop - 12, w + 4, 6, roofColor);
  r(x + 10, bodyTop - 18, w - 20, 6, roofColor);
  r(x + 24, bodyTop - 24, w - 48, 6, roofColor);
  // 瓦缝：每一级台阶都刻，竖缝错开才像瓦
  for (let i = 0; i < 9; i++) r(x + 4 + i * 12, bodyTop - 6, 1, 4, seamColor);
  for (let i = 0; i < 8; i++) r(x + 8 + i * 12, bodyTop - 12, 1, 4, seamColor);
  for (let i = 0; i < 6; i++) r(x + 16 + i * 12, bodyTop - 18, 1, 4, seamColor);
  for (let i = 0; i < 4; i++) r(x + 30 + i * 12, bodyTop - 24, 1, 4, seamColor);
  // 屋脊高光
  r(x + 24, bodyTop - 24, w - 48, 1, id === 'brick' ? PALETTE.brickLight : PALETTE.wood);
  // 烟囱
  r(x + 76, bodyTop - 34, 10, 12, PALETTE.brick);
  r(x + 75, bodyTop - 35, 12, 2, PALETTE.roofDark);

  windowPane(r, x + 12, bodyTop + 16, 22, 18);
  windowPane(r, x + 68, bodyTop + 16, 22, 18);
  // 门
  r(x + 42, groundY - 26, 22, 26, PALETTE.frame);
  r(x + 44, groundY - 24, 18, 24, PALETTE.door);
  r(x + 46, groundY - 22, 14, 8, PALETTE.wood);
}

function streetProp(r: Rect, year: number, groundY: number): void {
  const id = propsForYear(year).find((p) => p.slot === 'street')?.id ?? 'dirt';
  if (id === 'lamp') {
    r(24, groundY - 50, 3, 50, PALETTE.grayDark);
    r(20, groundY - 53, 11, 4, PALETTE.gray);
    r(29, groundY - 51, 5, 3, PALETTE.lampLight);
  }
}

/** 电线杆 + 下垂的电线 */
function powerPole(r: Rect, x: number, groundY: number): void {
  const top = groundY - 46;
  r(x, top, 2, 46, PALETTE.woodDark);
  r(x - 6, top + 4, 14, 2, PALETTE.woodDark);
  r(x - 4, top + 1, 2, 3, PALETTE.cream);
  r(x + 4, top + 1, 2, 3, PALETTE.cream);
  // 电线：以杆顶为最高点向两边下垂
  for (let dx = -150; dx <= 150; dx++) {
    const sag = Math.floor(((Math.abs(dx) / 150) ** 2) * 7);
    r(x + dx, top + 5 + sag, 1, 1, PALETTE.grayDark);
  }
}

/** 背景路人：比主角小一号的简笔小人，只为让画面里有生活气 */
function bystander(r: Rect, x: number, groundY: number, shirt: string, skin: string, hair: string): void {
  r(x + 1, groundY - 13, 5, 2, hair);
  r(x + 2, groundY - 11, 3, 3, skin);
  r(x + 1, groundY - 8, 5, 5, shirt);
  r(x + 1, groundY - 3, 2, 3, PALETTE.navy);
  r(x + 4, groundY - 3, 2, 3, PALETTE.navy);
}

function vehicle(r: Rect, year: number, x: number, groundY: number): void {
  const id = propsForYear(year).find((p) => p.slot === 'vehicle')?.id ?? 'bike';
  if (id === 'bike') {
    disc(r, x + 4, groundY - 4, 4, PALETTE.outline);
    disc(r, x + 22, groundY - 4, 4, PALETTE.outline);
    r(x + 4, groundY - 14, 18, 2, PALETTE.red);
    r(x + 12, groundY - 18, 2, 5, PALETTE.grayDark);
    r(x + 20, groundY - 18, 2, 5, PALETTE.grayDark);
  } else if (id === 'motor') {
    disc(r, x + 5, groundY - 4, 4, PALETTE.outline);
    disc(r, x + 24, groundY - 4, 4, PALETTE.outline);
    r(x + 3, groundY - 12, 24, 6, PALETTE.navy);
    r(x + 20, groundY - 18, 6, 7, PALETTE.blue);
  } else if (id === 'car' || id === 'ev') {
    const body = id === 'ev' ? PALETTE.green : PALETTE.blue;
    r(x, groundY - 14, 34, 8, body);
    r(x + 6, groundY - 19, 20, 6, id === 'ev' ? PALETTE.greenDark : PALETTE.blueDark);
    r(x + 8, groundY - 18, 7, 4, PALETTE.glass);
    r(x + 17, groundY - 18, 7, 4, PALETTE.glass);
    disc(r, x + 8, groundY - 5, 3, PALETTE.outline);
    disc(r, x + 26, groundY - 5, 3, PALETTE.outline);
  }
}

// ---------------------------------------------------------------- 室外

function drawOutdoor(r: Rect, spec: SceneSpec): void {
  // 天：三段色 + 抖动缝合，不留硬分界
  r(0, 0, UW, 38, PALETTE.skyHigh);
  r(0, 38, UW, 26, PALETTE.skyMid);
  r(0, 64, UW, 22, PALETTE.skyLow);
  ditherBand(r, 36, 4, PALETTE.skyHigh, PALETTE.skyMid);
  ditherBand(r, 62, 4, PALETTE.skyMid, PALETTE.skyLow);

  disc(r, 272, 22, 11, PALETTE.sunRing);
  disc(r, 272, 22, 8, PALETTE.sun);

  cloud(r, 34, 12, 3);
  cloud(r, 116, 26, 2);
  cloud(r, 186, 8, 3);
  cloud(r, 62, 42, 2);

  // 远山：蓝灰两层，和前面的草地拉开纵深。用绿色会像两片草地叠在一起。
  for (let x = 0; x < UW; x += 40) {
    disc(r, x + 20, 88, 22, PALETTE.hillFar);
    disc(r, x + 6, 92, 16, PALETTE.hillFar);
  }
  r(0, 88, UW, 20, PALETTE.hillFar);
  for (let x = 20; x < UW; x += 60) disc(r, x, 100, 20, PALETTE.hillFarDark);
  r(0, 100, UW, 12, PALETTE.hillFarDark);

  // 草地
  r(0, 110, UW, 70, PALETTE.grass);
  r(0, 110, UW, 3, PALETTE.grassDark);
  // 草地斑块：不只撒点，也铺几块更大的色斑，避免一整片死绿
  for (let i = 0; i < 7; i++) {
    disc(r, 20 + i * 46, 128 + (i % 3) * 12, 10 + (i % 3) * 3, PALETTE.grassLight);
  }
  for (let i = 0; i < 8; i++) {
    disc(r, 40 + i * 38, 142 - (i % 4) * 6, 8, PALETTE.grassDark);
  }
  for (let i = 0; i < 60; i++) {
    const gx = (i * 37) % UW;
    const gy = 118 + ((i * 53) % 34);
    r(gx, gy, 2, 1, i % 3 === 0 ? PALETTE.grassLight : PALETTE.grassDark);
  }

  // 土路 / 柏油路
  const street = propsForYear(spec.year).find((p) => p.slot === 'street')?.id ?? 'dirt';
  if (street === 'dirt') {
    r(0, 156, UW, 24, PALETTE.dirt);
    r(0, 156, UW, 2, PALETTE.dirtDark);
    for (let i = 0; i < 14; i++) r(12 + i * 22, 162 + (i % 3) * 5, 6, 2, PALETTE.dirtDark);
    // 车辙：两条断续的深色长线，土路才有"被走过"的感觉
    for (let x = 0; x < UW; x += 9) {
      if ((x / 9) % 3 !== 2) r(x, 166, 6, 1, PALETTE.dirtDark);
      if ((x / 9) % 4 !== 1) r(x, 174, 6, 1, PALETTE.dirtDark);
    }
  } else {
    r(0, 156, UW, 24, PALETTE.road);
    r(0, 156, UW, 2, PALETTE.roadLight);
    for (let i = 0; i < 10; i++) r(10 + i * 32, 168, 14, 2, PALETTE.roadLight);
  }

  building(r, spec.year, spec.urban, 198, 152);
  fence(r, 108, 152, 82);
  // 树冠投影：扁一团压在草地上，树才算"长在地上"
  disc(r, 58, 151, 17, 'rgba(61,90,36,0.16)');
  disc(r, 52, 151, 11, 'rgba(61,90,36,0.12)');
  tree(r, 52, 152, 40);
  bush(r, 314, 152, 7);
  bush(r, 176, 152, 5);
  streetProp(r, spec.year, 152);
  vehicle(r, spec.year, 140, 152);

  // 电线杆：农村画面里最有年代感的一根，线要有下垂弧度
  powerPole(r, 172, 152);

  // 背景里的路人：一院子只有自己三个人，画面是空的。
  // 位置避开主角（143）、树（52–92）和栅栏（108–190）。
  const bystanders: [number, string, string, string][] = [
    [16, PALETTE.blue, PALETTE.skin, PALETTE.hairDark],
    [286, PALETTE.warm, PALETTE.skin, PALETTE.hairBrown],
  ];
  for (const [bx, shirt, skin, hair] of bystanders) {
    bystander(r, bx, 126, shirt, skin, hair);
  }

  // 草丛：沿草地与路的交界撒一层，给画面一点纵深
  for (let i = 0; i < 22; i++) {
    const gx = 4 + i * 15 + (i % 4) * 3;
    if (gx > 100 && gx < 200) continue;
    r(gx, 150, 1, 3, PALETTE.grassDark);
    r(gx + 2, 149, 1, 4, PALETTE.grassLight);
    r(gx + 4, 151, 1, 2, PALETTE.grassDark);
  }

  if (spec.scene === 'factory') {
    r(296, 78, 16, 74, PALETTE.grayDark);
    r(294, 74, 20, 5, PALETTE.gray);
    for (let i = 0; i < 3; i++) disc(r, 304, 66 - i * 9, 5 + i, PALETTE.cloud);
    r(20, 92, 26, 20, PALETTE.wallDark);
    r(16, 86, 34, 7, PALETTE.roof);
  }
}

// ---------------------------------------------------------------- 室内

function drawIndoor(r: Rect, spec: SceneSpec): void {
  // 墙
  r(0, 0, UW, 132, PALETTE.wall);
  r(0, 0, UW, 5, PALETTE.wallDark);
  for (let x = 0; x < UW; x += 24) r(x, 5, 1, 123, PALETTE.wallDark);

  // 地板
  r(0, 132, UW, 48, PALETTE.wood);
  r(0, 128, UW, 5, PALETTE.woodDark);
  for (let x = 0; x < UW; x += 34) r(x, 137, 1, 43, PALETTE.woodDark);
  for (let y = 146; y < 180; y += 11) r(0, y, UW, 1, PALETTE.woodDark);

  // 地毯（角色站在上面，避免"浮"在木地板上）
  r(104, 158, 84, 16, PALETTE.cream);
  r(104, 158, 84, 2, PALETTE.pink);
  r(104, 172, 84, 2, PALETTE.pink);
  r(108, 162, 76, 8, PALETTE.pink);

  // 窗
  const wx = 30;
  const wy = 30;
  const ww = 72;
  const wh = 58;
  r(wx - 4, wy - 4, ww + 8, wh + 8, PALETTE.frame);
  r(wx, wy, ww, wh, PALETTE.skyMid);
  r(wx, wy, ww, Math.round(wh * 0.55), PALETTE.skyHigh);
  disc(r, wx + 54, wy + 13, 6, PALETTE.sun);
  cloud(r, wx + 8, wy + 10, 2);
  r(wx + Math.round(ww / 2) - 1, wy, 3, wh, PALETTE.frame);
  r(wx, wy + Math.round(wh / 2) - 1, ww, 3, PALETTE.frame);
  // 窗帘
  r(wx - 9, wy - 8, 10, wh + 16, PALETTE.pink);
  r(wx + ww - 1, wy - 8, 10, wh + 16, PALETTE.pink);
  r(wx - 9, wy - 10, ww + 20, 3, PALETTE.woodDark);

  // 挂钟
  disc(r, 210, 34, 9, PALETTE.frame);
  disc(r, 210, 34, 7, PALETTE.cream);
  r(210, 29, 1, 5, PALETTE.outline);
  r(210, 34, 4, 1, PALETTE.outline);

  // 墙上两幅：一张全家福、一张奖状。
  // v1 画的是"一小块草 + 两条灰线"，在 390 宽的手机上完全读不出是什么。
  // 现在按中国家庭墙上真正会挂的东西画，尺寸也放大到能辨认。
  // —— 全家福：三个人，中间那个高一点
  r(124, 26, 38, 28, PALETTE.frame);
  r(127, 29, 32, 22, PALETTE.skyLow);
  r(127, 44, 32, 7, PALETTE.grass);
  const fam = [
    { x: 131, h: 12 },
    { x: 138, h: 15 },
    { x: 147, h: 12 },
  ];
  for (const p of fam) {
    // 头
    r(p.x, 50 - p.h - 4, 4, 4, PALETTE.skin);
    r(p.x - 1, 50 - p.h - 5, 6, 2, PALETTE.hairDark);
    // 身子
    r(p.x - 1, 50 - p.h, 6, p.h, p.h > 13 ? PALETTE.red : PALETTE.blue);
  }
  // —— 奖状：红边、红头、右下角一枚章
  r(124, 58, 38, 26, PALETTE.redDark);
  r(126, 60, 34, 22, PALETTE.cream);
  r(129, 63, 24, 3, PALETTE.redDark);
  r(129, 69, 28, 1, PALETTE.gray);
  r(129, 72, 22, 1, PALETTE.gray);
  r(150, 74, 7, 6, PALETTE.red);
  r(152, 76, 3, 2, PALETTE.cream);

  // 电视 + 电视柜（教室没有电视，换成黑板）
  const tv = propsForYear(spec.year).find((p) => p.slot === 'screen');
  if (spec.scene === 'classroom') {
    // 黑板 + 粉笔字 + 粉笔槽
    r(214, 44, 96, 56, PALETTE.frame);
    r(218, 48, 88, 48, '#3f5d4a');
    r(222, 54, 34, 2, '#dde6dd');
    r(222, 62, 52, 2, '#dde6dd');
    r(222, 70, 26, 2, '#dde6dd');
    r(222, 78, 42, 2, '#dde6dd');
    r(218, 96, 88, 3, PALETTE.woodDark);
    // 讲台
    r(232, 116, 60, 14, PALETTE.wood);
    r(232, 116, 60, 2, PALETTE.woodDark);
  } else if (tv) {
    if (tv.id === 'tv-bw') {
      r(232, 96, 44, 34, PALETTE.woodDark);
      r(236, 100, 36, 24, PALETTE.grayDark);
      r(240, 104, 28, 16, PALETTE.gray);
      r(246, 130, 16, 4, PALETTE.woodDark);
    } else if (tv.id === 'tv-color') {
      r(228, 94, 52, 36, PALETTE.grayDark);
      r(232, 98, 44, 26, PALETTE.navy);
      r(236, 102, 36, 18, PALETTE.blue);
      r(246, 130, 16, 4, PALETTE.grayDark);
    } else if (tv.id === 'tv-lcd') {
      r(224, 92, 60, 34, PALETTE.outline);
      r(227, 95, 54, 28, PALETTE.navy);
      r(232, 100, 28, 18, PALETTE.blueDark);
      r(248, 126, 12, 4, PALETTE.outline);
    } else {
      r(218, 48, 72, 42, PALETTE.outline);
      r(222, 52, 64, 34, PALETTE.navy);
    }
    // 柜子
    r(220, 130, 72, 12, PALETTE.woodDark);
    r(224, 133, 30, 7, PALETTE.wood);
    r(258, 133, 30, 7, PALETTE.wood);
  }

  // 矮桌（靠左，避开站在中间的玩家）
  r(64, 150, 60, 5, PALETTE.woodDark);
  r(70, 155, 4, 20, PALETTE.woodDark);
  r(114, 155, 4, 20, PALETTE.woodDark);
  r(72, 142, 9, 8, PALETTE.cream); // 书
  r(83, 144, 10, 6, PALETTE.redDark);
  r(98, 140, 7, 10, PALETTE.green); // 瓶
  disc(r, 110, 142, 4, PALETTE.lampLight);

  // 吊灯：灯线 + 梯形灯罩 + 一点灯芯（不画半透明光晕，缩到手机上会变成一团脏影）
  r(288, 0, 2, 15, PALETTE.grayDark);
  r(281, 15, 16, 3, PALETTE.lampLight);
  r(283, 18, 12, 2, PALETTE.sun);
  r(287, 20, 4, 2, PALETTE.white);

  // 绿植
  r(302, 148, 9, 14, PALETTE.brownDark);
  disc(r, 306, 142, 8, PALETTE.leafDark);
  disc(r, 302, 138, 6, PALETTE.leaf);
  disc(r, 310, 139, 5, PALETTE.leafLight);

  // 猫（房间里有活物，画面才不像样板间）
  if (spec.year >= 1990) {
    disc(r, 196, 166, 5, PALETTE.warm);
    disc(r, 192, 161, 4, PALETTE.warm);
    r(189, 157, 2, 3, PALETTE.warm);
    r(194, 157, 2, 3, PALETTE.warm);
    r(191, 161, 1, 1, PALETTE.eye);
    r(194, 161, 1, 1, PALETTE.eye);
    r(200, 168, 6, 1, PALETTE.warm);
  }
}

/** 确定性杂点：同一帧每次重绘结果一致，避免颗粒闪烁 */
function grainHash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 年代色调 = 三个时代（与 era.ts 的分界一致：1990 / 2010）：
 * - 胶片时代（≤1989）：强褪色 + 粗颗粒（340 点）+ 暗角，接近棕褐色调；
 * - 挂历时代（1990–2009）：彩色照片感，只留一层薄暖意 + 50 点细颗粒；
 * - 数字时代（≥2010）：零做旧，只压一层几乎看不见的冷色，画面清亮锐利。
 * 跨时代那一年整幅画换代，配合界面的时代字卡，是本作的招牌转场。
 * 注意：仍不整屏压暗（v1 的教训不变）——靠褪色与颗粒传达年代，不靠变黑。
 */
function eraGrade(r: Rect, year: number): void {
  if (year < 1990) {
    r(0, 0, UW, UH, 'rgba(198,152,84,0.22)');
    for (let i = 0; i < 340; i++) {
      const gx = Math.floor(grainHash(i * 2) * UW);
      const gy = Math.floor(grainHash(i * 2 + 1) * UH);
      r(gx, gy, 1, 1, i % 3 === 0 ? 'rgba(255,246,220,0.10)' : 'rgba(58,42,26,0.08)');
    }
    const v = 'rgba(74,52,28,0.07)';
    r(0, 0, UW, 3, v);
    r(0, UH - 3, UW, 3, v);
    r(0, 0, 4, UH, v);
    r(UW - 4, 0, 4, UH, v);
    r(0, 3, UW, 2, 'rgba(74,52,28,0.04)');
    r(0, UH - 5, UW, 2, 'rgba(74,52,28,0.04)');
    return;
  }
  if (year < 2010) {
    r(0, 0, UW, UH, 'rgba(226,186,120,0.05)');
    for (let i = 0; i < 50; i++) {
      const gx = Math.floor(grainHash(i * 2) * UW);
      const gy = Math.floor(grainHash(i * 2 + 1) * UH);
      r(gx, gy, 1, 1, 'rgba(58,42,26,0.05)');
    }
    return;
  }
  r(0, 0, UW, UH, 'rgba(110,130,150,0.04)');
}

/** 精灵显示高度（相对成年 252px）：幼儿到少年按年龄段长个，老年略缩 */
const STAGE_H: Record<string, number> = {
  '03': 0.46, '08': 0.62, '15': 0.86, '25': 1, '45': 1, '70': 0.95,
  '30': 1, '50': 1, '75': 0.95, '28': 1, '48': 1, '72': 0.95,
};
const ADULT_H = 252;

export function drawScene(ctx: CanvasRenderingContext2D, spec: SceneSpec): void {
  const r = makeRect(ctx);
  const mode = SCENES.find((s) => s.id === spec.scene)?.mode ?? 'outdoor';
  ctx.clearRect(0, 0, SCENE_W, SCENE_H);

  // 生图背景板优先：有板就用板（板自带道具与纵深），没有则程序画。
  const plate = plateFor(spec.scene, spec.year);
  const plateImg = plate ? getImage(plateUrl(plate)) : null;
  if (plate && plateImg) {
    const scale = Math.max(SCENE_W / plateImg.naturalWidth, SCENE_H / plateImg.naturalHeight);
    const dw = plateImg.naturalWidth * scale;
    const dh = plateImg.naturalHeight * scale;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(plateImg, (SCENE_W - dw) / 2, SCENE_H - dh, dw, dh);
    ctx.restore();
  } else if (mode === 'outdoor') {
    drawOutdoor(r, spec);
  } else {
    drawIndoor(r, spec);
  }

  eraGrade(r, spec.year);

  // 室外基线要比"地平线"再往前几格：v1 直接踩在地平线上，
  // 腿的下半截被栅栏和草沿切掉，人看起来像跪着。有板时用板登记的基线。
  const feetPx = plate && plateImg ? plate.baseline : (mode === 'outdoor' ? 165 : 170) * U;
  const xPx = spec.scene === 'classroom' ? 300 : 430;
  const seed = spec.seed ?? 0;

  const shadow = (px: number, halfW: number): void => {
    ctx.fillStyle = 'rgba(61,47,36,0.15)';
    ctx.fillRect(Math.round(px - halfW), feetPx - 4, halfW * 2, 5);
    ctx.fillRect(Math.round(px - halfW * 0.7), feetPx - 6, halfW * 1.4, 3);
  };

  /** 生图精灵：加载完就用它，未加载完返回 false 让调用方回退像素小人 */
  const placeImage = (set: string, stage: string, px: number, bob = 0): boolean => {
    const img = getImage(spriteUrl(set, stage));
    if (!img) return false;
    const h = ADULT_H * (STAGE_H[stage] ?? 1);
    const w = (h * img.naturalWidth) / img.naturalHeight;
    shadow(px, Math.round(w * 0.32));
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, px - w / 2, feetPx - h + bob, w, h);
    ctx.restore();
    return true;
  };

  const place = (sprite: SpriteSpec, px: number): void => {
    shadow(px, 27);
    ctx.save();
    ctx.translate(px, feetPx - SPRITE_FEET * SPRITE_SCALE);
    ctx.scale(SPRITE_SCALE, SPRITE_SCALE);
    drawCharacter(ctx, sprite);
    ctx.restore();
  };

  for (const c of spec.companions ?? []) {
    const age = c.age ?? c.sprite.age;
    let done = false;
    if (c.kind === 'father') done = placeImage('dad', dadStage(age), c.x);
    else if (c.kind === 'mother') done = placeImage('mom', momStage(age), c.x);
    else if (c.kind) done = placeImage(otherSet(seed, c.sprite.gender), stageKeyForAge(age), c.x);
    if (!done) place(c.sprite, c.x);
  }

  const bob = spec.sprite.breath ? -2 : 0;
  if (!placeImage(protagonistSet(seed, spec.sprite.gender), stageKeyForAge(spec.sprite.age), xPx, bob)) {
    place(spec.sprite, xPx);
  }
}
