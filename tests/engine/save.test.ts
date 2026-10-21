import { beforeEach, describe, expect, it } from 'vitest';
import { CONTINUE_CHOICE_ID, Game } from '../../src/engine/game';
import {
  loadCurrent,
  listRecords,
  pushRecord,
  restoreGame,
  saveCurrent,
  serializeGame,
  type PastRecord,
} from '../../src/engine/save';
import type { Birth } from '../../src/engine/types';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

const birth: Birth = {
  year: 1985,
  month: 6,
  province: '河南',
  urban: false,
  gender: 'male',
  name: '王建国',
  fatherJob: 'farmer',
  motherJob: 'farmer',
  tier: 'normal',
  siblings: 1,
  urbanizationRate: 0.24,
  cohortLifeExpectancy: 67,
};

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = memoryStorage();
});

function advance(g: Game, years: number): void {
  for (let i = 0; i < years; i++) {
    const snap = g.snapshot;
    if (snap.phase === 'dead') return;
    if (snap.phase === 'awaitingChoice') {
      const pick = snap.pendingEvent!.choices.find((c) => c.state === 'available');
      g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    } else {
      g.tick();
    }
  }
}

describe('存档读写', () => {
  it('没有存档时返回 null', () => {
    expect(loadCurrent()).toBeNull();
  });

  it('localStorage 抛错时降级，不炸', () => {
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('quota');
      },
    } as unknown as Storage;
    expect(loadCurrent()).toBeNull();
    expect(saveCurrent({ v: 1 } as never)).toBe(false);
  });

  it('写入后能读回同一份', () => {
    const g = new Game({ seed: 44, birth });
    g.start();
    advance(g, 12);
    expect(saveCurrent(serializeGame(g))).toBe(true);
    expect(loadCurrent()?.year).toBe(g.snapshot.year);
  });

  it('旧版本存档直接丢弃', () => {
    globalThis.localStorage.setItem('sfsq.current.v1', JSON.stringify({ v: 0, year: 1999 }));
    expect(loadCurrent()).toBeNull();
  });

  it('坏 JSON 不会白屏', () => {
    globalThis.localStorage.setItem('sfsq.current.v1', '{not json');
    expect(loadCurrent()).toBeNull();
  });
});

describe('重放恢复', () => {
  it('年份、数值与账本都能对上', () => {
    const g = new Game({ seed: 44, birth });
    g.start();
    advance(g, 20);

    const restored = restoreGame(serializeGame(g));
    expect(restored.snapshot.year).toBe(g.snapshot.year);
    expect(restored.snapshot.stats).toEqual(g.snapshot.stats);
    expect(restored.snapshot.ledger).toEqual(g.snapshot.ledger);
  });

  it('停在抉择弹窗时存档，恢复后仍停在同一事件', () => {
    const g = new Game({ seed: 33, birth });
    g.start();
    while (g.snapshot.phase !== 'awaitingChoice') g.tick();
    const pendingId = g.snapshot.pendingEvent!.event.id;

    const restored = restoreGame(serializeGame(g));
    expect(restored.snapshot.phase).toBe('awaitingChoice');
    expect(restored.snapshot.pendingEvent!.event.id).toBe(pendingId);
    expect(restored.snapshot.stats).toEqual(g.snapshot.stats);
  });
});

describe('前世纪录', () => {
  const record = (n: number): PastRecord => ({
    id: `r${n}`,
    createdAt: 1000 + n,
    birth,
    titleName: '守一座城的人',
    headline: '他这一生，没赶上什么大的浪。',
    subtitle: '赶上了扩招。',
    ledger: [],
    snapshots: [],
  });

  it('最新在前', () => {
    pushRecord(record(1));
    pushRecord(record(2));
    expect(listRecords().map((r) => r.id)).toEqual(['r2', 'r1']);
  });

  it('最多保留 10 局', () => {
    for (let i = 0; i < 13; i++) pushRecord(record(i));
    const list = listRecords();
    expect(list).toHaveLength(10);
    expect(list[0]!.id).toBe('r12');
    expect(list[9]!.id).toBe('r3');
  });

  it('存储坏掉时返回空数组', () => {
    globalThis.localStorage.setItem('sfsq.records.v1', 'oops');
    expect(listRecords()).toEqual([]);
  });
});
