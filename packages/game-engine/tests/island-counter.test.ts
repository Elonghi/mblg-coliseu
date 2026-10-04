import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/index.js';
import {
  card,
  gameState,
  playerOf,
  playerState,
  stateOf,
  zeroRng,
} from './helpers.js';

describe('Island response', () => {
  it.each([
    'MOUNTAIN',
    'ISLAND',
    'SWAMP',
    'FOREST',
    'PLAINS',
  ] as const)('counters %s by discarding a matching type', (type) => {
    const attempted = card('attempted', type, 'p1');
    const island = card('response-island', 'ISLAND', 'p2');
    const cost = card('cost', type, 'p2');
    const initial = gameState(
      playerState('p1', { hand: [attempted] }),
      playerState('p2', { hand: [island, cost] }),
    );
    const pending = stateOf(
      applyAction(
        initial,
        'p1',
        { type: 'PLAY_LAND', cardId: attempted.id },
        zeroRng,
      ),
    );
    const countered = stateOf(
      applyAction(
        pending,
        'p2',
        {
          type: 'COUNTER_WITH_ISLAND',
          islandCardId: island.id,
          discardCardId: cost.id,
        },
        zeroRng,
      ),
    );

    expect(playerOf(countered, 'p1').field).toEqual([]);
    expect(playerOf(countered, 'p1').graveyard).toEqual([attempted]);
    expect(playerOf(countered, 'p2').field).toEqual([island]);
    expect(playerOf(countered, 'p2').graveyard).toEqual([cost]);
    expect(countered.pending).toBeNull();
  });

  it('does not execute the countered land ability', () => {
    const plains = card('plains', 'PLAINS', 'p1');
    const wouldBeDrawn = card('top', 'FOREST', 'p1');
    const island = card('island', 'ISLAND', 'p2');
    const cost = card('cost', 'PLAINS', 'p2');
    const initial = gameState(
      playerState('p1', { hand: [plains], deck: [wouldBeDrawn] }),
      playerState('p2', { hand: [island, cost] }),
    );
    const pending = stateOf(
      applyAction(initial, 'p1', { type: 'PLAY_LAND', cardId: plains.id }, zeroRng),
    );
    const countered = stateOf(
      applyAction(
        pending,
        'p2',
        {
          type: 'COUNTER_WITH_ISLAND',
          islandCardId: island.id,
          discardCardId: cost.id,
        },
        zeroRng,
      ),
    );
    expect(playerOf(countered, 'p1').hand).toEqual([]);
    expect(playerOf(countered, 'p1').deck).toEqual([wouldBeDrawn]);
  });

  it('requires a distinct Island and matching discard card from the responder hand', () => {
    const mountain = card('mountain', 'MOUNTAIN', 'p1');
    const island = card('island', 'ISLAND', 'p2');
    const wrongCost = card('wrong', 'FOREST', 'p2');
    const pending = stateOf(
      applyAction(
        gameState(
          playerState('p1', { hand: [mountain] }),
          playerState('p2', { hand: [island, wrongCost] }),
        ),
        'p1',
        { type: 'PLAY_LAND', cardId: mountain.id },
        zeroRng,
      ),
    );
    const result = applyAction(
      pending,
      'p2',
      {
        type: 'COUNTER_WITH_ISLAND',
        islandCardId: island.id,
        discardCardId: wrongCost.id,
      },
      zeroRng,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_COUNTER_COST');
  });

  it('requires a second Island when countering an Island', () => {
    const attempted = card('attempted', 'ISLAND', 'p1');
    const onlyIsland = card('only-island', 'ISLAND', 'p2');
    const pending = stateOf(
      applyAction(
        gameState(
          playerState('p1', { hand: [attempted] }),
          playerState('p2', { hand: [onlyIsland] }),
        ),
        'p1',
        { type: 'PLAY_LAND', cardId: attempted.id },
        zeroRng,
      ),
    );
    const result = applyAction(
      pending,
      'p2',
      {
        type: 'COUNTER_WITH_ISLAND',
        islandCardId: onlyIsland.id,
        discardCardId: onlyIsland.id,
      },
      zeroRng,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_COUNTER_COST');
  });

  it('does not open a response chain after an Island counter', () => {
    const mountain = card('mountain', 'MOUNTAIN', 'p1');
    const counterIsland = card('counter-island', 'ISLAND', 'p2');
    const mountainCost = card('mountain-cost', 'MOUNTAIN', 'p2');
    const pending = stateOf(
      applyAction(
        gameState(
          playerState('p1', { hand: [mountain] }),
          playerState('p2', { hand: [counterIsland, mountainCost] }),
        ),
        'p1',
        { type: 'PLAY_LAND', cardId: mountain.id },
        zeroRng,
      ),
    );
    const countered = stateOf(
      applyAction(
        pending,
        'p2',
        {
          type: 'COUNTER_WITH_ISLAND',
          islandCardId: counterIsland.id,
          discardCardId: mountainCost.id,
        },
        zeroRng,
      ),
    );
    expect(countered.pending).toBeNull();
    const chainAttempt = applyAction(
      countered,
      'p1',
      {
        type: 'COUNTER_WITH_ISLAND',
        islandCardId: 'anything',
        discardCardId: 'anything-else',
      },
      zeroRng,
    );
    expect(chainAttempt.ok).toBe(false);
    if (!chainAttempt.ok) expect(chainAttempt.error.code).toBe('NO_ACTION_PENDING');
  });

  it('is an exception to the active player land counter', () => {
    const ownPlayedLand = card('own-played', 'FOREST', 'p2');
    const attempted = card('attempted', 'MOUNTAIN', 'p1');
    const island = card('island', 'ISLAND', 'p2');
    const cost = card('cost', 'MOUNTAIN', 'p2');
    const pending = gameState(
      playerState('p1', { hand: [attempted] }),
      playerState('p2', { hand: [island, cost], field: [ownPlayedLand] }),
      {
        landPlayedThisTurn: true,
        pending: {
          kind: 'RESPONSE',
          controllerId: 'p1',
          responderId: 'p2',
          cardId: attempted.id,
          landType: attempted.type,
        },
      },
    );
    const countered = stateOf(
      applyAction(
        pending,
        'p2',
        {
          type: 'COUNTER_WITH_ISLAND',
          islandCardId: island.id,
          discardCardId: cost.id,
        },
        zeroRng,
      ),
    );
    expect(playerOf(countered, 'p2').field).toEqual([ownPlayedLand, island]);
  });
});
