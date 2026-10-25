import { describe, expect, it } from 'vitest';
import { CONTINUE_CHOICE_ID, Game } from '../../src/engine/game';
import { createRng } from '../../src/engine/rng';
import { restoreGame, serializeGame } from '../../src/engine/save';

/**
 * 存档 = 种子 + 事实流水，恢复靠重放。
 *
 * 这里锁的是一条曾经断掉的链：`focusId` 被写进存档，但重放时从来没用过，
 * 于是玩家只要选过非默认重心，重放出来的五维就和存档对不上，被判定
 * "存档不可信"并**删掉整局**。旧测试没抓到，因为重放用例全程没调 setFocus。
 */

function playWithFocusSwitching(seed: number, steps: number): { game: Game; switches: number } {
  const game = new Game({ seed });
  game.start();
  const rng = createRng((seed ^ 0x5f3759df) >>> 0);
  let switches = 0;

  for (let i = 0; i < steps; i++) {
    const snap = game.snapshot;
    if (snap.phase === 'dead') break;
    if (snap.phase === 'awaitingChoice') {
      const pick = snap.pendingEvent!.choices.find((c) => c.state === 'available');
      game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      continue;
    }
    if (snap.focusOptions.length > 0 && rng.chance(0.3)) {
      const option = snap.focusOptions[rng.int(0, snap.focusOptions.length - 1)]!;
      if (option.id !== snap.focusId) {
        game.setFocus(option.id);
        switches += 1;
      }
    }
    game.tick();
    // 把当年的弹窗当场清空，让存档点落在干净的 playing 上。
    // 「存档停在弹窗上」是另一条边界，由下面的专门用例覆盖。
    let guard = 0;
    while (game.snapshot.phase === 'awaitingChoice' && guard++ < 5) {
      const pick = game.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
      game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    }
  }
  return { game, switches };
}

describe('存档重放：年度重心', () => {
  it('随机切换重心后，恢复出来的年份 / 重心 / 五维 / 账本完全一致', () => {
    let checked = 0;
    let switched = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { game, switches } = playWithFocusSwitching(seed * 7919, 60);
      if (game.snapshot.phase === 'dead') continue;
      // 存档前把未决弹窗解决掉：这一条测的是"重心"，弹窗边界另有专门用例
      if (game.snapshot.phase === 'awaitingChoice') {
        const pick = game.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
        game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      }
      switched += switches;

      const restored = restoreGame(serializeGame(game));
      expect(restored.snapshot.year).toBe(game.snapshot.year);
      expect(restored.snapshot.focusId).toBe(game.snapshot.focusId);
      expect(restored.snapshot.stats).toEqual(game.snapshot.stats);
      expect(restored.snapshot.ledger).toEqual(game.snapshot.ledger);
      expect(restored.snapshot.timeline).toEqual(game.snapshot.timeline);
      checked += 1;
    }
    // 用例必须真的覆盖到"切换过重心"这件事，否则等于没测
    expect(checked).toBeGreaterThan(20);
    expect(switched).toBeGreaterThan(50);
  });

  it('同一年内反复切换，只保留最后一次（记录的是生效年份）', () => {
    const game = new Game({ seed: 5 });
    game.start();
    // 幼儿期只有 hold / early_learn 两项
    game.setFocus('early_learn');
    game.setFocus('hold');
    game.setFocus('early_learn');

    const log = game.focusLogReadonly;
    expect(log).toHaveLength(1);
    // 生效年份是"下一年"：tick 先 year += 1 再结算
    expect(log[0]).toEqual({ year: game.snapshot.year + 1, focusId: 'early_learn' });
  });

  it('切换到默认项本身不会产生多余记录', () => {
    const game = new Game({ seed: 5 });
    game.start();
    const before = game.snapshot.focusId;
    game.setFocus(before);
    expect(game.focusLogReadonly).toHaveLength(0);
  });

  it('在切换重心的当年立刻存档，也能恢复', () => {
    const game = new Game({ seed: 11 });
    game.start();
    let guard = 0;
    while (game.snapshot.year < game.snapshot.birth.year + 8 && guard++ < 40) {
      if (game.snapshot.phase === 'awaitingChoice') {
        const pick = game.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
        game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
      } else {
        game.tick();
      }
    }
    const target = game.snapshot.focusOptions[game.snapshot.focusOptions.length - 1]!;
    game.setFocus(target.id);

    const restored = restoreGame(serializeGame(game));
    expect(restored.snapshot.focusId).toBe(target.id);
    expect(restored.snapshot.stats).toEqual(game.snapshot.stats);
  });

  it('停在抉择弹窗、且当年换过重心，恢复后仍停在同一事件', () => {
    const game = new Game({ seed: 33 });
    game.start();
    let guard = 0;
    while (game.snapshot.phase !== 'awaitingChoice' && guard++ < 100) {
      if (game.snapshot.focusOptions.length > 0) {
        game.setFocus(game.snapshot.focusOptions[game.snapshot.focusOptions.length - 1]!.id);
      }
      game.tick();
    }
    const pendingId = game.snapshot.pendingEvent!.event.id;
    const focusId = game.snapshot.focusId;

    const restored = restoreGame(serializeGame(game));
    expect(restored.snapshot.phase).toBe('awaitingChoice');
    expect(restored.snapshot.pendingEvent!.event.id).toBe(pendingId);
    expect(restored.snapshot.focusId).toBe(focusId);
    expect(restored.snapshot.stats).toEqual(game.snapshot.stats);
  });
});
