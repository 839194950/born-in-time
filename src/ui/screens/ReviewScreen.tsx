import { useMemo, useState } from 'react';
import { GENDER_LABEL } from '../../data/labels';
import type { GameSnapshot } from '../../engine/game';
import { setLatestMessage, listRecords, type PastRecord } from '../../engine/save';
import { STAT_KEYS, type AxisKey } from '../../engine/types';
import { gapText, verdictText } from '../../engine/window';
import type { EndingCardData } from '../lib/endingCard';
import { StatBar } from '../components/StatBar';

const AXES: readonly { left: AxisKey; right: AxisKey; leftLabel: string; rightLabel: string }[] = [
  { left: 'companion', right: 'work', leftLabel: '陪伴', rightLabel: '工作' },
  { left: 'root', right: 'wind', leftLabel: '根', rightLabel: '风' },
  { left: 'calm', right: 'wave', leftLabel: '平静', rightLabel: '浪潮' },
  { left: 'now', right: 'future', leftLabel: '今天', rightLabel: '明天' },
];

export interface AxisPair {
  leftLabel: string;
  rightLabel: string;
  leftPct: number;
}

export function axisPairs(axes: Record<AxisKey, number>): AxisPair[] {
  return AXES.map(({ left, right, leftLabel, rightLabel }) => {
    const a = Math.max(0, axes[left]);
    const b = Math.max(0, axes[right]);
    const total = a + b;
    return { leftLabel, rightLabel, leftPct: total === 0 ? 50 : (a / total) * 100 };
  });
}

export function ReviewScreen({
  snapshot,
  data,
  onRestart,
}: {
  snapshot: GameSnapshot;
  data: EndingCardData;
  onRestart: () => void;
}) {
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const records = useMemo<PastRecord[]>(() => listRecords(), []);
  const { aggregate } = data.ending;

  const bestYearEntries = snapshot.timeline.filter((t) => t.year === aggregate.bestYear);

  return (
    <main className="screen review-screen">
      <header className="review-head">
        <h1>这一生</h1>
        <p className="sub">
          {`${snapshot.birth.name} · ${snapshot.birth.year} · ${snapshot.birth.province}${snapshot.birth.urban ? '城市' : '农村'} · ${GENDER_LABEL[snapshot.birth.gender]}`}
        </p>
        <p className="review-title">{`【${data.ending.title.name}】${data.ending.headline}`}</p>
      </header>

      <section className="review-block">
        <h2>窗口账本</h2>
        {snapshot.ledger.length === 0 ? (
          <p className="muted">这一生没有遇到大的窗口。</p>
        ) : (
          <ul className="ledger-list">
            {snapshot.ledger.map((e) => (
              <li key={e.eventId} className={`ledger-row ledger-${e.verdict}`}>
                <span className="ledger-year">{e.year}</span>
                <span className="ledger-title">{e.title}</span>
                <span className="ledger-verdict">
                  {e.verdict === 'nearMiss' ? `${verdictText(e.verdict)}（差 ${gapText(e.gapMonths)}）` : verdictText(e.verdict)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="review-block">
        <h2>终局五维</h2>
        <div className="stats">
          {STAT_KEYS.map((key) => (
            <StatBar key={key} stat={key} value={snapshot.stats[key]} />
          ))}
        </div>
      </section>

      <section className="review-block">
        <h2>人生纹理</h2>
        <div className="axes">
          {axisPairs(snapshot.axes).map((pair) => (
            <div className="axis" key={pair.leftLabel}>
              <div className="axis-labels">
                <span>{pair.leftLabel}</span>
                <span>{pair.rightLabel}</span>
              </div>
              <div className="axis-track">
                <span className="axis-marker" style={{ left: `${pair.leftPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="review-block">
        <h2>最幸福的一年</h2>
        <p className="review-best">
          {`${aggregate.bestYear} 年，${Math.round(
            snapshot.snapshots.find((s) => s.year === aggregate.bestYear)?.happiness ?? aggregate.happinessAvg,
          )} 分。`}
        </p>
        {bestYearEntries.length > 0 && (
          <ul className="ledger-list">
            {bestYearEntries.map((t, i) => (
              <li key={i} className="ledger-row">
                <span className="ledger-title">{t.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {snapshot.interests.length > 0 && (
        <section className="review-block">
          <h2>这一生花时间最多的事</h2>
          <ul className="interest-list">
            {snapshot.interests.map((i) => (
              <li key={i.id}>
                <span className="interest-name">{i.label}</span>
                <span className="interest-lv">{`Lv.${i.level}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="review-block">
        <h2>留一句话</h2>
        <textarea
          className="review-message"
          value={message}
          maxLength={60}
          placeholder="写给这一生，或者写给自己。"
          onChange={(e) => {
            setMessage(e.target.value);
            setSaved(false);
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={saved}
          onClick={() => {
            setLatestMessage(message);
            setSaved(true);
          }}
        >
          {saved ? '已记下' : '记下'}
        </button>
      </section>

      {records.length > 0 && (
        <section className="review-block">
          <h2>前世纪录</h2>
          <ul className="record-list">
            {records.map((r) => (
              <li key={r.id} className="record-row">
                <span className="record-year">{r.birth.year}</span>
                <span className="record-title">{r.titleName}</span>
                {r.message && <span className="record-message">{r.message}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="actions">
        <button type="button" className="btn-primary" onClick={onRestart}>
          再抽一年
        </button>
      </div>
    </main>
  );
}
