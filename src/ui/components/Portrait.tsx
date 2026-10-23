import { useEffect, useRef, useState } from 'react';
import { CHAR_H, CHAR_W, drawCharacter, outfitFor } from '../lib/pixel';
import { idPhotoUrl, stageKeyForAge } from '../lib/assets';
import { roleFromFlags, stageOf } from './SceneStage';

export interface PortraitProps {
  age: number;
  gender: 'male' | 'female';
  urban: boolean;
  health: number;
  happiness: number;
  flags: readonly string[];
  /** 主角角色套（am/bm/cm/af/bf/cf/df）：给了就用生图证件照，缺图自动回退程序绘制 */
  set?: string;
}

/**
 * 人物卡上的头像：优先用生图证件照（与场景精灵同一套脸、同一年龄段），
 * 图缺失或加载失败时回退到程序像素绘制——回退图和场景里用的是同一套
 * drawCharacter，所以最坏情况下头像也还是"这一个人"。
 */
export function Portrait(props: PortraitProps) {
  const { age, set } = props;
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [set, age]);

  if (set && !imgFailed) {
    return (
      <img
        className="portrait"
        src={idPhotoUrl(set, stageKeyForAge(age))}
        alt={`${age} 岁时的样子`}
        draggable={false}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return <CanvasPortrait {...props} />;
}

function CanvasPortrait({ age, gender, urban, health, happiness, flags }: PortraitProps) {
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
