import { ERA_EVENTS } from '../../data/events';

/**
 * 际遇图鉴：跨局累积"你赶上过哪些时代窗口"。
 *
 * 这是最便宜的一条留存机制——它不需要新内容，只是把已有的账本换个地方放。
 * 想点亮"房改末班车"的人会主动重抽出生年，收集欲直接驱动"再抽一年"。
 */
const KEY = 'sfsq.collection.v1';

export interface CollectionState {
  caught: string[];
  total: number;
}

export function eraEventIds(): string[] {
  return ERA_EVENTS.map((e) => e.id);
}

export function loadCollection(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const valid = new Set(eraEventIds());
    return raw.filter((id): id is string => typeof id === 'string' && valid.has(id));
  } catch {
    return [];
  }
}

/** 把这一局赶上的窗口并进图鉴，返回新增了哪些 */
export function mergeCaught(caughtIds: readonly string[]): { newly: string[]; state: CollectionState } {
  const valid = new Set(eraEventIds());
  const before = new Set(loadCollection());
  const newly: string[] = [];
  for (const id of caughtIds) {
    if (!valid.has(id) || before.has(id)) continue;
    before.add(id);
    newly.push(id);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([...before]));
  } catch {
    // 存不下也不影响本局
  }
  return { newly, state: { caught: [...before], total: eraEventIds().length } };
}

export function titleOfEvent(id: string): string {
  return ERA_EVENTS.find((e) => e.id === id)?.title ?? id;
}
