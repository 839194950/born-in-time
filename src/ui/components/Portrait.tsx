import { useEffect, useRef } from 'react';
import { CHAR_H, CHAR_W, drawCharacter, outfitFor } from '../lib/pixel';
import { roleFromFlags, stageOf } from './SceneStage';

export interface PortraitProps {
  age: number;
  gender: 'male' | 'female';
  urban: boolean;
  health: number;
  happiness: number;
  flags: readonly string[];
}

/**
 * 人物卡上的小头像。
 *
 * 和场景里用的是同一套 drawCharacter，所以头像是"这一个人"，
 * 不是一个抽象的占位图。像素放大用 nearest（image-rendering: pixelated），
 * 不然 48×64 拉到 56px 会糊成一团。
 */
export function Portrait({ age, gender, urban, health, happiness, flags }: PortraitProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CHAR_W, CHAR_H);
    drawCharacter(ctx, {
      stage: stageOf(age),
      gender,
      outfit: outfitFor(age, gender, roleFromFlags(flags, urban)),
      age,
      health,
      happiness,
    });
  }, [age, gender, urban, health, happiness, flags]);

  return (
    <canvas
      ref={ref}
      className="portrait"
      width={CHAR_W}
      height={CHAR_H}
      role="img"
      aria-label={`${age} 岁时的样子`}
    />
  );
}
