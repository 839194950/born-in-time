/**
 * 音频：v1 零素材，全部用 Web Audio 合成。
 *
 * 基调见 AUDIT-06：像"一台没关严的旧收音机在空屋子里"——大部分时间是电流声，
 * 偶尔转到台，从不演奏给你听。所以这里没有旋律、没有和声进行，只有
 * 木头、纸、机械、开关这类物理声。死亡时刻的重量交给静默，不交给音乐。
 *
 * 三条硬约束：
 * 1. 这个模块**不许被 engine 引用**（engine 是纯逻辑层，248 项测试在 node 里跑）。
 * 2. 静音用 gain=0 且 context 继续跑（世界没变，节流计时不该冻）；
 *    切后台才 suspend（世界已经跳年份，尾音必须丢弃）。
 * 3. iOS 上 create 会抢占音频会话，所以只在明确的开始手势里 create。
 */

export type Cue =
  | 'reel.lock'
  | 'modal.open'
  | 'choice.confirm'
  | 'still.in'
  | 'ui.stat.down'
  | 'death.moment'
  | 'ending.card';

const BASE_VOLUME = 0.35;
const MUTE_KEY = 'sfsq.muted.v1';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let lastAt = new Map<Cue, number>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
muted = readMuted();

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : BASE_VOLUME;
  // 总线末端压一道，防止多个音叠在一起削波
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);
  return ctx;
}

/** 只在「就这一年，开始」「继续上一局」这类明确手势里调用 */
export function unlockAudio(): void {
  const ac = ensureContext();
  if (!ac) return;
  if (ac.state === 'suspended' || ac.state === 'interrupted') void ac.resume();
}

/** 页面回来时自愈：只 resume 已存在的 context，绝不 create */
export function resumeIfNeeded(): void {
  if (!ctx) return;
  if (ctx.state === 'suspended' || ctx.state === 'interrupted') void ctx.resume();
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // 存不下也能静音这一次
  }
  if (master && ctx) {
    master.gain.setTargetAtTime(next ? 0 : BASE_VOLUME, ctx.currentTime, 0.02);
  }
}

export function isMuted(): boolean {
  return muted;
}

/** 短促噪声：木头、纸、抽屉这类非乐音 */
function noise(ac: AudioContext, dur: number, freq: number, q: number, gain: number): void {
  const frames = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(master!);
  src.start();
}

function tone(ac: AudioContext, freq: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  osc.connect(g);
  g.connect(master!);
  osc.start();
  osc.stop(ac.currentTime + dur + 0.02);
}

/**
 * 播放一个 cue。倍速 8× 以上按最小间隔节流——
 * 不节流的话，16× 下每年都响一次就变成机关枪了。
 */
export function playCue(cue: Cue): void {
  if (muted) return;
  const ac = ctx;
  if (!ac || ac.state !== 'running') return;

  const now = performance.now();
  const gap = cue === 'choice.confirm' ? 400 : 120;
  if (now - (lastAt.get(cue) ?? 0) < gap) return;
  lastAt.set(cue, now);

  switch (cue) {
    case 'reel.lock':
      // 印章落纸：低频闷响 + 一次金属余震
      tone(ac, 96, 0.20, 0.20, 'triangle');
      noise(ac, 0.16, 1400, 0.9, 0.12);
      break;
    case 'modal.open':
      // 抽屉滑开：一小段带通噪声 + 轻微上滑
      noise(ac, 0.18, 900, 1.2, 0.10);
      tone(ac, 320, 0.10, 0.04, 'sine');
      break;
    case 'choice.confirm':
      // 签了个字：木质轻敲，没有庆祝音
      tone(ac, 520, 0.07, 0.10, 'sine');
      noise(ac, 0.05, 2400, 1.4, 0.06);
      break;
    case 'still.in':
      // 时间在这里喘了口气
      noise(ac, 0.6, 420, 0.7, 0.05);
      tone(ac, 180, 0.7, 0.03, 'sine');
      break;
    case 'ui.stat.down':
      // 漏气：窄带噪声下扫，不报警
      noise(ac, 0.12, 700, 2.0, 0.05);
      break;
    case 'death.moment': {
      // 世界继续，人不在了：先全静默 1.2s，然后一声关机
      const g = master!.gain;
      const t0 = ac.currentTime;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(BASE_VOLUME, t0);
      g.linearRampToValueAtTime(0.0001, t0 + 0.05);
      window.setTimeout(() => {
        if (!ctx || muted) return;
        const g2 = master!.gain;
        g2.setValueAtTime(0.0001, ctx.currentTime);
        g2.linearRampToValueAtTime(BASE_VOLUME, ctx.currentTime + 0.4);
        noise(ctx, 0.03, 3000, 0.7, 0.25);
        tone(ctx, 70, 0.5, 0.10, 'sine');
      }, 1200);
      break;
    }
    case 'ending.card':
      // 档案袋打开，不下判词：单音淡入，不解决
      tone(ac, 392, 0.5, 0.05, 'sine');
      break;
    default:
      break;
  }
}

/** 页面隐藏就挂起，省电也避免后台出声 */
export function installAudioLifecycle(): () => void {
  if (typeof document === 'undefined') return () => {};
  const onVisibility = (): void => {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') void ctx.suspend();
    else resumeIfNeeded();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}
