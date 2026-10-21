import { describe, expect, it } from 'vitest';
import { evaluateChoice, filterUsableChoices, type ChoiceContext } from '../../src/engine/options';
import type { ChoiceDef, Stats } from '../../src/engine/types';

const base: Stats = { health: 60, ability: 50, wealth: 40, family: 60, happiness: 55 };

const ctx = (over: Partial<ChoiceContext> = {}): ChoiceContext => ({
  year: 1990,
  stats: base,
  tier: 'normal',
  flags: [],
  urban: true,
  ...over,
});

const choice = (over: Partial<ChoiceDef> = {}): ChoiceDef => ({
  id: 'c',
  label: '选项',
  outcome: '',
  ...over,
});

describe('时代开关：解锁年', () => {
  it('解锁年之前置灰，并说出原因', () => {
    const quit = choice({ gate: { unlockYear: 1992, unlockText: '这个时代还没有这个选项' } });
    expect(evaluateChoice(quit, ctx({ year: 1991 }))).toEqual({
      state: 'locked',
      reason: '这个时代还没有这个选项',
    });
    expect(evaluateChoice(quit, ctx({ year: 1992 })).state).toBe('available');
    expect(evaluateChoice(quit, ctx({ year: 2005 })).state).toBe('available');
  });

  it('没有 unlockText 时给默认说法', () => {
    const media = choice({ gate: { unlockYear: 2013 } });
    expect(evaluateChoice(media, ctx({ year: 2008 }))).toEqual({
      state: 'locked',
      reason: '这个时代还没有这个选项',
    });
  });
});

describe('时代开关：取消年', () => {
  it('取消年之后再不可选', () => {
    const allocation = choice({ gate: { removeYear: 1998, removedText: '本选项已取消' } });
    expect(evaluateChoice(allocation, ctx({ year: 1997 })).state).toBe('available');
    expect(evaluateChoice(allocation, ctx({ year: 1998 }))).toEqual({
      state: 'locked',
      reason: '本选项已取消',
    });
  });

  it('取消优先于解锁，两者同时存在时不出现自相矛盾的文案', () => {
    const c = choice({ gate: { unlockYear: 1990, removeYear: 1995 } });
    expect(evaluateChoice(c, ctx({ year: 2000 }))).toMatchObject({ state: 'locked', reason: '本选项已取消' });
  });
});

describe('条件解锁', () => {
  it('能力不够时报“成绩不够”', () => {
    const college = choice({
      requires: { statMin: { ability: 50 } },
      lockedText: '成绩不够',
    });
    expect(evaluateChoice(college, ctx({ stats: { ...base, ability: 49 } }))).toEqual({
      state: 'locked',
      reason: '成绩不够',
    });
    expect(evaluateChoice(college, ctx({ stats: { ...base, ability: 50 } })).state).toBe('available');
  });

  it('家境档、城乡、flag 都能卡住选项', () => {
    expect(evaluateChoice(choice({ requires: { tierIn: ['wellOff', 'rich'] }, lockedText: '家里拿不出这笔钱' }), ctx()).state).toBe('locked');
    expect(evaluateChoice(choice({ requires: { tierIn: ['wellOff', 'rich'] } }), ctx({ tier: 'rich' })).state).toBe('available');
    expect(evaluateChoice(choice({ requires: { urban: true } }), ctx({ urban: false })).state).toBe('locked');
    expect(evaluateChoice(choice({ requires: { flags: ['in_school'] } }), ctx()).state).toBe('locked');
    expect(evaluateChoice(choice({ requires: { flags: ['in_school'] } }), ctx({ flags: ['in_school'] })).state).toBe('available');
    expect(evaluateChoice(choice({ requires: { notFlags: ['married'] } }), ctx({ flags: ['married'] })).state).toBe('locked');
  });

  it('没有 lockedText 时给默认说法', () => {
    expect(evaluateChoice(choice({ requires: { statMin: { ability: 90 } } }), ctx())).toEqual({
      state: 'locked',
      reason: '条件不满足',
    });
  });

  it('statMax 也能卡住', () => {
    const c = choice({ requires: { statMax: { wealth: 30 } }, lockedText: '你已经不需要这个了' });
    expect(evaluateChoice(c, ctx({ stats: { ...base, wealth: 31 } })).state).toBe('locked');
    expect(evaluateChoice(c, ctx({ stats: { ...base, wealth: 30 } })).state).toBe('available');
  });
});

describe('置灰项必须留在列表里', () => {
  it('filterUsableChoices 不删除锁定选项', () => {
    const locked = choice({ id: 'locked', requires: { statMin: { ability: 99 } } });
    const open = choice({ id: 'open' });
    const out = filterUsableChoices([locked, open], ctx());
    expect(out.map((c) => c.definition.id)).toEqual(['locked', 'open']);
    expect(out[0]!.result.state).toBe('locked');
    expect(out[1]!.result.state).toBe('available');
  });
});
