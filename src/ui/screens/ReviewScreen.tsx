import { useMemo, useState } from 'react';
import { GENDER_LABEL } from '../../data/labels';
import type { GameSnapshot } from '../../engine/game';
import { setLatestMessage, listRecords, type PastRecord } from '../../engine/save';
import { STAT_KEYS, type AxisKey } from '../../engine/types';
import { gapText, verdictText } from '../../engine/window';
import { simulatePeers } from '../../engine/peers';
import { TIER_LABEL } from '../../data/labels';
import type { EndingCardData } from '../lib/endingCard';
import { StatBar } from '../components/StatBar';
import { loadCollection, mergeCaught, titleOfEvent } from '../lib/collection';

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

      <section className="review-block">
        <h2>{`同年对照 · ${snapshot.birth.year} 年出生`}</h2>
        <ul className="compare-list">
          <li className="is-self">
            <div className="compare-head">
              <span className="compare-name">{`${snapshot.birth.name}（你）`}</span>
              <span className="compare-title">{data.ending.title.name}</span>
            </div>
            <p className="compare-meta">
              {`${snapshot.birth.province} · ${snapshot.birth.urban ? '城镇' : '农村'} · 家境${TIER_LABEL[snapshot.birth.tier]}`}
            </p>
            <p className="compare-nums">
              {`享年 ${aggregate.deathAge} 岁　财富 ${Math.round(aggregate.finalWealth)}　赶上 ${aggregate.caught} / 差一年 ${aggregate.nearMiss}　最幸福 ${aggregate.bestYear} 年`}
            </p>
          </li>
          {simulatePeers(snapshot.birth, snapshot.seed).map((peer) => (
            <li key={peer.birth.name}>
              <div className="compare-head">
                <span className="compare-name">{peer.birth.name}</span>
                <span className="compare-title">{peer.titleName}</span>
              </div>
              <p className="compare-meta">
                {`${peer.birth.province} · ${peer.birth.urban ? '城镇' : '农村'} · 家境${TIER_LABEL[peer.birth.tier]} · ${peer.careerLine}`}
              </p>
              <p className="compare-nums">
                {`享年 ${peer.deathAge} 岁　财富 ${Math.round(peer.finalStats.wealth)}　赶上 ${peer.caught} / 差一年 ${peer.nearMiss}　最幸福 ${peer.bestYear} 年`}
              </p>
            </li>
          ))}
        </ul>
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

      <CollectionBlock ledger={snapshot.ledger} />

      <div className="actions">
        <button type="button" className="btn-primary" onClick={onRestart}>
          再抽一年
        </button>
      </div>
    </main>
  );
}

/**
 * 际遇图鉴：这一局赶上的时代窗口会永久点亮。
 * 想凑齐「房改末班车」「不再包分配」的人，会自己再去抽一年。
 */
function CollectionBlock({ ledger }: { ledger: readonly { eventId: string; verdict: string }[] }) {
  const { state, newly } = useMemo(() => {
    const caught = ledger.filter((e) => e.verdict === 'caught').map((e) => e.eventId);
    return mergeCaught(caught);
  }, [ledger]);
  const owned = useMemo(() => new Set(loadCollection()), [state]);
  const pct = Math.round((state.caught.length / Math.max(1, state.total)) * 100);

  return (
    <section className="review-block">
      <h2>际遇图鉴</h2>
      <p className="review-best">
        {`你一共赶上过 ${state.caught.length} / ${state.total} 个时代窗口（${pct}%）。`}
        {newly.length > 0 && ` 这一局新点亮了：${newly.map(titleOfEvent).join('、')}。`}
      </p>
      <div className="collection-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <ul className="collection-list">
        {[...owned].slice(0, 12).map((id) => (
          <li key={id} className="is-lit">
            {titleOfEvent(id)}
          </li>
        ))}
      </ul>
    </section>
  );
}
