import { hasCurrent } from './engine/save';
import BirthScreen from './ui/screens/BirthScreen';
import DeathScreen from './ui/screens/DeathScreen';
import PlayScreen from './ui/screens/PlayScreen';
import { useGame } from './ui/store';

export default function App() {
  const { snapshot, actions } = useGame();

  if (!snapshot) {
    return (
      <BirthScreen
        onStart={(birth) => actions.startGame(birth)}
        onResume={() => actions.resume()}
        canResume={hasCurrent()}
      />
    );
  }
  if (snapshot.phase === 'dead') return <DeathScreen />;
  return <PlayScreen />;
}
