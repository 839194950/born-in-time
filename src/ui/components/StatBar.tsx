import { STAT_MAX, type StatKey } from '../../engine/types';
import { STAT_LABEL } from '../../engine/format';

export function StatBar({ stat, value }: { stat: StatKey; value: number }) {
  const pct = Math.max(0, Math.min(100, (value / STAT_MAX) * 100));
  return (
    <div className="stat">
      <span className="stat-label">{STAT_LABEL[stat]}</span>
      <span className="stat-track">
        <span className={`stat-fill stat-${stat}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="stat-value">{Math.round(value)}</span>
    </div>
  );
}
