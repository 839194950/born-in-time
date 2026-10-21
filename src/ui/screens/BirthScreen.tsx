export default function BirthScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="screen">
      <h1>生逢其时</h1>
      <p>抽一个出生年份。</p>
      <button type="button" className="btn-primary" onClick={onStart}>
        开始
      </button>
    </main>
  );
}
