import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  getLegalActions,
  getPlayerView,
  removePlayer,
} from '../src/index.js';
import {
  card,
  multiplayerGameState,
  playerOf,
  playerState,
  stateOf,
  zeroRng,
} from './helpers.js';

describe('four-player games', () => {
  it('creates four private five-card hands and chooses the starter with injected RNG', () => {
    const state = createGame({
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      deckSize: 25,
      rng: { next: () => 0.74 },
    });

    expect(state.players).toHaveLength(4);
    expect(state.players.every((player) => player.hand.length === 5)).toBe(true);
    expect(state.players.every((player) => player.deck.length === 20)).toBe(true);
    expect(state.startingPlayerId).toBe('p3');
    expect(state.phase).toBe('MAIN');
  });

  it('cycles turns through every active player and only skips the first draw', () => {
    let state = multiplayerGameState([
      playerState('p1'),
      playerState('p2', { deck: [card('draw-2', 'ISLAND', 'p2')] }),
      playerState('p3'),
      playerState('p4'),
    ]);

    state = stateOf(applyAction(state, 'p1', { type: 'END_TURN' }, zeroRng));
    expect(state).toMatchObject({ currentPlayerId: 'p2', phase: 'DRAW' });
    state = stateOf(applyAction(state, 'p2', { type: 'DRAW' }, zeroRng));
    expect(playerOf(state, 'p2').hand.map((item) => item.id)).toEqual(['draw-2']);
    state = stateOf(applyAction(state, 'p2', { type: 'END_TURN' }, zeroRng));
    state = stateOf(applyAction(state, 'p3', { type: 'DRAW' }, zeroRng));
    state = stateOf(applyAction(state, 'p3', { type: 'END_TURN' }, zeroRng));
    state = stateOf(applyAction(state, 'p4', { type: 'DRAW' }, zeroRng));
    state = stateOf(applyAction(state, 'p4', { type: 'END_TURN' }, zeroRng));

    expect(state).toMatchObject({ currentPlayerId: 'p1', phase: 'DRAW', turnNumber: 5 });
  });

  it('lets Mountain target a land controlled by any opponent', () => {
    const mountain = card('mountain', 'MOUNTAIN', 'p1');
    let state = multiplayerGameState([
      playerState('p1', { hand: [mountain] }),
      playerState('p2', { field: [card('p2-land', 'PLAINS', 'p2')] }),
      playerState('p3', { field: [card('p3-land', 'ISLAND', 'p3')] }),
      playerState('p4'),
    ]);

    state = stateOf(applyAction(state, 'p1', { type: 'PLAY_LAND', cardId: mountain.id }, zeroRng));
    state = passAllResponses(state, ['p2', 'p3', 'p4']);
    expect(getLegalActions(state, 'p1')).toEqual(expect.arrayContaining([
      { type: 'CHOOSE_MOUNTAIN_TARGET', targetLandId: 'p2-land' },
      { type: 'CHOOSE_MOUNTAIN_TARGET', targetLandId: 'p3-land' },
    ]));

    state = stateOf(applyAction(
      state,
      'p1',
      { type: 'CHOOSE_MOUNTAIN_TARGET', targetLandId: 'p3-land' },
      zeroRng,
    ));
    expect(playerOf(state, 'p3').field).toHaveLength(0);
    expect(playerOf(state, 'p3').graveyard.map((item) => item.id)).toEqual(['p3-land']);
  });

  it('makes the Swamp controller select one opponent and reveals only that hand', () => {
    const swamp = card('swamp', 'SWAMP', 'p1');
    let state = multiplayerGameState([
      playerState('p1', { hand: [swamp] }),
      playerState('p2', { hand: [card('p2-secret', 'PLAINS', 'p2')] }),
      playerState('p3', { hand: [card('p3-secret', 'ISLAND', 'p3')] }),
      playerState('p4'),
    ]);

    state = stateOf(applyAction(state, 'p1', { type: 'PLAY_LAND', cardId: swamp.id }, zeroRng));
    state = passAllResponses(state, ['p2', 'p3', 'p4']);
    expect(state.pending).toEqual({ kind: 'SWAMP_TARGET', controllerId: 'p1' });
    expect(getLegalActions(state, 'p1')).toEqual([
      { type: 'CHOOSE_SWAMP_TARGET', targetPlayerId: 'p2' },
      { type: 'CHOOSE_SWAMP_TARGET', targetPlayerId: 'p3' },
    ]);

    state = stateOf(applyAction(
      state,
      'p1',
      { type: 'CHOOSE_SWAMP_TARGET', targetPlayerId: 'p3' },
      zeroRng,
    ));
    expect(getPlayerView(state, 'p1').privateState.revealedOpponentHand?.[0]?.id)
      .toBe('p3-secret');
    expect(getPlayerView(state, 'p2').privateState.revealedOpponentHand).toBeNull();
    expect(getPlayerView(state, 'p3').privateState.revealedOpponentHand).toBeNull();
    expect(JSON.stringify(getPlayerView(state, 'p2'))).not.toContain('p3-secret');

    state = stateOf(applyAction(
      state,
      'p1',
      { type: 'CHOOSE_SWAMP_DISCARD', targetCardId: 'p3-secret' },
      zeroRng,
    ));
    expect(playerOf(state, 'p3').graveyard[0]?.id).toBe('p3-secret');
    expect(playerOf(state, 'p2').hand[0]?.id).toBe('p2-secret');
  });

  it('offers Island responses in cyclic order and the first counter closes the window', () => {
    const played = card('played', 'MOUNTAIN', 'p1');
    const p3Island = card('p3-island', 'ISLAND', 'p3');
    const p3Cost = card('p3-cost', 'MOUNTAIN', 'p3');
    const p4Island = card('p4-island', 'ISLAND', 'p4');
    const p4Cost = card('p4-cost', 'MOUNTAIN', 'p4');
    let state = multiplayerGameState([
      playerState('p1', { hand: [played] }),
      playerState('p2'),
      playerState('p3', { hand: [p3Island, p3Cost] }),
      playerState('p4', { hand: [p4Island, p4Cost] }),
    ]);

    state = stateOf(applyAction(state, 'p1', { type: 'PLAY_LAND', cardId: played.id }, zeroRng));
    expect(state.pending).toMatchObject({ responderId: 'p2' });
    state = stateOf(applyAction(state, 'p2', { type: 'PASS_RESPONSE' }, zeroRng));
    expect(state.pending).toMatchObject({ responderId: 'p3' });
    state = stateOf(applyAction(state, 'p3', {
      type: 'COUNTER_WITH_ISLAND',
      islandCardId: p3Island.id,
      discardCardId: p3Cost.id,
    }, zeroRng));

    expect(state.pending).toBeNull();
    expect(playerOf(state, 'p1').graveyard.map((item) => item.id)).toEqual(['played']);
    expect(playerOf(state, 'p3').field.map((item) => item.id)).toEqual(['p3-island']);
    expect(playerOf(state, 'p4').hand).toHaveLength(2);
    expect(getLegalActions(state, 'p4')).toEqual([]);
  });

  it('removes a disconnected player and continues with the next active player', () => {
    const state = multiplayerGameState([
      playerState('p1'),
      playerState('p2'),
      playerState('p3'),
      playerState('p4'),
    ], { currentPlayerId: 'p2', turnNumber: 7 });

    const remaining = removePlayer(state, 'p2', zeroRng);
    expect(remaining.players.map((candidate) => candidate.id)).toEqual(['p1', 'p3', 'p4']);
    expect(remaining).toMatchObject({
      currentPlayerId: 'p3',
      turnNumber: 8,
      phase: 'DRAW',
      winnerId: null,
    });
  });

  it('removes stale starter and Mountain-target references with their player', () => {
    const mountain = card('mountain', 'MOUNTAIN', 'p1');
    let state = multiplayerGameState([
      playerState('p1', { hand: [mountain] }),
      playerState('p2', { field: [card('only-target', 'FOREST', 'p2')] }),
      playerState('p3'),
      playerState('p4'),
    ], { startingPlayerId: 'p2' });
    state = stateOf(applyAction(state, 'p1', { type: 'PLAY_LAND', cardId: mountain.id }, zeroRng));
    state = passAllResponses(state, ['p2', 'p3', 'p4']);
    expect(state.pending?.kind).toBe('MOUNTAIN_TARGET');

    state = removePlayer(state, 'p2', zeroRng);
    expect(state.startingPlayerId).toBe('p3');
    expect(state.pending).toBeNull();
    expect(state.players.some((candidate) => candidate.id === state.startingPlayerId)).toBe(true);
  });

  it('skips a removed Island responder and awards the game to the final player', () => {
    const played = card('played', 'PLAINS', 'p1');
    let state = multiplayerGameState([
      playerState('p1', { hand: [played] }),
      playerState('p2'),
      playerState('p3'),
      playerState('p4'),
    ]);
    state = stateOf(applyAction(state, 'p1', { type: 'PLAY_LAND', cardId: played.id }, zeroRng));

    state = removePlayer(state, 'p2', zeroRng);
    expect(state.pending).toMatchObject({ responderId: 'p3' });
    state = removePlayer(state, 'p3', zeroRng);
    state = removePlayer(state, 'p4', zeroRng);
    expect(state.players.map((candidate) => candidate.id)).toEqual(['p1']);
    expect(state.winnerId).toBe('p1');
  });
});

function passAllResponses(state: ReturnType<typeof multiplayerGameState>, players: readonly string[]) {
  return players.reduce(
    (current, playerId) => stateOf(applyAction(
      current,
      playerId,
      { type: 'PASS_RESPONSE' },
      zeroRng,
    )),
    state,
  );
}
