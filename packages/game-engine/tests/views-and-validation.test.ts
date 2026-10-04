import { describe, expect, it } from 'vitest';
import { applyAction, getPlayerView, getPublicState } from '../src/index.js';
import {
  card,
  gameState,
  playerState,
  stateOf,
  zeroRng,
} from './helpers.js';

describe('public/private state and action validation', () => {
  it('publishes counts and public zones without exposing deck or hand contents', () => {
    const handSecret = card('HAND-SECRET', 'SWAMP', 'p1');
    const deckSecret = card('DECK-SECRET', 'FOREST', 'p1');
    const publicLand = card('PUBLIC', 'PLAINS', 'p1');
    const state = gameState(
      playerState('p1', {
        hand: [handSecret],
        deck: [deckSecret],
        field: [publicLand],
      }),
      playerState('p2'),
    );
    const publicState = getPublicState(state);
    const serialized = JSON.stringify(publicState);

    expect(publicState.players[0].handCount).toBe(1);
    expect(publicState.players[0].deckCount).toBe(1);
    expect(publicState.players[0].field).toEqual([publicLand]);
    expect(serialized).not.toContain('HAND-SECRET');
    expect(serialized).not.toContain('DECK-SECRET');
  });

  it('gives each viewer only their own private hand', () => {
    const firstSecret = card('FIRST-SECRET', 'MOUNTAIN', 'p1');
    const secondSecret = card('SECOND-SECRET', 'ISLAND', 'p2');
    const state = gameState(
      playerState('p1', { hand: [firstSecret] }),
      playerState('p2', { hand: [secondSecret] }),
    );

    const firstView = getPlayerView(state, 'p1');
    expect(firstView.privateState.hand).toEqual([firstSecret]);
    expect(JSON.stringify(firstView)).not.toContain('SECOND-SECRET');
  });

  it('does not expose the Island top card through public pending state', () => {
    const island = card('island', 'ISLAND', 'p1');
    const secretTop = card('TOP-SECRET', 'MOUNTAIN', 'p1');
    const state = gameState(
      playerState('p1', { deck: [secretTop], field: [island] }),
      playerState('p2'),
      {
        pending: {
          kind: 'ISLAND_TOP',
          controllerId: 'p1',
          topCardId: secretTop.id,
        },
      },
    );
    expect(JSON.stringify(getPublicState(state))).not.toContain('TOP-SECRET');
  });

  it('rejects actions from unknown players and out-of-turn players', () => {
    const state = gameState(playerState('p1'), playerState('p2'));
    const unknown = applyAction(state, 'stranger', { type: 'END_TURN' }, zeroRng);
    const outOfTurn = applyAction(state, 'p2', { type: 'END_TURN' }, zeroRng);

    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe('UNKNOWN_PLAYER');
    expect(outOfTurn.ok).toBe(false);
    if (!outOfTurn.ok) expect(outOfTurn.error.code).toBe('NOT_YOUR_TURN');
  });

  it('rejects a land not owned in the active player hand', () => {
    const state = gameState(playerState('p1'), playerState('p2'));
    const result = applyAction(
      state,
      'p1',
      { type: 'PLAY_LAND', cardId: 'missing' },
      zeroRng,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CARD_NOT_IN_HAND');
  });

  it('allows only the responder to act in a response window', () => {
    const land = card('land', 'PLAINS', 'p1');
    const pending = stateOf(
      applyAction(
        gameState(playerState('p1', { hand: [land] }), playerState('p2')),
        'p1',
        { type: 'PLAY_LAND', cardId: land.id },
        zeroRng,
      ),
    );
    const result = applyAction(pending, 'p1', { type: 'PASS_RESPONSE' }, zeroRng);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_YOUR_TURN');
  });

  it('blocks unrelated actions while a choice is pending', () => {
    const target = card('target', 'PLAINS', 'p2');
    const state = gameState(
      playerState('p1'),
      playerState('p2', { field: [target] }),
      { pending: { kind: 'MOUNTAIN_TARGET', controllerId: 'p1' } },
    );
    const result = applyAction(state, 'p1', { type: 'END_TURN' }, zeroRng);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('WRONG_PENDING_ACTION');
  });

  it('returns the original state unchanged when validation fails', () => {
    const state = gameState(playerState('p1'), playerState('p2'));
    const snapshot = JSON.stringify(state);
    const result = applyAction(
      state,
      'p1',
      { type: 'PLAY_LAND', cardId: 'missing' },
      zeroRng,
    );
    expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('rejects private views for non-players', () => {
    const state = gameState(playerState('p1'), playerState('p2'));
    expect(() => getPlayerView(state, 'stranger')).toThrow('Unknown player');
  });
});
