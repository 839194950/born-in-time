import { useEffect, useMemo, useState } from 'react';
import type { GameSnapshot } from '../../engine/game';
import { buildCardData, deathLines } from '../lib/endingCard';
import { useGame } from '../store';
import { EndingScreen } from './EndingScreen';

type Step = 'moment' | 'card' | 'review';

export function DeathMoment({ snapshot, onNext }: { snapshot: GameSnapshot; onNext: () => void }) {
  return (
    <main className="death-screen">
      <div className="death-lines">
        {deathLines(snapshot).map((line, i) => (
          <p key={line} className="death-line" style={{ animationDelay: `${0.2 + i * 0.9}s` }}>
            {line}
          </p>
        ))}
      </div>
      <button type="button" className="btn-link death-next" onClick={onNext}>
        继续
      </button>
    </main>
  );
}

export default function DeathScreen() {
  const { snapshot, actions } = useGame();
  const [step, setStep] = useState<Step>('moment');

  const data = useMemo(() => (snapshot ? buildCardData(snapshot) : null), [snapshot]);

  useEffect(() => {
    if (step !== 'moment') return;
    const id = window.setTimeout(() => setStep('card'), 3600);
    return () => window.clearTimeout(id);
  }, [step]);

  if (!snapshot || !data) return null;

  if (step === 'moment') return <DeathMoment snapshot={snapshot} onNext={() => setStep('card')} />;
  if (step === 'card') {
    return (
      <EndingScreen
        data={data}
        onReview={() => setStep('review')}
        onRestart={() => actions.reset()}
      />
    );
  }

  return (
    <main className="screen">
      <p className="modal-body">详细复盘（下一步补完）</p>
      <button type="button" className="btn-primary" onClick={() => actions.reset()}>
        再抽一年
      </button>
    </main>
  );
}
