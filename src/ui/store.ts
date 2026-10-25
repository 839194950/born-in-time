import { useSyncExternalStore } from 'react';
import { Game, type GameSnapshot } from '../engine/game';
import {
  clearCurrent,
  loadCurrentStatus,
  type LoadStatus,
  recordFromSnapshot,
  restoreGame,
  saveCurrent,
  serializeGame,
  pushRecord,
} from '../engine/save';
import type { Birth } from '../engine/types';
import { clearSeedFromUrl } from './lib/share';

export interface GameStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): GameSnapshot | null;
  getGame(): Game | null;
  startGame(birth: Birth, seed?: number): void;
  /** 三态：ok 恢复成功 / empty 没有存档 / stale 存档属于旧版本，需要重开 */
  resumeWithStatus(): LoadStatus;
  resume(): boolean;
  reset(): void;
  setFocus(id: string): void;
  tick(): void;
  resolve(id: string): void;
  advanceToDecision(): void;
}

export function createGameStore(): GameStore {
  let game: Game | null = null;
  let detach: (() => void) | null = null;
  let recorded = false;
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const attach = (next: Game): void => {
    detach?.();
    game = next;
    recorded = false;
    detach = next.subscribe(() => {
      const snap = next.snapshot;
      if (snap.phase === 'dead') {
        clearCurrent();
        if (!recorded) {
          recorded = true;
          pushRecord(recordFromSnapshot(snap));
        }
      } else {
        saveCurrent(serializeGame(next));
      }
      emit();
    });
  };

  // 用闭包而不是 this：store 的方法会被拆进 useGame 的 actions 对象里调用，
  // 那时 this 指向的是那个新对象，方法体里的 this.xxx 会直接炸。
  const resumeWithStatus = (): LoadStatus => {
    const { status, save } = loadCurrentStatus();
    if (status !== 'ok' || !save) return status;
    let restored: Game;
    try {
      restored = restoreGame(save);
    } catch {
      // 重放对不上（内容变过 / 档被改过）：明确报 stale，由 UI 提示重开
      return 'stale';
    }
    attach(restored);
    emit();
    return 'ok';
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return game?.snapshot ?? null;
    },
    getGame() {
      return game;
    },
    startGame(birth, seed = Date.now()) {
      const next = Game.fromBirth(birth, seed);
      attach(next);
      next.start();
      emit();
    },
    resumeWithStatus,
    resume: () => resumeWithStatus() === 'ok',
    reset() {
      detach?.();
      detach = null;
      game = null;
      recorded = false;
      // 回到出生屏前清掉地址栏里的种子，否则「再抽一年」抽到的还是同一年
      clearSeedFromUrl();
      emit();
    },
    setFocus(id) {
      game?.setFocus(id);
    },
    tick() {
      game?.tick();
    },
    resolve(id) {
      game?.resolve(id);
    },
    advanceToDecision() {
      game?.advanceToDecision();
    },
  };
}

export const store = createGameStore();

export interface GameActions {
  startGame(birth: Birth, seed?: number): void;
  resumeWithStatus(): LoadStatus;
  resume(): boolean;
  reset(): void;
  setFocus(id: string): void;
  tick(): void;
  resolve(id: string): void;
  advanceToDecision(): void;
}

export function useGame(): { snapshot: GameSnapshot | null; actions: GameActions } {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
  return {
    snapshot,
    actions: {
      startGame: store.startGame,
      resumeWithStatus: store.resumeWithStatus,
      resume: store.resume,
      reset: store.reset,
      setFocus: store.setFocus,
      tick: store.tick,
      resolve: store.resolve,
      advanceToDecision: store.advanceToDecision,
    },
  };
}
