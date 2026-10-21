import { TIER_ORDER, YEAR_FROM, YEAR_TO, type JobId, type Tier } from '../engine/types';

export const BIRTH_YEARS: readonly number[] = Array.from(
  { length: YEAR_TO - YEAR_FROM + 1 },
  (_, i) => YEAR_FROM + i,
);

type Anchors = readonly (readonly [number, number])[];

function interpolate(anchors: Anchors, year: number): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (!first || !last) throw new Error('interpolate: empty anchors');
  if (year <= first[0]) return first[1];
  if (year >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1]!;
    const next = anchors[i]!;
    if (year <= next[0]) {
      const t = (year - prev[0]) / (next[0] - prev[0]);
      return prev[1] + (next[1] - prev[1]) * t;
    }
  }
  return last[1];
}

/**
 * 城镇化率（0–1）。锚点取整自国家统计局口径，中间年份线性插值。
 * 来源：国家统计局《中国统计年鉴》人口城乡构成，1978 年 17.9%、1990 年 26.4%、
 * 2000 年 36.2%、2002 年 39.1%；1977 年按 1978 年近似。
 */
const URBANIZATION_ANCHORS: Anchors = [
  [1977, 0.18],
  [1980, 0.19],
  [1985, 0.24],
  [1990, 0.26],
  [1995, 0.29],
  [2000, 0.36],
  [2002, 0.39],
];

export function urbanizationRate(year: number): number {
  return interpolate(URBANIZATION_ANCHORS, year);
}

/**
 * 出生人口权重（相对值，单位≈百万人）。不必精确，只求峰谷形状正确：
 * 1987 年前后为峰（约 2550 万），2002 年为谷（约 1650 万）。
 * 来源：国家统计局历年出生人口数，取整。
 */
const YEAR_WEIGHT: Readonly<Record<number, number>> = {
  1977: 17.9,
  1978: 17.5,
  1979: 17.3,
  1980: 17.8,
  1981: 20.7,
  1982: 22.5,
  1983: 20.8,
  1984: 20.6,
  1985: 22.2,
  1986: 23.9,
  1987: 25.5,
  1988: 24.6,
  1989: 24.1,
  1990: 23.9,
  1991: 22.5,
  1992: 21.2,
  1993: 21.3,
  1994: 21.1,
  1995: 20.6,
  1996: 20.6,
  1997: 20.4,
  1998: 19.9,
  1999: 19.1,
  2000: 17.7,
  2001: 17.0,
  2002: 16.5,
};

export function yearWeight(year: number): number {
  return YEAR_WEIGHT[year] ?? 1;
}

/**
 * 该出生队列的预期寿命。城市高于农村，随年代上升。
 * 来源：国家统计局人口预期寿命口径，1977 年城镇约 70、农村约 66；
 * 2002 年城镇约 78、农村约 72。中间年份线性。
 */
const LIFE_URBAN: Anchors = [
  [1977, 70],
  [2002, 78],
];
const LIFE_RURAL: Anchors = [
  [1977, 66],
  [2002, 72],
];

export function cohortLifeExpectancy(year: number, urban: boolean): number {
  return interpolate(urban ? LIFE_URBAN : LIFE_RURAL, year);
}

type TierWeight = { tier: Tier; w: number };

const TIER_BASE: Readonly<Record<'urban' | 'rural', { start: TierWeight[]; end: TierWeight[] }>> = {
  urban: {
    start: [
      { tier: 'destitute', w: 2 },
      { tier: 'poor', w: 12 },
      { tier: 'normal', w: 56 },
      { tier: 'wellOff', w: 25 },
      { tier: 'rich', w: 5 },
    ],
    end: [
      { tier: 'destitute', w: 1 },
      { tier: 'poor', w: 8 },
      { tier: 'normal', w: 40 },
      { tier: 'wellOff', w: 38 },
      { tier: 'rich', w: 13 },
    ],
  },
  rural: {
    start: [
      { tier: 'destitute', w: 12 },
      { tier: 'poor', w: 34 },
      { tier: 'normal', w: 42 },
      { tier: 'wellOff', w: 10 },
      { tier: 'rich', w: 2 },
    ],
    end: [
      { tier: 'destitute', w: 3 },
      { tier: 'poor', w: 15 },
      { tier: 'normal', w: 42 },
      { tier: 'wellOff', w: 32 },
      { tier: 'rich', w: 8 },
    ],
  },
};

export function tierWeights(year: number, urban: boolean): TierWeight[] {
  const base = urban ? TIER_BASE.urban : TIER_BASE.rural;
  const t = Math.min(1, Math.max(0, (year - YEAR_FROM) / (YEAR_TO - YEAR_FROM)));
  return TIER_ORDER.map((tier, i) => {
    const start = base.start[i]?.w ?? 0;
    const end = base.end[i]?.w ?? 0;
    return { tier, w: start + (end - start) * t };
  });
}

/**
 * 独生概率。1977–1979 未严格推行，接近自然多孩；
 * 1980 后城市执行更严，到 1990 年前后触顶。
 */
export function onlyChildChance(year: number, urban: boolean): number {
  if (year <= 1979) return 0.05;
  const t = Math.min(1, (year - 1980) / 10);
  return urban ? 0.7 + 0.15 * t : 0.3 + 0.15 * t;
}

type JobWeight = { id: JobId; w: number };

const POOL_1977_URBAN: JobWeight[] = [
  { id: 'worker', w: 52 },
  { id: 'cadre', w: 15 },
  { id: 'teacher', w: 12 },
  { id: 'shopclerk', w: 9 },
  { id: 'soldier', w: 6 },
  { id: 'farmer', w: 3 },
  { id: 'merchant', w: 3 },
];

const POOL_1977_RURAL: JobWeight[] = [
  { id: 'farmer', w: 80 },
  { id: 'worker', w: 6 },
  { id: 'teacher', w: 5 },
  { id: 'shopclerk', w: 4 },
  { id: 'soldier', w: 3 },
  { id: 'cadre', w: 2 },
];

const POOL_1990_URBAN: JobWeight[] = [
  { id: 'worker', w: 38 },
  { id: 'cadre', w: 12 },
  { id: 'selfEmployed', w: 12 },
  { id: 'teacher', w: 10 },
  { id: 'merchant', w: 10 },
  { id: 'shopclerk', w: 8 },
  { id: 'townshipWorker', w: 5 },
  { id: 'soldier', w: 3 },
  { id: 'farmer', w: 2 },
];

const POOL_1990_RURAL: JobWeight[] = [
  { id: 'farmer', w: 68 },
  { id: 'townshipWorker', w: 10 },
  { id: 'selfEmployed', w: 6 },
  { id: 'merchant', w: 5 },
  { id: 'teacher', w: 4 },
  { id: 'worker', w: 4 },
  { id: 'shopclerk', w: 3 },
];

const POOL_2000_URBAN: JobWeight[] = [
  { id: 'worker', w: 25 },
  { id: 'officeWorker', w: 18 },
  { id: 'selfEmployed', w: 14 },
  { id: 'cadre', w: 10 },
  { id: 'teacher', w: 9 },
  { id: 'entrepreneur', w: 6 },
  { id: 'programmer', w: 6 },
  { id: 'merchant', w: 6 },
  { id: 'shopclerk', w: 4 },
  { id: 'soldier', w: 2 },
];

const POOL_2000_RURAL: JobWeight[] = [
  { id: 'farmer', w: 55 },
  { id: 'migrant', w: 20 },
  { id: 'townshipWorker', w: 10 },
  { id: 'teacher', w: 5 },
  { id: 'shopclerk', w: 5 },
  { id: 'merchant', w: 5 },
];

export function jobPool(year: number, urban: boolean): JobWeight[] {
  if (year <= 1989) return urban ? POOL_1977_URBAN : POOL_1977_RURAL;
  if (year <= 1999) return urban ? POOL_1990_URBAN : POOL_1990_RURAL;
  return urban ? POOL_2000_URBAN : POOL_2000_RURAL;
}
