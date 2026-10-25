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

/**
 * 清掉地址栏里的种子。
 *
 * 必须清：「再抽一年」会回到出生屏，而出生屏的种子来自 `seedFromLocation()`。
 * 不清的话地址栏还留着上一局的 `?s=`，于是"再抽一年"抽到的还是同一年——
 * 玩家以为重抽了，其实什么都没变。
 */
export function clearSeedFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const { pathname, search, hash } = window.location;
    if (!search.includes(`${SEED_PARAM}=`)) return;
    const rest = search
      .replace(/^\?/, '')
      .split('&')
      .filter((part) => part !== '' && !part.startsWith(`${SEED_PARAM}=`))
      .join('&');
    window.history.replaceState(null, '', `${pathname}${rest ? `?${rest}` : ''}${hash}`);
  } catch {
    // 改不了地址也不影响重开
  }
}
