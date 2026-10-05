import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../src/index.js';
import { card, gameState, playerOf, playerState, stateOf, zeroRng } from './helpers.js';

describe('game setup, turns, and draws', () => {
  it('deals five cards to each player and randomly selects the starter', () => {
    const state = createGame({
      playerIds: ['p1', 'p2'],
      deckSize: 25,
      rng: zeroRng,
    });

    expect(state.startingPlayerId).toBe('p1');
    expect(state.currentPlayerId).toBe('p1');
    expect(state.phase).toBe('MAIN');
    expect(state.players[0]?.hand).toHaveLength(5);
    expect(state.players[1]?.hand).toHaveLength(5);
    expect(state.players[0]?.deck).toHaveLength(20);
    expect(state.players[1]?.deck).toHaveLength(20);
  });

  it('can select the second player as starter through injected RNG', () => {
    const state = createGame({
      playerIds: ['p1', 'p2'],
      deckSize: 25,
      rng: { next: () => 0.75 },
    });
    expect(state.startingPlayerId).toBe('p2');
  });

  it('does not allow the starter to draw on the first turn', () => {
    const state = createGame({
      playerIds: ['p1', 'p2'],
      deckSize: 25,
      rng: zeroRng,
    });
    const result = applyAction(state, 'p1', { type: 'DRAW' }, zeroRng);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('WRONG_PHASE');
  });

  it('makes the second player and every later turn draw at turn start', () => {
    const initial = createGame({
      playerIds: ['p1', 'p2'],
      deckSize: 25,
      rng: zeroRng,
    });
    const secondTurn = stateOf(
      applyAction(initial, 'p1', { type: 'END_TURN' }, zeroRng),
    );
    expect(secondTurn.phase).toBe('DRAW');

    const afterSecondDraw = stateOf(
      applyAction(secondTurn, 'p2', { type: 'DRAW' }, zeroRng),
    );
    expect(playerOf(afterSecondDraw, 'p2').hand).toHaveLength(6);
    expect(afterSecondDraw.phase).toBe('MAIN');

    const thirdTurn = stateOf(
      applyAction(afterSecondDraw, 'p2', { type: 'END_TURN' }, zeroRng),
    );
    const afterThirdDraw = stateOf(
      applyAction(thirdTurn, 'p1', { type: 'DRAW' }, zeroRng),
    );
    expect(playerOf(afterThirdDraw, 'p1').hand).toHaveLength(6);
  });

  it('draws nothing without inventing cards when deck and graveyard are empty', () => {
    const initial = gameState(playerState('p1'), playerState('p2'), {
      phase: 'DRAW',
    });
    const next = stateOf(applyAction(initial, 'p1', { type: 'DRAW' }, zeroRng));

    expect(playerOf(next, 'p1').hand).toEqual([]);
    expect(next.phase).toBe('MAIN');
  });

  it('recycles the graveyard when a draw finds an empty deck', () => {
    const discarded = card('discarded', 'FOREST', 'p1');
    const initial = gameState(
      playerState('p1', { graveyard: [discarded] }),
      playerState('p2'),
      { phase: 'DRAW' },
    );
    const next = stateOf(applyAction(initial, 'p1', { type: 'DRAW' }, zeroRng));

    expect(playerOf(next, 'p1').hand).toEqual([discarded]);
    expect(playerOf(next, 'p1').graveyard).toEqual([]);
  });

  it('shuffles the whole graveyard with injected RNG before a recycled draw', () => {
    const first = card('first', 'FOREST', 'p1');
    const second = card('second', 'ISLAND', 'p1');
    const third = card('third', 'SWAMP', 'p1');
    const initial = gameState(
      playerState('p1', { graveyard: [first, second, third] }),
      playerState('p2'),
      { phase: 'DRAW' },
    );
    const next = stateOf(applyAction(initial, 'p1', { type: 'DRAW' }, zeroRng));

    expect(playerOf(next, 'p1').hand).toEqual([second]);
    expect(playerOf(next, 'p1').deck).toEqual([third, first]);
    expect(playerOf(next, 'p1').graveyard).toEqual([]);
  });

  it('enforces one attempted land per turn and resets the limit next turn', () => {
    const firstLand = card('first', 'FOREST', 'p1');
    const secondLand = card('second', 'PLAINS', 'p1');
    const initial = gameState(
      playerState('p1', { hand: [firstLand, secondLand] }),
      playerState('p2'),
    );
    const pending = stateOf(
      applyAction(initial, 'p1', { type: 'PLAY_LAND', cardId: firstLand.id }, zeroRng),
    );
    const resolved = stateOf(
      applyAction(pending, 'p2', { type: 'PASS_RESPONSE' }, zeroRng),
    );
    const secondAttempt = applyAction(
      resolved,
      'p1',
      { type: 'PLAY_LAND', cardId: secondLand.id },
      zeroRng,
    );

    expect(secondAttempt.ok).toBe(false);
    if (!secondAttempt.ok) expect(secondAttempt.error.code).toBe('LAND_ALREADY_PLAYED');

    const nextTurn = stateOf(
      applyAction(resolved, 'p1', { type: 'END_TURN' }, zeroRng),
    );
    expect(nextTurn.landPlayedThisTurn).toBe(false);
  });

  it('has no maximum hand size and keeps all drawn cards', () => {
    const hand = Array.from({ length: 12 }, (_, index) =>
      card(`hand-${String(index)}`, 'PLAINS', 'p1'),
    );
    const top = card('top', 'ISLAND', 'p1');
    const initial = gameState(
      playerState('p1', { hand, deck: [top] }),
      playerState('p2'),
      { phase: 'DRAW' },
    );
    const next = stateOf(applyAction(initial, 'p1', { type: 'DRAW' }, zeroRng));
    expect(playerOf(next, 'p1').hand).toHaveLength(13);
  });
});
