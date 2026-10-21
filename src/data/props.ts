/** Task 25 会补齐道具年代替代表；这里先定好色调与接口 */
export type PropSlot = 'tv' | 'vehicle' | 'phone' | 'desk' | 'wall';

export interface PropPlacement {
  id: string;
  slot: PropSlot;
  src: string;
}

/**
 * 场景色调随年份滑动：80 年代褪色胶片 → 90 年代微暖 → 2000 年代后干净明亮。
 */
export function toneFilter(year: number): string {
  const t = Math.min(1, Math.max(0, (year - 1977) / 33));
  const saturate = 0.75 + t * 0.35;
  const sepia = 0.28 * (1 - t);
  const contrast = 0.92 + t * 0.1;
  const brightness = 0.94 + t * 0.08;
  return `saturate(${saturate.toFixed(3)}) sepia(${sepia.toFixed(3)}) contrast(${contrast.toFixed(3)}) brightness(${brightness.toFixed(3)})`;
}

export function propsForYear(_year: number): PropPlacement[] {
  return [];
}
