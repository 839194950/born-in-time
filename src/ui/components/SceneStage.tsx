import { useEffect, useRef } from 'react';
import { sceneForContext, toneFilter } from '../../data/props';
import type { FamilyMember, Gender } from '../../engine/types';
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
  family?: readonly FamilyMember[];
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
export function SceneStage({ year, age, gender, urban, health, happiness, flags, family = [] }: SceneStageProps) {
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
      companions: companionsFor(family, year, age, gender),
    });
  }, [year, age, gender, urban, health, happiness, role, family]);

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

/** 家人同框：小时候是父母，成家后是配偶和孩子。只画在世的人。 */
function companionsFor(
  family: readonly FamilyMember[],
  year: number,
  age: number,
  gender: Gender,
): { sprite: import('../lib/pixel').SpriteSpec; x: number }[] {
  const alive = family.filter((m) => m.deathYear === undefined || m.deathYear > year);
  const out: { sprite: import('../lib/pixel').SpriteSpec; x: number }[] = [];
  if (age <= 14) {
    const father = alive.find((m) => m.role === 'father');
    const mother = alive.find((m) => m.role === 'mother');
    if (father) out.push({ sprite: { stage: 'work', gender: 'male', outfit: 'farm', age: year - father.birthYear, health: 70, happiness: 60 }, x: 250 });
    if (mother) out.push({ sprite: { stage: 'work', gender: 'female', outfit: 'casual', age: year - mother.birthYear, health: 70, happiness: 60 }, x: 640 });
    return out;
  }
  const spouse = alive.find((m) => m.role === 'spouse');
  if (spouse) {
    const spouseAge = year - spouse.birthYear;
    out.push({
      sprite: { stage: stageOf(spouseAge), gender: gender === 'male' ? 'female' : 'male', outfit: 'casual', age: spouseAge, health: 70, happiness: 60 },
      x: 620,
    });
  }
  const child = alive.find((m) => m.role === 'child');
  if (child) {
    const childAge = year - child.birthYear;
    if (childAge >= 0 && childAge <= 22) {
      out.push({
        sprite: { stage: stageOf(childAge), gender: 'male', outfit: 'school', age: childAge, health: 80, happiness: 70 },
        x: 540,
      });
    }
  }
  return out;
}
