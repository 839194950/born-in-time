import type { FocusOption, Stage } from '../engine/types';

/**
 * 年度重心：随生命阶段换皮，此消彼长。
 * 每项都必须有升有降 —— 这是规格 §5 的硬规则，测试会强制。
 */
export const FOCUS_OPTIONS: Readonly<Record<Stage, readonly FocusOption[]>> = {
  infant: [],
  child: [
    {
      id: 'play',
      label: '玩',
      effects: { happiness: 3, ability: -1 },
      axes: { calm: 1, now: 2 },
    },
    {
      id: 'study',
      label: '学习',
      effects: { ability: 3, happiness: -1 },
      axes: { future: 2, work: 1 },
    },
    {
      id: 'chores',
      label: '帮家里',
      effects: { family: 3, ability: -1, happiness: -1 },
      axes: { companion: 2, root: 2 },
    },
    {
      id: 'sport',
      label: '运动',
      effects: { health: 2, ability: 1, happiness: -1 },
      axes: { now: 1, calm: 1 },
    },
  ],
  student: [
    {
      id: 'study',
      label: '学习',
      effects: { ability: 3, health: -1, happiness: -1 },
      axes: { future: 3, work: 1 },
    },
    {
      id: 'social',
      label: '社交',
      effects: { happiness: 2, family: 1, ability: -1 },
      axes: { companion: 2, now: 1 },
    },
    {
      id: 'parttime',
      label: '打工攒钱',
      effects: { wealth: 3, health: -1, ability: -1 },
      axes: { work: 2, now: 1 },
    },
    {
      id: 'hobby',
      label: '爱好',
      effects: { happiness: 2, ability: 1, health: -1 },
      axes: { calm: 2, root: 1 },
    },
  ],
  work: [
    {
      id: 'career',
      label: '拼事业',
      effects: { wealth: 2, ability: 2, health: -1, family: -1 },
      axes: { work: 3, future: 1 },
    },
    {
      id: 'family',
      label: '顾家',
      effects: { family: 3, happiness: 1, wealth: -1 },
      axes: { companion: 3, calm: 1 },
    },
    {
      id: 'save',
      label: '攒钱投资',
      effects: { wealth: 3, happiness: -1, family: -1 },
      axes: { future: 2, work: 1 },
    },
    {
      id: 'rest',
      label: '休息生活',
      effects: { health: 2, happiness: 2, wealth: -2 },
      axes: { calm: 3, now: 1 },
    },
  ],
  midlife: [
    {
      id: 'career',
      label: '事业',
      effects: { wealth: 2, health: -2, family: -1 },
      axes: { work: 3, future: 1 },
    },
    {
      id: 'parents',
      label: '父母',
      effects: { family: 3, health: -1, happiness: -1 },
      axes: { companion: 3, root: 2 },
    },
    {
      id: 'kids',
      label: '孩子',
      effects: { family: 2, happiness: 1, wealth: -1 },
      axes: { companion: 2, future: 2 },
    },
    {
      id: 'self',
      label: '自己',
      effects: { health: 2, happiness: 2, family: -1 },
      axes: { calm: 3, now: 2 },
    },
  ],
  elder: [
    {
      id: 'health',
      label: '养生',
      effects: { health: 1, happiness: 1, wealth: -1 },
      axes: { calm: 3, now: 1 },
    },
    {
      id: 'grandkids',
      label: '带孙辈',
      effects: { family: 3, happiness: 1, health: -1 },
      axes: { companion: 3, root: 2 },
    },
    {
      id: 'work',
      label: '发挥余热',
      effects: { wealth: 2, health: -2 },
      axes: { work: 3, future: 1 },
    },
    {
      id: 'friends',
      label: '老友社交',
      effects: { happiness: 2, family: 1, health: -1 },
      axes: { calm: 2, companion: 1 },
    },
  ],
};
