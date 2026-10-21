import { describe, expect, it } from 'vitest';
import { CHAR_H, CHAR_W, PALETTE, drawCharacter, hairTier, outfitFor, type SpriteSpec } from '../../src/ui/lib/pixel';

interface Recorded {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

function recorder() {
  const rects: Recorded[] = [];
  const ctx = {
    fillStyle: '',
    save() {},
    restore() {},
    translate() {},
    scale() {},
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, color: String(ctx.fillStyle) });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}

const spec = (over: Partial<SpriteSpec> = {}): SpriteSpec => ({
  stage: 'work',
  gender: 'male',
  outfit: 'casual',
  age: 30,
  health: 70,
  happiness: 60,
  ...over,
});

describe('像素角色', () => {
  it('全局调色板不超过 64 色', () => {
    expect(Object.keys(PALETTE).length).toBeLessThanOrEqual(64);
  });

  it('白发分三档', () => {
    expect(hairTier(30)).toBe(0);
    expect(hairTier(50)).toBe(1);
    expect(hairTier(66)).toBe(2);
    expect(hairTier(82)).toBe(3);
  });

  it('按年龄与身份选衣服', () => {
    expect(outfitFor(8, 'male', 'student')).toBe('school');
    expect(outfitFor(30, 'male', 'worker')).toBe('factory');
    expect(outfitFor(30, 'female', 'teacher')).toBe('whitecoat');
    expect(outfitFor(70, 'male', 'worker')).toBe('casual');
  });

  it('画出来的每一笔都落在 48×64 画布内', () => {
    const { ctx, rects } = recorder();
    drawCharacter(ctx, spec());
    expect(rects.length).toBeGreaterThan(20);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(CHAR_W);
      expect(r.y + r.h).toBeLessThanOrEqual(CHAR_H);
    }
  });

  it('不同阶段/性别/健康状态画出来不一样', () => {
    const a = recorder();
    drawCharacter(a.ctx, spec({ stage: 'child', age: 8, outfit: 'school' }));
    const b = recorder();
    drawCharacter(b.ctx, spec({ stage: 'elder', age: 80, gender: 'female', outfit: 'pajamas', health: 20 }));
    expect(JSON.stringify(a.rects)).not.toBe(JSON.stringify(b.rects));
  });
});
