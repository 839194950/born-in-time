import { useEffect, useState } from 'react';
import { clearCurrent, hasResumable } from './engine/save';
import { simulatePeers } from './engine/peers';
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
            // 预热同年对照组：它要跑完三条完整人生（本机 ~34ms，低端机更久），
            // 放在主循环首帧会卡住场景渲染。这里用户正在等抽签动画，感知不到。
            simulatePeers(birth, seed);
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
            这一局的存档对不上（可能是版本更新过），只能重开一局。
          </div>
        )}
      </>
    );
  }
  if (snapshot.phase === 'dead') return <DeathScreen />;
  return <PlayScreen />;
}
