import { describe, expect, it } from 'vitest';
import { applyAction, hasWon } from '../src/index.js';
import type { Card, LandType } from '../src/index.js';
import {
  card,
  gameState,
  playerState,
  stateOf,
  zeroRng,
} from './helpers.js';

const allTypes: readonly LandType[] = [
  'MOUNTAIN',
  'ISLAND',
  'SWAMP',
  'FOREST',
  'PLAINS',
];

function lands(types: readonly LandType[], ownerId = 'p1'): Card[] {
  return types.map((type, index) => card(`${type}-${String(index)}`, type, ownerId));
}

describe('victory', () => {
  it('recognizes all five different land types', () => {
    expect(hasWon(playerState('p1', { field: lands(allTypes) }))).toBe(true);
  });

  it('recognizes five lands of one type', () => {
    expect(
      hasWon(
        playerState('p1', {
          field: lands(Array.from({ length: 5 }, () => 'MOUNTAIN')),
        }),
      ),
    ).toBe(true);
  });

  it('allows additional lands without preventing victory', () => {
    expect(
      hasWon(
        playerState('p1', {
          field: lands([...allTypes, 'MOUNTAIN', 'PLAINS']),
        }),
      ),
    ).toBe(true);
  });

  it('does not award victory with only four different lands', () => {
    expect(hasWon(playerState('p1', { field: lands(allTypes.slice(0, 4)) }))).toBe(
      false,
    );
  });

  it('wins immediately when a resolving land completes the condition', () => {
    const existing = lands(allTypes.slice(0, 4));
    const plains = card('winning-plains', 'PLAINS', 'p1');
    const pending = stateOf(
      applyAction(
        gameState(
          playerState('p1', { hand: [plains], field: existing }),
          playerState('p2'),
        ),
        'p1',
        { type: 'PLAY_LAND', cardId: plains.id },
        zeroRng,
      ),
    );
    const won = stateOf(
      applyAction(pending, 'p2', { type: 'PASS_RESPONSE' }, zeroRng),
    );
    expect(won.winnerId).toBe('p1');
    expect(won.pending).toBeNull();
  });

  it('can win when an Island response completes the condition', () => {
    const attempted = card('attempted', 'MOUNTAIN', 'p1');
    const island = card('winning-island', 'ISLAND', 'p2');
    const cost = card('cost', 'MOUNTAIN', 'p2');
    const existing = lands(
      ['MOUNTAIN', 'SWAMP', 'FOREST', 'PLAINS'],
      'p2',
    );
    const pending = stateOf(
      applyAction(
        gameState(
          playerState('p1', { hand: [attempted] }),
          playerState('p2', { hand: [island, cost], field: existing }),
        ),
        'p1',
        { type: 'PLAY_LAND', cardId: attempted.id },
        zeroRng,
      ),
    );
    const won = stateOf(
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
    expect(won.winnerId).toBe('p2');
  });

  it('rejects every further action after victory', () => {
    const won = gameState(playerState('p1'), playerState('p2'), {
      winnerId: 'p1',
    });
    const result = applyAction(won, 'p1', { type: 'END_TURN' }, zeroRng);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('GAME_OVER');
  });
});
