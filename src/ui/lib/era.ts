/**
 * 三时代（用户 2026-10-22 拍板）：整个游戏的视觉按「当前年份」分三段，
 * 跨过 1990 / 2010 两道坎，界面配色、场景色调、结局卡一起换代——
 * 一个人从胶片照片活到彩色照片、再活进手机屏幕，风格跟着年代走。
 *
 * 时代只由年份决定，不进存档：读档时按当前年份现算，永远不会错位。
 */
export type EraId = 'film' | 'calendar' | 'digital';

export interface EraInfo {
  id: EraId;
  name: string;
  /** 字卡与说明里用的年份范围文案 */
  years: string;
}

export const ERAS: Record<EraId, EraInfo> = {
  film: { id: 'film', name: '胶片时代', years: '1958 — 1989' },
  calendar: { id: 'calendar', name: '挂历时代', years: '1990 — 2009' },
  digital: { id: 'digital', name: '数字时代', years: '2010 — ' },
};

export function eraOfYear(year: number): EraInfo {
  if (year < 1990) return ERAS.film;
  if (year < 2010) return ERAS.calendar;
  return ERAS.digital;
}
