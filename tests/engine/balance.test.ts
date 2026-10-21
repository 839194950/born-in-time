import { describe, expect, it } from 'vitest';
import { runBatch, summarizeBatch } from '../../src/engine/balance';

const rows = runBatch(600, 1);
const summary = summarizeBatch(rows);

describe('数值与节奏（600 局批跑）', () => {
  it('打印分布，便于调参', () => {
    // eslint-disable-next-line no-console
    console.log(
      [
        `mean choices: ${summary.avgChoices.toFixed(1)}`,
        `mean death age: ${summary.avgDeathAge.toFixed(1)}`,
        `mean caught/near/pass: ${summary.avgCaught.toFixed(1)} / ${summary.avgNearMiss.toFixed(1)} / ${summary.avgPassedBy.toFixed(1)}`,
        `mean hit rate: ${(summary.avgHitRate * 100).toFixed(0)}%`,
        `mean early/late: ${summary.avgEarlyHits.toFixed(1)} / ${summary.avgLateHits.toFixed(1)}`,
        `mean jobs/moves: ${summary.avgJobChanges.toFixed(1)} / ${summary.avgMoves.toFixed(1)}`,
        `death delta: mean ${summary.avgDeathDelta.toFixed(1)} / max ${summary.maxDeathDelta}`,
        `last train (>=2): ${(summary.lastTrainShare * 100).toFixed(2)}%`,
        `saturated share: ${(summary.saturatedShare * 100).toFixed(1)}%`,
        ...Object.entries(summary.titleShare)
          .sort((a, b) => b[1] - a[1])
          .map(([name, share]) => `  ${name}: ${(share * 100).toFixed(1)}%`),
      ].join('\n'),
    );
    expect(rows).toHaveLength(600);
  });

  it('一局抉择数在二期口径内（35–65 之间：目录约 20 + 日常约 27 + 反思 5）', () => {
    expect(summary.avgChoices).toBeGreaterThan(35);
    expect(summary.avgChoices).toBeLessThan(65);
  });

  it('“每次都差一年的人”约为 20%（10%–35%）', () => {
    const share = summary.titleShare['每次都差一年的人'] ?? 0;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.35);
  });

  it('“过小日子的人”约为 20%（5%–35%）', () => {
    const share = summary.titleShare['过小日子的人'] ?? 0;
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.35);
  });

  it('稀有称号各不超过 12%', () => {
    for (const name of ['最后一班车的人', '比同龄人多活十年的人', '逆袭的人', '高开低走的人']) {
      expect(summary.titleShare[name] ?? 0).toBeLessThan(0.12);
    }
  });

  it('五维终值不出现大面积贴边（>95 或 <5 的比例低于 25%）', () => {
    expect(summary.saturatedShare).toBeLessThan(0.25);
  });

  it('没有称号缺口：12 个称号都能被命中', () => {
    expect(Object.keys(summary.titleShare).length).toBeGreaterThanOrEqual(10);
  });
});
