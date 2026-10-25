import { describe, expect, it } from 'vitest';
import {
  cohortLifeExpectancy,
  jobPool,
  onlyChildChance,
  tierWeights,
  urbanizationCaveat,
  urbanizationRate,
  yearWeight,
  averageWage,
  wageMonths,
} from '../../src/data/demography';
import { BIRTH_YEARS } from '../../src/data/demography';
import { pickName } from '../../src/data/names';
import { PROVINCES } from '../../src/data/provinces';
import { createRng } from '../../src/engine/rng';
import { YEAR_FROM, YEAR_TO } from '../../src/engine/types';

describe('城镇化率', () => {
  it('逐年取核验表的精确值', () => {
    expect(urbanizationRate(1977)).toBeCloseTo(0.1755, 4);
    expect(urbanizationRate(1982)).toBeCloseTo(0.2113, 4);
    expect(urbanizationRate(1990)).toBeCloseTo(0.2641, 4);
    expect(urbanizationRate(1997)).toBeCloseTo(0.2992, 4);
    expect(urbanizationRate(2000)).toBeCloseTo(0.3622, 4);
    expect(urbanizationRate(2002)).toBeCloseTo(0.3909, 4);
  });

  it('1970 年以后总体上升（1960 年代初那一段是历史回落，不强行平滑）', () => {
    expect(urbanizationRate(2005)).toBeGreaterThan(urbanizationRate(1958));
    expect(urbanizationRate(1991)).toBeLessThan(urbanizationRate(1990));
    for (let y = 1970; y <= YEAR_TO; y++) {
      expect(urbanizationRate(y)).toBeGreaterThan(urbanizationRate(y - 1) - 0.01);
    }
  });

  it('年份越界时夹到边界，不返回 NaN', () => {
    expect(urbanizationRate(1900)).toBeCloseTo(urbanizationRate(YEAR_FROM), 6);
    expect(urbanizationRate(2100)).toBeCloseTo(urbanizationRate(YEAR_TO), 6);
  });

  it('2000 年要有口径说明，别的年份没有', () => {
    expect(urbanizationCaveat(2000)).toContain('普查');
    expect(urbanizationCaveat(1999)).toBeNull();
    expect(urbanizationCaveat(2001)).toBeNull();
  });
});

describe('出生人口权重', () => {
  it('覆盖 1958–2005 且全为正', () => {
    expect(BIRTH_YEARS).toHaveLength(YEAR_TO - YEAR_FROM + 1);
    expect(BIRTH_YEARS[0]).toBe(1958);
    expect(BIRTH_YEARS[BIRTH_YEARS.length - 1]).toBe(2005);
    for (const y of BIRTH_YEARS) expect(yearWeight(y)).toBeGreaterThan(0);
  });

  it('权重开过方，峰谷比不再悬殊', () => {
    const max = Math.max(...BIRTH_YEARS.map(yearWeight));
    const min = Math.min(...BIRTH_YEARS.map(yearWeight));
    expect(max / min).toBeLessThan(1.6);
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
    expect(cohortLifeExpectancy(1900, true)).toBe(cohortLifeExpectancy(1958, true));
    expect(cohortLifeExpectancy(1958, true)).toBeLessThan(cohortLifeExpectancy(1977, true));
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

describe('工资锚点', () => {
  it('取年鉴值，中间年份插值', () => {
    expect(averageWage(1997)).toBe(6470);
    expect(averageWage(2008)).toBe(29229);
    expect(averageWage(1988)).toBeGreaterThan(1400);
    expect(averageWage(1988)).toBeLessThan(1800);
  });

  it('2005 年出生的人活到 2070 年，工资不能冻结在 2050', () => {
    // `interpolate` 对超过末锚点的年份直接返回末值。锚点原本止于 2050，
    // 而 2005 年生的人能活到 2075 前后——那批人一辈子的后半段会看着
    // 一个不动的月薪（"2050 年平均工资"）。补了 2060/2070 两个推演锚点。
    expect(averageWage(2060)).toBeGreaterThan(averageWage(2050));
    expect(averageWage(2070)).toBeGreaterThan(averageWage(2060));
    // 而且是逐年上涨，不是台阶
    expect(averageWage(2055)).toBeGreaterThan(averageWage(2050));
    expect(averageWage(2065)).toBeGreaterThan(averageWage(2060));
  });

  it('把金额换算成当年几个月的工资', () => {
    // 1997 年 3000 元学费 ≈ 5.6 个月工资
    expect(wageMonths(3000, 1997)).toBe(6);
    expect(wageMonths(1000000, 2020)).toBeGreaterThan(100);
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
