import { useSyncExternalStore } from 'react';
import { Game, type GameSnapshot } from '../engine/game';
import {
  clearCurrent,
  loadCurrent,
  recordFromSnapshot,
  restoreGame,
  saveCurrent,
  serializeGame,
  pushRecord,
} from '../engine/save';
import type { Birth } from '../engine/types';

export interface GameStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): GameSnapshot | null;
  getGame(): Game | null;
  startGame(birth: Birth, seed?: number): void;
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
    resume() {
      const save = loadCurrent();
      if (!save) return false;
      let restored: Game;
      try {
        restored = restoreGame(save);
      } catch {
        return false;
      }
      attach(restored);
      emit();
      return true;
    },
    reset() {
      detach?.();
      detach = null;
      game = null;
      recorded = false;
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
      resume: store.resume,
      reset: store.reset,
      setFocus: store.setFocus,
      tick: store.tick,
      resolve: store.resolve,
      advanceToDecision: store.advanceToDecision,
    },
  };
}
