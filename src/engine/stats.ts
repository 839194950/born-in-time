import type { Rng } from './rng';
import { STAT_KEYS, STAT_MAX, STAT_MIN, type Birth, type Stats, type Tier } from './types';

/** 调参入口：所有系数集中在这里，Task 23 只改这些数 */
export const STAT_TUNING = {
  /** 幸福向基准线回落的年度比例（能力正常化后基准线下移，回落速度也要放缓） */
  happinessAdaptRate: 0.18,
  /** 财富百分位超过该值后，继续上涨开始打折 */
  wealthDragFrom: 45,
  /** 打折斜率：每高 1 点百分位，少这么多比例 */
  wealthDragPerPoint: 1 / 30,
  /** 最多打掉的比例 */
  wealthDragFloor: 0.2,
  /** 健康终值对寿命的最大修正（年） */
  healthLifeMod: 6,
  /** 死亡年龄的随机浮动（±年） */
  deathNoiseYears: 4,
  /** 幸福基准线权重 */
  baselineWeights: { health: 0.3, family: 0.3, wealth: 0.2, ability: 0.2 },
  /** 健康低于"这个岁数还养得回来的上限"时，正向健康效果翻倍（只奖励主动选择） */
  healthRecoverBoost: 2.2,
  /** 55 岁后能力开始折旧（规格 §4.2「会被时代打折的存量」） */
  abilityDecayAge: 55,
  abilityDecayPerYear: -0.5,
  /** 55 岁后亲情进入支出期（空巢，规格 §4.4） */
  familyDecayAge: 55,
  familyDecayPerYear: -0.35,
  /** 长寿尾：常年选"养生/运动"的人可以真的多活几年 */
  longevityTailMax: 8,
  longevityTailPerYear: 0.4,
} as const;

/**
 * 年度重心的按钮上写的是整年累计的“手感值”，实际每年只吃三到四成。
 * 否则连年选“拼事业”，四十年的 -2 会把人直接推到 0。#
 */
export const FOCUS_EFFECT_SCALE = 0.4;

export function scaleEffects(effects: Partial<Stats>, scale: number): Partial<Stats> {
  const out: Partial<Stats> = {};
  for (const key of STAT_KEYS) {
    const value = effects[key];
    if (value !== undefined) out[key] = value * scale;
  }
  return out;
}

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
    health: 66 + rank * 3 + urban * 5 - (birth.siblings > 0 ? 1 : 0),
    ability: 32 + rank * 4 + urban * 10,
    wealth: 8 + rank * 17 + urban * 7,
    family: 66 + rank * 2 - birth.siblings * 4 + (birth.urban ? 0 : 3),
    happiness: 58 + rank * 2 + urban * 2,
  });
}

/**
 * 40 岁前平缓，55 岁后加速。只出不进，只能靠锻炼和医疗延缓。
 *
 * v2 把三个档位都砍了一半：v1 的全程衰减积分约 -24，再叠加重心净成本与事件，
 * 健康终值被压到 17.5，所有人卡在同一个底——那不是"底盘"，是"滑梯"。
 */
export function healthDecay(age: number): number {
  if (age < 40) return -0.05;
  if (age < 55) return -0.2;
  return -0.45;
}

/**
 * 这个岁数"还养得回来的上限"。年龄越大，上限越低——
 * 保证长期趋势仍然只出不进，但给主动养生留出真实的空间。
 */
export function healthBand(age: number): number {
  return 62 - 0.45 * Math.max(0, age - 30);
}

/** 55 岁后能力折旧：手艺会被时代打折，不该是一路只涨的棘轮 */
export function abilityDecay(age: number): number {
  return age > STAT_TUNING.abilityDecayAge ? STAT_TUNING.abilityDecayPerYear : 0;
}

/** 55 岁后亲情进入支出期：父母老去、子女离巢，关系要花力气才维持得住 */
export function familyDecay(age: number): number {
  return age > STAT_TUNING.familyDecayAge ? STAT_TUNING.familyDecayPerYear : 0;
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

/**
 * 年度重心用的软边效果：越接近上下限，同方向的改变越难推动。
 * 否则连年选“拼事业”，亲情和健康会被一路推到 0，人生后半段就没有余地了。
 */
export function applySoftEffects(stats: Stats, effects?: Partial<Stats>): Stats {
  if (!effects) return stats;
  const out: Stats = { ...stats };
  for (const key of STAT_KEYS) {
    const delta = effects[key];
    if (delta === undefined) continue;
    const value = out[key];
    let scaled = delta;
    if (delta < 0 && value < 25) scaled = delta * (value / 25);
    if (delta > 0 && value > 75) scaled = delta * ((100 - value) / 25);
    out[key] = clampStat(value + scaled);
  }
  return out;
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
