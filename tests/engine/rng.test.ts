import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng';

describe('createRng', () => {
  it('同一 seed 产生相同序列', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('next 落在 [0,1)', () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('weighted 按权重分布', () => {
    const r = createRng(7);
    const counts: Record<number, number> = { 0: 0, 1: 0 };
    for (let i = 0; i < 10000; i++) {
      const v = r.weighted([{ v: 0, w: 1 }, { v: 1, w: 3 }]);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    const ratio = (counts[1] ?? 0) / 10000;
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(0.8);
  });

  it('int 含两端点', () => {
    const r = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = r.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it('chance 概率正确', () => {
    const r = createRng(11);
    let hits = 0;
    for (let i = 0; i < 10000; i++) if (r.chance(0.25)) hits++;
    const ratio = hits / 10000;
    expect(ratio).toBeGreaterThan(0.22);
    expect(ratio).toBeLessThan(0.28);
  });

  it('pick 从数组中取值', () => {
    const r = createRng(5);
    const arr = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) expect(arr).toContain(r.pick(arr));
  });

  it('空数组直接抛错，而不是返回 undefined', () => {
    const r = createRng(5);
    expect(() => r.pick([])).toThrow();
    expect(() => r.weighted([])).toThrow();
  });
});
