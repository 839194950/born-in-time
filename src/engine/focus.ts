import { FOCUS_OPTIONS } from '../data/focus';
import { applyEffects } from './stats';
import type { FocusOption, Stage, Stats } from './types';

export function stageForAge(age: number): Stage {
  if (age < 6) return 'infant';
  if (age <= 12) return 'child';
  if (age <= 22) return 'student';
  if (age <= 39) return 'work';
  if (age <= 59) return 'midlife';
  return 'elder';
}

export function focusOptionsFor(stage: Stage): readonly FocusOption[] {
  return FOCUS_OPTIONS[stage];
}

export function defaultFocusFor(stage: Stage): string {
  return FOCUS_OPTIONS[stage][0]?.id ?? '';
}

/** 幼儿期与未知选项都原样返回，调用方不必特判 */
export function applyFocus(stats: Stats, stage: Stage, focusId: string): Stats {
  const option = FOCUS_OPTIONS[stage].find((o) => o.id === focusId);
  if (!option) return stats;
  return applyEffects(stats, option.effects);
}

export function focusOptionById(stage: Stage, focusId: string): FocusOption | null {
  return FOCUS_OPTIONS[stage].find((o) => o.id === focusId) ?? null;
}
