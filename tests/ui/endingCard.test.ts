import { describe, expect, it } from 'vitest';
import { CONTINUE_CHOICE_ID, Game, type GameSnapshot } from '../../src/engine/game';
import { buildCardData, buildPlainText, deathLines } from '../../src/ui/lib/endingCard';

function finishLife(seed = 2026): GameSnapshot {
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

describe('死亡时刻文案', () => {
  it('第一行是生卒年', () => {
    const snapshot = finishLife();
    expect(deathLines(snapshot)[0]).toMatch(/^\d{4}—\d{4}$/);
  });

  it('说出活了多少天', () => {
    const snapshot = finishLife();
    const all = deathLines(snapshot).join('\n');
    expect(all).toContain('天');
    expect(all).toContain(String(snapshot.death!.daysLived));
  });

  it('提到留下的人', () => {
    const snapshot = finishLife();
    expect(deathLines(snapshot).join('\n')).toContain('留下');
  });
});

describe('结局卡文本版', () => {
  it('含开局三件套、主标题、称号与数据带', () => {
    const snapshot = finishLife();
    const data = buildCardData(snapshot)!;
    const text = buildPlainText(data);

    expect(text).toContain(String(snapshot.birth.year));
    expect(text).toContain(snapshot.birth.province);
    expect(text).toContain(data.ending.headline);
    expect(text).toContain(data.ending.title.name);
    expect(text).toContain('享年');
    expect(text).toContain('最幸福的一年');
  });

  it('页脚钩子文案按出生年动态生成', () => {
    const snapshot = finishLife();
    const data = buildCardData(snapshot)!;
    const text = buildPlainText(data);
    expect(text).toContain('生逢其时');
    expect(text).toMatch(new RegExp(`${snapshot.birth.year - 1}|${snapshot.birth.year + 1}`));
  });
});
