import { describe, expect, it } from 'vitest';
import { applyFocus, defaultFocusFor, focusOptionsFor, stageForAge } from '../../src/engine/focus';
import type { Stage, Stats } from '../../src/engine/types';

const base: Stats = { health: 60, ability: 50, wealth: 40, family: 60, happiness: 55 };

const FOUR_STAGES: Stage[] = ['child', 'student', 'work', 'midlife', 'elder'];
// 幼儿期也有两项照护倾向：0–5 岁不再零操作（规格 §5 只写了儿童期，但开局 27 秒真空必须堵掉）
const ACTIVE_STAGES: Stage[] = ['infant', ...FOUR_STAGES];

describe('stageForAge', () => {
  it('按规格切分六个阶段', () => {
    expect(stageForAge(0)).toBe('infant');
    expect(stageForAge(5)).toBe('infant');
    expect(stageForAge(6)).toBe('child');
    expect(stageForAge(12)).toBe('child');
    expect(stageForAge(13)).toBe('student');
    expect(stageForAge(22)).toBe('student');
    expect(stageForAge(23)).toBe('work');
    expect(stageForAge(39)).toBe('work');
    expect(stageForAge(40)).toBe('midlife');
    expect(stageForAge(59)).toBe('midlife');
    expect(stageForAge(60)).toBe('elder');
    expect(stageForAge(95)).toBe('elder');
  });
});

describe('年度重心选项', () => {
  it('除幼儿期外每个阶段 4 个选项，id 不重复', () => {
    for (const stage of FOUR_STAGES) {
      const opts = focusOptionsFor(stage);
      expect(opts).toHaveLength(4);
      expect(new Set(opts.map((o) => o.id)).size).toBe(4);
      for (const o of opts) expect(o.label.length).toBeGreaterThan(0);
    }
  });

  it('幼儿期给两个照护倾向，而不是零操作', () => {
    const opts = focusOptionsFor('infant');
    expect(opts).toHaveLength(2);
    for (const o of opts) {
      const values = Object.values(o.effects);
      expect(values.some((v) => (v ?? 0) < 0)).toBe(true);
      expect(values.some((v) => (v ?? 0) > 0)).toBe(true);
    }
  });

  it('每项都有取舍：至少一项数值要降', () => {
    for (const stage of ACTIVE_STAGES) {
      for (const o of focusOptionsFor(stage)) {
        const values = Object.values(o.effects);
        expect(values.some((v) => (v ?? 0) < 0)).toBe(true);
        expect(values.some((v) => (v ?? 0) > 0)).toBe(true);
      }
    }
  });

  it('效果幅度克制，单项不超过 4', () => {
    for (const stage of ACTIVE_STAGES) {
      for (const o of focusOptionsFor(stage)) {
        for (const v of Object.values(o.effects)) expect(Math.abs(v ?? 0)).toBeLessThanOrEqual(4);
      }
    }
  });

  it('每项都落在人生纹理四轴上', () => {
    for (const stage of ACTIVE_STAGES) {
      for (const o of focusOptionsFor(stage)) {
        expect(Object.keys(o.axes).length).toBeGreaterThan(0);
      }
    }
  });

  it('每个阶段都有默认项', () => {
    for (const stage of ACTIVE_STAGES) {
      const id = defaultFocusFor(stage);
      expect(focusOptionsFor(stage).some((o) => o.id === id)).toBe(true);
    }
  });
});

describe('applyFocus', () => {
  it('学习抬能力', () => {
    const out = applyFocus(base, 'student', 'study');
    expect(out.ability).toBeGreaterThan(base.ability);
  });

  it('未知或空选项原样返回', () => {
    expect(applyFocus(base, 'student', 'nope')).toEqual(base);
    expect(applyFocus(base, 'infant', 'study')).toEqual(base);
  });

  it('结果仍夹在 0–100', () => {
    const out = applyFocus({ ...base, health: 100, happiness: 0 }, 'work', 'rest');
    expect(out.health).toBeLessThanOrEqual(100);
    expect(out.happiness).toBeGreaterThanOrEqual(0);
  });
});
