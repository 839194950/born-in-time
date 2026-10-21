import { describe, expect, it } from 'vitest';
import { TITLES } from '../../src/data/titles';
import { buildAggregate, evaluateEnding, pickHeadline, pickSubtitle } from '../../src/engine/ending';
import { Game } from '../../src/engine/game';
import type { EndingAggregate, LedgerEntry, Verdict } from '../../src/engine/types';

const agg = (over: Partial<EndingAggregate> = {}): EndingAggregate => ({
  deathAge: 72,
  cohortLifeExpectancy: 68,
  birthTierRank: 2,
  finalWealth: 55,
  bestWealth: 60,
  happinessAvg: 55,
  familyFinal: 55,
  caught: 2,
  nearMiss: 1,
  passedBy: 2,
  hitRate: 0.4,
  lastTrainHits: 0,
  earlyHits: 1,
  lateHits: 1,
  jobChanges: 2,
  moves: 2,
  startups: 0,
  wealthVariance: 60,
  defaultChoiceRatio: 0.3,
  migrated: true,
  bestYear: 1999,
  ...over,
});

const titleOf = (a: EndingAggregate) => TITLES.find((t) => t.test(a))?.name ?? '(无)';

const entry = (eventId: string, verdict: Verdict, over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  eventId,
  title: eventId,
  year: 1999,
  age: 18,
  verdict,
  gapMonths: verdict === 'nearMiss' ? 11 : 0,
  weight: 3,
  lastTrain: false,
  ...over,
});

describe('命型判定', () => {
  it('三次差一年就是“每次都差一年的人”', () => {
    expect(titleOf(agg({ nearMiss: 3, caught: 5, hitRate: 0.7 }))).toBe('每次都差一年的人');
  });

  it('窗口命中率七成以上且赶上了浪', () => {
    expect(titleOf(agg({ nearMiss: 0, caught: 4, passedBy: 1, hitRate: 0.8 }))).toBe('赶上每一次浪潮的人');
  });

  it('两次末班车就是“最后一班车的人”', () => {
    expect(titleOf(agg({ nearMiss: 0, caught: 3, passedBy: 2, hitRate: 0.6, lastTrainHits: 2 }))).toBe('最后一班车的人');
  });

  it('低起点高终点是“逆袭的人”', () => {
    expect(titleOf(agg({ nearMiss: 0, caught: 1, hitRate: 0.2, birthTierRank: 0, finalWealth: 85 }))).toBe('逆袭的人');
  });

  it('高起点低终点是“高开低走的人”，判语留体面', () => {
    const a = agg({ nearMiss: 0, caught: 1, hitRate: 0.2, birthTierRank: 4, finalWealth: 35 });
    const title = TITLES.find((t) => t.test(a))!;
    expect(title.name).toBe('高开低走的人');
    expect(title.blurb(a)).not.toMatch(/烂|失败|可惜/);
  });

  it('命中集中在 35 岁前 / 40 岁后', () => {
    expect(titleOf(agg({ nearMiss: 0, caught: 3, passedBy: 2, hitRate: 0.6, earlyHits: 3, lateHits: 0 }))).toBe('少年得志');
    expect(titleOf(agg({ nearMiss: 0, caught: 3, passedBy: 2, hitRate: 0.6, earlyHits: 0, lateHits: 3 }))).toBe('大器晚成');
  });

  it('折腾的人需要转行加迁徙够多且财富起伏大', () => {
    expect(titleOf(agg({ nearMiss: 0, caught: 1, hitRate: 0.2, jobChanges: 3, moves: 2, startups: 1, wealthVariance: 300 }))).toBe('折腾的人');
    expect(titleOf(agg({ nearMiss: 0, caught: 1, hitRate: 0.2, jobChanges: 3, moves: 2, startups: 1, wealthVariance: 10 }))).not.toBe('折腾的人');
  });

  it('守一座城：没迁徙、没怎么换工作', () => {
    expect(titleOf(agg({ nearMiss: 0, caught: 1, hitRate: 0.2, moves: 0, jobChanges: 1 }))).toBe('守一座城的人');
  });

  it('平淡但过得踏实是“过小日子的人”', () => {
    expect(
      titleOf(agg({ caught: 2, passedBy: 2, nearMiss: 0, hitRate: 0.5, happinessAvg: 66, familyFinal: 72, moves: 3 })),
    ).toBe('过小日子的人');
  });

  it('比同龄人多活十年', () => {
    expect(titleOf(agg({ nearMiss: 0, caught: 1, hitRate: 0.2, deathAge: 82, cohortLifeExpectancy: 68, moves: 3 }))).toBe(
      '比同龄人多活十年的人',
    );
  });

  it('什么都不沾时兜底到“被时代推着走的人”', () => {
    expect(titleOf(agg({ caught: 2, passedBy: 3, nearMiss: 0, hitRate: 0.4, happinessAvg: 40, moves: 2 }))).toBe(
      '被时代推着走的人',
    );
  });

  it('12 个称号齐全，稀有度从高到低排列', () => {
    expect(TITLES).toHaveLength(12);
    for (let i = 1; i < TITLES.length; i++) {
      expect(TITLES[i - 1]!.rarity).toBeGreaterThan(TITLES[i]!.rarity);
    }
    expect(TITLES[TITLES.length - 1]!.test(agg())).toBe(true);
  });
});

describe('主标题', () => {
  it('差一年优先，且报出月数', () => {
    const line = pickHeadline([entry('era_gaokao', 'nearMiss', { gapMonths: 11, weight: 5 })], 'male');
    expect(line).toContain('11 个月');
    expect(line).toContain('他');
  });

  it('女性用“她”', () => {
    const line = pickHeadline([entry('era_gaokao', 'nearMiss', { gapMonths: 11 })], 'female');
    expect(line).toContain('她');
  });

  it('末班车也有专属句式', () => {
    const line = pickHeadline([entry('era_housing', 'caught', { lastTrain: true })], 'female');
    expect(line).toMatch(/最后一批|最后一班/);
  });

  it('没有窗口也不至于空着', () => {
    expect(pickHeadline([], 'male').length).toBeGreaterThan(4);
  });
});

describe('副句', () => {
  it('列出赶上的与错过的', () => {
    const line = pickSubtitle([
      entry('a', 'caught'),
      entry('b', 'caught'),
      entry('c', 'passedBy'),
    ]);
    expect(line).toContain('赶上了');
    expect(line).toContain('错过了');
  });
});

describe('buildAggregate', () => {
  it('从真实一局里算出聚合数据', () => {
    const g = new Game({ seed: 2026 });
    g.start();
    let guard = 0;
    while (g.snapshot.phase !== 'dead' && guard++ < 200) {
      if (g.snapshot.phase === 'awaitingChoice') {
        g.resolve(g.snapshot.pendingEvent!.choices.find((c) => c.state === 'available')!.id);
      } else g.tick();
    }
    const a = buildAggregate(g.snapshot);
    expect(a.deathAge).toBe(g.snapshot.death!.age);
    expect(a.caught + a.nearMiss + a.passedBy).toBe(g.snapshot.ledger.length);
    expect(a.bestWealth).toBeGreaterThanOrEqual(a.finalWealth);
    expect(a.bestYear).toBeGreaterThanOrEqual(g.snapshot.birth.year);

    const ending = evaluateEnding(g.snapshot);
    expect(ending.title.name.length).toBeGreaterThan(0);
    expect(ending.headline.length).toBeGreaterThan(0);
    expect(ending.subtitle.length).toBeGreaterThan(0);
  });
});
