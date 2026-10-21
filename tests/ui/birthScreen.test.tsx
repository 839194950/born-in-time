import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BirthScreen, { BirthCard, siblingsLine, urbanizationLine } from '../../src/ui/screens/BirthScreen';
import type { Birth } from '../../src/engine/types';

const birth: Birth = {
  year: 1981,
  month: 4,
  province: '安徽',
  urban: false,
  gender: 'male',
  name: '王建国',
  fatherJob: 'teacher',
  motherJob: 'farmer',
  tier: 'normal',
  siblings: 2,
  urbanizationRate: 0.18,
  cohortLifeExpectancy: 66.4,
};

describe('城镇化率文案', () => {
  it('农村版说出十个里有几个在乡下', () => {
    const line = urbanizationLine(birth);
    expect(line).toContain('8 个生在乡下');
    expect(line).toContain('你是其中之一');
  });

  it('城市版对称', () => {
    const line = urbanizationLine({ ...birth, urban: true });
    expect(line).toContain('不到 2 个生在城里');
  });
});

describe('兄弟姐妹文案', () => {
  it('独生与非独生分开说', () => {
    expect(siblingsLine(0)).toBe('独生子女');
    expect(siblingsLine(2)).toBe('2 个兄弟姐妹');
  });
});

describe('出生卡', () => {
  it('把规格要求展示的字段都印出来', () => {
    const html = renderToString(<BirthCard birth={birth} />);
    expect(html).toContain('王建国');
    expect(html).toContain('1981');
    expect(html).toContain('安徽');
    expect(html).toContain('农村');
    expect(html).toContain('教师 · 农民');
    expect(html).toContain('普通');
    expect(html).toContain('2 个兄弟姐妹');
    expect(html).toContain('66.4 岁');
    expect(html).toContain('这一年出生的孩子');
  });
});

describe('开局屏', () => {
  it('首屏能渲染标题与按钮', () => {
    const html = renderToString(<BirthScreen onStart={() => {}} />);
    expect(html).toContain('生逢其时');
    expect(html).toContain('换一年');
    expect(html).toContain('就这一年，开始');
  });
});
