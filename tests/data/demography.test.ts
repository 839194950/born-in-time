import { describe, expect, it } from 'vitest';
import {
  cohortLifeExpectancy,
  jobPool,
  onlyChildChance,
  tierWeights,
  urbanizationRate,
  yearWeight,
} from '../../src/data/demography';
import { BIRTH_YEARS } from '../../src/data/demography';
import { pickName } from '../../src/data/names';
import { PROVINCES } from '../../src/data/provinces';
import { createRng } from '../../src/engine/rng';
import { YEAR_FROM, YEAR_TO } from '../../src/engine/types';

describe('城镇化率', () => {
  it('锚点年份取锚点值', () => {
    expect(urbanizationRate(1977)).toBeCloseTo(0.18, 5);
    expect(urbanizationRate(1990)).toBeCloseTo(0.26, 5);
    expect(urbanizationRate(2002)).toBeCloseTo(0.39, 5);
  });

  it('中间年份线性插值', () => {
    expect(urbanizationRate(1982)).toBeCloseTo(0.21, 5);
    expect(urbanizationRate(1997)).toBeCloseTo(0.318, 5);
  });

  it('全年份严格递增', () => {
    for (let y = YEAR_FROM + 1; y <= YEAR_TO; y++) {
      expect(urbanizationRate(y)).toBeGreaterThan(urbanizationRate(y - 1));
    }
  });
});

describe('出生人口权重', () => {
  it('覆盖 1977–2002 且全为正', () => {
    expect(BIRTH_YEARS).toHaveLength(26);
    for (const y of BIRTH_YEARS) expect(yearWeight(y)).toBeGreaterThan(0);
  });

  it('80 年代中后期与 2000 年前后是相对高峰', () => {
    expect(yearWeight(1987)).toBeGreaterThan(yearWeight(1977));
    expect(yearWeight(1987)).toBeGreaterThan(yearWeight(2002));
  });
});

describe('队列预期寿命', () => {
  it('城市高于农村，且随年代上升', () => {
    expect(cohortLifeExpectancy(2002, true)).toBeGreaterThan(cohortLifeExpectancy(2002, false));
    expect(cohortLifeExpectancy(2002, true)).toBeGreaterThan(cohortLifeExpectancy(1977, true));
    expect(cohortLifeExpectancy(1950, true)).toBe(cohortLifeExpectancy(1977, true));
  });
});

describe('家境与职业池', () => {
  it('每个年份×城乡的权重和为正', () => {
    for (let y = YEAR_FROM; y <= YEAR_TO; y++) {
      for (const urban of [true, false]) {
        expect(tierWeights(y, urban).reduce((s, x) => s + x.w, 0)).toBeGreaterThan(0);
        expect(jobPool(y, urban).reduce((s, x) => s + x.w, 0)).toBeGreaterThan(0);
      }
    }
  });

  it('职业池随年代扩张', () => {
    expect(jobPool(1985, true).some((j) => j.id === 'programmer')).toBe(false);
    expect(jobPool(2001, true).some((j) => j.id === 'programmer')).toBe(true);
    expect(jobPool(1985, false).some((j) => j.id === 'selfEmployed')).toBe(false);
    expect(jobPool(1995, false).some((j) => j.id === 'selfEmployed')).toBe(true);
  });

  it('农村家庭始终以农民为主', () => {
    for (let y = YEAR_FROM; y <= YEAR_TO; y++) {
      const total = jobPool(y, false).reduce((s, x) => s + x.w, 0);
      const farmer = jobPool(y, false).find((j) => j.id === 'farmer');
      expect(farmer).toBeDefined();
      expect((farmer?.w ?? 0) / total).toBeGreaterThan(0.5);
    }
  });
});

describe('独生概率', () => {
  it('1977–1979 接近自然多孩', () => {
    for (const y of [1977, 1978, 1979]) {
      expect(onlyChildChance(y, true)).toBeLessThan(0.1);
      expect(onlyChildChance(y, false)).toBeLessThan(0.1);
    }
  });

  it('1980 后城市明显高于农村', () => {
    expect(onlyChildChance(1985, true)).toBeGreaterThan(0.6);
    expect(onlyChildChance(1985, false)).toBeLessThan(0.5);
    expect(onlyChildChance(1995, true)).toBeGreaterThan(onlyChildChance(1995, false));
  });
});

describe('姓名库', () => {
  it('按年代取用，不串味', () => {
    const rng = createRng(1);
    const early = new Set<string>();
    for (let i = 0; i < 200; i++) early.add(pickName(rng, 'female', 1980));
    expect(early.has('子涵')).toBe(false);
    expect(early.has('欣怡')).toBe(false);

    const late = new Set<string>();
    for (let i = 0; i < 200; i++) late.add(pickName(rng, 'male', 2001));
    expect(late.has('建国')).toBe(false);
  });

  it('名字非空且男女池不同', () => {
    const rng = createRng(2);
    const male = new Set<string>();
    const female = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const m = pickName(rng, 'male', 1995);
      const f = pickName(rng, 'female', 1995);
      expect(m.length).toBeGreaterThan(0);
      expect(f.length).toBeGreaterThan(0);
      male.add(m);
      female.add(f);
    }
    expect([...male].some((n) => female.has(n))).toBe(false);
  });
});

describe('省份权重', () => {
  it('覆盖主要省份且权重为正', () => {
    expect(PROVINCES.length).toBeGreaterThanOrEqual(25);
    for (const p of PROVINCES) {
      expect(p.w).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(1);
    }
    const total = PROVINCES.reduce((s, p) => s + p.w, 0);
    expect(total).toBeCloseTo(1, 1);
  });
});
