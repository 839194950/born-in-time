import { useEffect, useMemo, useState } from 'react';
import { GENDER_LABEL, JOB_LABEL, TIER_LABEL } from '../../data/labels';
import { urbanizationCaveat } from '../../data/demography';
import { yearNote } from '../../data/yearNotes';
import { rollBirth } from '../../engine/birth';
import { YEAR_FROM, YEAR_TO } from '../../engine/types';
import { Portrait } from '../components/Portrait';
import { eraOfYear } from '../lib/era';
import { SEED_PARAM, encodeSeed, nextSeed, seedFromLocation } from '../lib/share';
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

      <div className="birth-body">
        <div className="birth-portrait">
          <Portrait age={0} gender={birth.gender} urban={birth.urban} health={80} happiness={60} flags={[]} />
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
      </div>

      <p className="card-line">{urbanizationLine(birth)}</p>
      {urbanizationCaveat(birth.year) && (
        <p className="card-line card-line-muted">{urbanizationCaveat(birth.year)}</p>
      )}
      <p className="card-line card-line-muted">{yearNote(birth.year)}</p>
    </section>
  );
}

export default function BirthScreen({
  onStart,
  onResume,
  canResume = false,
}: {
  onStart: (birth: Birth, seed: number) => void;
  onResume?: () => void;
  canResume?: boolean;
}) {
  // 一局 = 一个种子：出生与对局共用，分享链接才可能复现同一局
  const [seed, setSeed] = useState<number>(() => seedFromLocation() ?? (Date.now() >>> 0));
  const birth = useMemo(() => rollBirth(createRng(seed)), [seed]);

  const [rolling, setRolling] = useState(true);
  const SPAN = YEAR_TO - YEAR_FROM + 1;
  const [shownYear, setShownYear] = useState(() => YEAR_FROM + (seed % SPAN));

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
      setShownYear(YEAR_FROM + Math.floor(Math.random() * SPAN));
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
    <main className="screen birth-screen" data-era={eraOfYear(birth.year).id}>
      <header className="birth-head">
        <h1>生逢其时</h1>
        <p className="sub">从恢复高考那年开始抽，抽到哪一年，就过哪一年的人生。</p>
      </header>

      <div className={`year-reel${rolling ? ' is-rolling' : ''}`}>
        <span className="year-number">{shownYear}</span>
        <span className="year-note">{rolling ? '……' : yearNote(birth.year)}</span>
      </div>
      {/* 只在定格后播报一次完整句；滚动期 aria-live 会把它变成 26 次朗读 */}
      <p className="sr-only" role="status">
        {rolling ? '正在抽签' : `抽到 ${birth.year} 年，${yearNote(birth.year)}`}
      </p>

      {/* 抽签期间保留占位，避免读屏用户遇到"标题之后整张卡凭空出现" */}
      <div aria-busy={rolling}>{rolling ? <div className="birth-card-placeholder" aria-hidden="true" /> : <BirthCard birth={birth} />}</div>

      <div className="actions">
        <button
          type="button"
          className="btn"
          aria-disabled={rolling}
          onClick={() => {
            if (rolling) return;
            setSeed((s) => nextSeed(s));
          }}
        >
          换一年
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            // 把种子写进地址栏：用户直接复制地址就是分享链接
            if (rolling) return;
            try {
              window.history.replaceState(null, '', `?${SEED_PARAM}=${encodeSeed(seed)}`);
            } catch {
              // 内嵌浏览器可能禁止改地址
            }
            onStart(birth, seed);
          }}
          aria-disabled={rolling}
        >
          就这一年，开始
        </button>
      </div>

      {canResume && onResume && (
        <button type="button" className="btn-resume" onClick={onResume}>
          继续上一局
        </button>
      )}

      {/* 关于：致谢、数据出处、隐私，一页装完（检查单 §二 要求的那一条） */}
      <footer className="about-foot">
        <p>
          灵感来源：<a href="https://1in8b.life" target="_blank" rel="noreferrer">1in8b.life</a>
          。本作的机制、文案与数据均为原创，未使用原作素材。
        </p>
        <p>史实取自国家统计局历年统计公报、教育部与国家卫健委公开数据；2026 年以后的条目均标注「推演」。</p>
        <p>存档只写在你这台设备的浏览器里，不上传、不需要账号。</p>
      </footer>
    </main>
  );
}
