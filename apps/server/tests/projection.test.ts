import { describe, expect, it } from 'vitest';
import type { Card, GameState, PlayerState } from '@mblg-coliseu/game-engine';
import {
  getPrivatePlayerState,
  getPublicGameState,
  projectGameState,
} from '../src/projection.js';

function card(id: string, type: Card['type'], ownerId: string): Card {
  return { id, type, ownerId };
}

function player(
  id: string,
  hand: readonly Card[],
  deck: readonly Card[],
): PlayerState {
  return { id, hand, deck, field: [], graveyard: [] };
}

function stateWithPending(pending: GameState['pending']): GameState {
  return {
    players: [
      player(
        'one',
        [card('one-hand', 'MOUNTAIN', 'one')],
        [card('one-top', 'PLAINS', 'one')],
      ),
      player(
        'two',
        [card('two-secret', 'FOREST', 'two')],
        [card('two-top-secret', 'ISLAND', 'two')],
      ),
    ],
    currentPlayerId: 'one',
    startingPlayerId: 'one',
    turnNumber: 1,
    phase: 'MAIN',
    landPlayedThisTurn: false,
    pending,
    winnerId: null,
  };
}

describe('multiplayer state projection', () => {
  it('never exposes the opponent hand or deck top', () => {
    const state = stateWithPending(null);
    const firstView = projectGameState(state, 'one');
    const serialized = JSON.stringify(firstView);

    expect(firstView.privatePlayerState.hand).toEqual(state.players[0]?.hand);
    expect(firstView.publicGameState.players[1]?.handCount).toBe(1);
    expect(serialized).not.toContain('two-secret');
    expect(serialized).not.toContain('two-top-secret');
    expect(firstView.privatePlayerState.deckTop).toBeNull();
  });

  it('reveals an opponent hand only to the controller resolving Swamp', () => {
    const state = stateWithPending({
      kind: 'SWAMP_DISCARD',
      controllerId: 'one',
      targetPlayerId: 'two',
    });

    expect(getPrivatePlayerState(state, 'one').revealedOpponentHand).toEqual(
      state.players[1]?.hand,
    );
    expect(getPrivatePlayerState(state, 'two').revealedOpponentHand).toBeNull();
  });

  it('reveals Island deck top only to its controller and hides its card id publicly', () => {
    const state = stateWithPending({
      kind: 'ISLAND_TOP',
      controllerId: 'one',
      topCardId: 'one-top',
    });

    expect(getPrivatePlayerState(state, 'one').deckTop?.id).toBe('one-top');
    expect(getPrivatePlayerState(state, 'two').deckTop).toBeNull();
    expect(JSON.stringify(getPublicGameState(state, 'two'))).not.toContain('one-top');
  });
});
