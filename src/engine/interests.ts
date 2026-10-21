/**
 * 兴趣等级：年度重心选得多了，慢慢攒成“这一生花时间最多的事”。
 * 借鉴 1in8b 的兴趣 Lv 呈现（阅读 Lv.29 那种），让过程里的投入看得见，
 * 而不是只在结局变成纹理轴上的一个数字。
 */
export interface InterestDef {
  id: string;
  label: string;
}

/** focus id → 兴趣。不是每个重心都对应兴趣：顾家、攒钱这类归亲情和财富，不往这里记。 */
export const INTEREST_BY_FOCUS: Readonly<Record<string, InterestDef>> = {
  study: { id: 'reading', label: '阅读' },
  sport: { id: 'sports', label: '运动' },
  hobby: { id: 'arts', label: '文艺' },
  social: { id: 'friends', label: '交友' },
  play: { id: 'play', label: '玩乐' },
  health: { id: 'wellness', label: '养生' },
  self: { id: 'wellness', label: '养生' },
  rest: { id: 'wellness', label: '养生' },
};

export const INTEREST_XP_PER_YEAR = 3;

/** 经验 → 等级。前期涨得快，后期越来越难，像真爱好一样。 */
export function interestLevel(xp: number): number {
  if (xp <= 0) return 0;
  return Math.min(30, Math.floor(Math.sqrt(xp * 3)));
}

export interface InterestState {
  id: string;
  label: string;
  xp: number;
  level: number;
}

export function summarizeInterests(xpMap: Readonly<Record<string, number>>): InterestState[] {
  const labelOf = new Map<string, string>();
  for (const def of Object.values(INTEREST_BY_FOCUS)) labelOf.set(def.id, def.label);
  return Object.entries(xpMap)
    .filter(([, xp]) => xp > 0)
    .map(([id, xp]) => ({ id, label: labelOf.get(id) ?? id, xp, level: interestLevel(xp) }))
    .sort((a, b) => b.xp - a.xp);
}
