import { useEffect, useMemo, useState } from 'react';
import { GENDER_LABEL, JOB_LABEL, TIER_LABEL } from '../../data/labels';
import { yearNote } from '../../data/yearNotes';
import { rollBirth } from '../../engine/birth';
import { createRng } from '../../engine/rng';
import type { Birth } from '../../engine/types';

const ROLL_MS = 1600;
const TICK_MS = 60;

export function urbanizationLine(birth: Birth): string {
  const urbanCount = Math.max(1, Math.ceil(birth.urbanizationRate * 10));
  return birth.urban
    ? `这一年出生的孩子，10 个里只有不到 ${urbanCount} 个生在城里。你是其中之一。`
    : `这一年出生的孩子，10 个里有 ${10 - urbanCount} 个生在乡下。你是其中之一。`;
}

export function siblingsLine(siblings: number): string {
  return siblings === 0 ? '独生子女' : `${siblings} 个兄弟姐妹`;
}

export function BirthCard({ birth }: { birth: Birth }) {
  return (
    <section className="birth-card" aria-label="出生卡">
      <div className="card-head">
        <span className="card-name">{birth.name}</span>
        <span className="card-meta">
          {birth.year} · {birth.province}
          {birth.urban ? '城市' : '农村'} · {TIER_LABEL[birth.tier]}家庭
        </span>
      </div>

      <dl className="card-grid">
        <div>
          <dt>性别</dt>
          <dd>{GENDER_LABEL[birth.gender]}</dd>
        </div>
        <div>
          <dt>父母职业</dt>
          <dd>{`${JOB_LABEL[birth.fatherJob]} · ${JOB_LABEL[birth.motherJob]}`}</dd>
        </div>
        <div>
          <dt>家境</dt>
          <dd>{TIER_LABEL[birth.tier]}</dd>
        </div>
        <div>
          <dt>兄弟姐妹</dt>
          <dd>{siblingsLine(birth.siblings)}</dd>
        </div>
        <div>
          <dt>预期寿命</dt>
          <dd>{`${birth.cohortLifeExpectancy.toFixed(1)} 岁`}</dd>
        </div>
      </dl>

      <p className="card-line">{urbanizationLine(birth)}</p>
      <p className="card-line card-line-muted">{yearNote(birth.year)}</p>
    </section>
  );
}

export default function BirthScreen({
  onStart,
  onResume,
  canResume = false,
}: {
  onStart: (birth: Birth) => void;
  onResume?: () => void;
  canResume?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const birth = useMemo(
    () => rollBirth(createRng((Date.now() ^ (attempt * 2654435761)) >>> 0)),
    [attempt],
  );

  const [rolling, setRolling] = useState(true);
  const [shownYear, setShownYear] = useState(() => 1977 + (attempt % 26));

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setRolling(true);
    if (reduced) {
      setShownYear(birth.year);
      setRolling(false);
      return;
    }

    const timer = window.setInterval(() => {
      setShownYear(1977 + Math.floor(Math.random() * 26));
    }, TICK_MS);
    const stop = window.setTimeout(() => {
      window.clearInterval(timer);
      setShownYear(birth.year);
      setRolling(false);
    }, ROLL_MS);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [birth]);

  return (
    <main className="screen birth-screen">
      <header className="birth-head">
        <h1>生逢其时</h1>
        <p className="sub">从恢复高考那年开始抽，抽到哪一年，就过哪一年的人生。</p>
      </header>

      <div className={`year-reel${rolling ? ' is-rolling' : ''}`} aria-live="polite">
        <span className="year-number">{shownYear}</span>
        <span className="year-note">{rolling ? '……' : yearNote(birth.year)}</span>
      </div>

      {!rolling && <BirthCard birth={birth} />}

      <div className="actions">
        <button type="button" className="btn" onClick={() => setAttempt((a) => a + 1)} disabled={rolling}>
          换一年
        </button>
        <button type="button" className="btn-primary" onClick={() => onStart(birth)} disabled={rolling}>
          就这一年，开始
        </button>
      </div>

      {canResume && onResume && (
        <button type="button" className="btn-resume" onClick={onResume}>
          继续上一局
        </button>
      )}
    </main>
  );
}
