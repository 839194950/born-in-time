import { useEffect, useState } from 'react';
import { clearCurrent, hasResumable } from './engine/save';
import { installAudioLifecycle, unlockAudio } from './ui/audio';
import { markVisit, track } from './ui/analytics';
import BirthScreen from './ui/screens/BirthScreen';
import DeathScreen from './ui/screens/DeathScreen';
import PlayScreen from './ui/screens/PlayScreen';
import { useGame } from './ui/store';

export default function App() {
  const { snapshot, actions } = useGame();
  const [staleNotice, setStaleNotice] = useState(false);

  useEffect(() => {
    markVisit();
    return installAudioLifecycle();
  }, []);

  if (!snapshot) {
    return (
      <>
        <BirthScreen
          onStart={(birth, seed) => {
            // 音频只能在这里解锁：抽签按钮在滚动期是 aria-disabled，不是合法手势
            unlockAudio();
            track('start', { year: birth.year });
            actions.startGame(birth, seed);
          }}
          onResume={() => {
            unlockAudio();
            const status = actions.resumeWithStatus();
            if (status === 'stale' || status === 'corrupt') {
              // 明确作废：告诉玩家为什么，而不是点一下毫无反应
              clearCurrent();
              setStaleNotice(true);
            }
          }}
          canResume={hasResumable()}
        />
        {staleNotice && (
          <div className="notice-toast" role="status">
            上一版的人生已经无法续玩（内容更新过），重新抽一年吧。
          </div>
        )}
      </>
    );
  }
  if (snapshot.phase === 'dead') return <DeathScreen />;
  return <PlayScreen />;
}
