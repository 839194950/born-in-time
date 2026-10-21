import { STAT_KEYS, type EventDef, type Stats, type Tier } from './types';

export interface EventCtx {
  age: number;
  year: number;
  urban: boolean;
  tier: Tier;
  stats: Stats;
  flags: readonly string[];
}

function isDue(ev: EventDef, ctx: EventCtx): boolean {
  if (ev.trigger.type === 'year') {
    if (ev.trigger.year !== ctx.year) return false;
  } else if (ev.trigger.age !== ctx.age) {
    return false;
  }
  return matchesConditions(ev, ctx);
}

export function matchesConditions(ev: EventDef, ctx: EventCtx): boolean {
  const c = ev.conditions;
  if (!c) return true;
  if (c.urban !== undefined && c.urban !== ctx.urban) return false;
  if (c.tierIn && !c.tierIn.includes(ctx.tier)) return false;
  if (c.flags && !c.flags.every((f) => ctx.flags.includes(f))) return false;
  if (c.notFlags && c.notFlags.some((f) => ctx.flags.includes(f))) return false;
  if (c.statMin) {
    for (const key of STAT_KEYS) {
      const min = c.statMin[key];
      if (min !== undefined && ctx.stats[key] < min) return false;
    }
  }
  if (c.statMax) {
    for (const key of STAT_KEYS) {
      const max = c.statMax[key];
      if (max !== undefined && ctx.stats[key] > max) return false;
    }
  }
  return true;
}

/** 一年最多弹一个抉择；其余以播报和结算带过 */
export const MAX_DECISIONS_PER_YEAR = 1;

/**
 * 当年到期的全部事件，按 ledgerWeight 降序（重的先上）。
 * 不在这里截断：是否算“占用当年的抉择名额”要看判定结果 ——
 * 路过的事件只写一行播报，不该把这一年让给一段背景音。
 */
export function findDueEvents(
  ctx: EventCtx,
  catalog: readonly EventDef[],
  firedIds: ReadonlySet<string>,
): EventDef[] {
  return catalog
    .filter((ev) => !ev.broadcast && !firedIds.has(ev.id) && isDue(ev, ctx))
    .sort((a, b) => b.ledgerWeight - a.ledgerWeight || a.id.localeCompare(b.id));
}

/** 同年可以播报多条，顺序按权重降序 */
export function findDueBroadcasts(
  ctx: EventCtx,
  catalog: readonly EventDef[],
  firedIds: ReadonlySet<string>,
): EventDef[] {
  return catalog
    .filter((ev) => ev.broadcast === true && !firedIds.has(ev.id) && isDue(ev, ctx))
    .sort((a, b) => b.ledgerWeight - a.ledgerWeight || a.id.localeCompare(b.id));
}

export function pickVariantText(ev: EventDef, urban: boolean): string {
  const variant = urban ? ev.variants?.urban : ev.variants?.rural;
  return variant ?? ev.body;
}

/** 内容层的守门人：没有出处的事件不许上线 */
export function validateCatalog(catalog: readonly EventDef[]): void {
  const ids = new Set<string>();
  for (const ev of catalog) {
    if (ids.has(ev.id)) throw new Error(`重复的事件 id：${ev.id}`);
    ids.add(ev.id);
    if (ev.source.trim().length === 0) throw new Error(`事件缺少出处：${ev.id}`);
    if (ev.choices.length === 0 && ev.broadcast !== true) {
      throw new Error(`事件既没有选项也不是播报：${ev.id}`);
    }
    if (ev.windowAge[0] > ev.windowAge[1]) throw new Error(`窗口年龄倒置：${ev.id}`);
    if (ev.secondWindowAge && ev.secondWindowAge[0] > ev.secondWindowAge[1]) {
      throw new Error(`第二窗口年龄倒置：${ev.id}`);
    }
  }
}
