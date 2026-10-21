import { describe, expect, it } from 'vitest';
import { cohortLifeExpectancy, urbanizationRate, yearWeight } from '../../src/data/demography';
import { PROVINCES } from '../../src/data/provinces';
import { rollBirth } from '../../src/engine/birth';
import { createRng } from '../../src/engine/rng';
import { YEAR_FROM, YEAR_TO } from '../../src/engine/types';

describe('rollBirth', () => {
  it('同种子结果完全一致', () => {
    expect(rollBirth(createRng(77))).toEqual(rollBirth(createRng(77)));
  });

  it('年份落在 1958–2005，月份落在 1–12', () => {
    const r = createRng(1);
    for (let i = 0; i < 500; i++) {
      const b = rollBirth(r);
      expect(b.year).toBeGreaterThanOrEqual(1958);
      expect(b.year).toBeLessThanOrEqual(2005);
      expect(Number.isInteger(b.year)).toBe(true);
      expect(b.month).toBeGreaterThanOrEqual(1);
      expect(b.month).toBeLessThanOrEqual(12);
      expect(Number.isInteger(b.month)).toBe(true);
    }
  });

  it('出生卡要用的两个数字与出生年/城乡一致', () => {
    const r = createRng(1);
    for (let i = 0; i < 200; i++) {
      const b = rollBirth(r);
      expect(b.urbanizationRate).toBeCloseTo(urbanizationRate(b.year), 8);
      expect(b.cohortLifeExpectancy).toBeCloseTo(cohortLifeExpectancy(b.year, b.urban), 8);
    }
  });

  it('城乡比例贴近当年城镇化率的加权平均', () => {
    const r = createRng(9);
    const n = 20000;
    let urban = 0;
    for (let i = 0; i < n; i++) if (rollBirth(r).urban) urban++;

    // 期望值直接从同一张表算，改生年范围时这条测试不用跟着改
    let weightSum = 0;
    let expected = 0;
    for (let y = YEAR_FROM; y <= YEAR_TO; y++) {
      const w = yearWeight(y);
      weightSum += w;
      expected += w * urbanizationRate(y);
    }
    expect(Math.abs(urban / n - expected / weightSum)).toBeLessThan(0.03);
  });

  it('独生与兄弟姐妹数自洽', () => {
    const r = createRng(3);
    let only = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) {
      const b = rollBirth(r);
      if (b.siblings === 0) only++;
      else expect(b.siblings).toBeGreaterThanOrEqual(1);
      expect(b.siblings).toBeLessThanOrEqual(3);
    }
    expect(only / n).toBeGreaterThan(0.1);
    expect(only / n).toBeLessThan(0.8);
  });

  it('同一年份里城市独生率明显高于农村', () => {
    const r = createRng(5);
    let urbanOnly = 0;
    let urbanTotal = 0;
    let ruralOnly = 0;
    let ruralTotal = 0;
    for (let i = 0; i < 30000; i++) {
      const b = rollBirth(r);
      if (b.year !== 1985) continue;
      if (b.urban) {
        urbanTotal++;
        if (b.siblings === 0) urbanOnly++;
      } else {
        ruralTotal++;
        if (b.siblings === 0) ruralOnly++;
      }
    }
    expect(urbanTotal).toBeGreaterThan(50);
    expect(ruralTotal).toBeGreaterThan(50);
    expect(urbanOnly / urbanTotal).toBeGreaterThan(ruralOnly / ruralTotal + 0.2);
  });

  it('农村家庭父母职业以农民/务工为主', () => {
    const r = createRng(11);
    let rural = 0;
    let farmish = 0;
    for (let i = 0; i < 20000; i++) {
      const b = rollBirth(r);
      if (b.urban) continue;
      rural++;
      if (b.fatherJob === 'farmer' || b.fatherJob === 'migrant') farmish++;
    }
    expect(farmish / rural).toBeGreaterThan(0.5);
  });

  it('程序员只出现在 1996 年及以后（职业池分档 1996–2002）', () => {
    const r = createRng(13);
    for (let i = 0; i < 20000; i++) {
      const b = rollBirth(r);
      if (b.fatherJob === 'programmer' || b.motherJob === 'programmer') {
        expect(b.year).toBeGreaterThanOrEqual(1996);
      }
    }
  });

  it('省份来自权重表，姓名非空', () => {
    const r = createRng(17);
    const names = new Set(PROVINCES.map((p) => p.name));
    for (let i = 0; i < 500; i++) {
      const b = rollBirth(r);
      expect(names.has(b.province)).toBe(true);
      expect(b.name.trim().length).toBeGreaterThan(1);
      expect(['male', 'female']).toContain(b.gender);
    }
  });
});
