import { toneFilter } from '../../data/props';

export interface SceneStageProps {
  year: number;
  age: number;
  urban: boolean;
  health: number;
  happiness: number;
}

/**
 * 占位版场景：真正像素图在 Task 24–25 替换。
 * 现在只保证尺寸、比例与年代色调是真的 —— 换图时不用动布局。
 */
export function SceneStage({ year, age, urban, health, happiness }: SceneStageProps) {
  const posture = health < 30 ? 'is-frail' : '';
  const bounce = happiness >= 70 ? 'is-happy' : '';
  return (
    <div className={`scene ${urban ? 'scene-urban' : 'scene-rural'}`} style={{ filter: toneFilter(year) }}>
      <div className="scene-sky" />
      <div className="scene-hill" />
      <div className="scene-ground" />
      <div className={`scene-actor ${posture} ${bounce}`} data-age={age < 13 ? 'child' : age < 40 ? 'young' : 'old'} />
      <span className="scene-caption">{`${year} · ${urban ? '城镇' : '乡村'}`}</span>
    </div>
  );
}
