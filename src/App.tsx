import { rollBirth } from './engine/birth';
import { createRng } from './engine/rng';
import BirthScreen from './ui/screens/BirthScreen';
import DeathScreen from './ui/screens/DeathScreen';
import PlayScreen from './ui/screens/PlayScreen';
import { useGame } from './ui/store';

export default function App() {
  const { snapshot, actions } = useGame();

  if (!snapshot) {
    return <BirthScreen onStart={() => actions.startGame(rollBirth(createRng(Date.now())))} />;
  }
  if (snapshot.phase === 'dead') return <DeathScreen />;
  return <PlayScreen />;
}
