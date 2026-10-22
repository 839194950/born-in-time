import type { TimelineEntry } from '../../engine/types';

export function Timeline({
  entries,
  limit = 8,
  hideTitle = false,
}: {
  entries: readonly TimelineEntry[];
  limit?: number;
  hideTitle?: boolean;
}) {
  const shown = [...entries].reverse().slice(0, limit);
  return (
    <section className="timeline" aria-label="人生纪录">
      {!hideTitle && <h3>人生纪录</h3>}
      {shown.length === 0 ? (
        <p className="timeline-empty">还没有什么可记的。</p>
      ) : (
        <ol>
          {shown.map((e, i) => (
            <li key={`${e.year}-${e.age}-${i}`} className={`timeline-${e.kind}`}>
              <span className="timeline-year">{e.year}</span>
              <span className="timeline-text">{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
