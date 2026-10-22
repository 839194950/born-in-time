/**
 * 分享链路：一局 = 一个种子。
 *
 * v1 有两个互不相关的种子（出生一个、对局一个），所以"这一局"根本无法被
 * 任何单一标识指向——缺 URL 参数只是表象，根因在这里。
 * 现在出生也由同一个种子推出（rollBirth 全部字段都从 RNG 来），
 * 因此载荷只需要 32bit → base36 七个字符。
 */
export const SEED_PARAM = 's';

export function encodeSeed(seed: number): string {
  return (seed >>> 0).toString(36);
}

export function decodeSeed(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = parseInt(raw, 36);
  if (!Number.isFinite(value) || value < 0) return null;
  return value >>> 0;
}

/** 从 URL 读种子；没有就返回 null（正常抽签） */
export function seedFromLocation(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    return decodeSeed(new URLSearchParams(window.location.search).get(SEED_PARAM));
  } catch {
    return null;
  }
}

/** 换一年：确定性推进，同一台机器上连点也不会重复 */
export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

export function shareUrl(seed: number): string {
  const base =
    typeof window === 'undefined'
      ? 'https://shengfengqishi.example/'
      : `${window.location.origin}${window.location.pathname}`;
  return `${base}?${SEED_PARAM}=${encodeSeed(seed)}`;
}

/** 把当前种子写回地址栏，方便直接复制分享 */
export function syncUrlWithSeed(seed: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.history.replaceState(null, '', `?${SEED_PARAM}=${encodeSeed(seed)}`);
  } catch {
    // 某些内嵌浏览器禁止改地址，忽略即可
  }
}
