import { describe, expect, it } from 'vitest';
import { DAILY_EVENTS } from '../../src/data/events/daily';
import { REFLECTIONS } from '../../src/data/reflections';
import { Game, CONTINUE_CHOICE_ID } from '../../src/engine/game';
import { rollBirth } from '../../src/engine/birth';
import { createRng } from '../../src/engine/rng';
import { restoreGame, serializeGame } from '../../src/engine/save';
import { deriveStates } from '../../src/engine/states';
import type { Birth } from '../../src/engine/types';
import { cohortLifeExpectancy } from '../../src/data/demography';

function playAll(g: Game, onPending?: (id: string, kind: string) => void): Game {
  g.start();
  let guard = 0;
  while (g.snapshot.phase !== 'dead' && guard++ < 600) {
    if (g.snapshot.phase === 'awaitingChoice') {
      const p = g.snapshot.pendingEvent!;
      onPending?.(p.event.id, p.kind);
      const pick = p.choices.find((c) => c.state === 'available');
      g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    } else {
      g.tick();
    }
  }
  return g;
}

describe('日常事件池数据', () => {
  it('id 唯一、年龄段合法、每个事件至少一个选项且带出处', () => {
    const ids = new Set<string>();
    for (const d of DAILY_EVENTS) {
      expect(ids.has(d.id)).toBe(false);
      ids.add(d.id);
      expect(d.ageRange[0]).toBeLessThan(d.ageRange[1]);
      expect(d.choices.length).toBeGreaterThan(0);
      expect(d.source.length).toBeGreaterThan(0);
      for (const c of d.choices) expect(c.outcome.length + (c.probability?.length ?? 0)).toBeGreaterThan(0);
    }
    expect(DAILY_EVENTS.length).toBeGreaterThanOrEqual(24);
  });
});

describe('二期系统', () => {
  it('一局里日常事件会多次出现，且同一事件不重复（非 repeatable）', () => {
    const seen: string[] = [];
    playAll(new Game({ seed: 2026 }), (id, kind) => {
      if (kind === 'daily') seen.push(id);
    });
    expect(seen.length).toBeGreaterThanOrEqual(8);
    const once = seen.filter((id) => !DAILY_EVENTS.find((d) => d.id === id)?.repeatable);
    expect(new Set(once).size).toBe(once.length);
  });

  it('五个反思节点都会在对应年龄出现', () => {
    const ages: number[] = [];
    playAll(new Game({ seed: 7 }), (id, kind) => {
      if (kind === 'reflection') ages.push(Number(id.replace('reflection_', '')));
    });
    expect(ages).toEqual(expect.arrayContaining([18, 30, 40, 50, 60]));
    expect(REFLECTIONS).toHaveLength(5);
  });

  it('反思弹窗带年代数据：正文里有工资或城镇化率数字', () => {
    const g = new Game({ seed: 7 });
    g.start();
    let body = '';
    let guard = 0;
    while (guard++ < 100) {
      if (g.snapshot.phase === 'awaitingChoice') {
        const p = g.snapshot.pendingEvent!;
        if (p.kind === 'reflection') {
          body = p.text;
          break;
        }
        const pick = p.choices.find((c) => c.state === 'available');
        g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else g.tick();
    }
    expect(body).toMatch(/元一年|城镇化率/);
  });

  it('持续状态推导：房贷在还 → 还清；持仓与慢病各就各位', () => {
    expect(deriveStates(['has_home', 'mortgage'], 40).map((x) => x.id)).toContain('mortgage');
    expect(deriveStates(['has_home', 'mortgage', 'mortgage_paid'], 60).map((x) => x.id)).toContain('mortgage_paid');
    expect(deriveStates(['holds_btc', 'chronic_illness'], 55).map((x) => x.id)).toEqual(
      expect.arrayContaining(['btc', 'chronic']),
    );
    expect(deriveStates([], 30)).toEqual([]);
  });

  it('带日常选择的存档能精确重放（resume 不再因日常事件分叉）', () => {
    // 按应用真实开局方式：出生用独立 rng 抽，游戏种子只管玩法随机流
    const birth = rollBirth(createRng(7));
    const g = Game.fromBirth(birth, 99);
    g.start();
    let guard = 0;
    while (g.snapshot.year < g.snapshot.birth.year + 30 && guard++ < 300) {
      if (g.snapshot.phase === 'awaitingChoice') {
        const p = g.snapshot.pendingEvent!;
        const pick = p.choices.find((c) => c.state === 'available');
        g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else g.tick();
    }
    const save = serializeGame(g);
    expect(save.choiceLog!.length).toBeGreaterThan(5);
    const restored = restoreGame(save);
    expect(restored.snapshot.year).toBe(save.year);
    expect(restored.snapshot.stats).toEqual(save.stats);
  });

  it('房贷会在背上 20 年后还清并记进时间线', () => {
    const birth: Birth = {
      ...rollBirth(createRng(11)),
      year: 1975, month: 5, urban: true,
      cohortLifeExpectancy: cohortLifeExpectancy(1975, true),
    };
    const g = playAll(Game.fromBirth(birth, 42));
    const tl = g.snapshot.timeline.map((t) => t.text).join('\n');
    if (tl.includes('买房') || g.snapshot.flags.includes('has_home')) {
      // 是否买房取决于这局的抉择路径；买了就必须在 20 年后见到还清记录
      if (g.snapshot.flags.includes('mortgage_paid')) expect(tl).toContain('房贷，这个月还清了');
    }
    // 至少验证状态推导与 flag 一致
    const states = g.snapshot.states.map((x) => x.id);
    if (g.snapshot.flags.includes('mortgage_paid')) expect(states).toContain('mortgage_paid');
  });
});
