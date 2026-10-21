import { useGame } from '../store';

export default function PlayScreen() {
  const { snapshot, actions } = useGame();
  if (!snapshot) return null;
  return (
    <main className="screen">
      <p>
        {snapshot.year} 年 · {snapshot.age} 岁
      </p>
      <button type="button" onClick={() => actions.tick()}>
        下一年
      </button>
    </main>
  );
}
