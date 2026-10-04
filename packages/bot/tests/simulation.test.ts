import { describe, expect, it } from 'vitest';
import {
  LAND_TYPES,
  applyAction,
  createGame,
  getPlayerView,
  hasWon,
} from '@mblg-coliseu/game-engine';
import type {
  DeckSize,
  GameState,
  PlayerId,
  RandomSource,
} from '@mblg-coliseu/game-engine';
import { chooseBotAction } from '../src/index.js';

const GAME_COUNT = 1_000;
const ACTION_LIMIT = 500;

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

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error('Bot simulation invariant failed: ' + message);
}

function decisionPlayer(state: GameState): PlayerId {
  if (state.pending?.kind === 'RESPONSE') return state.pending.responderId;
  return state.pending?.controllerId ?? state.currentPlayerId;
}

function validateState(state: GameState, deckSize: DeckSize): void {
  const ids = new Set<string>();
  const copiesPerType = deckSize / LAND_TYPES.length;

  invariant(
    state.players.some((player) => player.id === state.currentPlayerId),
    'current player exists',
  );
  for (const player of state.players) {
    const typeCounts = new Map<string, number>();
    let total = 0;
    for (const zone of [player.deck, player.hand, player.field, player.graveyard]) {
      for (const card of zone) {
        invariant(card.ownerId === player.id, 'card remains with its owner');
        invariant(!ids.has(card.id), 'card exists in exactly one zone');
        ids.add(card.id);
        typeCounts.set(card.type, (typeCounts.get(card.type) ?? 0) + 1);
        total += 1;
      }
    }
    invariant(total === deckSize, 'all cards are conserved');
    for (const type of LAND_TYPES) {
      invariant(typeCounts.get(type) === copiesPerType, 'type counts are conserved');
    }
  }

  const winners = state.players.filter(hasWon);
  if (state.winnerId === null) {
    invariant(winners.length === 0, 'victory is recorded immediately');
  } else {
    invariant(state.pending === null, 'finished game has no pending action');
    invariant(winners.length === 1, 'finished game has exactly one winner');
    invariant(winners[0]?.id === state.winnerId, 'winner satisfies engine victory');
  }
}

describe('1,000 Bot vs Bot games', () => {
  it('finishes every game without invalid state or illegal action', () => {
    let totalActions = 0;
    let maximumActions = 0;
    const wins = new Map<PlayerId, number>();

    for (let gameNumber = 1; gameNumber <= GAME_COUNT; gameNumber += 1) {
      const deckSize: DeckSize = gameNumber % 2 === 0 ? 25 : 50;
      const rng = new SeededRandom(100_000 + gameNumber);
      let state = createGame({
        playerIds: ['bot-1', 'bot-2'],
        deckSize,
        rng,
      });
      let actions = 0;
      validateState(state, deckSize);

      while (state.winnerId === null && actions < ACTION_LIMIT) {
        const actorId = decisionPlayer(state);
        const action = chooseBotAction(getPlayerView(state, actorId));
        const result = applyAction(state, actorId, action, rng);
        if (!result.ok) {
          throw new Error(
            'Bot executed illegal action ' +
              action.type +
              ' in game ' +
              String(gameNumber) +
              ': ' +
              result.error.code,
          );
        }
        state = result.state;
        actions += 1;
        validateState(state, deckSize);
      }

      expect(
        state.winnerId,
        'game ' + String(gameNumber) + ' exceeded action limit',
      ).not.toBeNull();
      const winner = state.players.find((player) => player.id === state.winnerId);
      expect(winner).toBeDefined();
      if (winner === undefined) throw new Error('Winner is not a game player.');
      expect(hasWon(winner)).toBe(true);

      wins.set(winner.id, (wins.get(winner.id) ?? 0) + 1);
      totalActions += actions;
      maximumActions = Math.max(maximumActions, actions);
    }

    expect((wins.get('bot-1') ?? 0) + (wins.get('bot-2') ?? 0)).toBe(GAME_COUNT);
    expect(maximumActions).toBeLessThan(ACTION_LIMIT);
    console.info(
      'Bot simulation: ' +
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
