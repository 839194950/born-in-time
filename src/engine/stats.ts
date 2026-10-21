import type { Rng } from './rng';
import { STAT_KEYS, STAT_MAX, STAT_MIN, type Birth, type Stats, type Tier } from './types';

/** 调参入口：所有系数集中在这里，Task 23 只改这些数 */
export const STAT_TUNING = {
  /** 幸福向基准线回落的年度比例 */
  happinessAdaptRate: 0.25,
  /** 财富百分位超过该值后，继续上涨开始打折 */
  wealthDragFrom: 50,
  /** 打折斜率：每高 1 点百分位，少这么多比例 */
  wealthDragPerPoint: 1 / 40,
  /** 最多打掉的比例 */
  wealthDragFloor: 0.2,
  /** 健康终值对寿命的最大修正（年） */
  healthLifeMod: 8,
  /** 死亡年龄的随机浮动（±年） */
  deathNoiseYears: 4,
  /** 幸福基准线权重 */
  baselineWeights: { health: 0.3, family: 0.3, wealth: 0.2, ability: 0.2 },
} as const;

const TIER_RANK: Record<Tier, number> = {
  destitute: 0,
  poor: 1,
  normal: 2,
  wellOff: 3,
  rich: 4,
};

export function clampStat(v: number): number {
  return Math.min(STAT_MAX, Math.max(STAT_MIN, v));
}

export function clampStats(stats: Stats): Stats {
  return {
    health: clampStat(stats.health),
    ability: clampStat(stats.ability),
    wealth: clampStat(stats.wealth),
    family: clampStat(stats.family),
    happiness: clampStat(stats.happiness),
  };
}

/** 起跑线：家境档 + 城乡医疗/教育条件，独生与否影响亲情投入 */
export function initialStats(birth: Birth): Stats {
  const rank = TIER_RANK[birth.tier];
  const urban = birth.urban ? 1 : 0;
  return clampStats({
    health: 60 + rank * 3 + urban * 5 - (birth.siblings > 0 ? 1 : 0),
    ability: 32 + rank * 4 + urban * 10,
    wealth: 8 + rank * 17 + urban * 7,
    family: 66 + rank * 2 - birth.siblings * 4 + (birth.urban ? 0 : 3),
    happiness: 58 + rank * 2 + urban * 2,
  });
}

/** 40 岁前平缓，55 岁后加速。只出不进，只能靠锻炼和医疗延缓。 */
export function healthDecay(age: number): number {
  if (age < 40) return -0.15;
  if (age < 55) return -0.5;
  return -1.2;
}

export function happinessBaseline(stats: Stats): number {
  const w = STAT_TUNING.baselineWeights;
  return (
    stats.health * w.health +
    stats.family * w.family +
    stats.wealth * w.wealth +
    stats.ability * w.ability
  );
}

/** 幸福是可推、会漏的流量：每年向基准线回落一部分 */
export function adaptHappiness(stats: Stats): Stats {
  const target = happinessBaseline(stats);
  const next = stats.happiness + (target - stats.happiness) * STAT_TUNING.happinessAdaptRate;
  return { ...stats, happiness: clampStat(next) };
}

/** 财富是相对排名：越高越难再涨，下跌不打折 */
export function wealthGain(stats: Stats, delta: number): number {
  if (delta <= 0) return delta;
  if (stats.wealth <= STAT_TUNING.wealthDragFrom) return delta;
  const excess = (stats.wealth - STAT_TUNING.wealthDragFrom) * STAT_TUNING.wealthDragPerPoint;
  const factor = Math.max(STAT_TUNING.wealthDragFloor, 1 - excess);
  return delta * factor;
}

export function applyEffects(stats: Stats, effects?: Partial<Stats>): Stats {
  const out: Stats = { ...stats };
  if (!effects) return out;
  for (const key of STAT_KEYS) {
    const delta = effects[key];
    if (delta === undefined) continue;
    out[key] = clampStat(out[key] + delta);
  }
  return out;
}

/** 终点年龄 = 队列预期寿命 ± 健康修正 ± 随机 */
export function lifeExpectancyAtDeath(birth: Birth, finalStats: Stats, rng: Rng): number {
  const mod = ((finalStats.health - 50) / 50) * STAT_TUNING.healthLifeMod;
  const noise = rng.next() * STAT_TUNING.deathNoiseYears * 2 - STAT_TUNING.deathNoiseYears;
  return Math.round(birth.cohortLifeExpectancy + mod + noise);
}
