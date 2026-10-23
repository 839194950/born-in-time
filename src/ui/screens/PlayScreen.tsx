import { useEffect, useMemo, useRef, useState } from 'react';
import { isMuted, playCue, setMuted } from '../audio';
import { track } from '../analytics';
import { formatEffects } from '../../engine/format';
import { GENDER_LABEL, JOB_LABEL, ROLE_LABEL, TIER_LABEL } from '../../data/labels';
import { SCENES, sceneForContext } from '../../data/props';
import { simulatePeers } from '../../engine/peers';
import { CONTINUE_CHOICE_ID, type GameSnapshot } from '../../engine/game';
import { STAT_KEYS } from '../../engine/types';
import { STILLS } from '../../data/stills';
import { eraOfYear, type EraInfo } from '../lib/era';
import { EventModal } from '../components/EventModal';
import { Portrait } from '../components/Portrait';
import { roleFromFlags, SceneStage } from '../components/SceneStage';
import { StatBar } from '../components/StatBar';
import { Timeline } from '../components/Timeline';
import { useGame } from '../store';

/** 1× 下一年 60 秒：一生约一小时（用户 2026-10-22 拍板，对齐 1in8b 的节奏）。
 *  想快的走倍速：16× 时一年 3.75 秒。 */
export const YEAR_MS = 60000;
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
  const [muted, setMutedState] = useState(() => isMuted());

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

  // 弹窗出现 / 定格画面 / 抉择确认——音效都是"物理声"，不做奖惩音
  useEffect(() => {
    if (pending) playCue('modal.open');
  }, [pending]);

  useEffect(() => {
    if (snapshot.milestoneId) playCue('still.in');
  }, [snapshot.milestoneId]);

  const milestoneId = snapshot.milestoneId;
  const [shownStill, setShownStill] = useState<string | null>(null);

  /* 三时代换代：年份跨过 1990 / 2010 时，整屏换一套视觉（data-era 驱动
     CSS 变量缓变），并盖一张时代字卡做转场；胶片→挂历多一下暖色闪光。
     时代只由年份现算，不进存档；开局/读档落在哪个时代就直接是哪个时代。 */
  const era = eraOfYear(snapshot.year);
  const prevEraRef = useRef(era.id);
  const [eraCard, setEraCard] = useState<EraInfo | null>(null);
  const [eraFlash, setEraFlash] = useState(false);
  useEffect(() => {
    const prev = prevEraRef.current;
    if (prev === era.id) return;
    prevEraRef.current = era.id;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setEraFlash(prev === 'film' && era.id === 'calendar');
    setEraCard(era);
    const t = window.setTimeout(() => setEraCard(null), 2050);
    return () => window.clearTimeout(t);
    // era 是 ERAS 常量引用，按 id 触发即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [era.id]);

  useEffect(() => {
    if (!milestoneId) return;
    setShownStill(milestoneId);
    const id = window.setTimeout(() => setShownStill(null), 2200);
    return () => window.clearTimeout(id);
  }, [milestoneId]);

  const still = shownStill ? STILLS.find((s) => s.id === shownStill) ?? null : null;

  const canChooseFocus = phase === 'playing';

  // 场景名与同住人数：给场景加一句说明，像"你住在哪儿"而不是一张图
  const sceneId = sceneForContext({
    age: snapshot.age,
    urban: snapshot.birth.urban,
    role: roleFromFlags(snapshot.flags, snapshot.birth.urban),
  });
  const sceneName = SCENES.find((s) => s.id === sceneId)?.name ?? '家';
  const household = snapshot.family.filter(
    (m) => m.deathYear === undefined || m.deathYear > snapshot.year,
  ).length;

  const peers = useMemo(() => simulatePeers(snapshot.birth, snapshot.seed), [snapshot.birth, snapshot.seed]);
  const peerRank = useMemo(() => {
    const mine = snapshot.stats.happiness;
    const ahead = peers.filter((p) => {
      const now = p.yearly.find((y) => y.year === snapshot.year);
      return now ? now.happiness > mine : false;
    }).length;
    return ahead + 1;
  }, [peers, snapshot.stats.happiness, snapshot.year]);

  const idHash = useMemo(() => {
    let h = 0x811c9dc5;
    const text = `${snapshot.birth.name}|${snapshot.seed}|${snapshot.birth.year}`;
    for (let i = 0; i < text.length; i++) {
      h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    }
    const hex = h.toString(16).toUpperCase().padStart(8, '0');
    return `${hex}${hex.split('').reverse().join('')}`.slice(0, 24);
  }, [snapshot.birth.name, snapshot.seed, snapshot.birth.year]);

  return (
    <main className="screen play-screen" data-era={era.id}>
      {/* 顶部工具条：左＝你是谁，右＝怎么放 */}
      <header className="play-head">
        <div className="play-clock">
          <span className="play-year">{snapshot.year}</span>
          <span className="play-age">{`${snapshot.age} 岁`}</span>
          <span className="play-meta">
            {`${snapshot.birth.name} · ${snapshot.birth.province}${snapshot.birth.urban ? '城市' : '农村'}`}
          </span>
        </div>
        <div className="head-controls" role="group" aria-label="时间控制">
          <button
            type="button"
            className={`ctrl${paused ? ' is-active' : ''}`}
            onClick={() => setPaused((p) => !p)}
            disabled={phase !== 'playing'}
          >
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
          <button
            type="button"
            className="ctrl"
            onClick={() => actions.advanceToDecision()}
            disabled={phase !== 'playing'}
          >
            快进到下一个抉择
          </button>
          <button
            type="button"
            className={`ctrl${auto ? ' is-active' : ''}`}
            aria-pressed={auto}
            onClick={() => setAuto((a) => !a)}
          >
            自动抉择
          </button>
          <button
            type="button"
            className="ctrl"
            aria-pressed={!muted}
            title={muted ? '开启声音' : '静音'}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setMutedState(next);
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* 左栏：身份 + 状态 */}
      <div className="play-col-left">
        <section className="card identity-card">
          <div className="identity-top">
            <span className="identity-tag">身份证</span>
            <span className="identity-year">{`${snapshot.birth.year} 年生`}</span>
          </div>
          <div className="identity-main">
            <Portrait
              age={snapshot.age}
              gender={snapshot.birth.gender}
              urban={snapshot.birth.urban}
              health={snapshot.stats.health}
              happiness={snapshot.stats.happiness}
              flags={snapshot.flags}
            />
            <dl className="identity-rows">
              <div>
                <dt>性别</dt>
                <dd>{GENDER_LABEL[snapshot.birth.gender]}</dd>
              </div>
              <div>
                <dt>出生</dt>
                <dd>{`${snapshot.birth.year} 年 ${snapshot.birth.month} 月`}</dd>
              </div>
              <div>
                <dt>居住地</dt>
                <dd>{`${snapshot.birth.province}${snapshot.birth.urban ? '城市' : '农村'}`}</dd>
              </div>
              <div>
                <dt>父亲</dt>
                <dd>{JOB_LABEL[snapshot.birth.fatherJob]}</dd>
              </div>
              <div>
                <dt>母亲</dt>
                <dd>{JOB_LABEL[snapshot.birth.motherJob]}</dd>
              </div>
            </dl>
          </div>
          <p className="identity-hash">{idHash}</p>
          {/* 原「背景」卡并入身份证下半段（版式重排：九卡减一张） */}
          <div className="identity-facts">
            <h2 className="card-title">
              背景
              <small>出生时的样子</small>
            </h2>
            <dl className="fact-rows">
              <div>
                <dt>同年位次</dt>
                <dd>{`第 ${peerRank} 名 / ${peers.length + 1} 人`}</dd>
              </div>
              <div>
                <dt>家境</dt>
                <dd>{TIER_LABEL[snapshot.birth.tier]}</dd>
              </div>
              <div>
                <dt>出生时城镇化</dt>
                <dd>{`${Math.round(snapshot.birth.urbanizationRate * 100)}%`}</dd>
              </div>
              <div>
                <dt>同批人的预期寿命</dt>
                <dd>{`${Math.round(snapshot.birth.cohortLifeExpectancy)} 岁`}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="card status-card" aria-label="状态">
          <h2 className="card-title">
            状态
            <small>0–100</small>
          </h2>
          <div className="stats">
            {STAT_KEYS.map((key) => (
              <StatBar key={key} stat={key} value={snapshot.stats[key]} />
            ))}
          </div>
          <p className="career-line">{snapshot.careerLine}</p>
          {snapshot.states.length > 0 && (
            <div className="state-chips" aria-label="持续状态">
              {snapshot.states.map((st) => (
                <span key={st.id} className="state-chip">
                  {st.label}
                </span>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* 中栏：场景 + 重心 + 人生纪录 */}
      <div className="play-stage">
        <section className="card scene-card">
          <SceneStage
            year={snapshot.year}
            age={snapshot.age}
            gender={snapshot.birth.gender}
            urban={snapshot.birth.urban}
            health={snapshot.stats.health}
            happiness={snapshot.stats.happiness}
            flags={snapshot.flags}
            family={snapshot.family}
            seed={snapshot.seed}
          />
          <p className="scene-note">
            {`${snapshot.birth.province}${snapshot.birth.urban ? '城区' : '乡村'}的${sceneName}，家里 ${household} 口人。`}
          </p>
        </section>

        {snapshot.focusOptions.length > 0 && (
          <section className="card focus-card" aria-label="今年的重心">
            <h2 className="card-title">
              今年的重心
              <small>每年选一个</small>
            </h2>
            <p className="focus-hint">{stageHint(snapshot.age)}</p>
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
                    <span className="focus-effects">
                      {formatEffects(snapshot.focusDisplay[option.id] ?? option.effects)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="card record-card">
          <h2 className="card-title">
            人生纪录
            <small>最近 10 条</small>
          </h2>
          <Timeline entries={snapshot.timeline} limit={10} hideTitle />
        </section>
      </div>

      {/* 右栏：家人 + 同龄人 + 人生地图 */}
      <aside className="play-side">
        {snapshot.family.length > 0 && (
          <section className="card family-card" aria-label="家人">
            <h2 className="card-title">家人与生活</h2>
            <ul className="family-list">
              {snapshot.family.map((m) => {
                const dead = m.deathYear !== undefined && m.deathYear <= snapshot.year;
                const age = (dead ? m.deathYear! : snapshot.year) - m.birthYear;
                return (
                  <li key={`${m.role}-${m.name}`} className={dead ? 'is-dead' : ''}>
                    <span className="family-role">{ROLE_LABEL[m.role] ?? m.role}</span>
                    <span className="family-name">{m.name}</span>
                    <span className="family-job">{m.job ?? '—'}</span>
                    <span className="family-age">
                      {dead ? `${age} 岁离世` : `${age} 岁`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="card peers-card" aria-label="同年出生的人">
          <h2 className="card-title">
            {`和你同年出生的人`}
            <small>{snapshot.birth.year} 年</small>
          </h2>
          <ul className="peers-list">
            {peers.map((peer) => {
              const gone = snapshot.year > peer.deathYear;
              const now = peer.yearly.find((y) => y.year === snapshot.year);
              return (
                <li key={peer.birth.name}>
                  <span className="peer-name">{peer.birth.name}</span>
                  <span className="peer-meta">
                    {`${peer.birth.province} · ${peer.birth.urban ? '城镇' : '农村'} · ${TIER_LABEL[peer.birth.tier]}`}
                  </span>
                  <span className="peer-status">
                    {gone
                      ? `已于 ${peer.deathAge} 岁离世`
                      : now
                        ? `${now.age} 岁 · 幸福 ${Math.round(now.happiness)}`
                        : '在世'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card map-card" aria-label="人生地图">
          <h2 className="card-title">
            人生地图
            <small>一格一年</small>
          </h2>
          <LifeMap snapshot={snapshot} />
        </section>
      </aside>

      {pending && (
        <EventModal
          pending={pending}
          stats={snapshot.stats}
          onPick={(id) => {
            playCue('choice.confirm');
            track('choice', { id });
            actions.resolve(id);
          }}
          onContinue={() => actions.resolve(CONTINUE_CHOICE_ID)}
        />
      )}

      {eraCard && (
        <div className="era-veil" onClick={() => setEraCard(null)} role="presentation">
          {eraFlash && <div className="era-flash" />}
          <div className="era-card-inner">
            <div className="era-card-name">{eraCard.name}</div>
            <div className="era-card-years">{eraCard.years}</div>
          </div>
        </div>
      )}

      {still && (
        <div className="still" onClick={() => setShownStill(null)} role="presentation">
          {/* 定格画面用「当下这一刻的场景」做底：把人留在原地，只把声音和界面拿走。
              v1 这里是全黑遮罩 + 白字，等于把最有情绪的六个瞬间做成了幻灯片标题。 */}
          <div className="still-bg" aria-hidden="true">
            <SceneStage
              year={snapshot.year}
              age={snapshot.age}
              gender={snapshot.birth.gender}
              urban={snapshot.birth.urban}
              health={snapshot.stats.health}
              happiness={snapshot.stats.happiness}
              flags={snapshot.flags}
              family={snapshot.family}
              seed={snapshot.seed}
              variant="plain"
            />
          </div>
          <div className="still-veil" aria-hidden="true" />
          <div className="still-inner">
            <span className="still-year">{snapshot.year}</span>
            <h2>{still.title}</h2>
            <p>{still.line}</p>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * 每一段年龄的处境说明。
 *
 * 光给四个按钮，玩家不知道"选这个有什么用"。一句话交代当下的处境，
 * 重心就不再像四个没有含义的标签。
 */
function stageHint(age: number): string {
  if (age < 6) return '这六年你什么都做不了——怎么带，全看家里怎么安排。';
  if (age < 13) return '上学了。接下来几年怎么过，从现在开始定。';
  if (age < 19) return '中考和高考都在前面。这几年攒下的力气，到那时会兑现。';
  if (age < 30) return '该自己挣钱了。第一份工作，大致决定往后几十年的走向。';
  if (age < 45) return '房子、孩子、事业，哪一件先来，得自己排顺序。';
  if (age < 60) return '孩子长大了，父母老了。你站在中间，两头都要顾。';
  return '最后这些年。想怎么过，已经由你说了算。';
}

/**
 * 人生地图：一格一年。
 *
 * 深红 = 赶上过时代窗口，浅红 = 差一年，灰阶深浅 = 当年的幸福。
 * 这样一眼能看出"这辈子在哪几年是好的"，比一串时间戳有用。
 */
function LifeMap({ snapshot }: { snapshot: GameSnapshot }) {
  const first = snapshot.snapshots[0]?.year ?? snapshot.birth.year;
  const last = snapshot.year;
  const years: number[] = [];
  for (let y = first; y <= last; y++) years.push(y);

  const caught = new Set(
    snapshot.ledger.filter((e) => e.verdict === 'caught').map((e) => e.year),
  );
  const near = new Set(
    snapshot.ledger.filter((e) => e.verdict === 'nearMiss').map((e) => e.year),
  );
  const mood = new Map(snapshot.snapshots.map((s) => [s.year, s.happiness]));

  const rows: number[][] = [];
  for (let i = 0; i < years.length; i += 20) rows.push(years.slice(i, i + 20));

  return (
    <div className="lifemap">
      {rows.map((row, i) => (
        <div className="lifemap-row" key={i}>
          {row.map((y) => {
            const h = mood.get(y) ?? 50;
            const cls = caught.has(y)
              ? 'lm-caught'
              : near.has(y)
                ? 'lm-near'
                : 'lm-plain';
            return (
              <span
                key={y}
                className={`lm-cell ${cls}`}
                style={cls === 'lm-plain' ? { opacity: 0.28 + (h / 100) * 0.62 } : undefined}
                title={`${y} 年 · 幸福 ${Math.round(h)}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function PlayScreen() {
  const { snapshot, actions } = useGame();
  if (!snapshot) return null;
  return <PlayScreenView snapshot={snapshot} actions={actions} />;
}
