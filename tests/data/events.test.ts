import { describe, expect, it } from 'vitest';
import { ALL_EVENTS, BROADCAST_EVENTS, CONDITIONAL_EVENTS, ERA_EVENTS, STAGE_EVENTS } from '../../src/data/events';
import { validateCatalog } from '../../src/engine/catalog';
import type { EventDef } from '../../src/engine/types';

const yearOf = (e: EventDef): number => (e.trigger.type === 'year' ? e.trigger.year : -1);

describe('事件目录完整性', () => {
  it('全部通过守门校验（id 唯一、有出处、有选项或播报、窗口合法）', () => {
    expect(() => validateCatalog(ALL_EVENTS)).not.toThrow();
  });

  it('时代事件覆盖规格列出的年份', () => {
    const years = new Set(ERA_EVENTS.map(yearOf));
    for (const y of [1977, 1986, 1988, 1989, 1990, 1993, 1996, 1997, 1998, 1999, 2001, 2003, 2008, 2009, 2013, 2015, 2016, 2017, 2018, 2023, 2025, 2030, 2035, 2040, 2045]) {
      expect(years.has(y)).toBe(true);
    }
  });

  it('时代事件不少于 18 条，播报不少于 10 条', () => {
    expect(ERA_EVENTS.length).toBeGreaterThanOrEqual(18);
    expect(BROADCAST_EVENTS.length).toBeGreaterThanOrEqual(10);
    for (const b of BROADCAST_EVENTS) expect(b.broadcast).toBe(true);
  });

  it('每条都有出处', () => {
    for (const e of ALL_EVENTS) expect(e.source.trim().length).toBeGreaterThan(4);
  });

  it('每个选项都有结果文案', () => {
    for (const e of [...ERA_EVENTS, ...STAGE_EVENTS, ...CONDITIONAL_EVENTS]) {
      for (const c of e.choices) expect(c.outcome.trim().length).toBeGreaterThan(0);
    }
  });

  it('无非财富项的效果幅度不超过 6', () => {
    for (const e of [...ERA_EVENTS, ...STAGE_EVENTS, ...CONDITIONAL_EVENTS]) {
      for (const c of e.choices) {
        for (const [key, value] of Object.entries(c.effects ?? {})) {
          if (key === 'wealth') continue;
          expect(Math.abs(value)).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it('末班车型事件至少 2 条', () => {
    expect(ALL_EVENTS.filter((e) => e.lastTrain).length).toBeGreaterThanOrEqual(2);
  });

  it('人生阶段事件不少于 20 条，按年龄触发且年龄不重复', () => {
    expect(STAGE_EVENTS.length).toBeGreaterThanOrEqual(20);
    const ages = STAGE_EVENTS.map((e) => (e.trigger.type === 'age' ? e.trigger.age : -1));
    for (const age of ages) expect(age).toBeGreaterThan(0);
    expect(new Set(ages).size).toBe(ages.length);
    expect([...ages].sort((a, b) => a - b)).toEqual(ages);
    for (const e of STAGE_EVENTS) expect(e.layer).toBe('stage');
  });

  it('条件专属事件不少于 7 条，且都带条件', () => {
    expect(CONDITIONAL_EVENTS.length).toBeGreaterThanOrEqual(7);
    for (const e of CONDITIONAL_EVENTS) {
      expect(e.layer).toBe('conditional');
      expect(e.conditions).toBeDefined();
      expect(Object.keys(e.conditions ?? {}).length).toBeGreaterThan(0);
    }
  });

  it('2026 年以后的内容必须标注“推演”', () => {
    const future = ALL_EVENTS.filter((e) => yearOf(e) >= 2026);
    expect(future.length).toBeGreaterThan(0);
    for (const e of future) {
      const text = `${e.title}${e.body}${Object.values(e.variants ?? {}).join('')}`;
      expect(text).toContain('推演');
    }
  });

  it('禁用的表述不出现（价值判断与血腥描写）', () => {
    const banned = ['把一手好牌', '活该', '失败者', '一败涂地', '血', '尸体'];
    for (const e of ALL_EVENTS) {
      const text = `${e.title}${e.body}${Object.values(e.variants ?? {}).join('')}${e.choices.map((c) => c.outcome).join('')}`;
      for (const word of banned) expect(text).not.toContain(word);
    }
  });
});
