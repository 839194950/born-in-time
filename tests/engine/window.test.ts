import { describe, expect, it } from 'vitest';
import { judgeWindow, verdictText } from '../../src/engine/window';

const gaokao = { eventYear: 1999, windowAge: [17, 19] as [number, number] };

describe('judgeWindow：窗口内', () => {
  it('年份差落在窗口内就是赶上，gapMonths 为 0', () => {
    expect(judgeWindow({ birthYear: 1980, birthMonth: 12, ...gaokao })).toMatchObject({
      verdict: 'caught',
      gapMonths: 0,
    });
    expect(judgeWindow({ birthYear: 1980, birthMonth: 8, ...gaokao }).verdict).toBe('caught');
    expect(judgeWindow({ birthYear: 1981, birthMonth: 9, ...gaokao }).verdict).toBe('caught');
    expect(judgeWindow({ birthYear: 1982, birthMonth: 1, ...gaokao }).verdict).toBe('caught');
  });

  it('age 是年份差（同年出生的人一致，不受出生月份影响）', () => {
    expect(judgeWindow({ birthYear: 1981, birthMonth: 1, ...gaokao }).age).toBe(18);
    expect(judgeWindow({ birthYear: 1981, birthMonth: 12, ...gaokao }).age).toBe(18);
    expect(judgeWindow({ birthYear: 1979, birthMonth: 12, ...gaokao }).age).toBe(20);
  });

  it('出生月份不改变判定结果', () => {
    for (const birthYear of [1979, 1980, 1981, 1982, 1983]) {
      const verdicts = new Set(
        Array.from({ length: 12 }, (_, i) =>
          judgeWindow({ birthYear, birthMonth: i + 1, ...gaokao }).verdict,
        ),
      );
      expect(verdicts.size, `${birthYear} 年生`).toBe(1);
    }
  });
});

describe('judgeWindow：边缘带', () => {
  it('差 1 年算差一年，报出 12 个月', () => {
    expect(judgeWindow({ birthYear: 1983, birthMonth: 9, ...gaokao })).toMatchObject({
      verdict: 'nearMiss',
      gapMonths: 12,
    });
    expect(judgeWindow({ birthYear: 1979, birthMonth: 3, ...gaokao })).toMatchObject({
      verdict: 'nearMiss',
      gapMonths: 12,
    });
  });

  it('恰好卡在 24 个月仍算差一年，25 个月就是路过', () => {
    // 窗口上界 19：1980 年生是 19，1979 年生是 20（差 1 年），1978 年生是 21（差 2 年）
    expect(judgeWindow({ birthYear: 1978, birthMonth: 6, ...gaokao }).verdict).toBe('nearMiss');
    expect(judgeWindow({ birthYear: 1977, birthMonth: 6, ...gaokao }).verdict).toBe('passedBy');
    expect(judgeWindow({ birthYear: 1977, birthMonth: 6, ...gaokao }).gapMonths).toBe(36);
  });

  it('edgeYears 可覆盖默认 2 年', () => {
    // 1977 年生 → 差 3 年；放宽到 3 年就成 nearMiss
    expect(judgeWindow({ birthYear: 1977, birthMonth: 6, ...gaokao, edgeYears: 3 }).verdict).toBe('nearMiss');
    expect(judgeWindow({ birthYear: 1977, birthMonth: 6, ...gaokao }).verdict).toBe('passedBy');
  });
});

describe('judgeWindow：路过', () => {
  it('远小于窗口只播报，不给选项', () => {
    expect(judgeWindow({ birthYear: 1990, birthMonth: 3, ...gaokao }).verdict).toBe('passedBy');
  });

  it('远大于窗口同样路过', () => {
    expect(judgeWindow({ birthYear: 1970, birthMonth: 3, ...gaokao }).verdict).toBe('passedBy');
  });
});

describe('judgeWindow：第二窗口', () => {
  it('高龄撞上第二窗口时按第二窗口判定', () => {
    const retirement = {
      eventYear: 2025,
      windowAge: [40, 50] as [number, number],
      secondWindowAge: [55, 62] as [number, number],
    };
    // 1968 年生，2025 年 57 岁
    expect(judgeWindow({ birthYear: 1968, birthMonth: 3, ...retirement })).toMatchObject({
      verdict: 'caught',
      age: 57,
    });
    // 1985 年生，2025 年 40 岁，命中第一窗口
    expect(judgeWindow({ birthYear: 1985, birthMonth: 3, ...retirement }).verdict).toBe('caught');
  });

  it('两个窗口之间取更近的那个算距离', () => {
    const two = {
      eventYear: 2025,
      windowAge: [20, 25] as [number, number],
      secondWindowAge: [60, 65] as [number, number],
    };
    // 1988 年生，2025 年 37 岁：距第一窗口上界 12 年、距第二窗口下界 23 年
    expect(judgeWindow({ birthYear: 1988, birthMonth: 6, ...two }).verdict).toBe('passedBy');
    // 1998 年生，2025 年 27 岁：距第一窗口上界 2 年
    expect(judgeWindow({ birthYear: 1998, birthMonth: 6, ...two }).verdict).toBe('nearMiss');
  });
});

describe('verdictText', () => {
  it('三种判定各有说法', () => {
    expect(verdictText('caught')).toBe('赶上');
    expect(verdictText('nearMiss')).toBe('差一年');
    expect(verdictText('passedBy')).toBe('路过');
  });
});
