import { describe, expect, it } from 'vitest';
import { createGameStore } from '../../src/ui/store';
import type { Birth } from '../../src/engine/types';

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

  it('重心切换与抉择通过 store 转发', () => {
    const store = createGameStore();
    store.startGame(birth, 1);
    while (store.getSnapshot()!.age < 7) store.tick();
    store.setFocus('study');
    expect(store.getSnapshot()!.focusId).toBe('study');
  });
});
