import type { EventDef } from '../../engine/types';
import { BROADCAST_EVENTS } from './broadcast';
import { CHILDHOOD_EVENTS } from './childhood';
import { CONDITIONAL_EVENTS } from './conditional';
import { ERA_EVENTS } from './era';
import { LATE_EVENTS } from './late';
import { STAGE_EVENTS } from './stage';

/** data 层唯一入口：新增内容只改这里引用的文件 */
export const ALL_EVENTS: readonly EventDef[] = [
  ...ERA_EVENTS,
  ...CHILDHOOD_EVENTS,
  ...LATE_EVENTS,
  ...STAGE_EVENTS,
  ...CONDITIONAL_EVENTS,
  ...BROADCAST_EVENTS,
];

export { BROADCAST_EVENTS, CHILDHOOD_EVENTS, CONDITIONAL_EVENTS, ERA_EVENTS, LATE_EVENTS, STAGE_EVENTS };
