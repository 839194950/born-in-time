import type { EventDef } from '../../engine/types';
import { BROADCAST_EVENTS } from './broadcast';
import { CONDITIONAL_EVENTS } from './conditional';
import { ERA_EVENTS } from './era';
import { STAGE_EVENTS } from './stage';

/** data 层唯一入口：新增内容只改这里引用的文件 */
export const ALL_EVENTS: readonly EventDef[] = [
  ...ERA_EVENTS,
  ...STAGE_EVENTS,
  ...CONDITIONAL_EVENTS,
  ...BROADCAST_EVENTS,
];

export { BROADCAST_EVENTS, CONDITIONAL_EVENTS, ERA_EVENTS, STAGE_EVENTS };
