import { describe, expect, it } from 'vitest';
import { CONTINUE_CHOICE_ID, Game } from '../../src/engine/game';
import { restoreGame, serializeGame } from '../../src/engine/save';
import type { Birth, EventDef } from '../../src/engine/types';

/**
 * 这一组锁的是"别再静默丢弃"。
 *
 * 2026-10-24 第二轮复查发现的两条丢弃规则，合起来让 77.9% 的玩家一辈子没有孩子、
 * 36.9% 的人从没见过「结婚」——而 274 项测试全绿，因为没有任何一条断言在问
 * "该发生的事发生了吗"。这个文件就是为了让那种漏检不会再发生。
 */

const base: Birth = {
  year: 1980,
  month: 6,
  province: '河南',
  urban: true,
  gender: 'male',
  name: '李建国',
  fatherJob: 'worker',
  motherJob: 'teacher',
  tier: 'normal',
  siblings: 1,
  urbanizationRate: 0.2,
  cohortLifeExpectancy: 72,
};

function playOnce(seed: number, birth: Birth): { asked: Set<string>; game: Game } {
  const game = new Game({ seed, birth });
  game.start();
  const asked = new Set<string>();
  let guard = 0;
  while (guard++ < 400) {
    const snap = game.snapshot;
    if (snap.phase === 'dead') break;
    if (snap.phase === 'awaitingChoice') {
      asked.add(snap.pendingEvent!.event.id);
      const pick = snap.pendingEvent!.choices.find((c) => c.state === 'available');
      game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    } else {
      game.tick();
    }
  }
  return { asked, game };
}

describe('播报级事件要结算后果（不是只写一行字）', () => {
  const probe: EventDef = {
    id: 'test_silent_stage',
    priority: 2,
    layer: 'stage',
    trigger: { type: 'age', age: 1 },
    windowAge: [1, 1],
    title: '测试节点',
    body: '测试正文',
    choices: [
      {
        id: 'default_path',
        label: '默认路径',
        effects: { family: 10 },
        outcome: '默认结果',
        setFlags: ['child_born'],
        default: true,
      },
      {
        id: 'other_path',
        label: '另一条路',
        effects: { wealth: -50 },
        outcome: '另一条结果',
        setFlags: ['single'],
      },
    ],
    ledgerWeight: 1,
    source: '测试用事件',
  };

  it('按 default 那一项结算数值与 flag，并真的改变家庭结构', () => {
    const game = new Game({
      seed: 7,
      birth: base,
      catalog: [probe],
      dailyEvents: [],
      reflections: false,
    });
    game.start();
    const before = game.snapshot.stats.family;
    game.tick();
    const snap = game.snapshot;

    // 数值：往 default 那一项的方向走（按 0.4 折算并走软边，所以只断言方向）
    expect(snap.stats.family).toBeGreaterThan(before);
    // 只结算 default，不结算另一项
    expect(snap.flags).toContain('child_born');
    expect(snap.flags).not.toContain('single');
    // flag 落到家庭结构上：孩子必须真的出现在家人栏
    expect(snap.family.some((m) => m.role === 'child')).toBe(true);
    // 仍然是一行播报，不弹窗
    expect(snap.phase).toBe('playing');
    expect(snap.timeline.some((t) => t.kind === 'broadcast' && t.text.startsWith('测试节点：'))).toBe(true);
  });
});

describe('同一年撞车要顺延（不是丢弃）', () => {
  it('无条件的阶段事件在各生年都出现（第一份工作 / 结婚）', () => {
    // 这两条没有 conditions，只在 age 23 / 27 触发，因此"没出现"只可能是被撞车吞掉。
    for (const year of [1958, 1966, 1975, 1985, 1995, 2005]) {
      let firstJob = 0;
      let marriage = 0;
      const runs = 12;
      for (let i = 0; i < runs; i++) {
        const { asked } = playOnce(9000 + i, { ...base, year });
        if (asked.has('stage_first_job')) firstJob += 1;
        if (asked.has('stage_marriage')) marriage += 1;
      }
      expect(firstJob / runs, `${year} 年生「第一份工作」出现率`).toBeGreaterThanOrEqual(0.99);
      expect(marriage / runs, `${year} 年生「结婚」出现率`).toBeGreaterThanOrEqual(0.99);
    }
  });

  it('孩子真的会出现（曾经 77.9% 的玩家一辈子没有孩子）', () => {
    let withChild = 0;
    const runs = 20;
    for (let i = 0; i < runs; i++) {
      const { game } = playOnce(4242 + i, { ...base, year: 1990 });
      if (game.snapshot.family.some((m) => m.role === 'child')) withChild += 1;
    }
    expect(withChild / runs).toBeGreaterThanOrEqual(0.9);
  });
});

describe('复读不是死路', () => {
  it('选「复读一年」之后，第二年有一场真正的高考', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const game = new Game({ seed, birth: { ...base, year: 1990 } });
      game.start();
      let guard = 0;
      let retook = false;
      let sawRetry = false;
      while (guard++ < 400) {
        const snap = game.snapshot;
        if (snap.phase === 'dead') break;
        if (snap.phase !== 'awaitingChoice') {
          game.tick();
          continue;
        }
        const pending = snap.pendingEvent!;
        if (pending.event.id === 'stage_gaokao' && !retook) {
          game.resolve('retake');
          retook = true;
          continue;
        }
        if (pending.event.id === 'cond_gaokao_retry') {
          expect(snap.age).toBe(19);
          sawRetry = true;
        }
        const pick = pending.choices.find((c) => c.state === 'available');
        game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      }
      if (retook) {
        expect(sawRetry, `seed ${seed} 复读后没有第二场高考`).toBe(true);
        return;
      }
    }
    throw new Error('没有任何种子走到高考');
  });
});

describe('生不生孩子由玩家决定', () => {
  it('「孩子」弹窗里「再等等」始终可点（不是强制要一个）', () => {
    let saw = 0;
    let waitAvailable = 0;
    for (let i = 0; i < 15; i++) {
      const game = new Game({ seed: 31000 + i, birth: { ...base, year: 1990 } });
      game.start();
      let guard = 0;
      while (guard++ < 400) {
        const snap = game.snapshot;
        if (snap.phase === 'dead') break;
        if (snap.phase !== 'awaitingChoice') {
          game.tick();
          continue;
        }
        const pending = snap.pendingEvent!;
        if (pending.event.id === 'stage_child_birth') {
          saw += 1;
          if (pending.choices.some((c) => c.id === 'wait' && c.state === 'available')) waitAvailable += 1;
        }
        const pick = pending.choices.find((c) => c.state === 'available');
        game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      }
    }
    expect(saw).toBeGreaterThan(0);
    expect(waitAvailable).toBe(saw);
  });

  it('选了「一个人过」的人不会被时代事件塞一个孩子', () => {
    // era_two_child_2016 的「再生一个」曾经无视条件直接设 child_born，
    // 未婚玩家会读到"第二个孩子出生那天"。
    let singles = 0;
    let gotChild = 0;
    for (let i = 0; i < 15; i++) {
      const game = new Game({ seed: 47000 + i, birth: { ...base, year: 1990 } });
      game.start();
      let guard = 0;
      let isSingle = false;
      while (guard++ < 400) {
        const snap = game.snapshot;
        if (snap.phase === 'dead') break;
        if (snap.phase !== 'awaitingChoice') {
          game.tick();
          continue;
        }
        const pending = snap.pendingEvent!;
        // 选「一个人过」；其余一律选"能生就生"的那一项，确保只有婚姻这一处挡着
        if (pending.event.id === 'stage_marriage' && pending.choices.some((c) => c.id === 'single' && c.state === 'available')) {
          game.resolve('single');
          isSingle = true;
          continue;
        }
        const pick = pending.choices.find((c) => c.state === 'available');
        game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      }
      if (!isSingle) continue;
      singles += 1;
      if (game.snapshot.flags.includes('child_born')) gotChild += 1;
    }
    expect(singles).toBeGreaterThan(0);
    expect(gotChild).toBe(0);
  });
});

describe('存档：同年多个弹窗也能重放', () => {
  it('在不同存档点上（含弹窗开着时）恢复后数值一致', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const game = new Game({ seed: seed * 7919 });
      game.start();
      let guard = 0;
      const saveAt = (seed * 7) % 30;
      let save: ReturnType<typeof serializeGame> | null = null;
      while (guard++ < 400) {
        const snap = game.snapshot;
        if (snap.phase === 'dead') break;
        if (snap.phase === 'awaitingChoice') {
          const pick = snap.pendingEvent!.choices.find((c) => c.state === 'available');
          game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
        } else {
          game.tick();
        }
        if (guard === saveAt) save = serializeGame(game);
      }
      if (!save) continue;
      const restored = restoreGame(save);
      expect(restored.snapshot.year).toBe(save.year);
      expect(restored.snapshot.stats).toEqual(save.stats);
    }
  });
});
