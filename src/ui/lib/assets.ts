import { eraOfYear } from './era';
import type { SceneId } from '../../data/props';
import type { Gender } from '../../engine/types';

/**
 * 生图素材清单（美术规范 v1.1）：背景板按「场景×时代」取，人物精灵按
 * 「角色套×年龄段」取。素材在 public/assets 下，缺图或未加载完时场景层
 * 自动回退程序像素绘制，所以这里只管"有就用"。
 */

/** 素材用相对路径：站点 base 是 './'，单页应用始终位于根路径，相对引用在 dev 与 Pages 子路径下都成立 */
const BASE = '';

// ---------------------------------------------------------------- 精灵

const MALE_SETS = ['am', 'bm', 'cm'];
const FEMALE_SETS = ['af', 'bf', 'cf', 'df'];

/** 主角的脸由种子决定：一局一抽，抽到哪套过哪张脸的一生 */
export function protagonistSet(seed: number, gender: Gender): string {
  const sets = gender === 'male' ? MALE_SETS : FEMALE_SETS;
  return sets[Math.abs(seed) % sets.length] ?? sets[0]!;
}

/** 配偶 / 兄妹 / 孩子：与主角错开一套，避免同框撞脸 */
export function otherSet(seed: number, gender: Gender): string {
  const sets = gender === 'male' ? MALE_SETS : FEMALE_SETS;
  return sets[(Math.abs(seed) + 1) % sets.length] ?? sets[0]!;
}

/** 年龄 → 精灵阶段（与 pixel 的 stageOf 分界对齐） */
export function stageKeyForAge(age: number): string {
  if (age < 6) return '03';
  if (age < 13) return '08';
  if (age < 23) return '15';
  if (age < 40) return '25';
  if (age < 60) return '45';
  return '70';
}

export function dadStage(age: number): string {
  return age < 40 ? '30' : age < 65 ? '50' : '75';
}

export function momStage(age: number): string {
  return age < 40 ? '28' : age < 62 ? '48' : '72';
}

export function spriteUrl(set: string, stage: string): string {
  return `${BASE}assets/sprites/${set}-${stage}.webp`;
}

/** 证件照：与精灵同一套索引（角色套×年龄段），public/assets/idphotos 下 */
export function idPhotoUrl(set: string, stage: string): string {
  return `${BASE}assets/idphotos/${set}-${stage}.webp`;
}

// ---------------------------------------------------------------- 背景板

export interface PlateDef {
  src: string;
  /** 人物脚底基线（960×540 画布坐标） */
  baseline: number;
}

/** 20 张背景板（plates2 批次，极简扁平风与人物同族）：8 场景 × 可达时代组合，基线先统一 500，实机验图后按张微调 */
const PLATES: Record<string, PlateDef> = Object.fromEntries(
  [
    'yard:film', 'yard:calendar', 'yard:digital', 'street:calendar', 'street:digital',
    'classroom:film', 'classroom:calendar', 'classroom:digital',
    'factory:film', 'factory:calendar', 'factory:digital',
    'rental:film', 'rental:calendar', 'rental:digital',
    'living:film', 'living:calendar', 'living:digital',
    'office:calendar', 'office:digital', 'late:digital',
  ].map((key) => {
    const [scene, era] = key.split(':');
    return [key, { src: `assets/plates/${scene}-${era}.webp`, baseline: 500 }];
  }),
);

export function plateFor(scene: SceneId, year: number): PlateDef | undefined {
  return PLATES[`${scene}:${eraOfYear(year).id}`];
}

export function plateUrl(def: PlateDef): string {
  return `${BASE}${def.src}`;
}

// ---------------------------------------------------------------- 图片缓存

const cache = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

/** 任一图片加载完成时通知订阅者重绘（SceneStage 用） */
export function onImageReady(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 取已加载完成的图片；未完成返回 null（调用方回退程序绘制，加载完会再重绘） */
export function getImage(url: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = cache.get(url);
  if (!img) {
    img = new Image();
    img.onload = () => listeners.forEach((cb) => cb());
    img.src = url;
    cache.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
