import { describe, expect, it } from 'vitest';
import { recordJudgement, summarizeLedger } from '../../src/engine/ledger';
import type { LedgerEntry, Verdict } from '../../src/engine/types';

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

describe('recordJudgement', () => {
  it('同一事件只记一次', () => {
    const a = entry('gaokao', 'caught');
    expect(recordJudgement([a], a)).toHaveLength(1);
  });

  it('不同事件按顺序追加', () => {
    const out = recordJudgement(recordJudgement([], entry('a', 'caught')), entry('b', 'passedBy'));
    expect(out.map((e) => e.eventId)).toEqual(['a', 'b']);
  });

  it('不修改传入数组', () => {
    const list = [entry('a', 'caught')];
    recordJudgement(list, entry('b', 'caught'));
    expect(list).toHaveLength(1);
  });
});

describe('summarizeLedger', () => {
  it('三种判定各自计数', () => {
    const sum = summarizeLedger([entry('a', 'caught'), entry('b', 'nearMiss'), entry('c', 'passedBy')]);
    expect(sum).toMatchObject({ caught: 1, nearMiss: 1, passedBy: 1, total: 3 });
  });

  it('命中率是赶上占全部窗口的比例', () => {
    const sum = summarizeLedger([
      entry('a', 'caught'),
      entry('b', 'caught'),
      entry('c', 'nearMiss'),
      entry('d', 'passedBy'),
    ]);
    expect(sum.hitRate).toBeCloseTo(0.5, 5);
  });

  it('空账本的命中率为 0，不出现 NaN', () => {
    const sum = summarizeLedger([]);
    expect(sum).toMatchObject({ total: 0, hitRate: 0, nearest: null, lastTrainHits: 0 });
  });

  it('nearest 只看差一年，取差距最小的一条', () => {
    const sum = summarizeLedger([
      entry('a', 'nearMiss', { gapMonths: 30 }),
      entry('b', 'nearMiss', { gapMonths: 11 }),
      entry('c', 'caught'),
      entry('d', 'nearMiss', { gapMonths: 20 }),
    ]);
    expect(sum.nearest?.eventId).toBe('b');
  });

  it('统计末班车命中次数', () => {
    const sum = summarizeLedger([
      entry('a', 'caught', { lastTrain: true }),
      entry('b', 'caught', { lastTrain: true }),
      entry('c', 'caught'),
    ]);
    expect(sum.lastTrainHits).toBe(2);
  });
});
