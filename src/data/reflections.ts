import { averageWage, urbanizationRate } from './demography';
import type { ChoiceDef } from '../engine/types';

/**
 * 反思节点：18 / 30 / 40 / 50 / 60 岁各停一次。
 * 学 1in8b 的“暂停片刻”：先甩一个和这个人真实相关的年代数字，
 * 再问一个没有对错的问题。答案只留一句话在时间线里，效果都是小账。
 */
export interface ReflectionDef {
  age: number;
  title: string;
  fact: (ctx: { birthYear: number; year: number; lifeExpectancy: number }) => string;
  question: string;
  choices: ChoiceDef[];
  source: string;
}

const SRC = '城镇化率与城镇平均工资：国家统计局历年统计公报；出生队列预期寿命见游戏内人口模型';
const wage = (year: number): string => Math.round(averageWage(year)).toLocaleString('zh-CN');
const pct = (year: number): string => `${Math.round(urbanizationRate(year) * 100)}%`;

export const REFLECTION_AGES: readonly number[] = [18, 30, 40, 50, 60];

export const REFLECTIONS: readonly ReflectionDef[] = [
  {
    age: 18,
    title: '十八岁，停一停',
    fact: ({ birthYear, year }) =>
      `你出生那年，全国每 100 个人里大约有 ${pct(birthYear).slice(0, -1)} 个是城里人；到了今年，城镇平均工资大约是 ${wage(year)} 元一年。`,
    question: '十八岁了。往后这一辈子，你觉得是赶上更重要，还是使劲更重要？',
    choices: [
      { id: 'luck', label: '赶上更重要', effects: { happiness: 1 }, outcome: '你把这句话放在了心里。后来很多次，它都应验了——好的坏的都有。' },
      { id: 'effort', label: '使劲更重要', effects: { ability: 2, happiness: -1 }, outcome: '你把这句话放在了心里。后来很多次，你都靠它撑了过来。' },
      { id: 'both', label: '都重要，看命', effects: { happiness: 1 }, outcome: '你说都重要。说完你自己笑了一下，这个回答确实很十八岁。' },
    ],
    source: SRC,
  },
  {
    age: 30,
    title: '三十岁，停一停',
    fact: ({ year }) =>
      `三十岁这一年，城镇平均工资大约是 ${wage(year)} 元一年。你同年出生的人里，有的已经买了房，有的刚换第三份工作，有的孩子都会打酱油了。`,
    question: '回头看这十二年，你觉得自己走得怎么样？',
    choices: [
      { id: 'ok', label: '该赶的赶上了，还行', effects: { happiness: 2 }, outcome: '你说还行。这个年纪能说出“还行”的人，不多。' },
      { id: 'slow', label: '有几步走慢了', effects: { ability: 1, happiness: -1 }, outcome: '你把那几步在心里又走了一遍。走慢的地方，后来一直记得很清楚。' },
      { id: 'unknown', label: '说不上来', effects: {}, outcome: '你说说不上来。三十岁的很多问题，本来就没有标准答案。' },
    ],
    source: SRC,
  },
  {
    age: 40,
    title: '四十岁，停一停',
    fact: ({ lifeExpectancy }) =>
      `按统计，你这一代人的平均寿命预期大约是 ${Math.round(lifeExpectancy)} 岁。也就是说，到今天，人生在数字上已经过了一半。`,
    question: '上有老下有小的年纪。你觉得自己活成了小时候想的样子吗？',
    choices: [
      { id: 'close', label: '差不多吧', effects: { happiness: 1, family: 1 }, outcome: '你说差不多。小时候想当的人，和现在过日子的这个人，在这一刻对上了。' },
      { id: 'far', label: '差得远', effects: { happiness: -1 }, outcome: '你说差得远。说完沉默了一会儿，又低头忙手里的事去了。' },
      { id: 'forgot', label: '早就忘了想当什么了', effects: { happiness: 1 }, outcome: '你是真忘了。忘了有时候也是一种走出来了。' },
    ],
    source: SRC,
  },
  {
    age: 50,
    title: '五十岁，停一停',
    fact: ({ birthYear, year }) =>
      `你出生那年城镇化率是 ${pct(birthYear)}，今年是 ${pct(year)}。你半辈子，正好赶上这个国家从乡土变成城市。`,
    question: '半辈子过去了。剩下的日子，你想先紧着谁？',
    choices: [
      { id: 'family', label: '先紧着家里人', effects: { family: 2, happiness: 1 }, outcome: '你说先紧着家里。前半辈子是这么过来的，后半辈子也不打算改。' },
      { id: 'self', label: '想为自己活一点', effects: { happiness: 2, family: -1 }, outcome: '你说想为自己活一点。说这话的时候，你声音不大，但很确定。' },
      { id: 'same', label: '就这么过下去', effects: { happiness: 1 }, outcome: '你说就这么过。平平淡淡这个词，到你这岁数，是句好话。' },
    ],
    source: SRC,
  },
  {
    age: 60,
    title: '六十岁，停一停',
    fact: ({ lifeExpectancy }) =>
      `六十岁了。按统计，你这一代人平均能活到 ${Math.round(lifeExpectancy)} 岁左右——你已经走到了这个数字跟前。`,
    question: '要是能给十八岁的自己留一句话，你留什么？',
    choices: [
      { id: 'msg_brave', label: '别怕，往前走', effects: { happiness: 1 }, outcome: '你留给他四个字：别怕，往前走。写完你觉得，十八岁的自己大概会嫌这话太简单。' },
      { id: 'msg_family', label: '多陪陪家里人', effects: { family: 1, happiness: 1 }, outcome: '你留的是：多陪陪家里人。年轻的时候总觉得来日方长。' },
      { id: 'msg_none', label: '什么也不留', effects: {}, outcome: '你决定什么也不留。他该踩的坑，一个也不会少踩——但那就是他的一生。' },
    ],
    source: SRC,
  },
];

export function reflectionFor(age: number): ReflectionDef | undefined {
  return REFLECTIONS.find((r) => r.age === age);
}
