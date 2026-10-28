import { useEffect, useMemo, useRef, useState } from 'react';
import { sceneForContext } from '../../data/props';
import type { FamilyMember, Gender } from '../../engine/types';
import { getImage, imageSettled, imageSettledCached, onImageReady, preloadSceneAssets } from '../lib/assets';
import { outfitFor, type OutfitRole } from '../lib/pixel';
import { SCENE_H, SCENE_W, drawScene, sceneAssetUrls, type CompanionKind } from '../lib/scene';

export interface SceneStageProps {
  year: number;
  age: number;
  gender: Gender;
  urban: boolean;
  health: number;
  happiness: number;
  flags: readonly string[];
  family?: readonly FamilyMember[];
  /** 本局种子：决定主角抽哪套生图脸 */
  seed?: number;
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
  seed = 0,
  variant = 'frame',
}: SceneStageProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const role = roleFromFlags(flags, urban);
  /** 待机呼吸：0 / 1 两帧交替。幅度只有 1px，但两帧之后就不是贴纸了。 */
  const [breath, setBreath] = useState<0 | 1>(0);
  /** 生图素材是异步加载的：任一图就绪就重绘一次，像素小人随即换成精灵。
   *  挂载时预热全部场景素材，避免中途新场景/新年龄段第一次出现时现下闪回程序画风。 */
  const [, setImgTick] = useState(0);
  /** 本场景要用的生图地址（与 drawScene 请求的完全一致；呼吸帧不影响地址，用 0 占位） */
  const requiredUrls = useMemo(
    () =>
      sceneAssetUrls({
        year,
        urban,
        scene: sceneForContext({ age, urban, role }),
        seed,
        sprite: { stage: stageOf(age), gender, outfit: outfitFor(age, gender, role), age, health, happiness, breath: 0 },
        companions: companionsFor(family, year, age, gender),
      }),
    [year, urban, age, gender, role, seed, health, happiness, family],
  );
  const urlsKey = requiredUrls.join('|');
  /** 已确认到货的那组地址；要求一变就失效，图到货前不画程序占位 */
  const [settledKey, setSettledKey] = useState<string | null>(() =>
    requiredUrls.every(imageSettledCached) ? urlsKey : null,
  );
  const [timedOut, setTimedOut] = useState(false);
  const showScene = settledKey === urlsKey || timedOut;
  useEffect(() => {
    // 本场景的图先下（排在预热队列前面）：否则弱网下 20 张背景板会把人物精灵挡在后面，
    // 门靠超时放行时就会出现“新背景板 + 程序小人”的混搭
    requiredUrls.forEach((u) => getImage(u));
    preloadSceneAssets();
    return onImageReady(() => {
      setImgTick((t) => t + 1);
      if (requiredUrls.every(imageSettled)) setSettledKey(urlsKey);
    });
  }, [urlsKey]);
  /** 首帧门：本场景的图都到货（或确认缺图）前显示加载态；15 秒还没到货就先放行，避免弱网下卡加载 */
  useEffect(() => {
    setTimedOut(false);
    if (requiredUrls.every(imageSettled)) {
      setSettledKey(urlsKey);
      return undefined;
    }
    setSettledKey(null);
    const t = window.setTimeout(() => setTimedOut(true), 15000);
    return () => window.clearTimeout(t);
  }, [urlsKey]);

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
    if (!showScene) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawScene(ctx, {
      year,
      urban,
      scene: sceneForContext({ age, urban, role }),
      seed,
      sprite: { stage: stageOf(age), gender, outfit: outfitFor(age, gender, role), age, health, happiness, breath },
      companions: companionsFor(family, year, age, gender),
    });
  }, [year, age, gender, urban, health, happiness, role, family, breath, seed, showScene]);

  return (
    <div className={variant === 'plain' ? 'scene-plain' : 'scene-wrap'}>
      {showScene ? (
        <canvas
          ref={ref}
          className="scene-canvas"
          width={SCENE_W}
          height={SCENE_H}
          role="img"
          aria-label={`${year} 年的场景`}
        />
      ) : (
        <div className="scene-loading" role="status" aria-label="场景加载中">
          场景加载中…
        </div>
      )}
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
): { sprite: import('../lib/pixel').SpriteSpec; x: number; kind: CompanionKind; age: number }[] {
  const alive = family.filter((m) => m.deathYear === undefined || m.deathYear > year);
  const out: { sprite: import('../lib/pixel').SpriteSpec; x: number; kind: CompanionKind; age: number }[] = [];
  if (age <= 14) {
    const father = alive.find((m) => m.role === 'father');
    const mother = alive.find((m) => m.role === 'mother');
    // 家人要"围"在主角身边，不是隔着一条街排排站：父 330 / 主角 430 / 母 525
    if (father) {
      const a = year - father.birthYear;
      out.push({ sprite: { stage: 'work', gender: 'male', outfit: 'farm', age: a, health: 70, happiness: 60 }, x: 330, kind: 'father', age: a });
    }
    if (mother) {
      const a = year - mother.birthYear;
      out.push({ sprite: { stage: 'work', gender: 'female', outfit: 'casual', age: a, health: 70, happiness: 60 }, x: 525, kind: 'mother', age: a });
    }
    return out;
  }
  const spouse = alive.find((m) => m.role === 'spouse');
  if (spouse) {
    const spouseAge = year - spouse.birthYear;
    out.push({
      sprite: { stage: stageOf(spouseAge), gender: gender === 'male' ? 'female' : 'male', outfit: 'casual', age: spouseAge, health: 70, happiness: 60 },
      x: 540,
      kind: 'spouse',
      age: spouseAge,
    });
  }
  const child = alive.find((m) => m.role === 'child');
  if (child) {
    const childAge = year - child.birthYear;
    if (childAge >= 0 && childAge <= 22) {
      out.push({
        sprite: { stage: stageOf(childAge), gender: 'male', outfit: 'school', age: childAge, health: 80, happiness: 70 },
        x: 345,
        kind: 'child',
        age: childAge,
      });
    }
  }
  return out;
}
