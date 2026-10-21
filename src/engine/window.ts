import type { Verdict, WindowJudgement } from './types';

/** 事件在该年的代表时点：取年中，避免“年初/年末”造成的假精度 */
const EVENT_MONTH = 6;
const DEFAULT_EDGE_YEARS = 3;

export interface WindowInput {
  birthYear: number;
  birthMonth: number;
  eventYear: number;
  windowAge: [number, number];
  edgeYears?: number;
  secondWindowAge?: [number, number];
}

/**
 * 时代窗口判定。全部用整数月计算，避免边界上的浮点误差。
 * 窗口 [minAge, maxAge] 换算为 [minAge*12, maxAge*12 + 11]。
 */
export function judgeWindow(input: WindowInput): WindowJudgement {
  const { birthYear, birthMonth, eventYear, windowAge, secondWindowAge } = input;
  const edgeMonths = (input.edgeYears ?? DEFAULT_EDGE_YEARS) * 12;

  const ageMonths = (eventYear - birthYear) * 12 + (EVENT_MONTH - birthMonth);
  const windows = secondWindowAge ? [windowAge, secondWindowAge] : [windowAge];

  let inside = false;
  let nearestGap = Number.POSITIVE_INFINITY;

  for (const w of windows) {
    const start = w[0] * 12;
    const end = w[1] * 12 + 11;
    if (ageMonths >= start && ageMonths <= end) {
      inside = true;
      break;
    }
    const gap = ageMonths < start ? start - ageMonths : ageMonths - end;
    if (gap < nearestGap) nearestGap = gap;
  }

  let verdict: Verdict;
  if (inside) verdict = 'caught';
  else if (nearestGap <= edgeMonths) verdict = 'nearMiss';
  else verdict = 'passedBy';

  return {
    verdict,
    age: Math.floor(ageMonths / 12),
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
