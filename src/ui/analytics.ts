/**
 * 最小埋点：只采 8 个能直接对应决策的事件，不采设备指纹、不采每帧。
 *
 * 零后端：数据先攒在内存与 sessionStorage 里，暴露到 window.__SFSQ__，
 * 接 Cloudflare / Vercel Analytics 时只需在这里挂一个 sink，业务代码不用动。
 */
export type TrackEvent =
  | 'draw' // 抽签完成
  | 'start' // 开一局
  | 'choice' // 做出一个抉择
  | 'ending' // 走到结局
  | 'save_png' // 保存结局图
  | 'copy_text' // 复制文字版
  | 'redraw' // 再抽一年
  | 'return'; // 次日回访

const KEY = 'sfsq.events.v1';
const MAX = 200;

interface Sink {
  (name: TrackEvent, props: Record<string, string | number>): void;
}

let sink: Sink | null = null;

export function setAnalyticsSink(next: Sink | null): void {
  sink = next;
}

export function track(name: TrackEvent, props: Record<string, string | number> = {}): void {
  const record = { name, at: Date.now(), ...props };
  try {
    if (typeof window !== 'undefined') {
      const w = window as unknown as { __SFSQ__?: unknown[] };
      w.__SFSQ__ = [...(w.__SFSQ__ ?? []), record].slice(-MAX);
    }
    if (typeof sessionStorage !== 'undefined') {
      const prev: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
      const list = Array.isArray(prev) ? prev : [];
      sessionStorage.setItem(KEY, JSON.stringify([...list, record].slice(-MAX)));
    }
  } catch {
    // 埋点失败绝不能影响游戏
  }
  sink?.(name, props);
}

/** 记一次「来过」：用来算次留，不区分用户，只按本机日期 */
export function markVisit(): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem('sfsq.visit.v1');
    localStorage.setItem('sfsq.visit.v1', today);
    if (last && last !== today) track('return', { from: last });
  } catch {
    // 忽略
  }
}
