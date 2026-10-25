import { describe, expect, it } from 'vitest';
import { ALL_EVENTS, CHILDHOOD_EVENTS, LATE_EVENTS } from '../../src/data/events';
import { CONTINUE_CHOICE_ID, Game } from '../../src/engine/game';
import { validateCatalog } from '../../src/engine/catalog';
import type { Birth, EventDef } from '../../src/engine/types';

/**
 * 内容分布的回归网。
 *
 * 2026-10-25 复查时发现的问题不是"事件少"，而是"分布错了"：
 * 1988 年以后出生的人 0–17 岁没有任何时代抉择，60 岁以后全批次 0 条，
 * 1965 年生的人 33→57 岁有 24 年空档。这一组断言把三条指标锁住，
 * 免得以后加内容时又把某一段人生挖空。
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

/** 会弹窗的时代事件（含条件层里按年份触发的） */
const eraModals = ALL_EVENTS.filter(
  (e) =>
    e.broadcast !== true &&
    e.priority !== undefined ? (e.priority ?? 3) >= 3 : (e.priority ?? 3) >= 3,
).filter(
  (e) => e.trigger.type === 'year' && (e.layer === 'era' || e.layer === 'conditional'),
);

function hitsInBand(birthYear: number, from: number, to: number): number {
  let n = 0;
  for (const e of eraModals) {
    const year = (e.trigger as { type: 'year'; year: number }).year;
    const age = year - birthYear;
    if (age >= from && age <= to && age >= e.windowAge[0] && age <= e.windowAge[1]) n += 1;
  }
  return n;
}

describe('内容分布', () => {
  it('童年（0–17 岁）：每个出生年份至少 3 条时代抉择', () => {
    const bad: string[] = [];
    for (let by = 1958; by <= 2005; by++) {
      const n = hitsInBand(by, 0, 17);
      if (n < 3) bad.push(`${by} 年生只有 ${n} 条`);
    }
    expect(bad, bad.join('；')).toEqual([]);
  });

  it('童年：1981–2005 这批人（曾经 0 条）现在至少 3 条', () => {
    for (let by = 1981; by <= 2005; by++) {
      expect(hitsInBand(by, 0, 17), `${by} 年生`).toBeGreaterThanOrEqual(3);
    }
  });

  it('晚年（60–80 岁）：1958–1975 出生的人平均不少于 2 条', () => {
    const counts: number[] = [];
    for (let by = 1958; by <= 1975; by++) counts.push(hitsInBand(by, 60, 80));
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(avg).toBeGreaterThanOrEqual(2);
    // 不能有整段完全空掉的出生年份
    expect(counts.filter((n) => n === 0), `空白的生年：${counts.join(',')}`).toEqual([]);
  });

  it('任何出生年份，有时代抉择的年龄之间不超过 8 年空档', () => {
    const worst: string[] = [];
    for (let by = 1958; by <= 2005; by++) {
      const ages = new Set<number>();
      for (const e of eraModals) {
        const year = (e.trigger as { type: 'year'; year: number }).year;
        const age = year - by;
        if (age < 0 || age > 66) continue;
        if (age >= e.windowAge[0] && age <= e.windowAge[1]) ages.add(age);
      }
      const sorted = [...ages].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i]! - sorted[i - 1]!;
        if (gap > 8) worst.push(`${by} 年生 ${sorted[i - 1]!}→${sorted[i]!} 岁（${gap} 年）`);
      }
    }
    expect(worst, worst.join('；')).toEqual([]);
  });

  it('新增内容通过目录守门校验（id 唯一、有出处、有选项、窗口合法）', () => {
    expect(() => validateCatalog(ALL_EVENTS)).not.toThrow();
  });

  it('1980–2010 每一年都有内容（抉择或播报）', () => {
    // 2026-10-25 补播报之前，这段有 10 个年份是彻底空的。
    // 现在只剩 1958–1979 里 8 个年份还是空的（1962/1964/1965/1967/1969/1971/1972/1978）——
    // 那是文革后期，内容刻意从简，不在这条断言的范围内。
    const years = new Set<number>();
    for (const e of ALL_EVENTS) if (e.trigger.type === 'year') years.add(e.trigger.year);
    const empty: number[] = [];
    for (let y = 1980; y <= 2010; y++) if (!years.has(y)) empty.push(y);
    expect(empty, `空年份：${empty.join(', ')}`).toEqual([]);
  });
});

describe('生活切面不进账本', () => {
  const makeEra = (id: string, weight: number): EventDef => ({
    id,
    layer: 'era',
    trigger: { type: 'year', year: 1981 },
    windowAge: [1, 1],
    title: `测试-${id}`,
    body: '测试正文',
    ledgerWeight: weight,
    source: '测试用事件',
    choices: [
      { id: 'a', label: 'A', effects: { happiness: 1 }, outcome: '结果 A', default: true },
      { id: 'b', label: 'B', effects: { health: -1 }, outcome: '结果 B' },
    ],
  });

  function runOne(catalog: EventDef[]): Game {
    const g = new Game({ seed: 3, birth: base, catalog, dailyEvents: [], reflections: false });
    g.start();
    g.tick();
    const pick = g.snapshot.pendingEvent?.choices.find((c) => c.state === 'available');
    g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    return g;
  }

  it('ledgerWeight 为 0 的时代事件不会污染账本与称号判据', () => {
    // 童年/晚年的 19 条都是 0。要是记进去，hitRate 和 earlyHits 会被顶起来，
    // 「少年得志」「赶上每一次浪潮」直接失衡（实测 caught 从 7.2 跳到 9.3）。
    const quiet = runOne([makeEra('test_quiet', 0)]);
    expect(quiet.snapshot.ledger).toHaveLength(0);

    const loud = runOne([makeEra('test_loud', 3)]);
    expect(loud.snapshot.ledger).toHaveLength(1);
    expect(loud.snapshot.ledger[0]!.verdict).toBe('caught');
  });

  it('新增的 32 条生活切面全部是 ledgerWeight 0', () => {
    for (const e of [...CHILDHOOD_EVENTS, ...LATE_EVENTS]) {
      expect(e.ledgerWeight, e.id).toBe(0);
    }
  });
});

describe('两条抉择通道', () => {
  const stageEv: EventDef = {
    id: 'test_life_node',
    layer: 'stage',
    trigger: { type: 'age', age: 1 },
    windowAge: [1, 1],
    title: '人生节点',
    body: '测试正文',
    ledgerWeight: 2,
    source: '测试用事件',
    choices: [{ id: 'a', label: 'A', outcome: '结果 A', default: true }],
  };

  const eraEv: EventDef = {
    id: 'test_era_wave',
    layer: 'era',
    trigger: { type: 'year', year: 1981 },
    windowAge: [1, 1],
    title: '时代事件',
    body: '测试正文',
    ledgerWeight: 5,
    source: '测试用事件',
    choices: [{ id: 'a', label: 'A', outcome: '结果 A', default: true }],
  };

  it('同一年两者都到期时，先弹人生节点（哪怕时代事件权重更高）', () => {
    // 目录顺序故意把时代事件放前面，验证排序不受输入顺序影响。
    const g = new Game({
      seed: 5,
      birth: base,
      catalog: [eraEv, stageEv],
      dailyEvents: [],
      reflections: false,
    });
    g.start();
    g.tick();
    expect(g.snapshot.pendingEvent!.event.id).toBe('test_life_node');

    g.resolve('a');
    // 时代事件顺延到这次抉择之后，不丢
    expect(g.snapshot.pendingEvent!.event.id).toBe('test_era_wave');
  });
});
