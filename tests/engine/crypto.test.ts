import { describe, expect, it } from 'vitest';
import { rollBirth } from '../../src/engine/birth';
import { CONTINUE_CHOICE_ID, Game } from '../../src/engine/game';
import { createRng } from '../../src/engine/rng';
import type { Birth, EventDef } from '../../src/engine/types';

const birth: Birth = { ...rollBirth(createRng(5)), year: 1985, month: 6, urban: true };

const buy: EventDef = {
  id: 'test_btc_buy',
  layer: 'era',
  trigger: { type: 'year', year: 2013 },
  windowAge: [18, 45],
  title: '比特币',
  body: '听说',
  ledgerWeight: 1,
  source: '测试',
  choices: [
    { id: 'buy', label: '买一点', effects: { wealth: -3 }, outcome: '买了', setFlags: ['holds_btc'] },
    { id: 'pass', label: '不碰', effects: {}, outcome: '没买', default: true },
  ],
};

const crisis: EventDef = {
  id: 'test_btc_crisis',
  layer: 'conditional',
  trigger: { type: 'year', year: 2019 },
  windowAge: [0, 99],
  conditions: { flags: ['holds_btc'] },
  title: '母亲住院',
  body: '要用钱',
  ledgerWeight: 1,
  source: '测试',
  choices: [
    { id: 'sell', label: '全卖了', effects: { family: 5 }, outcome: '卖了', clearFlags: ['holds_btc'] },
    { id: 'hold', label: '不卖', effects: { wealth: -6 }, outcome: '扛着' },
  ],
};

const peak: EventDef = {
  id: 'test_btc_peak',
  layer: 'conditional',
  trigger: { type: 'year', year: 2020 },
  windowAge: [0, 99],
  conditions: { flags: ['holds_btc'] },
  title: '涨疯了',
  body: '两万九',
  ledgerWeight: 1,
  source: '测试',
  choices: [{ id: 'cash', label: '全卖掉', effects: { wealth: 20 }, outcome: '落袋', clearFlags: ['holds_btc'] }],
};

/** 推进到指定年份，遇到抉择就交给 decide 处理 */
function runToYear(game: Game, year: number, decide: (eventId: string) => string | null): void {
  let guard = 0;
  while (game.snapshot.year < year && guard++ < 200) {
    if (game.snapshot.phase === 'awaitingChoice') {
      const eventId = game.snapshot.pendingEvent!.event.id;
      game.resolve(decide(eventId) ?? CONTINUE_CHOICE_ID);
    } else {
      game.tick();
    }
    if (game.snapshot.phase === 'dead') return;
  }
}

function playTo2021(pick: (eventId: string) => string | null): Game {
  const game = new Game({ seed: 1, birth, catalog: [buy, crisis, peak] });
  game.start();
  runToYear(game, 2021, pick);
  return game;
}

describe('比特币事件链（蝴蝶效应）', () => {
  it('买了才会遇到后续事件', () => {
    const game = new Game({ seed: 1, birth, catalog: [buy, crisis, peak] });
    game.start();
    runToYear(game, 2013, () => null);
    expect(game.snapshot.pendingEvent!.event.id).toBe('test_btc_buy');
    game.resolve('buy');
    expect(game.snapshot.flags).toContain('holds_btc');

    runToYear(game, 2019, () => null);
    expect(game.snapshot.pendingEvent!.event.id).toBe('test_btc_crisis');
  });

  it('没买的人一辈子都不会遇到', () => {
    const game = playTo2021((id) => (id === 'test_btc_buy' ? 'pass' : null));
    expect(game.snapshot.ledger.some((e) => e.eventId === 'test_btc_crisis')).toBe(false);
    expect(game.snapshot.ledger.some((e) => e.eventId === 'test_btc_peak')).toBe(false);
  });

  it('在变故那一年卖掉，就错过了后面的暴富', () => {
    const sold = playTo2021((id) => {
      if (id === 'test_btc_buy') return 'buy';
      if (id === 'test_btc_crisis') return 'sell';
      return null;
    });
    expect(sold.snapshot.flags).not.toContain('holds_btc');
    expect(sold.snapshot.timeline.some((t) => t.text.includes('涨疯了'))).toBe(false);
  });

  it('扛过变故的人，第二年撞上涨疯的那一波', () => {
    const held = playTo2021((id) => {
      if (id === 'test_btc_buy') return 'buy';
      if (id === 'test_btc_crisis') return 'hold';
      if (id === 'test_btc_peak') return 'cash';
      return null;
    });
    expect(held.snapshot.timeline.some((t) => t.text.includes('涨疯了'))).toBe(true);
    expect(held.snapshot.timeline.some((t) => t.text.includes('母亲住院'))).toBe(true);
  });

  it('两条路线的财富差得出来', () => {
    const sold = playTo2021((id) => {
      if (id === 'test_btc_buy') return 'buy';
      if (id === 'test_btc_crisis') return 'sell';
      return null;
    });
    const held = playTo2021((id) => {
      if (id === 'test_btc_buy') return 'buy';
      if (id === 'test_btc_crisis') return 'hold';
      if (id === 'test_btc_peak') return 'cash';
      return null;
    });
    expect(held.snapshot.stats.wealth).toBeGreaterThan(sold.snapshot.stats.wealth + 10);
  });
});
