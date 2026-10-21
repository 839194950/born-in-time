import { STAT_KEYS, type StatKey, type Stats } from './types';

export const STAT_LABEL: Record<StatKey, string> = {
  health: '健康',
  ability: '能力',
  wealth: '财富',
  family: '亲情',
  happiness: '幸福',
};

/** “能力 +6　财富 −2”，给按钮上的数值预览用。scale 用于展示真实生效值。 */
export function formatEffects(effects?: Partial<Stats>, scale = 1): string {
  if (!effects) return '';
  return STAT_KEYS.filter((k) => effects[k] !== undefined && effects[k] !== 0)
    .map((k) => {
      const v = (effects[k] as number) * scale;
      const shown = Number.isInteger(v) ? String(Math.abs(v)) : Math.abs(v).toFixed(1);
      return `${STAT_LABEL[k]} ${v > 0 ? '+' : '−'}${shown}`;
    })
    .join('　');
}
