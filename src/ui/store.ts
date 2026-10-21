import { useSyncExternalStore } from 'react';
import { Game, type GameSnapshot } from '../engine/game';
import { clearCurrent, loadCurrent, restoreGame, serializeGame, saveCurrent } from '../engine/save';
import type { Birth } from '../engine/types';

export interface GameStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): GameSnapshot | null;
  getGame(): Game | null;
  startGame(birth: Birth, seed?: number): void;
  resume(): boolean;
  setFocus(id: string): void;
  tick(): void;
  resolve(id: string): void;
  advanceToDecision(): void;
}

export function createGameStore(): GameStore {
  let game: Game | null = null;
  let detach: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of [...listeners]) listener();
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
      detach?.();
      const next = Game.fromBirth(birth, seed);
      game = next;
      detach = next.subscribe(() => {
        if (next.snapshot.phase === 'dead') clearCurrent();
        else saveCurrent(serializeGame(next));
        emit();
      });
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
      detach?.();
      game = restored;
      detach = restored.subscribe(() => {
        if (restored.snapshot.phase === 'dead') clearCurrent();
        else saveCurrent(serializeGame(restored));
        emit();
      });
      emit();
      return true;
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
      setFocus: store.setFocus,
      tick: store.tick,
      resolve: store.resolve,
      advanceToDecision: store.advanceToDecision,
    },
  };
}
