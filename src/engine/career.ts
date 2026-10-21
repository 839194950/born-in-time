import { averageWage } from '../data/demography';

/**
 * 职业状态：不单独存档，由 flags + 年龄推导（存档重放天然一致）。
 * 作用有二：一是给玩家一个看得见的身份（职业名 + 月薪体感锚点），
 * 二是让财富百分位每年有根基地涨落，而不是只靠事件凭空跳变。
 */
export interface Career {
  id: string;
  label: string;
  /** 月薪相对当年城镇平均工资的倍数 */
  wageMultiple: number;
  /** 年储蓄倾向：正数攒钱、负数吃老本（用于年度结算的百分位漂移） */
  savingBias: number;
  working: boolean;
  retired: boolean;
}

const STUDENT: Career = { id: 'student', label: '学生', wageMultiple: 0, savingBias: 0, working: false, retired: false };
const UNEMPLOYED: Career = { id: 'unemployed', label: '待业', wageMultiple: 0, savingBias: -1, working: false, retired: false };

export function deriveCareer(flags: readonly string[], age: number, urban: boolean): Career {
  if (age >= 60 || flags.includes('retired')) {
    return { id: 'retired', label: '退休', wageMultiple: 0.45, savingBias: 0, working: false, retired: true };
  }
  if (flags.includes('in_school') && age < 24 && !flags.includes('stable_job')) return STUDENT;
  if (age < 18) return STUDENT;
  if (flags.includes('edtech')) {
    return { id: 'edtech', label: '教培老师', wageMultiple: 1.15, savingBias: 0.4, working: true, retired: false };
  }
  if (flags.includes('stable_job')) {
    return { id: 'stable', label: urban ? '单位职员' : '乡镇单位职员', wageMultiple: 1.05, savingBias: 0.4, working: true, retired: false };
  }
  if (flags.includes('self_employed')) {
    return { id: 'self', label: '个体经营', wageMultiple: 1.1, savingBias: 0.2, working: true, retired: false };
  }
  if (flags.includes('gig_worker')) {
    return { id: 'gig', label: '灵活就业', wageMultiple: 0.75, savingBias: -0.2, working: true, retired: false };
  }
  if (flags.includes('vocational')) {
    return { id: 'vocational', label: '技术工人', wageMultiple: 0.95, savingBias: 0.3, working: true, retired: false };
  }
  if (flags.includes('college')) {
    return { id: 'office', label: '公司职员', wageMultiple: 1.2, savingBias: 0.4, working: true, retired: false };
  }
  if (flags.includes('migrant')) {
    return { id: 'migrant', label: '外来务工', wageMultiple: 0.8, savingBias: 0.6, working: true, retired: false };
  }
  if (age >= 18 && age < 24) return UNEMPLOYED;
  return {
    id: 'labor',
    label: urban ? '普通职工' : '务农兼务工',
    wageMultiple: urban ? 0.9 : 0.55,
    savingBias: 0.2,
    working: age >= 18,
    retired: false,
  };
}

/** 资历系数：入职打底，45 岁见顶，之后平坦 */
export function experienceFactor(age: number): number {
  if (age < 22) return 0.75;
  if (age >= 45) return 1.45;
  return 0.75 + ((age - 22) / 23) * 0.7;
}

/** 本年月薪（元，体感锚点）。学生/待业为 0，退休为退休金 */
export function monthlyWage(career: Career, year: number, age: number): number {
  if (career.wageMultiple === 0) return 0;
  const avgMonthly = averageWage(year) / 12;
  const factor = career.retired ? 1 : experienceFactor(age);
  return Math.round(avgMonthly * career.wageMultiple * factor);
}

/** 职业状态行（界面展示）：如「公司职员 · 月薪约 6,300 元（当年平均工资的 1.6 倍）」 */
export function careerLine(career: Career, year: number, age: number): string {
  const wage = monthlyWage(career, year, age);
  if (career.retired) return wage > 0 ? `退休 · 退休金约 ${wage.toLocaleString('zh-CN')} 元/月` : '退休';
  if (!career.working) return career.label;
  const avgMonthly = Math.max(1, averageWage(year) / 12);
  const ratio = wage / avgMonthly;
  return `${career.label} · 月薪约 ${wage.toLocaleString('zh-CN')} 元（当年平均的 ${ratio.toFixed(1)} 倍）`;
}

/**
 * 年度结算给财富百分位的漂移（整数点）：干得好的人每年悄悄往上挪一点，
 * 待业和入不敷出往下掉。幅度刻意小——大起大落仍然归事件管。
 */
export function annualWealthDrift(career: Career, rngNext: () => number): number {
  if (!career.working && !career.retired) return career.id === 'unemployed' ? -1 : 0;
  const noise = rngNext() < 0.3 ? 1 : 0;
  if (career.savingBias >= 0.4) return noise;
  if (career.savingBias >= 0.2) return rngNext() < 0.4 ? 1 : 0;
  if (career.savingBias < 0) return rngNext() < 0.5 ? -1 : 0;
  return 0;
}
