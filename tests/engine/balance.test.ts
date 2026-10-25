import { describe, expect, it } from 'vitest';
import { runBatch, summarizeBatch } from '../../src/engine/balance';
import { TITLES } from '../../src/data/titles';

/**
 * 这两条断言的口径一律从规格推导，不从当前实现反抄。
 * v1 这里写的是「抉择 35–65」「称号 >= 10 种」——正好把要修的东西锁在门外，
 * 是最典型的"按实现标定断言"。
 */
const rows = runBatch(600, 1);
const summary = summarizeBatch(rows);
const healthRows = runBatch(300, 1, 'health');
const healthSummary = summarizeBatch(healthRows);
const randomRows = runBatch(600, 1, 'random');
const randomSummary = summarizeBatch(randomRows);
const allSummaries = [summary, healthSummary, randomSummary];
const shareAcross = (name: string): number =>
  Math.max(...allSummaries.map((s) => s.titleShare[name] ?? 0));

const q = (xs: number[], p: number): number =>
  [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]!;
const share = (xs: number[], pred: (x: number) => boolean): number => xs.filter(pred).length / xs.length;

describe('数值与节奏（600 局批跑 · 规格 §7.5 / §4 / §8.3 / §11）', () => {
  it('打印分布，便于调参', () => {
    // eslint-disable-next-line no-console
    console.log(
      [
        `mean choices: ${summary.avgChoices.toFixed(1)} (P50 ${q(rows.map((r) => r.choices), 0.5)})`,
        `mean death age: ${summary.avgDeathAge.toFixed(1)}`,
        `mean caught/near/pass: ${summary.avgCaught.toFixed(1)} / ${summary.avgNearMiss.toFixed(1)} / ${summary.avgPassedBy.toFixed(1)}`,
        `death delta: mean ${summary.avgDeathDelta.toFixed(2)} / max ${summary.maxDeathDelta.toFixed(1)}`,
        ...[...new Set([...Object.keys(summary.titleShare), ...Object.keys(healthSummary.titleShare)])]
          .map((name) => `  ${name}: first ${((summary.titleShare[name] ?? 0) * 100).toFixed(1)}% / health ${((healthSummary.titleShare[name] ?? 0) * 100).toFixed(1)}%`),
      ].join('\n'),
    );
    expect(rows).toHaveLength(600);
  });

  /**
   * 规格原文是"一局约 20 个抉择（16–28）"。
   *
   * 2026-10-25 内容扩充（童年 13 条 + 晚年 6 条 + 分层通道）之后实测 28.3，
   * 上界按**事先定好的方案**改到 32——这不是"跑红了就调断言"：
   * `内容扩充规划.md` 的验收标准写的就是"抉择 30–32"，`改动说明-第三轮.md`
   * 也记了这次 re-baseline 的理由（童年和晚年原本各是 0 条，补上必然涨）。
   * 下界 16 没动；P90 的上界按"均值上限 + 6"的同一余量从 34 放到 38
   * （改动前是 28 + 6 = 34），这样它量的仍然是"长尾有没有失控"，而不是一个
   * 跟着均值走的死数字。实测 P90 = 35。
   */
  it('节奏：一局约 24 个抉择（16–32；上界按 2026-10-25 内容扩充方案上调）', () => {
    expect(summary.avgChoices).toBeGreaterThanOrEqual(16);
    expect(summary.avgChoices).toBeLessThanOrEqual(32);
    expect(q(rows.map((r) => r.choices), 0.9)).toBeLessThanOrEqual(38);
  });

  it('五维不出现长期贴边（分维看，不许五维合并稀释）', () => {
    for (const key of ['health', 'ability', 'wealth', 'family', 'happiness'] as const) {
      const values = rows.map((r) => r.finalStats[key]);
      expect(share(values, (v) => v >= 95)).toBeLessThanOrEqual(0.1);
      expect(share(values, (v) => v <= 5)).toBeLessThanOrEqual(0.1);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(mean).toBeGreaterThanOrEqual(30);
      expect(mean).toBeLessThanOrEqual(80);
    }
  });

  it('寿命：均值不系统性偏低，且上尾存在（规格 §4.1）', () => {
    expect(summary.avgDeathDelta).toBeGreaterThanOrEqual(-2);
    expect(summary.avgDeathDelta).toBeLessThanOrEqual(2);
    // 上界必须够到「多活十年」的阈值之上，否则那条断言与规格永不交集
    expect(healthSummary.maxDeathDelta).toBeGreaterThanOrEqual(10.5);
  });

  it('12 个称号都能被命中（三种玩家策略合并看）', () => {
    const hit = new Set([
      ...Object.keys(summary.titleShare),
      ...Object.keys(healthSummary.titleShare),
      ...Object.keys(randomSummary.titleShare),
    ]);
    expect(hit.size).toBe(12);
  });

  /**
   * 口径从「稀有度」推导，不按名字硬编码百分比。
   *
   * v2 这里写的是：`每次都差一年的人` 属于"主力称号"，10%–32%。
   * 而它在 titles.ts 里的 rarity 是 12（最稀有）——断言把 bug 锁成了期望值，
   * 于是「最稀有的判词是最常见的一个」这件事，CI 一直是绿的。
   */
  it('称号命中率随稀有度单调：越稀有越少见', () => {
    // 稀有度 9 以上：任何一条策略下都不该超过 12%
    for (const title of TITLES.filter((t) => t.rarity >= 9)) {
      expect(shareAcross(title.name), title.name).toBeLessThanOrEqual(0.12);
    }
    // 兜底称号必须是常见的一档
    expect(shareAcross('被时代推着走的人')).toBeGreaterThanOrEqual(0.05);
  });

  it('「每次都差一年的人」是判词，不是大路货（带宽 2 年后应 <10%）', () => {
    expect(summary.titleShare['每次都差一年的人'] ?? 0).toBeLessThanOrEqual(0.1);
    // 但也不能消失：仍有相当比例的局会遇到至少一次"差一年"
    expect(summary.avgNearMiss).toBeGreaterThanOrEqual(1.2);
  });

  it('长寿是"可经营的 build"：健康优先的玩家确实活得更久', () => {
    expect(healthSummary.avgDeathDelta).toBeGreaterThan(summary.avgDeathDelta + 3);
    expect(healthSummary.titleShare['比同龄人多活十年的人'] ?? 0).toBeGreaterThan(0.02);
  });
});
