import { describe, expect, it } from 'vitest';
import { propsForYear, toneFilter } from '../../src/data/props';

describe('年代色调', () => {
  it('80 年代褪色，2010 后干净', () => {
    expect(toneFilter(1985)).not.toBe(toneFilter(2015));
    expect(toneFilter(1977)).toContain('sepia(0.280)');
    expect(toneFilter(2020)).toContain('sepia(0.000)');
  });

  it('年份越界也不炸', () => {
    expect(toneFilter(1900)).toContain('saturate');
    expect(toneFilter(2200)).toContain('saturate');
  });
});

describe('道具替代表', () => {
  it('接口先返回数组，Task 25 再填内容', () => {
    expect(Array.isArray(propsForYear(1990))).toBe(true);
  });
});
