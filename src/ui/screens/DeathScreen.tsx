import { useEffect, useMemo, useState } from 'react';
import { SceneStage } from '../components/SceneStage';
import { playCue } from '../audio';
import type { GameSnapshot } from '../../engine/game';
import { buildCardData, deathLines } from '../lib/endingCard';
import { useGame } from '../store';
import { EndingScreen } from './EndingScreen';
import { ReviewScreen } from './ReviewScreen';

type Step = 'moment' | 'card' | 'review';

export function DeathMoment({ snapshot, onNext }: { snapshot: GameSnapshot; onNext: () => void }) {
  useEffect(() => {
    // 重量交给静默：先全静默 1.2 秒，再一声"关机"，不写挽歌
    playCue('death.moment');
  }, []);

  return (
    <main className="death-screen">
      {/* 最后一帧留在原地，用 1.6 秒淡到黑。不是"切黑屏"，是这间屋子慢慢没光。 */}
      <div className="death-fade" aria-hidden="true">
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
      <div className="death-lines">
        {deathLines(snapshot).map((line, i) => (
          <p key={line} className="death-line" style={{ animationDelay: `${1.3 + i * 0.9}s` }}>
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

  return <ReviewScreen snapshot={snapshot} data={data} onRestart={() => actions.reset()} />;
}
