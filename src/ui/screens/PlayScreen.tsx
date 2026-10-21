import { useEffect, useRef, useState } from 'react';
import { formatEffects } from '../../engine/format';
import { ROLE_LABEL } from '../../data/labels';
import { CONTINUE_CHOICE_ID, type GameSnapshot } from '../../engine/game';
import { STAT_KEYS } from '../../engine/types';
import { STILLS } from '../../data/stills';
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

  const milestoneId = snapshot.milestoneId;
  const [shownStill, setShownStill] = useState<string | null>(null);

  useEffect(() => {
    if (!milestoneId) return;
    setShownStill(milestoneId);
    const id = window.setTimeout(() => setShownStill(null), 2200);
    return () => window.clearTimeout(id);
  }, [milestoneId]);

  const still = shownStill ? STILLS.find((s) => s.id === shownStill) ?? null : null;

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
        family={snapshot.family}
      />

      <section className="stats" aria-label="五维数值">
        {STAT_KEYS.map((key) => (
          <StatBar key={key} stat={key} value={snapshot.stats[key]} />
        ))}
      </section>

      <p className="career-line">{snapshot.careerLine}</p>

      {snapshot.states.length > 0 && (
        <div className="state-chips" aria-label="持续状态">
          {snapshot.states.map((st) => (
            <span key={st.id} className="state-chip">{st.label}</span>
          ))}
        </div>
      )}

      {snapshot.family.length > 0 && (
        <section className="family-panel" aria-label="家人">
          <h3>家人</h3>
          <ul className="family-list">
            {snapshot.family.map((m) => {
              const dead = m.deathYear !== undefined && m.deathYear <= snapshot.year;
              const age = (dead ? m.deathYear! : snapshot.year) - m.birthYear;
              return (
                <li key={`${m.role}-${m.name}`} className={dead ? 'is-dead' : ''}>
                  <span className="family-role">{ROLE_LABEL[m.role] ?? m.role}</span>
                  <span className="family-name">{m.name}</span>
                  {m.job && <span className="family-job">{m.job}</span>}
                  <span className="family-age">{dead ? `${age} 岁离世` : `${age} 岁`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {snapshot.interests.length > 0 && (
        <section className="interest-panel" aria-label="兴趣">
          <h3>花时间最多的事</h3>
          <ul className="interest-list">
            {snapshot.interests.slice(0, 3).map((i) => (
              <li key={i.id}>
                <span className="interest-name">{i.label}</span>
                <span className="interest-lv">{`Lv.${i.level}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                  <span className="focus-effects">{formatEffects(snapshot.focusDisplay[option.id] ?? option.effects)}</span>
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

      {still && (
        <div className="still" onClick={() => setShownStill(null)} role="presentation">
          <div className="still-inner">
            <span className="still-year">{snapshot.year}</span>
            <h2>{still.title}</h2>
            <p>{still.line}</p>
          </div>
        </div>
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
