import { describe, expect, it } from 'vitest';
import { annualWealthDrift, careerLine, deriveCareer, monthlyWage } from '../../src/engine/career';
import { interestLevel, summarizeInterests } from '../../src/engine/interests';

describe('职业推导', () => {
  it('学生、体制内、个体、灵活就业、退休按 flag 与年龄区分', () => {
    // 在读按学制判：义务教育 6–14、高中阶段 15–17（要真读了高中/职高）、
    // 高等教育 18–21（要真考上了）。`in_school` 不再参与——它在 6 岁设上之后
    // 全目录没有一处清理，曾让 15 岁辍学的人到 23 岁都显示「学生」。
    expect(deriveCareer([], 12, true).id).toBe('student');
    expect(deriveCareer(['in_high_school'], 16, true).id).toBe('student');
    expect(deriveCareer(['vocational'], 16, true).id).toBe('student');
    expect(deriveCareer(['higher_ed'], 20, true).id).toBe('student');
    expect(deriveCareer(['in_school'], 20, true).id).not.toBe('student');
    expect(deriveCareer(['vocational'], 20, true).id).toBe('vocational');
    expect(deriveCareer(['stable_job'], 30, true).label).toContain('单位职员');
    expect(deriveCareer(['self_employed'], 30, false).id).toBe('self');
    expect(deriveCareer(['gig_worker'], 30, false).id).toBe('gig');
    expect(deriveCareer(['stable_job'], 65, true).retired).toBe(true);
  });

  it('月薪锚点随年代走：2000 年的公司职员月薪是 1990 年的数倍，且高于当年平均', () => {
    const c = deriveCareer(['college'], 30, true);
    const w2000 = monthlyWage(c, 2000, 30);
    const w1990 = monthlyWage(c, 1990, 30);
    expect(w2000).toBeGreaterThan(w1990 * 2);
    expect(careerLine(c, 2000, 30)).toContain('月薪约');
  });

  it('年度漂移永远是整数且幅度不超过 1', () => {
    const c = deriveCareer(['stable_job'], 35, true);
    for (let i = 0; i < 50; i++) {
      const d = annualWealthDrift(c, () => (i % 7) / 7);
      expect(Number.isInteger(d)).toBe(true);
      expect(Math.abs(d)).toBeLessThanOrEqual(1);
    }
  });
});

describe('兴趣等级', () => {
  it('经验越多等级越高，且封顶 30', () => {
    expect(interestLevel(0)).toBe(0);
    expect(interestLevel(30)).toBeGreaterThan(interestLevel(3));
    expect(interestLevel(100000)).toBe(30);
  });

  it('汇总按经验降序，空表返回空', () => {
    expect(summarizeInterests({})).toEqual([]);
    const list = summarizeInterests({ reading: 30, sports: 90 });
    expect(list[0]!.id).toBe('sports');
    expect(list[0]!.label).toBe('运动');
  });
});
