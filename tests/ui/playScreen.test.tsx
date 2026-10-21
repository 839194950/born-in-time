import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/game';
import { PlayScreenView } from '../../src/ui/screens/PlayScreen';

const noop = () => {};

function makeSnapshot(seed = 2026) {
  const g = new Game({ seed });
  g.start();
  for (let i = 0; i < 5; i++) {
    if (g.snapshot.phase === 'awaitingChoice') break;
    g.tick();
  }
  return g.snapshot;
}

const actions = { tick: noop, resolve: noop, setFocus: noop, advanceToDecision: noop };

describe('主循环屏', () => {
  it('五条数值全部可见', () => {
    const html = renderToString(<PlayScreenView snapshot={makeSnapshot()} actions={actions} />);
    for (const label of ['健康', '能力', '财富', '亲情', '幸福']) expect(html).toContain(label);
  });

  it('显示年份、年龄与出生信息', () => {
    const snapshot = makeSnapshot();
    const html = renderToString(<PlayScreenView snapshot={snapshot} actions={actions} />);
    expect(html).toContain(String(snapshot.year));
    expect(html).toContain(`${snapshot.age} 岁`);
    expect(html).toContain(snapshot.birth.name);
  });

  it('控制条含暂停、五档倍速、快进、自动抉择', () => {
    const html = renderToString(<PlayScreenView snapshot={makeSnapshot()} actions={actions} />);
    expect(html).toContain('暂停');
    for (const s of ['1×', '2×', '4×', '8×', '16×']) expect(html).toContain(s);
    expect(html).toContain('快进到下一个抉择');
    expect(html).toContain('自动抉择');
  });

  it('年度重心按钮带数值预览', () => {
    const snapshot = makeSnapshot();
    const html = renderToString(<PlayScreenView snapshot={snapshot} actions={actions} />);
    if (snapshot.focusOptions.length > 0) {
      expect(html).toContain('今年的重心');
      expect(html).toContain(snapshot.focusOptions[0]!.label);
    }
  });
});
