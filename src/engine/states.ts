/**
 * 持续状态：跨年份一直挂在人身上的东西。和一次性事件不同，
 * 它们每年都在悄悄地起作用（房贷占着支出、慢病拖着健康），
 * 也应该在界面上一直看得见。
 */
export interface LifeState {
  id: string;
  label: string;
}

export function deriveStates(flags: readonly string[], age: number): LifeState[] {
  const has = (f: string) => flags.includes(f);
  const out: LifeState[] = [];
  if (has('mortgage') && !has('mortgage_paid')) out.push({ id: 'mortgage', label: '房贷在还' });
  else if (has('mortgage_paid')) out.push({ id: 'mortgage_paid', label: '房贷还清' });
  else if (has('has_home')) out.push({ id: 'home', label: '有房无贷' });
  if (has('third_home')) out.push({ id: 'multi_home', label: '多套房' });
  if (has('holds_btc')) out.push({ id: 'btc', label: '持有比特币' });
  if (has('chronic_illness')) out.push({ id: 'chronic', label: '慢性病 · 长期服药' });
  if (has('health_conscious')) out.push({ id: 'wellness', label: '注重保养' });
  if (has('has_cat')) out.push({ id: 'cat', label: '养猫' });
  if (has('migrant') && !has('has_home') && age >= 20) out.push({ id: 'drifting', label: '异乡打拼' });
  return out;
}

/** 房贷年限：从背上房贷那年算，20 年还清 */
export const MORTGAGE_TERM_YEARS = 20;
