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
 * 城镇化率（0–1），逐年精确值，不再插值。
 * 来源：三源交叉一致的《中国统计年鉴》人口城乡构成序列（见 docs/史实核对表.md）。
 * 注意两处口径：1979 年取 18.96%（与城镇人口数自洽）；2000 年从 30.89% 跳到 36.22%
 * 是第五次全国人口普查的统计口径调整，不是真实一年涨了 5 个点。
 */
const YEAR_URBAN: Readonly<Record<number, number>> = {
  1958: 0.162,
  1959: 0.184,
  1960: 0.197,
  1961: 0.193,
  1962: 0.173,
  1963: 0.168,
  1964: 0.184,
  1965: 0.18,
  1966: 0.179,
  1967: 0.177,
  1968: 0.176,
  1969: 0.175,
  1970: 0.174,
  1971: 0.173,
  1972: 0.171,
  1973: 0.172,
  1974: 0.172,
  1975: 0.173,
  1976: 0.174,
  1977: 0.1755,
  1978: 0.1792,
  1979: 0.1896,
  1980: 0.1939,
  1981: 0.2016,
  1982: 0.2113,
  1983: 0.2162,
  1984: 0.2301,
  1985: 0.2371,
  1986: 0.2452,
  1987: 0.2532,
  1988: 0.2581,
  1989: 0.2621,
  1990: 0.2641,
  1991: 0.2637,
  1992: 0.2763,
  1993: 0.2814,
  1994: 0.2862,
  1995: 0.2904,
  1996: 0.2937,
  1997: 0.2992,
  1998: 0.304,
  1999: 0.3089,
  2000: 0.3622,
  2001: 0.3766,
  2002: 0.3909,
  2003: 0.405,
  2004: 0.418,
  2005: 0.43,
};

export function urbanizationRate(year: number): number {
  const clamped = Math.min(YEAR_TO, Math.max(YEAR_FROM, Math.round(year)));
  return YEAR_URBAN[clamped] ?? YEAR_URBAN[YEAR_FROM]!;
}

/** 2000 年的跳变来自普查口径调整，出生卡上要说明一句，别让人以为是真的一年涨 5 个点 */
export function urbanizationCaveat(year: number): string | null {
  return year === 2000 ? '注：这一年的统计口径按第五次全国人口普查调整过，城镇化率的跳升不代表一年内的真实变化。' : null;
}

/**
 * 出生人口权重（相对值，单位≈百万人）。不必精确，只求峰谷形状正确：
 * 1987 年前后为峰（约 2550 万），2002 年为谷（约 1650 万）。
 * 来源：国家统计局历年出生人口数，取整。
 */
const BIRTH_COUNT: Readonly<Record<number, number>> = {
  1958: 17.2,
  1959: 16.5,
  1960: 13.9,
  1961: 11.9,
  1962: 24.6,
  1963: 29.5,
  1964: 27.2,
  1965: 27.0,
  1966: 25.8,
  1967: 25.4,
  1968: 27.5,
  1969: 27.2,
  1970: 27.1,
  1971: 25.6,
  1972: 25.5,
  1973: 24.6,
  1974: 22.5,
  1975: 21.2,
  1976: 18.5,
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
  2003: 15.9,
  2004: 16.0,
  2005: 16.2,
};

/**
 * 抽签权重 = 出生人口数的平方根。
 * 直接按人口数抽会让 1963（2950 万）和 1987（2550 万）形成两个尖峰，
 * 其余年份几乎抽不到；开方后峰谷比从 1.9 倍压到 1.35 倍，年份分布更像“随便抽”。
 */
export function yearWeight(year: number): number {
  const count = BIRTH_COUNT[year];
  return count === undefined ? 1 : Math.sqrt(count);
}

/**
 * 该出生队列的预期寿命。城市高于农村，随年代上升。
 * 来源：国家统计局人口预期寿命口径，1977 年城镇约 70、农村约 66；
 * 2002 年城镇约 78、农村约 72。中间年份线性。
 */
const LIFE_URBAN: Anchors = [
  [1958, 66],
  [1977, 70],
  [2002, 78],
  [2005, 78.5],
];
const LIFE_RURAL: Anchors = [
  [1958, 62],
  [1977, 66],
  [2002, 72],
  [2005, 72.5],
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
 * 1980 年一胎化公开信之后，城市约 80%，农村约 40%（一孩半政策）。
 * 2016 年全面二孩后逐年下降，但本作生年上限是 2002，不涉及。
 */
export function onlyChildChance(year: number, urban: boolean): number {
  if (year <= 1979) return 0.05;
  return urban ? 0.8 : 0.4;
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

const POOL_1986_URBAN: JobWeight[] = [
  { id: 'worker', w: 44 },
  { id: 'cadre', w: 13 },
  { id: 'teacher', w: 11 },
  { id: 'selfEmployed', w: 10 },
  { id: 'merchant', w: 9 },
  { id: 'shopclerk', w: 7 },
  { id: 'townshipWorker', w: 3 },
  { id: 'soldier', w: 3 },
];

const POOL_1986_RURAL: JobWeight[] = [
  { id: 'farmer', w: 72 },
  { id: 'townshipWorker', w: 8 },
  { id: 'migrant', w: 7 },
  { id: 'selfEmployed', w: 4 },
  { id: 'teacher', w: 4 },
  { id: 'worker', w: 3 },
  { id: 'shopclerk', w: 2 },
];

const POOL_1996_URBAN: JobWeight[] = [
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

const POOL_1996_RURAL: JobWeight[] = [
  { id: 'farmer', w: 55 },
  { id: 'migrant', w: 20 },
  { id: 'townshipWorker', w: 10 },
  { id: 'teacher', w: 5 },
  { id: 'shopclerk', w: 5 },
  { id: 'merchant', w: 5 },
];

/**
 * 职业池随年代扩张，分档与核验表一致：
 * 1977–1985 只有农民/工人/教师/干部/军人（加供销社），
 * 1986–1995 加个体户、乡镇企业职工、外出务工，
 * 1996–2002 加企业主、白领、程序员。
 */
export function jobPool(year: number, urban: boolean): JobWeight[] {
  if (year <= 1985) return urban ? POOL_1977_URBAN : POOL_1977_RURAL;
  if (year <= 1995) return urban ? POOL_1986_URBAN : POOL_1986_RURAL;
  return urban ? POOL_1996_URBAN : POOL_1996_RURAL;
}

/**
 * 城镇单位就业人员年平均工资（元）。事件文案里的“体感锚点”从这里算，
 * 避免出现“这套房要全家不吃不喝 6 年”这种拍脑袋的数字。
 * 来源：《中国统计年鉴》表 4-22 / 国家统计局历年《城镇单位就业人员年平均工资情况》
 * （城镇非私营单位口径）。
 *
 * 2024 年及以后为**推演值**（按名义年增约 4% 外推）。
 * 之前这张表停在 2020，interpolate 对超界年份返回末值，于是 2050 年
 * 还在显示 2020 年的月薪——2005 年出生的人从 15 岁起就看着一个
 * 不动的数字过完一生。推演值至少让曲线保持连续。
 */
const AVERAGE_WAGE: Readonly<Record<number, number>> = {
  1978: 615,
  1980: 762,
  1985: 1148,
  1990: 2140,
  1991: 2340,
  1992: 2711,
  1993: 3371,
  1994: 4538,
  1995: 5500,
  1996: 6210,
  1997: 6470,
  1998: 7479,
  1999: 8346,
  2000: 9371,
  2001: 10870,
  2002: 12422,
  2005: 18364,
  2008: 29229,
  2020: 97379,
  2021: 106837,
  2022: 114029,
  2023: 120698,
  // 以下为推演
  2025: 131000,
  2030: 159000,
  2040: 235000,
  2050: 348000,
  // 2050 之后再补两个锚点。2005 年出生的人能活到 2075 前后，
  // 而 `interpolate` 对超过末锚点的年份直接返回末值——不补的话，
  // 这批人到死都看着 2050 年的月薪。
  // 推演口径：按 2023–2050 的年均增速（约 4%）略微衰减，取 3.5%。
  2060: 490000,
  2070: 690000,
};

const WAGE_ANCHORS: Anchors = Object.entries(AVERAGE_WAGE)
  .map(([y, w]) => [Number(y), w] as const)
  .sort((a, b) => a[0] - b[0]);

export function averageWage(year: number): number {
  return Math.round(interpolate(WAGE_ANCHORS, year));
}

/** 把这笔钱换算成“当年几个月的工资”，用于事件文案里的体感锚点 */
export function wageMonths(amount: number, year: number): number {
  return Math.max(1, Math.round((amount / averageWage(year)) * 12));
}
