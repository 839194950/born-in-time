import { useEffect, useRef, useState } from 'react';
import { formatEffects } from '../../engine/format';
import { CONTINUE_CHOICE_ID, type GameSnapshot } from '../../engine/game';
import { FOCUS_EFFECT_SCALE } from '../../engine/stats';
import { STAT_KEYS } from '../../engine/types';
import { EventModal } from '../components/EventModal';
import { SceneStage } from '../components/SceneStage';
import { StatBar } from '../components/StatBar';
import { Timeline } from '../components/Timeline';
import { useGame } from '../store';

/** 1× 下一年 4.5 秒 */
export const YEAR_MS = 4500;
export const SPEEDS = [1, 2, 4, 8, 16] as const;

export interface PlayActions {
  tick(): void;
  resolve(id: string): void;
  setFocus(id: string): void;
  advanceToDecision(): void;
}

export function PlayScreenView({ snapshot, actions }: { snapshot: GameSnapshot; actions: PlayActions }) {
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState(false);
  const [auto, setAuto] = useState(false);

  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const phase = snapshot.phase;
  const pending = snapshot.pendingEvent;

  useEffect(() => {
    if (phase !== 'playing' || paused) return;
    const id = window.setInterval(() => actionsRef.current.tick(), YEAR_MS / speed);
    return () => window.clearInterval(id);
  }, [phase, paused, speed]);

  useEffect(() => {
    if (!auto || phase !== 'awaitingChoice' || !pending) return;
    const id = window.setTimeout(() => {
      const pick = pending.choices.find((c) => c.state === 'available');
      actionsRef.current.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    }, 700);
    return () => window.clearTimeout(id);
  }, [auto, phase, pending]);

  const canChooseFocus = phase === 'playing';

  return (
    <main className="screen play-screen">
      <header className="play-head">
        <div className="play-clock">
          <span className="play-year">{snapshot.year}</span>
          <span className="play-age">{`${snapshot.age} 岁`}</span>
        </div>
        <span className="play-meta">
          {`${snapshot.birth.name} · ${snapshot.birth.province}${snapshot.birth.urban ? '城市' : '农村'}`}
        </span>
      </header>

      <SceneStage
        year={snapshot.year}
        age={snapshot.age}
        gender={snapshot.birth.gender}
        urban={snapshot.birth.urban}
        health={snapshot.stats.health}
        happiness={snapshot.stats.happiness}
        flags={snapshot.flags}
      />

      <section className="stats" aria-label="五维数值">
        {STAT_KEYS.map((key) => (
          <StatBar key={key} stat={key} value={snapshot.stats[key]} />
        ))}
      </section>

      {snapshot.focusOptions.length > 0 && (
        <section className="focus" aria-label="今年的重心">
          <h3>今年的重心</h3>
          <div className="focus-grid">
            {snapshot.focusOptions.map((option) => {
              const active = option.id === snapshot.focusId;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`focus-btn${active ? ' is-active' : ''}`}
                  disabled={!canChooseFocus}
                  onClick={() => actions.setFocus(option.id)}
                >
                  <span className="focus-label">{option.label}</span>
                  <span className="focus-effects">{formatEffects(option.effects, FOCUS_EFFECT_SCALE)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="controls" aria-label="时间控制">
        <button type="button" className="ctrl" onClick={() => setPaused((p) => !p)} disabled={phase !== 'playing'}>
          {paused ? '继续' : '暂停'}
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`ctrl${speed === s ? ' is-active' : ''}`}
            onClick={() => setSpeed(s)}
          >
            {`${s}×`}
          </button>
        ))}
        <button type="button" className="ctrl" onClick={() => actions.advanceToDecision()} disabled={phase !== 'playing'}>
          快进到下一个抉择
        </button>
        <button type="button" className={`ctrl${auto ? ' is-active' : ''}`} onClick={() => setAuto((a) => !a)}>
          {auto ? '自动抉择：开' : '自动抉择：关'}
        </button>
      </section>

      {pending && (
        <EventModal
          pending={pending}
          onPick={(id) => actions.resolve(id)}
          onContinue={() => actions.resolve(CONTINUE_CHOICE_ID)}
        />
      )}

      <Timeline entries={snapshot.timeline} />
    </main>
  );
}

export default function PlayScreen() {
  const { snapshot, actions } = useGame();
  if (!snapshot) return null;
  return <PlayScreenView snapshot={snapshot} actions={actions} />;
}
