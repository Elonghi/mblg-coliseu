import { describe, expect, it } from 'vitest';
import { getPlayerView } from '@mblg-coliseu/game-engine';
import type {
  Card,
  GameState,
  LandType,
  PlayerState,
} from '@mblg-coliseu/game-engine';
import { BOT_DIFFICULTY, chooseBotAction } from '../src/index.js';

function card(id: string, type: LandType, ownerId: string): Card {
  return { id, type, ownerId };
}

function player(
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

function state(
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

describe('MBLG Coliseu bot decisions', () => {
  it('exposes exactly one difficulty level', () => {
    expect(BOT_DIFFICULTY).toBe('STANDARD');
  });

  it('draws when the engine says it is in the draw phase', () => {
    const game = state(player('bot'), player('opponent'), { phase: 'DRAW' });
    expect(chooseBotAction(getPlayerView(game, 'bot'))).toEqual({ type: 'DRAW' });
  });

  it('prioritizes a land that wins with all five types', () => {
    const winning = card('winning-plains', 'PLAINS', 'bot');
    const other = card('other-mountain', 'MOUNTAIN', 'bot');
    const game = state(
      player('bot', {
        field: [
          card('m', 'MOUNTAIN', 'bot'),
          card('i', 'ISLAND', 'bot'),
          card('s', 'SWAMP', 'bot'),
          card('f', 'FOREST', 'bot'),
        ],
        hand: [other, winning],
      }),
      player('opponent'),
    );

    expect(chooseBotAction(getPlayerView(game, 'bot'))).toEqual({
      type: 'PLAY_LAND',
      cardId: winning.id,
    });
  });

  it('prioritizes a fifth land of the same type when it wins', () => {
    const winning = card('fifth-forest', 'FOREST', 'bot');
    const newType = card('new-island', 'ISLAND', 'bot');
    const forests = Array.from({ length: 4 }, (_, index) =>
      card('forest-' + String(index), 'FOREST', 'bot'),
    );
    const game = state(
      player('bot', { field: forests, hand: [newType, winning] }),
      player('opponent'),
    );

    expect(chooseBotAction(getPlayerView(game, 'bot'))).toEqual({
      type: 'PLAY_LAND',
      cardId: winning.id,
    });
  });

  it('prefers increasing distinct land types when no immediate win exists', () => {
    const duplicate = card('duplicate', 'MOUNTAIN', 'bot');
    const newType = card('new-type', 'SWAMP', 'bot');
    const game = state(
      player('bot', {
        field: [card('existing', 'MOUNTAIN', 'bot')],
        hand: [duplicate, newType],
      }),
      player('opponent'),
    );

    expect(chooseBotAction(getPlayerView(game, 'bot'))).toEqual({
      type: 'PLAY_LAND',
      cardId: newType.id,
    });
  });

  it('uses Mountain against the land supporting the nearest same-type victory', () => {
    const mountain = card('played-mountain', 'MOUNTAIN', 'bot');
    const forests = Array.from({ length: 4 }, (_, index) =>
      card('opponent-forest-' + String(index), 'FOREST', 'opponent'),
    );
    const plains = card('opponent-plains', 'PLAINS', 'opponent');
    const game = state(
      player('bot', { field: [mountain] }),
      player('opponent', { field: [...forests, plains] }),
      {
        landPlayedThisTurn: true,
        pending: { kind: 'MOUNTAIN_TARGET', controllerId: 'bot' },
      },
    );

    const action = chooseBotAction(getPlayerView(game, 'bot'));
    expect(action.type).toBe('CHOOSE_MOUNTAIN_TARGET');
    if (action.type === 'CHOOSE_MOUNTAIN_TARGET') {
      expect(forests.map((land) => land.id)).toContain(action.targetLandId);
    }
  });

  it('uses only the temporarily revealed hand to choose a Swamp discard', () => {
    const swamp = card('played-swamp', 'SWAMP', 'bot');
    const winningForest = card('winning-forest', 'FOREST', 'opponent');
    const other = card('other', 'MOUNTAIN', 'opponent');
    const opponentForests = Array.from({ length: 4 }, (_, index) =>
      card('forest-' + String(index), 'FOREST', 'opponent'),
    );
    const game = state(
      player('bot', { field: [swamp] }),
      player('opponent', {
        field: opponentForests,
        hand: [other, winningForest],
      }),
      {
        landPlayedThisTurn: true,
        pending: {
          kind: 'SWAMP_DISCARD',
          controllerId: 'bot',
          targetPlayerId: 'opponent',
        },
      },
    );
    const botView = getPlayerView(game, 'bot');
    const opponentView = getPlayerView(game, 'opponent');

    expect(opponentView.privateState.revealedOpponentHand).toBeNull();
    expect(chooseBotAction(botView)).toEqual({
      type: 'CHOOSE_SWAMP_DISCARD',
      targetCardId: winningForest.id,
    });
  });

  it('recovers the most relevant Forest target', () => {
    const forest = card('played-forest', 'FOREST', 'bot');
    const winning = card('winning-plains', 'PLAINS', 'bot');
    const lessRelevant = card('duplicate-mountain', 'MOUNTAIN', 'bot');
    const game = state(
      player('bot', {
        field: [
          forest,
          card('m', 'MOUNTAIN', 'bot'),
          card('i', 'ISLAND', 'bot'),
          card('s', 'SWAMP', 'bot'),
        ],
        graveyard: [lessRelevant, winning],
      }),
      player('opponent'),
      {
        landPlayedThisTurn: true,
        pending: { kind: 'FOREST_RECOVERY', controllerId: 'bot' },
      },
    );

    expect(chooseBotAction(getPlayerView(game, 'bot'))).toEqual({
      type: 'CHOOSE_FOREST_RECOVERY',
      targetCardId: winning.id,
    });
  });

  it('keeps a useful Island top card and bottoms an unhelpful duplicate', () => {
    const island = card('played-island', 'ISLAND', 'bot');
    const useful = card('useful-swamp', 'SWAMP', 'bot');
    const usefulGame = state(
      player('bot', {
        field: [island, card('mountain', 'MOUNTAIN', 'bot')],
        deck: [useful],
      }),
      player('opponent'),
      {
        landPlayedThisTurn: true,
        pending: {
          kind: 'ISLAND_TOP',
          controllerId: 'bot',
          topCardId: useful.id,
        },
      },
    );
    expect(chooseBotAction(getPlayerView(usefulGame, 'bot'))).toEqual({
      type: 'CHOOSE_ISLAND_TOP',
      placement: 'TOP',
    });

    const duplicate = card('duplicate-mountain', 'MOUNTAIN', 'bot');
    const duplicateGame = state(
      player('bot', {
        field: [island, card('mountain', 'MOUNTAIN', 'bot')],
        deck: [duplicate],
      }),
      player('opponent'),
      {
        landPlayedThisTurn: true,
        pending: {
          kind: 'ISLAND_TOP',
          controllerId: 'bot',
          topCardId: duplicate.id,
        },
      },
    );
    expect(chooseBotAction(getPlayerView(duplicateGame, 'bot'))).toEqual({
      type: 'CHOOSE_ISLAND_TOP',
      placement: 'BOTTOM',
    });
  });

  it('counters a land that would give the opponent victory and pays matching type', () => {
    const attempted = card('attempted-forest', 'FOREST', 'opponent');
    const island = card('response-island', 'ISLAND', 'bot');
    const matchingCost = card('forest-cost', 'FOREST', 'bot');
    const opponentForests = Array.from({ length: 4 }, (_, index) =>
      card('forest-' + String(index), 'FOREST', 'opponent'),
    );
    const game = state(
      player('opponent', {
        field: opponentForests,
        hand: [attempted],
      }),
      player('bot', { hand: [island, matchingCost] }),
      {
        currentPlayerId: 'opponent',
        landPlayedThisTurn: true,
        pending: {
          kind: 'RESPONSE',
          controllerId: 'opponent',
          responderId: 'bot',
          remainingResponderIds: [],
          cardId: attempted.id,
          landType: attempted.type,
        },
      },
    );

    expect(chooseBotAction(getPlayerView(game, 'bot'))).toEqual({
      type: 'COUNTER_WITH_ISLAND',
      islandCardId: island.id,
      discardCardId: matchingCost.id,
    });
  });

  it('passes instead of spending Island on an irrelevant response', () => {
    const attempted = card('attempted-island', 'ISLAND', 'opponent');
    const responseIsland = card('response-island', 'ISLAND', 'bot');
    const costIsland = card('cost-island', 'ISLAND', 'bot');
    const game = state(
      player('opponent', {
        field: [card('existing-island', 'ISLAND', 'opponent')],
        hand: [attempted],
      }),
      player('bot', { hand: [responseIsland, costIsland] }),
      {
        currentPlayerId: 'opponent',
        landPlayedThisTurn: true,
        pending: {
          kind: 'RESPONSE',
          controllerId: 'opponent',
          responderId: 'bot',
          remainingResponderIds: [],
          cardId: attempted.id,
          landType: attempted.type,
        },
      },
    );

    expect(chooseBotAction(getPlayerView(game, 'bot'))).toEqual({
      type: 'PASS_RESPONSE',
    });
  });

  it('ends its turn after the engine records its land play', () => {
    const game = state(player('bot'), player('opponent'), {
      landPlayedThisTurn: true,
    });
    expect(chooseBotAction(getPlayerView(game, 'bot'))).toEqual({
      type: 'END_TURN',
    });
  });
});
