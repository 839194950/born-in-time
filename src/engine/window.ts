import type { Verdict, WindowJudgement } from './types';

/** 事件在该年的代表时点：取年中，避免“年初/年末”造成的假精度 */
const EVENT_MONTH = 6;
/**
 * “差一年”的容差带宽（年）。
 *
 * v2 是 3：窗口两端各 3 年都算 nearMiss，一个事件有 6 年带宽，于是
 * 一生平均遇到 3 次“差一年”，称号「每次都差一年的人」（声明稀有度最高）
 * 反而成了最常见的一个（实测 24.8%）。
 * 收到 2 之后：平均 2.0 次，该称号 6.6%，而 85% 的局仍至少遇到一次——
 * “差一年”仍然是主题，但不再是随手就有。
 */
const DEFAULT_EDGE_YEARS = 2;

export interface WindowInput {
  birthYear: number;
  birthMonth: number;
  eventYear: number;
  windowAge: [number, number];
  edgeYears?: number;
  secondWindowAge?: [number, number];
}

/**
 * 时代窗口判定。
 *
 * **一律按整年判。** 这个游戏抽的是"出生在哪一年"，所以同年出生的人遇到
 * 同一件事时应该被判成同样的结果。
 *
 * 曾经用月龄判：事件时点固定取年中（6 月），12 月出生的人在窗口下界那一年
 * 还没过生日，于是每一个窗口都被系统性判成"差几个月"——实测 12 月出生的
 * 人 nearMiss 占 19.0%，1 月出生只有 14.3%。同一件事对年末出生的人天生
 * 更难够到，这不是叙事，是偏差。
 *
 * 代价：不再有"只差了 11 个月"这种精度，只有"差 1 年"。换来的是月份不再
 * 影响一个人的命。`ageMonths` 仍然返回，留给需要精确月份的文案。
 */
export function judgeWindow(input: WindowInput): WindowJudgement {
  const { birthYear, birthMonth, eventYear, windowAge, secondWindowAge } = input;
  const edgeMonths = (input.edgeYears ?? DEFAULT_EDGE_YEARS) * 12;

  // 事件那年你几岁（年份差，同年出生的人一致）
  const ageYears = eventYear - birthYear;
  // 精确月龄：仅作参考，不参与判定
  const ageMonths = ageYears * 12 + (EVENT_MONTH - birthMonth);

  const windows = secondWindowAge ? [windowAge, secondWindowAge] : [windowAge];

  let inside = false;
  let nearestGap = Number.POSITIVE_INFINITY;

  for (const w of windows) {
    if (ageYears >= w[0] && ageYears <= w[1]) {
      inside = true;
      break;
    }
    const gapYears = ageYears < w[0] ? w[0] - ageYears : ageYears - w[1];
    const gapMonths = gapYears * 12;
    if (gapMonths < nearestGap) nearestGap = gapMonths;
  }

  let verdict: Verdict;
  if (inside) verdict = 'caught';
  else if (nearestGap <= edgeMonths) verdict = 'nearMiss';
  else verdict = 'passedBy';

  return {
    verdict,
    age: ageYears,
    ageMonths,
    gapMonths: inside ? 0 : nearestGap,
  };
}

export function verdictText(verdict: Verdict): string {
  switch (verdict) {
    case 'caught':
      return '赶上';
    case 'nearMiss':
      return '差一年';
    case 'passedBy':
      return '路过';
  }
}

/** “他离高校扩招，只差了 11 个月。” */
export function gapText(gapMonths: number): string {
  if (gapMonths < 12) return `${gapMonths} 个月`;
  const years = Math.floor(gapMonths / 12);
  const months = gapMonths % 12;
  return months === 0 ? `${years} 年` : `${years} 年 ${months} 个月`;
}
