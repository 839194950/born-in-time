import { describe, expect, it } from 'vitest';
import { CONTINUE_CHOICE_ID, Game } from '../../src/engine/game';
import type { Birth } from '../../src/engine/types';

/**
 * 出生月份的公平性。
 *
 * `judgeWindow` 把事件时点固定取年中（6 月），于是 12 月出生的人在整个
 * 窗口下界那一年还没过生日，被系统性地判成"差几个月"。实测（3 年带宽时）
 * 12 月出生的人 nearMiss 占 19.0%，1 月出生 14.3%——差 4.7 个百分点。
 *
 * 带宽收到 2 年之后差距应该收敛。这里锁住"不超过 3pp"，防止以后调参把它放大。
 */

const base: Birth = {
  year: 1985,
  month: 6,
  province: '河南',
  urban: false,
  gender: 'male',
  name: '王建国',
  fatherJob: 'farmer',
  motherJob: 'farmer',
  tier: 'normal',
  siblings: 1,
  urbanizationRate: 0.24,
  cohortLifeExpectancy: 67,
};

function nearMissShare(month: number, rounds: number): number {
  let near = 0;
  let total = 0;
  for (let seed = 1; seed <= rounds; seed++) {
    const game = new Game({ seed: seed * 104729, birth: { ...base, month } });
    game.start();
    let guard = 0;
    while (game.snapshot.phase !== 'dead' && guard++ < 400) {
      const snap = game.snapshot;
      if (snap.phase === 'awaitingChoice') {
        const pick = snap.pendingEvent!.choices.find((c) => c.state === 'available');
        game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else {
        game.tick();
      }
    }
    for (const entry of game.snapshot.ledger) {
      total += 1;
      if (entry.verdict === 'nearMiss') near += 1;
    }
  }
  return total === 0 ? 0 : near / total;
}

describe('出生月份对“差一年”的影响', () => {
  it('1 月 / 6 月 / 12 月出生的 nearMiss 占比极差不超过 3pp', () => {
    const jan = nearMissShare(1, 120);
    const jun = nearMissShare(6, 120);
    const dec = nearMissShare(12, 120);
    const spread = Math.max(jan, jun, dec) - Math.min(jan, jun, dec);
    // eslint-disable-next-line no-console
    console.log(`1月 ${(jan * 100).toFixed(1)}% / 6月 ${(jun * 100).toFixed(1)}% / 12月 ${(dec * 100).toFixed(1)}% · 极差 ${(spread * 100).toFixed(1)}pp`);
    expect(spread).toBeLessThanOrEqual(0.03);
  });
});
