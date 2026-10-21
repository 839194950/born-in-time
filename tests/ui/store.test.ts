import { beforeEach, describe, expect, it } from 'vitest';
import type { Birth } from '../../src/engine/types';
import { createGameStore } from '../../src/ui/store';

const birth: Birth = {
  year: 1995,
  month: 6,
  province: '河南',
  urban: false,
  gender: 'male',
  name: '王建国',
  fatherJob: 'farmer',
  motherJob: 'farmer',
  tier: 'normal',
  siblings: 1,
  urbanizationRate: 0.29,
  cohortLifeExpectancy: 69,
};

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

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = memoryStorage();
});

describe('game store', () => {
  it('开局前没有快照', () => {
    expect(createGameStore().getSnapshot()).toBeNull();
  });

  it('开局后能拿到快照，并随推进变化', () => {
    const store = createGameStore();
    store.startGame(birth, 1);
    expect(store.getSnapshot()!.age).toBe(0);
    expect(store.getSnapshot()!.birth.name).toBe('王建国');
    store.tick();
    expect(store.getSnapshot()!.age).toBe(1);
  });

  it('订阅者在开局与推进时都会被通知', () => {
    const store = createGameStore();
    let notified = 0;
    const unsub = store.subscribe(() => (notified += 1));
    store.startGame(birth, 1);
    store.tick();
    expect(notified).toBeGreaterThanOrEqual(2);
    unsub();
    const after = notified;
    store.tick();
    expect(notified).toBe(after);
  });

  it('重心切换通过 store 转发', () => {
    const store = createGameStore();
    store.startGame(birth, 1);
    while (store.getSnapshot()!.age < 7) store.tick();
    store.setFocus('study');
    expect(store.getSnapshot()!.focusId).toBe('study');
  });
});

describe('自动存档与续玩', () => {
  it('推进时自动写档，新 store 能接着上一局', () => {
    const a = createGameStore();
    a.startGame(birth, 7);
    for (let i = 0; i < 9; i++) a.tick();
    const year = a.getSnapshot()!.year;
    const age = a.getSnapshot()!.age;

    const b = createGameStore();
    expect(b.resume()).toBe(true);
    expect(b.getSnapshot()!.year).toBe(year);
    expect(b.getSnapshot()!.age).toBe(age);
  });

  it('没有存档时 resume 返回 false，不产生快照', () => {
    const store = createGameStore();
    expect(store.resume()).toBe(false);
    expect(store.getSnapshot()).toBeNull();
  });
});
