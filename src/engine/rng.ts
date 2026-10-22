export interface Rng {
  /** [0, 1) */
  next(): number;
  /** 含两端点 */
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly { v: T; w: number }[]): T;
}

/**
 * 命名子流：同一个种子 + 不同用途/年份 → 互不干扰的独立随机序列。
 *
 * 为什么必须有：v1 全局共用一条随机流，日常抽取与事件触发互相消耗，
 * 于是「往日常池里加一条事件」会把之后每一次抽样的随机数全部错位，
 * 同种子同命的承诺（同年对照、每日种子）整体失效。
 * 拆成子流后，加内容只影响它自己那条流。
 */
export function streamSeed(seed: number, purpose: string, year: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  const feed = (text: string): void => {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  feed(purpose);
  feed('#');
  feed(String(year));
  return h >>> 0;
}

export function rngFor(seed: number, purpose: string, year: number): Rng {
  return createRng(streamSeed(seed, purpose, year));
}

/**
 * mulberry32：小、快、同种子完全可复现。
 * 存档恢复依赖它的确定性，禁止换成 Math.random。
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (max < min) throw new Error(`int: max(${max}) < min(${min})`);
    return min + Math.floor(next() * (max - min + 1));
  };

  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('pick: empty array');
    return items[int(0, items.length - 1)] as T;
  };

  const weighted = <T,>(items: readonly { v: T; w: number }[]): T => {
    if (items.length === 0) throw new Error('weighted: empty array');
    let total = 0;
    for (const item of items) {
      if (item.w < 0) throw new Error('weighted: negative weight');
      total += item.w;
    }
    if (total <= 0) throw new Error('weighted: total weight is zero');

    let roll = next() * total;
    for (const item of items) {
      roll -= item.w;
      if (roll < 0) return item.v;
    }
    return items[items.length - 1]!.v;
  };

  return {
    next,
    int,
    chance: (p: number) => next() < p,
    pick,
    weighted,
  };
}
