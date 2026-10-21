import { SCENES, propsForYear, type SceneId } from '../../data/props';
import { PALETTE, drawCharacter, type SpriteSpec } from './pixel';

export const SCENE_W = 960;
export const SCENE_H = 540;

export interface SceneSpec {
  year: number;
  urban: boolean;
  scene: SceneId;
  sprite: SpriteSpec;
  companions?: { sprite: SpriteSpec; x: number }[];
}

type Rect = (x: number, y: number, w: number, h: number, color: string) => void;

function makeRect(ctx: CanvasRenderingContext2D): Rect {
  return (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
}

function drawSky(r: Rect): void {
  r(0, 0, SCENE_W, 160, PALETTE.skyHigh);
  r(0, 160, SCENE_W, 120, PALETTE.skyLow);
  r(700, 60, 60, 60, PALETTE.cream);
  r(720, 80, 20, 20, PALETTE.skyHigh);
}

function drawBuilding(r: Rect, year: number, x: number): void {
  const id = propsForYear(year).find((p) => p.slot === 'building')?.id ?? 'earth';
  if (id === 'earth') {
    r(x, 300, 190, 140, PALETTE.brownDark);
    r(x - 10, 280, 210, 24, PALETTE.brown);
    r(x + 40, 360, 40, 80, PALETTE.outline);
    r(x + 110, 330, 40, 40, PALETTE.glass);
  } else if (id === 'brick') {
    r(x, 250, 200, 190, PALETTE.red);
    r(x - 8, 232, 216, 20, PALETTE.brownDark);
    r(x + 50, 360, 46, 80, PALETTE.outline);
    r(x + 120, 300, 46, 44, PALETTE.glass);
  } else if (id === 'midrise') {
    r(x, 180, 210, 260, PALETTE.wall);
    r(x, 180, 210, 12, PALETTE.wallDark);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) r(x + 20 + j * 60, 210 + i * 56, 40, 34, PALETTE.glass);
    }
  } else {
    r(x + 10, 100, 230, 340, PALETTE.grayDark);
    r(x + 10, 100, 230, 10, PALETTE.gray);
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 3; j++) r(x + 26 + j * 66, 130 + i * 42, 46, 26, PALETTE.glass);
    }
  }
}

function drawVehicle(r: Rect, year: number, x: number, y: number): void {
  const id = propsForYear(year).find((p) => p.slot === 'vehicle')?.id ?? 'bike';
  if (id === 'bike') {
    r(x, y + 20, 4, 24, PALETTE.grayDark);
    r(x + 40, y + 20, 4, 24, PALETTE.grayDark);
    r(x, y + 16, 44, 6, PALETTE.grayDark);
    r(x + 16, y + 6, 12, 10, PALETTE.red);
  } else if (id === 'motor') {
    r(x, y + 22, 16, 20, PALETTE.grayDark);
    r(x + 34, y + 22, 16, 20, PALETTE.grayDark);
    r(x - 6, y + 14, 62, 12, PALETTE.navy);
    r(x + 44, y + 2, 10, 14, PALETTE.gray);
  } else if (id === 'car') {
    r(x - 10, y + 14, 90, 26, PALETTE.blueDark);
    r(x + 10, y + 2, 54, 16, PALETTE.blue);
    r(x - 4, y + 36, 18, 12, PALETTE.outline);
    r(x + 56, y + 36, 18, 12, PALETTE.outline);
  } else {
    r(x - 10, y + 12, 94, 28, PALETTE.white);
    r(x + 12, y, 56, 16, PALETTE.glass);
    r(x - 4, y + 36, 18, 12, PALETTE.outline);
    r(x + 58, y + 36, 18, 12, PALETTE.outline);
    r(x + 70, y + 16, 8, 6, PALETTE.lampLight);
  }
}

function drawOutdoor(r: Rect, spec: SceneSpec): void {
  drawSky(r);
  r(0, 260, SCENE_W, 60, PALETTE.hill);
  r(120, 240, 220, 20, PALETTE.hill);
  r(520, 250, 260, 20, PALETTE.hill);
  r(0, 300, SCENE_W, 240, PALETTE.grass);
  r(0, 400, SCENE_W, 140, PALETTE.grassDark);

  const street = propsForYear(spec.year).find((p) => p.slot === 'street')?.id ?? 'dirt';
  if (street === 'dirt') {
    for (let i = 0; i < 10; i++) r(40 + i * 96, 470, 56, 8, PALETTE.brownDark);
  } else {
    r(0, 452, SCENE_W, 88, PALETTE.road);
    for (let i = 0; i < 9; i++) r(30 + i * 110, 492, 54, 6, PALETTE.roadLight);
  }

  if (spec.scene === 'yard') {
    r(760, 330, 20, 130, PALETTE.brownDark);
    r(700, 300, 140, 30, PALETTE.brown);
    for (let i = 0; i < 4; i++) r(80 + i * 44, 360, 12, 100, PALETTE.brownDark);
    r(60, 330, 240, 30, PALETTE.wallDark);
  } else if (spec.scene === 'factory') {
    r(60, 200, 120, 60, PALETTE.grayDark);
    r(70, 140, 24, 60, PALETTE.gray);
    r(80, 100, 8, 40, PALETTE.grayDark);
    for (let i = 0; i < 3; i++) r(80, 90 - i * 18, 8, 8, PALETTE.wallDark);
  }

  drawBuilding(r, spec.year, 690);
  drawVehicle(r, spec.year, 150, 392);
}

function drawIndoor(r: Rect, spec: SceneSpec): void {
  r(0, 0, SCENE_W, 400, PALETTE.wall);
  r(0, 380, SCENE_W, 160, PALETTE.floor);
  r(0, 376, SCENE_W, 8, PALETTE.wallDark);

  // 窗
  r(120, 90, 220, 160, PALETTE.wallDark);
  r(132, 102, 196, 136, PALETTE.glass);
  r(226, 102, 8, 136, PALETTE.wallDark);
  r(132, 166, 196, 8, PALETTE.wallDark);

  // 电视（按年代换代）
  const tv = propsForYear(spec.year).find((p) => p.slot === 'screen');
  if (tv) {
    if (tv.id === 'tv-bw') {
      r(700, 200, 130, 110, PALETTE.grayDark);
      r(712, 212, 106, 78, PALETTE.gray);
      r(740, 310, 50, 14, PALETTE.outline);
    } else if (tv.id === 'tv-color') {
      r(690, 190, 150, 120, PALETTE.grayDark);
      r(700, 200, 130, 90, PALETTE.hill);
      r(730, 310, 60, 16, PALETTE.outline);
    } else if (tv.id === 'tv-lcd') {
      r(680, 170, 190, 120, PALETTE.outline);
      r(690, 180, 170, 100, PALETTE.navy);
      r(760, 290, 30, 16, PALETTE.outline);
    } else {
      r(660, 120, 230, 136, PALETTE.outline);
      r(668, 128, 214, 120, PALETTE.navy);
    }
  }

  // 桌子
  r(420, 380, 200, 12, PALETTE.brown);
  r(436, 392, 12, 70, PALETTE.brownDark);
  r(592, 392, 12, 70, PALETTE.brownDark);

  // 灯
  r(500, 0, 6, 60, PALETTE.grayDark);
  r(470, 56, 66, 18, PALETTE.lampLight);
}

export function drawScene(ctx: CanvasRenderingContext2D, spec: SceneSpec): void {
  const r = makeRect(ctx);
  const mode = SCENES.find((s) => s.id === spec.scene)?.mode ?? 'outdoor';
  ctx.clearRect(0, 0, SCENE_W, SCENE_H);
  if (mode === 'outdoor') drawOutdoor(r, spec);
  else drawIndoor(r, spec);

  const scale = 3;
  const x = spec.scene === 'classroom' ? 300 : 430;
  const feet = mode === 'outdoor' ? 470 : 466;
  for (const c of spec.companions ?? []) {
    ctx.save();
    ctx.translate(c.x, feet - 64 * scale);
    ctx.scale(scale, scale);
    drawCharacter(ctx, c.sprite);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, feet - 64 * scale);
  ctx.scale(scale, scale);
  drawCharacter(ctx, spec.sprite);
  ctx.restore();
}
