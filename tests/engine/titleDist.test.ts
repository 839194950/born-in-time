import { describe, expect, it } from 'vitest';
import { TITLES } from '../../src/data/titles';
import { CONTINUE_CHOICE_ID, Game } from '../../src/engine/game';
import { evaluateEnding } from '../../src/engine/ending';
import { createRng } from '../../src/engine/rng';

/**
 * 称号分布要用「多种玩家策略」验收，不能只跑极端机器人。
 *
 * 现状的两条机器人是 `first`（永远选第一个）和 `health`（永远养生）——
 * 都是极端值。真实玩家在中间，而称号分布对策略极其敏感：
 * 「守一座城」在 first 下 3%、在随机策略下 24%，只看前者会以为它很稀有。
 *
 * 更要紧的是口径：断言必须从 rarity 推导，不能按名字硬编码百分比。
 * v2 的 balance.test 把「每次都差一年的人」（rarity 12，最稀有）写成了
 * "主力称号 10%–32%"，于是"最稀有的判词成了最常见的一个"这件事，
 * CI 一直是绿的。
 */

const N = 300;

function playRandom(seed: number): string {
  const game = new Game({ seed: seed * 7919 });
  game.start();
  const rng = createRng((seed * 2654435761) >>> 0);
  let guard = 0;
  while (game.snapshot.phase !== 'dead' && guard++ < 400) {
    const snap = game.snapshot;
    if (snap.phase === 'awaitingChoice') {
      const available = snap.pendingEvent!.choices.filter((c) => c.state === 'available');
      const pick = available[rng.int(0, Math.max(0, available.length - 1))];
      game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    } else {
      if (snap.focusOptions.length > 0 && rng.chance(0.15)) {
        game.setFocus(snap.focusOptions[rng.int(0, snap.focusOptions.length - 1)]!.id);
      }
      game.tick();
    }
  }
  return evaluateEnding(game.snapshot).title.name;
}

const shares = (() => {
  const counts = new Map<string, number>();
  for (let seed = 1; seed <= N; seed++) {
    const name = playRandom(seed);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
})();

const shareOf = (name: string): number => (shares.get(name) ?? 0) / N;

describe('称号分布（随机策略 · 300 局）', () => {
  it('稀有度 9 以上的称号都少见（≤12%）', () => {
    for (const title of TITLES.filter((t) => t.rarity >= 9)) {
      expect(shareOf(title.name), `${title.name}（rarity ${title.rarity}）`).toBeLessThanOrEqual(0.12);
    }
  });

  it('「每次都差一年的人」不再是最大路货（≤10%）', () => {
    expect(shareOf('每次都差一年的人')).toBeLessThanOrEqual(0.1);
  });

  it('没有哪个称号吞掉半壁江山（最高 ≤45%）', () => {
    const top = Math.max(...[...shares.values()]);
    expect(top / N).toBeLessThanOrEqual(0.45);
  });

  it('实际命中的称号足够多样（≥8 种）', () => {
    expect(shares.size).toBeGreaterThanOrEqual(8);
  });

  it('兜底称号仍在场（被时代推着走 ≥4%）', () => {
    expect(shareOf('被时代推着走的人')).toBeGreaterThanOrEqual(0.04);
  });
});
