import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  getPlayerView,
  hasWon,
} from '../src/index.js';
import type {
  DeckSize,
  GameState,
  PlayerId,
  RandomSource,
} from '../src/index.js';
import { validateGameInvariants, verifyImpossibleActionsAreRejected } from './simulation/invariants.js';
import { chooseSimpleBotAction } from './simulation/simple-bot.js';

const GAME_COUNT = 10_000;
const MAX_ACTIONS_PER_GAME = 500;

class SeededRandom implements RandomSource {
  private value: number;

  constructor(seed: number) {
    this.value = seed >>> 0;
  }

  next(): number {
    this.value = (this.value + 0x6d2b79f5) >>> 0;
    let mixed = this.value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  }
}

function actorForState(state: GameState): PlayerId {
  if (state.pending?.kind === 'RESPONSE') {
    return state.pending.responderId;
  }
  return state.pending?.controllerId ?? state.currentPlayerId;
}

describe('10,000 complete automated games', () => {
  it('always reaches a valid winner without illegal or impossible states', () => {
    let maximumActions = 0;
    let totalActions = 0;
    const wins = new Map<PlayerId, number>();

    for (let gameNumber = 1; gameNumber <= GAME_COUNT; gameNumber += 1) {
      const deckSize: DeckSize = gameNumber % 2 === 0 ? 25 : 50;
      const rng = new SeededRandom(gameNumber);
      let state = createGame({
        playerIds: ['player-1', 'player-2'],
        deckSize,
        rng,
      });
      let actions = 0;

      validateGameInvariants(state, deckSize);
      while (state.winnerId === null && actions < MAX_ACTIONS_PER_GAME) {
        verifyImpossibleActionsAreRejected(state);

        const actorId = actorForState(state);
        const action = chooseSimpleBotAction(getPlayerView(state, actorId));
        const result = applyAction(state, actorId, action, rng);
        if (!result.ok) {
          throw new Error(
            'Bot produced rejected action ' +
              action.type +
              ' in game ' +
              String(gameNumber) +
              ': ' +
              result.error.code,
          );
        }

        state = result.state;
        actions += 1;
        validateGameInvariants(state, deckSize);
      }

      expect(
        state.winnerId,
        'game ' + String(gameNumber) + ' exceeded action limit',
      ).not.toBeNull();
      const winner = state.players.find((player) => player.id === state.winnerId);
      expect(winner).toBeDefined();
      if (winner === undefined) {
        throw new Error('Winner does not belong to the simulated game.');
      }
      expect(hasWon(winner)).toBe(true);

      wins.set(winner.id, (wins.get(winner.id) ?? 0) + 1);
      totalActions += actions;
      maximumActions = Math.max(maximumActions, actions);
    }

    expect((wins.get('player-1') ?? 0) + (wins.get('player-2') ?? 0)).toBe(
      GAME_COUNT,
    );
    expect(maximumActions).toBeLessThan(MAX_ACTIONS_PER_GAME);

    console.info(
      'Simulation summary: ' +
        String(GAME_COUNT) +
        ' games, ' +
        String(totalActions) +
        ' actions, max ' +
        String(maximumActions) +
        ' actions/game, wins ' +
        JSON.stringify(Object.fromEntries(wins)),
    );
  }, 30_000);
});
