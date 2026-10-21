import { useState } from 'react';
import type { PendingEvent } from '../../engine/game';
import { gapText, verdictText } from '../../engine/window';

const VERDICT_CLASS: Record<string, string> = {
  caught: 'badge-caught',
  nearMiss: 'badge-near',
  passedBy: 'badge-passed',
};

export function EventModal({
  pending,
  onPick,
  onContinue,
}: {
  pending: PendingEvent;
  onPick: (id: string) => void;
  onContinue: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const { event, judgement, text, choices } = pending;

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="modal-head">
          <span className={`badge ${VERDICT_CLASS[judgement.verdict] ?? ''}`}>{verdictText(judgement.verdict)}</span>
          <h2>{event.title}</h2>
        </div>

        <p className="modal-body">{text}</p>

        {judgement.verdict === 'nearMiss' && (
          <p className="modal-near">
            {`你晚了 ${gapText(judgement.gapMonths)}。门里的事，这一回和你没关系。`}
          </p>
        )}

        {notice && <p className="modal-notice">{notice}</p>}

        <div className="modal-choices">
          {choices.length === 0 ? (
            <button type="button" className="choice" onClick={onContinue}>
              继续过日子
            </button>
          ) : (
            choices.map((choice) => {
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
