import { describe, expect, it } from 'vitest';
import {
  findDueBroadcasts,
  findDueEvents,
  matchesConditions,
  pickVariantText,
  validateCatalog,
  type EventCtx,
} from '../../src/engine/catalog';
import type { EventDef, Stats } from '../../src/engine/types';

const baseStats: Stats = { health: 60, ability: 50, wealth: 40, family: 60, happiness: 55 };

const ctx = (over: Partial<EventCtx> = {}): EventCtx => ({
  age: 18,
  year: 1999,
  urban: true,
  tier: 'normal',
  stats: baseStats,
  flags: [],
  ...over,
});

const event = (over: Partial<EventDef> = {}): EventDef => ({
  id: 'e1',
  layer: 'era',
  trigger: { type: 'year', year: 1999 },
  windowAge: [17, 19],
  title: '高校扩招',
  body: '主干文案',
  choices: [{ id: 'a', label: '报考本科', outcome: '录取' }],
  ledgerWeight: 3,
  source: '教育部 1999 年招生计划',
  ...over,
});

describe('matchesConditions', () => {
  it('无条件是所有事件都能匹配', () => {
    expect(matchesConditions(event(), ctx())).toBe(true);
  });

  it('城乡条件', () => {
    const e = event({ conditions: { urban: true } });
    expect(matchesConditions(e, ctx({ urban: true }))).toBe(true);
    expect(matchesConditions(e, ctx({ urban: false }))).toBe(false);
  });

  it('数值下限', () => {
    const e = event({ conditions: { statMin: { ability: 40 } } });
    expect(matchesConditions(e, ctx({ stats: { ...baseStats, ability: 39 } }))).toBe(false);
    expect(matchesConditions(e, ctx({ stats: { ...baseStats, ability: 40 } }))).toBe(true);
  });

  it('flag 与反向 flag', () => {
    const needSchool = event({ conditions: { flags: ['in_school'] } });
    expect(matchesConditions(needSchool, ctx())).toBe(false);
    expect(matchesConditions(needSchool, ctx({ flags: ['in_school'] }))).toBe(true);

    const noMarriage = event({ conditions: { notFlags: ['married'] } });
    expect(matchesConditions(noMarriage, ctx({ flags: ['married'] }))).toBe(false);
  });

  it('家境档', () => {
    const e = event({ conditions: { tierIn: ['wellOff', 'rich'] } });
    expect(matchesConditions(e, ctx({ tier: 'poor' }))).toBe(false);
    expect(matchesConditions(e, ctx({ tier: 'rich' }))).toBe(true);
  });
});

describe('findDueEvents', () => {
  it('同年多条按权重降序全部返回，截断交给主引擎（路过的不占名额）', () => {
    const low = event({ id: 'low', ledgerWeight: 1 });
    const high = event({ id: 'high', ledgerWeight: 5 });
    const due = findDueEvents(ctx(), [low, high], new Set());
    expect(due.map((e) => e.id)).toEqual(['high', 'low']);
  });

  it('触发过的事件不再返回', () => {
    expect(findDueEvents(ctx(), [event()], new Set(['e1']))).toEqual([]);
  });

  it('条件不满足的不返回', () => {
    const e = event({ conditions: { urban: false } });
    expect(findDueEvents(ctx(), [e], new Set())).toEqual([]);
  });

  it('按年龄触发的事件用 age 匹配', () => {
    const e = event({ trigger: { type: 'age', age: 18 }, windowAge: [18, 18] });
    expect(findDueEvents(ctx({ age: 18 }), [e], new Set())).toHaveLength(1);
    expect(findDueEvents(ctx({ age: 19 }), [e], new Set())).toHaveLength(0);
  });

  it('播报事件不走抉择通道', () => {
    const broadcast = event({ id: 'b', broadcast: true, choices: [], ledgerWeight: 9 });
    const choice = event({ id: 'c', ledgerWeight: 1 });
    expect(findDueEvents(ctx(), [broadcast, choice], new Set()).map((e) => e.id)).toEqual(['c']);
  });
});

describe('findDueBroadcasts', () => {
  it('只返回播报型，且可以同年多条', () => {
    const b1 = event({ id: 'b1', broadcast: true, choices: [], ledgerWeight: 9 });
    const b2 = event({ id: 'b2', broadcast: true, choices: [], ledgerWeight: 1 });
    const c = event({ id: 'c' });
    expect(findDueBroadcasts(ctx(), [b1, b2, c], new Set()).map((e) => e.id)).toEqual(['b1', 'b2']);
  });

  it('已播报过的不再返回', () => {
    const b = event({ id: 'b1', broadcast: true, choices: [] });
    expect(findDueBroadcasts(ctx(), [b], new Set(['b1']))).toEqual([]);
  });
});

describe('pickVariantText', () => {
  it('有城乡变体时优先用变体，没有就回落主干', () => {
    const e = event({ variants: { urban: '城市版', rural: '农村版' } });
    expect(pickVariantText(e, true)).toBe('城市版');
    expect(pickVariantText(e, false)).toBe('农村版');
    expect(pickVariantText(event(), false)).toBe('主干文案');
  });

  it('只写了一半变体时，另一半用主干', () => {
    const e = event({ variants: { urban: '城市版' } });
    expect(pickVariantText(e, false)).toBe('主干文案');
  });
});

describe('validateCatalog', () => {
  it('合格的目录不报错', () => {
    expect(() => validateCatalog([event(), event({ id: 'e2' })])).not.toThrow();
  });

  it('重复 id 报错', () => {
    expect(() => validateCatalog([event(), event()])).toThrow(/重复/);
  });

  it('缺出处报错', () => {
    expect(() => validateCatalog([event({ source: '  ' })])).toThrow(/出处/);
  });

  it('既没有选项也不是播报，报错', () => {
    expect(() => validateCatalog([event({ choices: [] })])).toThrow(/选项/);
  });

  it('窗口年龄倒置报错', () => {
    expect(() => validateCatalog([event({ windowAge: [22, 18] })])).toThrow(/窗口/);
  });
});
