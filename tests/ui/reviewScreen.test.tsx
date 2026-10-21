import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONTINUE_CHOICE_ID, Game } from '../../src/engine/game';
import { buildCardData } from '../../src/ui/lib/endingCard';
import { ReviewScreen, axisPairs } from '../../src/ui/screens/ReviewScreen';
import type { AxisKey } from '../../src/engine/types';

function finishLife(seed = 2026) {
  const g = new Game({ seed });
  g.start();
  let guard = 0;
  while (g.snapshot.phase !== 'dead' && guard++ < 200) {
    if (g.snapshot.phase === 'awaitingChoice') {
      const pick = g.snapshot.pendingEvent!.choices.find((c) => c.state === 'available');
      g.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    } else {
      g.tick();
    }
  }
  return g.snapshot;
}

describe('四轴换算', () => {
  it('两边都是 0 时居中', () => {
    const zero = Object.fromEntries(
      ['companion', 'work', 'root', 'wind', 'calm', 'wave', 'now', 'future'].map((k) => [k, 0]),
    ) as Record<AxisKey, number>;
    for (const pair of axisPairs(zero)) expect(pair.leftPct).toBe(50);
  });

  it('偏重哪边就往哪边靠', () => {
    const axes = {
      companion: 9,
      work: 1,
      root: 0,
      wind: 0,
      calm: 0,
      wave: 0,
      now: 0,
      future: 0,
    } as Record<AxisKey, number>;
    const [first] = axisPairs(axes);
    expect(first!.leftPct).toBeCloseTo(90, 5);
  });
});

describe('复盘页', () => {
  it('该有的区块都在', () => {
    const snapshot = finishLife();
    const data = buildCardData(snapshot)!;
    const html = renderToString(<ReviewScreen snapshot={snapshot} data={data} onRestart={() => {}} />);
    for (const label of ['窗口账本', '终局五维', '人生纹理', '最幸福的一年', '留一句话', '再抽一年']) {
      expect(html).toContain(label);
    }
  });

  it('账本逐条列出并可区分判定', () => {
    const snapshot = finishLife();
    const data = buildCardData(snapshot)!;
    const html = renderToString(<ReviewScreen snapshot={snapshot} data={data} onRestart={() => {}} />);
    for (const e of snapshot.ledger.slice(0, 5)) expect(html).toContain(e.title);
    if (snapshot.ledger.some((e) => e.verdict === 'nearMiss')) expect(html).toContain('差一年');
  });
});
