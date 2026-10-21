import { describe, expect, it } from 'vitest';
import { cohortLifeExpectancy } from '../../src/data/demography';
import { rollBirth } from '../../src/engine/birth';
import { Game } from '../../src/engine/game';
import { createRng } from '../../src/engine/rng';
import type { Birth, EventDef } from '../../src/engine/types';

const u = (seed: number) => createRng(seed);

function playToDeath(game: Game): Game {
  game.start();
  let guard = 0;
  while (game.snapshot.phase !== 'dead' && guard++ < 200) {
    if (game.snapshot.phase === 'awaitingChoice') {
      const pick = game.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
      if (!pick) throw new Error('没有可用选项');
      game.resolve(pick.id);
    } else {
      game.tick();
    }
  }
  return game;
}

describe('主引擎：一局能走完', () => {
  it('自动抉择能从出生一路推到死亡', () => {
    const g = playToDeath(new Game({ seed: 2026 }));
    expect(g.snapshot.phase).toBe('dead');
    expect(g.snapshot.death).not.toBeNull();
    expect(g.snapshot.age).toBeGreaterThan(30);
  });

  it('每年一条快照，且与年龄对齐', () => {
    const g = playToDeath(new Game({ seed: 2026 }));
    expect(g.snapshot.snapshots).toHaveLength(g.snapshot.age);
    expect(g.snapshot.snapshots[0]!.age).toBe(1);
  });

  it('账本不重复，且只记时代窗口事件', () => {
    const g = playToDeath(new Game({ seed: 2026 }));
    const ids = g.snapshot.ledger.map((e) => e.eventId);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of g.snapshot.ledger) {
      expect(e.verdict).toMatch(/caught|nearMiss|passedBy/);
      expect(e.eventId.startsWith('era_')).toBe(true); // 阶段事件不是窗口，不进账本
    }
  });

  it('2002 年出生的人也能推到终点，不会卡在没事件的年份', () => {
    const base = rollBirth(u(3));
    const birth: Birth = {
      ...base,
      year: 2002,
      month: 6,
      urban: false,
      urbanizationRate: 0.39,
      cohortLifeExpectancy: cohortLifeExpectancy(2002, false),
    };
    const g = playToDeath(Game.fromBirth(birth, 99));
    expect(g.snapshot.phase).toBe('dead');
    expect(g.snapshot.year).toBeGreaterThan(2060);
    expect(g.snapshot.snapshots).toHaveLength(g.snapshot.age);
  });
});

describe('主引擎：抉择', () => {
  it('锁定选项抛错，且不改变任何状态', () => {
    const gated: EventDef = {
      id: 'test_gate',
      layer: 'stage',
      trigger: { type: 'age', age: 18 },
      windowAge: [18, 18],
      title: '选择题',
      body: '测试正文',
      ledgerWeight: 1,
      source: '测试',
      choices: [
        { id: 'a', label: 'A', gate: { unlockYear: 3000 }, lockedText: '还没到时候', effects: { ability: 50 }, outcome: '' },
        { id: 'b', label: 'B', effects: { ability: 1 }, outcome: '' },
      ],
    };
    const g = new Game({ seed: 1, birth: { ...rollBirth(u(5)), year: 1990, month: 6 }, catalog: [gated] });
    g.start();
    while (g.snapshot.phase !== 'awaitingChoice') g.tick();

    const input = g.snapshot.pendingEvent!;
    expect(input.choices[0]).toMatchObject({ state: 'locked', reason: '还没到时候' });
    expect(input.choices[1]!.state).toBe('available');

    const before = { ...g.snapshot.stats };
    expect(() => g.resolve('a')).toThrow();
    expect(g.snapshot.stats).toEqual(before);
    expect(g.snapshot.phase).toBe('awaitingChoice');
  });

  it('选完之后回到推进状态，事件只触发一次', () => {
    const g = new Game({ seed: 2026 });
    g.start();
    while (g.snapshot.phase !== 'awaitingChoice') g.tick();
    const eventId = g.snapshot.pendingEvent!.event.id;
    const pick = g.snapshot.pendingEvent!.choices.find((c) => c.state === 'available')!;
    g.resolve(pick.id);

    expect(g.snapshot.phase).toBe('playing');
    expect(g.snapshot.pendingEvent).toBeNull();

    let again = 0;
    for (let i = 0; i < 40; i++) {
      const snap = g.snapshot;
      if (snap.phase === 'dead') break;
      if (snap.phase === 'awaitingChoice') {
        if (snap.pendingEvent!.event.id === eventId) again++;
        g.resolve(snap.pendingEvent!.choices.find((c) => c.state === 'available')!.id);
      } else {
        g.tick();
      }
    }
    expect(again).toBe(0);
  });

  it('抉择悬而未决时不能继续推进时间', () => {
    const g = new Game({ seed: 2026 });
    g.start();
    while (g.snapshot.phase !== 'awaitingChoice') g.tick();
    expect(() => g.tick()).toThrow();
  });
});

describe('主引擎：年度重心与数值', () => {
  it('换阶段时自动切到该阶段的默认重心', () => {
    const g = new Game({ seed: 7 });
    g.start();
    g.setFocus('play');
    while (g.snapshot.age < 13) g.tick();
    expect(g.snapshot.stage).toBe('student');
    expect(g.snapshot.focusOptions.some((o) => o.id === g.snapshot.focusId)).toBe(true);
  });

  it('非法重心 id 被忽略', () => {
    const g = new Game({ seed: 7 });
    g.start();
    const before = g.snapshot.focusId;
    g.setFocus('nope');
    expect(g.snapshot.focusId).toBe(before);
  });

  it('五维始终在 0–100', () => {
    const g = playToDeath(new Game({ seed: 31 }));
    for (const snap of g.snapshot.snapshots) {
      for (const v of Object.values(snap.stats)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it('家人随开局生成，父母比主角年长', () => {
    const g = new Game({ seed: 2026 });
    g.start();
    const father = g.snapshot.family.find((f) => f.role === 'father')!;
    expect(father).toBeDefined();
    expect(father.birthYear).toBeLessThan(g.snapshot.birth.year - 18);
  });
});

describe('主引擎：订阅', () => {
  it('每次状态变化版本号自增', () => {
    const g = new Game({ seed: 7 });
    const v0 = g.getVersion();
    let notified = 0;
    const unsub = g.subscribe(() => notified++);
    g.start();
    g.tick();
    expect(g.getVersion()).toBeGreaterThan(v0);
    expect(notified).toBeGreaterThanOrEqual(2);
    unsub();
  });
});
