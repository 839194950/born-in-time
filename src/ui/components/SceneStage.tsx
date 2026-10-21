import { useEffect, useRef } from 'react';
import { sceneForContext, toneFilter } from '../../data/props';
import type { Gender } from '../../engine/types';
import { outfitFor, type OutfitRole } from '../lib/pixel';
import { SCENE_H, SCENE_W, drawScene } from '../lib/scene';

export interface SceneStageProps {
  year: number;
  age: number;
  gender: Gender;
  urban: boolean;
  health: number;
  happiness: number;
  flags: readonly string[];
}

export function roleFromFlags(flags: readonly string[], urban: boolean): OutfitRole {
  if (flags.includes('edtech')) return 'teacher';
  if (flags.includes('stable_job')) return 'office';
  if (flags.includes('self_employed') || flags.includes('gig_worker')) return 'worker';
  if (!urban && flags.includes('farmer_family')) return 'farmer';
  return 'none';
}

/**
 * 场景与角色都在 canvas 上按像素网格绘制：零素材、风格一致、随时可改。
 * 以后要换成手绘 PNG，只需要改这一个组件。
 */
export function SceneStage({ year, age, gender, urban, health, happiness, flags }: SceneStageProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const role = roleFromFlags(flags, urban);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawScene(ctx, {
      year,
      urban,
      scene: sceneForContext({ age, urban, role }),
      sprite: { stage: stageOf(age), gender, outfit: outfitFor(age, gender, role), age, health, happiness },
    });
  }, [year, age, gender, urban, health, happiness, role]);

  return (
    <div className="scene-wrap">
      <canvas
        ref={ref}
        className={`scene-canvas${happiness >= 70 ? ' is-happy' : ''}`}
        width={SCENE_W}
        height={SCENE_H}
        style={{ filter: toneFilter(year) }}
        role="img"
        aria-label={`${year} 年的场景`}
      />
      <span className="scene-caption">{`${year} · ${urban ? '城镇' : '乡村'}`}</span>
    </div>
  );
}

function stageOf(age: number): 'infant' | 'child' | 'student' | 'work' | 'midlife' | 'elder' {
  if (age < 6) return 'infant';
  if (age < 13) return 'child';
  if (age < 23) return 'student';
  if (age < 40) return 'work';
  if (age < 60) return 'midlife';
  return 'elder';
}
