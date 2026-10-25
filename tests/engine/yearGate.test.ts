import { describe, expect, it } from 'vitest';
import { CONTINUE_CHOICE_ID, Game } from '../../src/engine/game';
import type { Birth } from '../../src/engine/types';

/**
 * 阶段事件按年龄触发，但"到了这个年纪必然发生"要以时代存在为前提。
 *
 * 曾经没有这道闸门：`stage_gaokao` 只看 age 18，于是 1958 年出生的人
 * 在 1976 年"参加高考"——恢复高考是 1977 年 12 月的事——紧接着 1977 年
 * 又赶上"恢复高考"，连着考了两次。
 */

const base: Birth = {
  year: 1958,
  month: 6,
  province: '河南',
  urban: true,
  gender: 'male',
  name: '李建国',
  fatherJob: 'worker',
  motherJob: 'teacher',
  tier: 'normal',
  siblings: 2,
  urbanizationRate: 0.162,
  cohortLifeExpectancy: 66,
};

function traceEvents(seed: number, overrides: Partial<Birth> = {}): { year: number; id: string }[] {
  const game = new Game({ seed, birth: { ...base, ...overrides } });
  game.start();
  const trace: { year: number; id: string }[] = [];
  let guard = 0;
  while (game.snapshot.phase !== 'dead' && guard++ < 400) {
    const snap = game.snapshot;
    if (snap.phase === 'awaitingChoice') {
      trace.push({ year: snap.year, id: snap.pendingEvent!.event.id });
      const pick = snap.pendingEvent!.choices.find((c) => c.state === 'available');
      game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    } else {
      game.tick();
    }
  }
  return trace;
}

describe('阶段事件的年份闸门', () => {
  it('1977 年之前不存在"高考"这个事件（1958–1970 出生全扫）', () => {
    for (let year = 1958; year <= 1970; year++) {
      for (const seed of [3, 17, 101]) {
        const trace = traceEvents(seed, { year });
        const gaokao = trace.filter((t) => t.id === 'stage_gaokao');
        for (const entry of gaokao) {
          expect(entry.year, `${year} 年生 seed ${seed} 在 ${entry.year} 年高考`).toBeGreaterThanOrEqual(1977);
        }
      }
    }
  });

  it('1958 年生的人 18 岁没有高考，19 岁赶上"恢复高考"', () => {
    const trace = traceEvents(777);
    expect(trace.some((t) => t.id === 'stage_gaokao' && t.year === 1976)).toBe(false);
    expect(trace.some((t) => t.id === 'era_gaokao_restored_1977' && t.year === 1977)).toBe(true);
  });

  it('1959 年生的人同一年只会弹一次高考（时代事件优先）', () => {
    for (const seed of [5, 23, 88]) {
      const trace = traceEvents(seed, { year: 1959 });
      const at1977 = trace.filter((t) => t.year === 1977 && (t.id === 'stage_gaokao' || t.id === 'era_gaokao_restored_1977'));
      expect(at1977).toHaveLength(1);
      expect(at1977[0]!.id).toBe('era_gaokao_restored_1977');
    }
  });

  it('1960 年生的人 1977 年听到消息、1978 年参加高考', () => {
    const trace = traceEvents(31337, { year: 1960 });
    const era = trace.find((t) => t.id === 'era_gaokao_restored_1977');
    expect(era?.year).toBe(1977);
    // 是否真的参加 1978 年高考取决于中考有没有上高中，但年份必须合法
    for (const t of trace.filter((x) => x.id === 'stage_gaokao')) {
      expect(t.year).toBeGreaterThanOrEqual(1977);
    }
  });
});

describe('按年龄触发的事件也要管年代', () => {
  it('1958 年生的人不会在 1983 年遇到「灵活就业」', () => {
    for (const seed of [11, 42, 99]) {
      const trace = traceEvents(seed, { year: 1958 });
      const gig = trace.find((t) => t.id === 'cond_gig_worker');
      if (gig) expect(gig.year).toBeGreaterThanOrEqual(2014);
    }
  });

  it('1958 年生的人不会在 1988 年「因为一个视频火了」', () => {
    for (const seed of [11, 42, 99]) {
      const trace = traceEvents(seed, { year: 1958 });
      const viral = trace.find((t) => t.id === 'cond_influencer');
      if (viral) expect(viral.year).toBeGreaterThanOrEqual(2016);
    }
  });

  it('1981 年的「第一份工作」里，教培那一条是置灰的', () => {
    const game = new Game({ seed: 21, birth: { ...base, year: 1958 } });
    game.start();
    let guard = 0;
    while (guard++ < 200) {
      const snap = game.snapshot;
      if (snap.phase === 'dead') break;
      if (snap.phase === 'awaitingChoice') {
        const pending = snap.pendingEvent!;
        if (pending.event.id === 'stage_first_job') {
          const edtech = pending.choices.find((c) => c.id === 'edtech')!;
          expect(edtech.state).toBe('locked');
          expect(edtech.reason).toContain('课外辅导');
          return;
        }
        const pick = pending.choices.find((c) => c.state === 'available');
        game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else {
        game.tick();
      }
    }
    throw new Error('这一局没有走到「第一份工作」');
  });
});

describe('死亡信息自洽', () => {
  it('「活了 X 天」与「享年 X 岁」对得上', () => {
    const game = new Game({ seed: 2026 });
    game.start();
    let guard = 0;
    while (game.snapshot.phase !== 'dead' && guard++ < 400) {
      if (game.snapshot.phase === 'awaitingChoice') {
        const pick = game.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
        game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else {
        game.tick();
      }
    }
    const death = game.snapshot.death!;
    expect(death.daysLived).toBe(Math.round(death.age * 365.2425));
    // 换算回年份不能差出一年
    expect(Math.abs(death.daysLived / 365.2425 - death.age)).toBeLessThan(0.1);
  });
});

describe('1958–1976 的童年不再是空白', () => {
  it('1958 年生的人在 1977 年前能遇到时代内容', () => {
    const trace = traceEvents(2024);
    const early = trace.filter((t) => t.year < 1977);
    expect(early.length).toBeGreaterThanOrEqual(2);
    expect(early.some((t) => t.id.startsWith('era_'))).toBe(true);
  });

  it('1966 年生的人能看到六十年代末的播报', () => {
    const game = new Game({ seed: 1966, birth: { ...base, year: 1966 } });
    game.start();
    let guard = 0;
    while (game.snapshot.year < 1980 && game.snapshot.phase !== 'dead' && guard++ < 40) {
      if (game.snapshot.phase === 'awaitingChoice') {
        const pick = game.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
        game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else {
        game.tick();
      }
    }
    const texts = game.snapshot.timeline.filter((t) => t.kind === 'broadcast').map((t) => t.text);
    expect(texts.some((t) => t.includes('学校停课') || t.includes('东方红') || t.includes('唐山'))).toBe(true);
  });

  it('出生当年的播报也会出现（tick 从下一年开始数，出生年要单独补）', () => {
    const game = new Game({ seed: 7, birth: { ...base, year: 1958 } });
    game.start();
    const born = game.snapshot.timeline.filter((t) => t.year === 1958);
    expect(born.some((t) => t.text.includes('人民公社'))).toBe(true);
  });
});
