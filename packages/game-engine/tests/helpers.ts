import { expect } from 'vitest';
import type {
  ActionResult,
  Card,
  GameState,
  LandType,
  PlayerState,
  RandomSource,
} from '../src/index.js';

export const zeroRng: RandomSource = { next: () => 0 };

export function sequenceRng(values: readonly number[]): RandomSource {
  let index = 0;
  return {
    next: () => {
      const value = values[index] ?? 0;
      index += 1;
      return value;
    },
  };
}

export function card(
  id: string,
  type: LandType,
  ownerId: string,
): Card {
  return { id, type, ownerId };
}

export function playerState(
  id: string,
  zones: Partial<Pick<PlayerState, 'deck' | 'hand' | 'field' | 'graveyard'>> = {},
): PlayerState {
  return {
    id,
    deck: zones.deck ?? [],
    hand: zones.hand ?? [],
    field: zones.field ?? [],
    graveyard: zones.graveyard ?? [],
  };
}

export function gameState(
  first: PlayerState,
  second: PlayerState,
  overrides: Partial<Omit<GameState, 'players'>> = {},
): GameState {
  return {
    players: [first, second],
    currentPlayerId: first.id,
    startingPlayerId: first.id,
    turnNumber: 1,
    phase: 'MAIN',
    landPlayedThisTurn: false,
    pending: null,
    winnerId: null,
    ...overrides,
  };
}

export function stateOf(result: ActionResult): GameState {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.state;
}

export function playerOf(state: GameState, id: string): PlayerState {
  const found = state.players.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`Missing player ${id}`);
  }
  return found;
}
