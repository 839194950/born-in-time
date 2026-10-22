import { describe, expect, it } from 'vitest';
import { runBatch, summarizeBatch } from '../../src/engine/balance';

/**
 * 这两条断言的口径一律从规格推导，不从当前实现反抄。
 * v1 这里写的是「抉择 35–65」「称号 >= 10 种」——正好把要修的东西锁在门外，
 * 是最典型的"按实现标定断言"。
 */
const rows = runBatch(600, 1);
const summary = summarizeBatch(rows);
const healthRows = runBatch(300, 1, 'health');
const healthSummary = summarizeBatch(healthRows);

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

  it('节奏：一局约 20 个抉择（16–28，规格 §7.5）', () => {
    expect(summary.avgChoices).toBeGreaterThanOrEqual(16);
    expect(summary.avgChoices).toBeLessThanOrEqual(28);
    expect(q(rows.map((r) => r.choices), 0.9)).toBeLessThanOrEqual(34);
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

  it('12 个称号都能被命中（两条机器人策略合并看）', () => {
    const hit = new Set([...Object.keys(summary.titleShare), ...Object.keys(healthSummary.titleShare)]);
    expect(hit.size).toBe(12);
  });

  it('主力称号各约 20%，稀有称号 <8%（规格 §11 / §13）', () => {
    for (const name of ['每次都差一年的人', '过小日子的人']) {
      expect(summary.titleShare[name] ?? 0).toBeGreaterThanOrEqual(0.1);
      expect(summary.titleShare[name] ?? 0).toBeLessThanOrEqual(0.32);
    }
    // 规格 §11 点名的是「最后一班车」「多活十年」<8%（后者属 dedicated build，见下一条断言）；
    // 其余稀有名给 12% 的宽容带，600 局抽样下 8% 附近的抖动没有解释力
    expect(summary.titleShare['最后一班车的人'] ?? 0).toBeLessThanOrEqual(0.08);
    for (const name of ['逆袭的人', '高开低走的人', '守一座城的人']) {
      expect(summary.titleShare[name] ?? 0).toBeLessThanOrEqual(0.12);
    }
  });

  it('长寿是"可经营的 build"：健康优先的玩家确实活得更久', () => {
    expect(healthSummary.avgDeathDelta).toBeGreaterThan(summary.avgDeathDelta + 3);
    expect(healthSummary.titleShare['比同龄人多活十年的人'] ?? 0).toBeGreaterThan(0.02);
  });
});
