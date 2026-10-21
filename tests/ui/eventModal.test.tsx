import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PendingEvent } from '../../src/engine/game';
import { EventModal } from '../../src/ui/components/EventModal';

const baseEvent = {
  id: 'e',
  layer: 'era' as const,
  trigger: { type: 'year' as const, year: 1999 },
  windowAge: [17, 19] as [number, number],
  title: '高校扩招',
  body: '正文',
  kind: 'event',
  choices: [{ id: 'a', label: '报考本科', outcome: '' }],
  ledgerWeight: 5,
  source: '教育部 1999 年招生计划',
};

const caught: PendingEvent = {
  event: baseEvent,
  judgement: { verdict: 'caught', age: 18, ageMonths: 216, gapMonths: 0 },
  text: '这一年的招生计划多了五十一万人。',
  kind: 'event',
  choices: [
    { id: 'a', label: '报考本科', state: 'available', effectsText: '能力 +6　财富 −2', uncertain: false },
    { id: 'b', label: '报考专科', state: 'locked', reason: '成绩够不上', effectsText: '', uncertain: false },
  ],
};

const nearMiss: PendingEvent = {
  event: { ...baseEvent, title: '房改' },
  judgement: { verdict: 'nearMiss', age: 21, ageMonths: 252, gapMonths: 11 },
  text: '单位分房在这一年走到头。',
  kind: 'event',
  choices: [],
};

describe('事件弹窗', () => {
  it('显示标题、正文与出处', () => {
    const html = renderToString(<EventModal pending={caught} onPick={() => {}} onContinue={() => {}} />);
    expect(html).toContain('高校扩招');
    expect(html).toContain('这一年的招生计划多了五十一万人。');
    expect(html).toContain('教育部 1999 年招生计划');
  });

  it('判定徽标显示赶上/差一年', () => {
    expect(renderToString(<EventModal pending={caught} onPick={() => {}} onContinue={() => {}} />)).toContain('赶上');
    expect(renderToString(<EventModal pending={nearMiss} onPick={() => {}} onContinue={() => {}} />)).toContain('差一年');
  });

  it('选项带数值预览', () => {
    const html = renderToString(<EventModal pending={caught} onPick={() => {}} onContinue={() => {}} />);
    expect(html).toContain('能力 +6');
    expect(html).toContain('财富 −2');
  });

  it('置灰项仍然可见，写明原因且不可聚焦', () => {
    const html = renderToString(<EventModal pending={caught} onPick={() => {}} onContinue={() => {}} />);
    expect(html).toContain('报考专科');
    expect(html).toContain('成绩够不上');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('tabindex="-1"');
  });

  it('差一年不给选项，只给“继续”与差距月数', () => {
    const html = renderToString(<EventModal pending={nearMiss} onPick={() => {}} onContinue={() => {}} />);
    expect(html).toContain('11 个月');
    expect(html).toContain('继续过日子');
    expect(html).not.toContain('报考本科');
  });
});
