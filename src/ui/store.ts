import { useSyncExternalStore } from 'react';
import { Game, type GameSnapshot } from '../engine/game';
import type { Birth } from '../engine/types';

export interface GameStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): GameSnapshot | null;
  getGame(): Game | null;
  startGame(birth: Birth, seed?: number): void;
  setFocus(id: string): void;
  tick(): void;
  resolve(id: string): void;
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
      game = Game.fromBirth(birth, seed);
      detach = game.subscribe(emit);
      game.start();
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
  };
}

export const store = createGameStore();

export interface GameActions {
  startGame(birth: Birth, seed?: number): void;
  setFocus(id: string): void;
  tick(): void;
  resolve(id: string): void;
}

export function useGame(): { snapshot: GameSnapshot | null; actions: GameActions } {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
  return {
    snapshot,
    actions: {
      startGame: store.startGame,
      setFocus: store.setFocus,
      tick: store.tick,
      resolve: store.resolve,
    },
  };
}
