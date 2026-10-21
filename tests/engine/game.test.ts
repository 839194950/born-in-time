import { describe, expect, it } from 'vitest';
import { cohortLifeExpectancy } from '../../src/data/demography';
import { rollBirth } from '../../src/engine/birth';
import { CONTINUE_CHOICE_ID, Game } from '../../src/engine/game';
import { createRng } from '../../src/engine/rng';
import type { Birth, EventDef } from '../../src/engine/types';

const u = (seed: number) => createRng(seed);

function playToDeath(game: Game): Game {
  game.start();
  let guard = 0;
  while (game.snapshot.phase !== 'dead' && guard++ < 200) {
    if (game.snapshot.phase === 'awaitingChoice') {
      const pick = game.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
      game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
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
    const pick = g.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
    g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);

    expect(g.snapshot.phase).toBe('playing');
    expect(g.snapshot.pendingEvent).toBeNull();

    let again = 0;
    for (let i = 0; i < 40; i++) {
      const snap = g.snapshot;
      if (snap.phase === 'dead') break;
      if (snap.phase === 'awaitingChoice') {
        if (snap.pendingEvent!.event.id === eventId) again++;
        const pick = snap.pendingEvent!.choices.find((c) => c.state === 'available');
        g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else {
        g.tick();
      }
    }
    expect(again).toBe(0);
  });

  it('判定为路过的事件只留一行播报，不打断时间', () => {
    const far: EventDef = {
      id: 'test_passed_by',
      layer: 'era',
      trigger: { type: 'year', year: 2000 },
      windowAge: [40, 50],
      title: '远处的浪',
      body: '这浪离你很远。',
      ledgerWeight: 1,
      source: '测试',
      choices: [{ id: 'a', label: 'A', outcome: '' }],
    };
    const g = new Game({ seed: 2, birth: { ...rollBirth(u(5)), year: 1990, month: 6 }, catalog: [far] });
    g.start();
    while (g.snapshot.year < 2000) g.tick();

    expect(g.snapshot.pendingEvent).toBeNull();
    expect(g.snapshot.phase).toBe('playing');
    expect(g.snapshot.ledger[0]?.verdict).toBe('passedBy');
    expect(g.snapshot.timeline.some((t) => t.text.startsWith('远处的浪：'))).toBe(true);
  });

  it('差一年只给文案不给选项，“继续”之后回到推进', () => {
    const close: EventDef = {
      id: 'test_near_miss',
      layer: 'era',
      trigger: { type: 'year', year: 2000 },
      windowAge: [13, 15],
      title: '差一步的浪',
      body: '你站在门口。',
      ledgerWeight: 4,
      source: '测试',
      choices: [{ id: 'a', label: 'A', outcome: '' }],
    };
    const g = new Game({ seed: 2, birth: { ...rollBirth(u(5)), year: 1990, month: 6 }, catalog: [close] });
    g.start();
    while (g.snapshot.phase !== 'awaitingChoice') g.tick();

    const pending = g.snapshot.pendingEvent!;
    expect(pending.judgement.verdict).toBe('nearMiss');
    expect(pending.judgement.gapMonths).toBe(36);
    expect(pending.choices).toHaveLength(0);
    expect(() => g.resolve('a')).toThrow();

    g.resolve(CONTINUE_CHOICE_ID);
    expect(g.snapshot.phase).toBe('playing');
    expect(g.snapshot.pendingEvent).toBeNull();
  });

  it('关键事件会写入定格标记，普通事件不会', () => {
    const still: EventDef = {
      id: 'stage_marriage',
      layer: 'stage',
      trigger: { type: 'age', age: 5 },
      windowAge: [5, 5],
      title: '婚礼',
      body: '测试',
      ledgerWeight: 1,
      source: '测试',
      choices: [{ id: 'a', label: 'A', outcome: '' }],
    };
    const g = new Game({ seed: 2, birth: { ...rollBirth(u(5)), year: 1990, month: 6 }, catalog: [still] });
    g.start();
    while (g.snapshot.phase !== 'awaitingChoice') g.tick();
    expect(g.snapshot.milestoneId).toBeNull();
    g.resolve('a');
    expect(g.snapshot.milestoneId).toBe('wedding');
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
    while (g.snapshot.age < 13) {
      if (g.snapshot.phase === 'awaitingChoice') {
        const pick = g.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
        g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else {
        g.tick();
      }
    }
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

describe('回归：阶段事件不走窗口判定（差一年误判）', () => {
  // 背景：阶段事件的 windowAge 写成单一年龄 [15,15]，事件时点又取年中 6 月，
  // 出生月份在 7 月以后的人每个阶段事件都会“差 1–6 个月”被判 nearMiss，
  // 只剩一个“继续过日子”按钮。1968 年 9 月出生的一局里 24 个事件误判了 14 个。
  const stageEvent: EventDef = {
    id: 'test_stage_exam',
    layer: 'stage',
    trigger: { type: 'age', age: 15 },
    windowAge: [15, 15],
    title: '中考',
    body: '测试正文',
    ledgerWeight: 1,
    source: '测试',
    choices: [
      { id: 'a', label: '读高中', outcome: '' },
      { id: 'b', label: '去打工', outcome: '' },
    ],
  };

  it.each([1, 3, 6, 7, 9, 12])('出生月份为 %i 月时，阶段事件照常给选项', (month) => {
    const g = new Game({
      seed: 2,
      birth: { ...rollBirth(u(5)), year: 1990, month },
      catalog: [stageEvent],
    });
    g.start();
    while (g.snapshot.phase !== 'awaitingChoice') g.tick();
    const pending = g.snapshot.pendingEvent!;
    expect(pending.event.id).toBe('test_stage_exam');
    expect(pending.judgement.verdict).toBe('caught');
    expect(pending.choices.length).toBeGreaterThan(0);
  });

  it('全量事件表跑一局：阶段事件永远有选项，下半年出生也不例外', () => {
    const base = rollBirth(u(11));
    const birth: Birth = {
      ...base,
      year: 1968,
      month: 9,
      urban: false,
      cohortLifeExpectancy: cohortLifeExpectancy(1968, false),
    };
    const g = Game.fromBirth(birth, 42);
    g.start();
    let stagePendings = 0;
    let guard = 0;
    while (g.snapshot.phase !== 'dead' && guard++ < 300) {
      if (g.snapshot.phase === 'awaitingChoice') {
        const pending = g.snapshot.pendingEvent!;
        if (pending.event.layer === 'stage') {
          stagePendings += 1;
          expect(pending.judgement.verdict).toBe('caught');
          expect(pending.choices.length).toBeGreaterThan(0);
        }
        const pick = pending.choices.find((c) => c.state === 'available');
        g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else {
        g.tick();
      }
    }
    expect(g.snapshot.phase).toBe('dead');
    expect(stagePendings).toBeGreaterThanOrEqual(8);
  });
});

describe('一期系统：职业结算 / 家人 / 兴趣 / 整数显示', () => {
  it('重心按钮预演值全是整数，且与实际生效同号', () => {
    const g = new Game({ seed: 7 });
    g.start();
    let guard = 0;
    while (g.snapshot.age < 10 && guard++ < 60) {
      if (g.snapshot.phase === 'awaitingChoice') {
        const pick = g.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
        g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else {
        g.tick();
      }
    }
    expect(g.snapshot.age).toBeGreaterThanOrEqual(10);
    for (const eff of Object.values(g.snapshot.focusDisplay)) {
      for (const v of Object.values(eff)) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('成年后有职业行，且第一份工资会记进时间线', () => {
    const g = playToDeath(new Game({ seed: 2026 }));
    expect(g.snapshot.careerLine.length).toBeGreaterThan(0);
    expect(g.snapshot.timeline.some((t) => t.text.startsWith('第一份工资'))).toBe(true);
  });

  it('连年选学习能攒出阅读兴趣，写进结局汇总', () => {
    const g = new Game({ seed: 5 });
    g.start();
    let guard = 0;
    while (g.snapshot.phase !== 'dead' && guard++ < 300) {
      if (g.snapshot.phase === 'awaitingChoice') {
        const pick = g.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
        g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else {
        if (g.snapshot.focusOptions.some((o) => o.id === 'study')) g.setFocus('study');
        g.tick();
      }
    }
    const reading = g.snapshot.interests.find((i) => i.id === 'reading');
    expect(reading).toBeDefined();
    expect(reading!.level).toBeGreaterThan(3);
  });

  it('父母会在玩家生前离世并记进时间线（1960 年出生的一局）', () => {
    const base = rollBirth(u(3));
    const birth: Birth = {
      ...base,
      year: 1960,
      month: 3,
      urban: false,
      cohortLifeExpectancy: cohortLifeExpectancy(1960, false),
    };
    const g = playToDeath(Game.fromBirth(birth, 42));
    expect(g.snapshot.timeline.some((t) => /父亲|母亲/.test(t.text) && t.text.includes('去世了'))).toBe(true);
    const father = g.snapshot.family.find((f) => f.role === 'father')!;
    expect(father.deathYear).toBeDefined();
  });

  it('最幸福的一年不会落在 8 岁之前', async () => {
    const { buildAggregate } = await import('../../src/engine/ending');
    const g = playToDeath(new Game({ seed: 2026 }));
    const agg = buildAggregate(g.snapshot);
    expect(agg.bestYear - g.snapshot.birth.year).toBeGreaterThanOrEqual(8);
  });
});
