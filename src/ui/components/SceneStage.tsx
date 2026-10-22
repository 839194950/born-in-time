import { useEffect, useRef, useState } from 'react';
import { sceneForContext } from '../../data/props';
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
  /** frame = 挂在页面里的带框场景；plain = 当背景用，不要画框和角标 */
  variant?: 'frame' | 'plain';
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
export function SceneStage({
  year,
  age,
  gender,
  urban,
  health,
  happiness,
  flags,
  family = [],
  variant = 'frame',
}: SceneStageProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const role = roleFromFlags(flags, urban);
  /** 待机呼吸：0 / 1 两帧交替。幅度只有 1px，但两帧之后就不是贴纸了。 */
  const [breath, setBreath] = useState<0 | 1>(0);

  useEffect(() => {
    // 尊重 reduced-motion：这类用户看到的是静帧，不是"动画坏了"
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => setBreath((b) => (b === 0 ? 1 : 0)), 1100);
    return () => window.clearInterval(id);
  }, []);

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
      sprite: { stage: stageOf(age), gender, outfit: outfitFor(age, gender, role), age, health, happiness, breath },
      companions: companionsFor(family, year, age, gender),
    });
  }, [year, age, gender, urban, health, happiness, role, family, breath]);

  return (
    <div className={variant === 'plain' ? 'scene-plain' : 'scene-wrap'}>
      <canvas
        ref={ref}
        className="scene-canvas"
        width={SCENE_W}
        height={SCENE_H}
        role="img"
        aria-label={`${year} 年的场景`}
      />
      {variant === 'frame' && <span className="scene-caption">{`${year} · ${urban ? '城镇' : '乡村'}`}</span>}
    </div>
  );
}

export function stageOf(age: number): 'infant' | 'child' | 'student' | 'work' | 'midlife' | 'elder' {
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
