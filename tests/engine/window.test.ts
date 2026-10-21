import { describe, expect, it } from 'vitest';
import { judgeWindow, verdictText } from '../../src/engine/window';

const gaokao = { eventYear: 1999, windowAge: [17, 19] as [number, number] };

describe('judgeWindow：窗口内', () => {
  it('年龄落在窗口内就是赶上，gapMonths 为 0', () => {
    expect(judgeWindow({ birthYear: 1979, birthMonth: 12, ...gaokao })).toMatchObject({
      verdict: 'caught',
      gapMonths: 0,
    });
    expect(judgeWindow({ birthYear: 1980, birthMonth: 8, ...gaokao }).verdict).toBe('caught');
    expect(judgeWindow({ birthYear: 1981, birthMonth: 9, ...gaokao }).verdict).toBe('caught');
  });

  it('age 是整周岁', () => {
    expect(judgeWindow({ birthYear: 1981, birthMonth: 9, ...gaokao }).age).toBe(17);
    expect(judgeWindow({ birthYear: 1979, birthMonth: 12, ...gaokao }).age).toBe(19);
  });
});

describe('judgeWindow：边缘带', () => {
  it('差 3 个月算差一年，且准确报出月数', () => {
    expect(judgeWindow({ birthYear: 1982, birthMonth: 9, ...gaokao })).toMatchObject({
      verdict: 'nearMiss',
      gapMonths: 3,
    });
  });

  it('超上界但在 3 年内也算差一年', () => {
    const r = judgeWindow({ birthYear: 1977, birthMonth: 3, ...gaokao });
    expect(r.verdict).toBe('nearMiss');
    expect(r.gapMonths).toBe(28);
  });

  it('恰好卡在 36 个月仍算差一年，37 个月就是路过', () => {
    // 窗口下界 204 个月；出生 1985-06 → 事件时 168 个月，差 36
    expect(judgeWindow({ birthYear: 1985, birthMonth: 6, ...gaokao })).toMatchObject({
      verdict: 'nearMiss',
      gapMonths: 36,
    });
    expect(judgeWindow({ birthYear: 1985, birthMonth: 7, ...gaokao }).verdict).toBe('passedBy');
  });

  it('edgeYears 可覆盖默认 3 年', () => {
    // 1986-06 生，1999 年时 156 个月，距下界 48 个月
    expect(judgeWindow({ birthYear: 1986, birthMonth: 6, ...gaokao, edgeYears: 5 }).verdict).toBe('nearMiss');
    expect(judgeWindow({ birthYear: 1986, birthMonth: 6, ...gaokao }).verdict).toBe('passedBy');
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
    // 1988 年生，2025 年 36 岁：距第一窗口上界 11 年、距第二窗口下界 24 年
    const r = judgeWindow({ birthYear: 1988, birthMonth: 6, ...two });
    expect(r.verdict).toBe('passedBy');
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
