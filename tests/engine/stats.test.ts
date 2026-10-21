import { describe, expect, it } from 'vitest';
import {
  adaptHappiness,
  applyEffects,
  healthDecay,
  happinessBaseline,
  initialStats,
  lifeExpectancyAtDeath,
  wealthGain,
} from '../../src/engine/stats';
import { createRng } from '../../src/engine/rng';
import type { Birth, Stats } from '../../src/engine/types';

const base: Stats = { health: 50, ability: 50, wealth: 50, family: 50, happiness: 50 };

const sampleBirth: Birth = {
  year: 1985,
  month: 6,
  province: '河南',
  urban: false,
  gender: 'male',
  name: '王建国',
  fatherJob: 'farmer',
  motherJob: 'farmer',
  tier: 'normal',
  siblings: 1,
  urbanizationRate: 0.24,
  cohortLifeExpectancy: 68,
};

describe('applyEffects', () => {
  it('上下界都夹紧在 0–100', () => {
    expect(applyEffects({ ...base, health: 98 }, { health: 5 }).health).toBe(100);
    expect(applyEffects({ ...base, wealth: 3 }, { wealth: -9 }).wealth).toBe(0);
  });

  it('不修改传入对象', () => {
    const input = { ...base };
    applyEffects(input, { health: -10 });
    expect(input.health).toBe(50);
  });

  it('缺省效果返回等值新对象', () => {
    const out = applyEffects(base, undefined);
    expect(out).toEqual(base);
    expect(out).not.toBe(base);
  });
});

describe('healthDecay', () => {
  it('任何年龄都在下降', () => {
    for (let age = 0; age <= 100; age++) expect(healthDecay(age)).toBeLessThan(0);
  });

  it('40 岁前平缓，55 岁后加速', () => {
    expect(healthDecay(30)).toBeGreaterThan(healthDecay(45));
    expect(healthDecay(45)).toBeGreaterThan(healthDecay(70));
  });
});

describe('happinessBaseline', () => {
  it('按 0.3/0.3/0.2/0.2 加权四维', () => {
    expect(happinessBaseline({ ...base, health: 100, family: 100, wealth: 100, ability: 100, happiness: 0 })).toBeCloseTo(100, 5);
    expect(happinessBaseline({ ...base, health: 0, family: 0, wealth: 0, ability: 0, happiness: 100 })).toBeCloseTo(0, 5);
    expect(happinessBaseline({ health: 80, family: 60, wealth: 40, ability: 20, happiness: 999 })).toBeCloseTo(
      0.3 * 80 + 0.3 * 60 + 0.2 * 40 + 0.2 * 20,
      5,
    );
  });
});

describe('adaptHappiness（适应回落）', () => {
  it('高于基准线会回落，但一年回不到底', () => {
    const out = adaptHappiness({ health: 50, family: 50, wealth: 50, ability: 50, happiness: 90 });
    expect(out.happiness).toBeLessThan(90);
    expect(out.happiness).toBeGreaterThan(50);
  });

  it('低于基准线会回升', () => {
    const out = adaptHappiness({ health: 90, family: 90, wealth: 90, ability: 90, happiness: 20 });
    expect(out.happiness).toBeGreaterThan(20);
    expect(out.happiness).toBeLessThan(90);
  });

  it('消费砸出来的幸福数年后滑回基准线', () => {
    let stats: Stats = { health: 50, family: 50, wealth: 50, ability: 50, happiness: 95 };
    for (let i = 0; i < 20; i++) stats = adaptHappiness(stats);
    expect(Math.abs(stats.happiness - 50)).toBeLessThan(0.5);
  });
});

describe('wealthGain（越高越难涨）', () => {
  it('低位吃满，高位打折', () => {
    expect(wealthGain({ ...base, wealth: 10 }, 5)).toBe(5);
    expect(wealthGain({ ...base, wealth: 50 }, 5)).toBe(5);
    expect(wealthGain({ ...base, wealth: 90 }, 5)).toBeLessThan(2);
  });

  it('下跌不打折', () => {
    expect(wealthGain({ ...base, wealth: 90 }, -5)).toBe(-5);
  });
});

describe('initialStats', () => {
  it('家境越好起跑线越高，城市优于农村', () => {
    const richUrban = initialStats({ ...sampleBirth, urban: true, tier: 'rich', siblings: 0 });
    const poorRural = initialStats({ ...sampleBirth, urban: false, tier: 'destitute', siblings: 3 });
    expect(richUrban.health).toBeGreaterThan(poorRural.health);
    expect(richUrban.ability).toBeGreaterThan(poorRural.ability);
    expect(richUrban.wealth).toBeGreaterThan(poorRural.wealth);
  });

  it('五维都在 0–100', () => {
    for (const tier of ['destitute', 'poor', 'normal', 'wellOff', 'rich'] as const) {
      for (const urban of [true, false]) {
        const s = initialStats({ ...sampleBirth, tier, urban });
        for (const v of Object.values(s)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe('lifeExpectancyAtDeath', () => {
  it('健康好加年，健康差减年', () => {
    const good = lifeExpectancyAtDeath(sampleBirth, { ...base, health: 100 }, createRng(1));
    const bad = lifeExpectancyAtDeath(sampleBirth, { ...base, health: 0 }, createRng(1));
    expect(good).toBeGreaterThan(sampleBirth.cohortLifeExpectancy);
    expect(bad).toBeLessThan(sampleBirth.cohortLifeExpectancy);
  });

  it('偏移不超过 ±12 年', () => {
    const r = createRng(2);
    for (let i = 0; i < 200; i++) {
      const age = lifeExpectancyAtDeath(sampleBirth, { ...base, health: i % 101 }, r);
      expect(age).toBeGreaterThanOrEqual(sampleBirth.cohortLifeExpectancy - 12);
      expect(age).toBeLessThanOrEqual(sampleBirth.cohortLifeExpectancy + 12);
    }
  });
});
