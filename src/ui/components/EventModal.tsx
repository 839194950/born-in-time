import { useState } from 'react';
import type { PendingEvent } from '../../engine/game';
import { STAT_LABEL } from '../../engine/format';
import { STAT_MAX, type StatKey, type Stats } from '../../engine/types';
import { gapText, verdictText } from '../../engine/window';

const STAT_ORDER: readonly StatKey[] = ['health', 'ability', 'wealth', 'family', 'happiness'];

const VERDICT_CLASS: Record<string, string> = {
  caught: 'badge-caught',
  nearMiss: 'badge-near',
  passedBy: 'badge-passed',
};

/** 差一年的说法按“差多少、差在哪边”分级，不再一句话用到底 */
export function nearMissLine(judgement: PendingEvent['judgement'], windowAge: [number, number]): string {
  const gap = judgement.gapMonths;
  if (gap <= 14) return `你晚了 ${gapText(gap)}。门里的事，这一回和你没关系。`;
  const start = windowAge[0] * 12;
  if (judgement.ageMonths < start) {
    return `这件事来的时候，你才 ${judgement.age} 岁，还差 ${gapText(gap)} 才够得着。等你够着了，它已经过去了。`;
  }
  return `你晚了 ${gapText(gap)}。等你走到跟前，这扇门已经关上了。`;
}

export function EventModal({
  pending,
  stats,
  onPick,
  onContinue,
}: {
  pending: PendingEvent;
  stats: Stats;
  onPick: (id: string) => void;
  onContinue: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const { event, judgement, text, choices } = pending;
  const badgeText =
    pending.kind === 'reflection' ? '停一停' : pending.kind === 'daily' ? '日常' : verdictText(judgement.verdict);
  const badgeClass =
    pending.kind === 'reflection' ? 'badge-reflect' : pending.kind === 'daily' ? 'badge-daily' : (VERDICT_CLASS[judgement.verdict] ?? '');

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="modal-head">
          <span className={`badge ${badgeClass}`}>{badgeText}</span>
          <h2>{event.title}</h2>
        </div>

        {/* 移动端弹窗是底部抽屉，会把页面上的五维条盖住——而玩家正是要看着它做选择。
            所以把读数复制一份进弹窗，做成一行紧凑的迷你条。 */}
        <div className="modal-stats" aria-label="当前五维">
          {STAT_ORDER.map((key) => {
            const value = stats[key];
            const pct = Math.max(0, Math.min(100, (value / STAT_MAX) * 100));
            return (
              <span className="ms" key={key}>
                <span className="ms-label">{STAT_LABEL[key]}</span>
                <span className="ms-value">{Math.round(value)}</span>
                <span className="ms-track">
                  <span className={`ms-fill stat-${key}`} style={{ width: `${pct}%` }} />
                </span>
              </span>
            );
          })}
        </div>

        <p className="modal-body">{text}</p>

        {pending.kind === 'event' && judgement.verdict === 'nearMiss' && (
          <p className="modal-near">{nearMissLine(judgement, event.windowAge)}</p>
        )}

        {notice && <p className="modal-notice">{notice}</p>}

        <div className="modal-choices">
          {choices.length === 0 ? (
            <button type="button" className="choice" onClick={onContinue}>
              继续过日子
            </button>
          ) : (
            // 能选的排前面，置灰的排后面。
            // v1 按数据顺序渲染，于是玩家第一眼看到的常常是那个灰的——
            // 门槛提高后（见偏离清单 13.6）置灰项变多，一进来就杵着一个点不动的按钮。
            [...choices]
              .sort((a, b) => (a.state === 'locked' ? 1 : 0) - (b.state === 'locked' ? 1 : 0))
              .map((choice) => {
              const locked = choice.state === 'locked';
              return (
                <button
                  key={choice.id}
                  type="button"
                  className={`choice${locked ? ' is-locked' : ''}`}
                  aria-disabled={locked}
                  tabIndex={locked ? -1 : 0}
                  onClick={() => (locked ? setNotice(choice.reason ?? '现在选不了') : onPick(choice.id))}
                >
                  <span className="choice-label">{choice.label}</span>
                  {choice.effectsText && <span className="choice-effects">{choice.effectsText}</span>}
                  {choice.uncertain && <span className="choice-uncertain">成败未定</span>}
                  {locked && <span className="choice-locked">{choice.reason}</span>}
                </button>
              );
            })
          )}
        </div>

        <p className="modal-source">{`出处：${event.source}`}</p>
      </div>
    </div>
  );
}
