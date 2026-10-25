import type { TimelineEntry } from '../../engine/types';

/**
 * 人生纪录。默认取最近若干条。
 *
 * 两个细节：
 * - 只切尾部而不是 `[...entries].reverse()`：主循环每年都会重渲染，
 *   复制整个数组（一百多条）没有必要。
 * - key 不用 index：新条目从顶部插入，index 会整体错位，导致所有行重建。
 */
export function Timeline({
  entries,
  limit = 8,
  hideTitle = false,
}: {
  entries: readonly TimelineEntry[];
  limit?: number;
  hideTitle?: boolean;
}) {
  const shown = entries.slice(Math.max(0, entries.length - limit)).reverse();
  return (
    <section className="timeline" aria-label="人生纪录">
      {!hideTitle && <h3>人生纪录</h3>}
      {shown.length === 0 ? (
        <p className="timeline-empty">还没有什么可记的。</p>
      ) : (
        <ol>
          {shown.map((e) => (
            <li key={`${e.year}-${e.age}-${e.kind}-${e.text.slice(0, 12)}`} className={`timeline-${e.kind}`}>
              <span className="timeline-year">{e.year}</span>
              <span className="timeline-text">{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
