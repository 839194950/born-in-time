import { STAT_KEYS, type ChoiceDef, type Requirement, type Stats, type Tier } from './types';

export interface ChoiceContext {
  year: number;
  stats: Stats;
  tier: Tier;
  flags: readonly string[];
  urban: boolean;
}

export type ChoiceResult = { state: 'available' } | { state: 'locked'; reason: string };

const DEFAULT_UNLOCK_TEXT = '这个时代还没有这个选项';
const DEFAULT_REMOVED_TEXT = '本选项已取消';
const DEFAULT_REQUIREMENT_TEXT = '条件不满足';

function meetsRequirement(req: Requirement | undefined, ctx: ChoiceContext): boolean {
  if (!req) return true;
  if (req.urban !== undefined && req.urban !== ctx.urban) return false;
  if (req.tierIn && !req.tierIn.includes(ctx.tier)) return false;
  if (req.flags && !req.flags.every((f) => ctx.flags.includes(f))) return false;
  if (req.notFlags && req.notFlags.some((f) => ctx.flags.includes(f))) return false;
  if (req.statMin) {
    for (const key of STAT_KEYS) {
      const min = req.statMin[key];
      if (min !== undefined && ctx.stats[key] < min) return false;
    }
  }
  if (req.statMax) {
    for (const key of STAT_KEYS) {
      const max = req.statMax[key];
      if (max !== undefined && ctx.stats[key] > max) return false;
    }
  }
  return true;
}

/**
 * 选项可用性。判定顺序固定：取消年 → 解锁年 → 条件。
 * 取消优先，避免“既能解锁又已取消”时给出自相矛盾的提示。
 */
export function evaluateChoice(choice: ChoiceDef, ctx: ChoiceContext): ChoiceResult {
  const gate = choice.gate;
  if (gate?.removeYear !== undefined && ctx.year >= gate.removeYear) {
    return { state: 'locked', reason: gate.removedText ?? choice.lockedText ?? DEFAULT_REMOVED_TEXT };
  }
  if (gate?.unlockYear !== undefined && ctx.year < gate.unlockYear) {
    return { state: 'locked', reason: gate.unlockText ?? choice.lockedText ?? DEFAULT_UNLOCK_TEXT };
  }
  if (!meetsRequirement(choice.requires, ctx)) {
    return { state: 'locked', reason: choice.lockedText ?? DEFAULT_REQUIREMENT_TEXT };
  }
  return { state: 'available' };
}

export interface ResolvedChoiceDef {
  definition: ChoiceDef;
  result: ChoiceResult;
}

/** 置灰的选项必须留在列表里 —— 看得见但选不了，本身就是叙事 */
export function filterUsableChoices(
  choices: readonly ChoiceDef[],
  ctx: ChoiceContext,
): ResolvedChoiceDef[] {
  return choices.map((definition) => ({ definition, result: evaluateChoice(definition, ctx) }));
}

export function availableChoiceIds(choices: readonly ResolvedChoiceDef[]): string[] {
  return choices.filter((c) => c.result.state === 'available').map((c) => c.definition.id);
}
