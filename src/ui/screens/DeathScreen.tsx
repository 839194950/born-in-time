import { useGame } from '../store';

export default function DeathScreen() {
  const { snapshot } = useGame();
  if (!snapshot) return null;
  return (
    <main className="screen">
      <p>
        {snapshot.birth.year}—{snapshot.death?.year}
      </p>
    </main>
  );
}
