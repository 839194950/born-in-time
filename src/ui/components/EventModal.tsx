import { useEffect, useRef, useState } from 'react';
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

/**
 * 差一年的说法分两种方向：早了够不着、晚了没赶上。
 *
 * 注意这里只有两个分支。`judgeWindow` 从 2026-10-24 起改按整年判定，
 * `gapMonths` 恒为 12 的整数倍——以前那个 `gap <= 14` 的"只差几个月"分支
 * 和最后一行输出的是同一句话，等于写了两遍。
 * 也不再出现"只差 11 个月"这种精度：这个游戏抽的是出生年份，同一年出生的人
 * 应该被判成同样的结果。
 */
export function nearMissLine(judgement: PendingEvent['judgement'], windowAge: [number, number]): string {
  const gap = judgement.gapMonths;
  const tooYoung = judgement.ageMonths < windowAge[0] * 12;
  return tooYoung
    ? `这件事来的时候，你才 ${judgement.age} 岁，还差 ${gapText(gap)} 才够得着。等你够着了，它已经过去了。`
    : `你晚了 ${gapText(gap)}。等你走到跟前，这扇门已经关上了。`;
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
  const modalRef = useRef<HTMLDivElement | null>(null);
  const { event, judgement, text, choices } = pending;

  // 弹窗是模态的，键盘用户必须能进来。旧版没有初始焦点：弹窗弹出后
  // 焦点还留在页面下面的按钮上，Tab 要穿过整个页面才够得到选项。
  useEffect(() => {
    const root = modalRef.current;
    if (!root) return;
    // 优先落在第一个可选选项上。「差一年」的弹窗没有选项（只有"继续过日子"），
    // 全部置灰时也没有 available——这两种情况以前焦点会留在遮罩后面，
    // 键盘用户既进不来、也听不到"为什么选不了"。退回到弹窗里第一个可聚焦元素。
    const target =
      root.querySelector<HTMLElement>('[data-choice="available"]') ??
      root.querySelector<HTMLElement>('button, [href], textarea');
    target?.focus();
  }, [event.id]);

  /** Tab 不跑出弹窗：否则键盘用户会掉到被遮住的页面上 */
  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Tab') return;
    const nodes = modalRef.current?.querySelectorAll<HTMLElement>('button, [href], textarea');
    if (!nodes || nodes.length === 0) return;
    const list = Array.from(nodes);
    const first = list[0]!;
    const last = list[list.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const badgeText =
    pending.kind === 'reflection' ? '停一停' : pending.kind === 'daily' ? '日常' : verdictText(judgement.verdict);
  const badgeClass =
    pending.kind === 'reflection' ? 'badge-reflect' : pending.kind === 'daily' ? 'badge-daily' : (VERDICT_CLASS[judgement.verdict] ?? '');

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        ref={modalRef}
        onKeyDown={trapTab}
      >
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
                  data-choice={locked ? 'locked' : 'available'}
                  // 置灰项也要能用键盘聚焦：这个游戏的设计意图就是"看得见但选不了"，
                  // 键盘用户如果连聚焦都做不到，就只剩"看不见也选不了"。
                  tabIndex={0}
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
