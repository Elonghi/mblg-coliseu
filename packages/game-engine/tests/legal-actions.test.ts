import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../src/index.js';
import { card, gameState, playerState } from './helpers.js';

describe('legal action projection', () => {
  it('lists playable hand cards and end turn without exposing opponent cards', () => {
    const own = card('own', 'FOREST', 'p1');
    const secret = card('secret', 'SWAMP', 'p2');
    const state = gameState(
      playerState('p1', { hand: [own] }),
      playerState('p2', { hand: [secret] }),
    );

    expect(getLegalActions(state, 'p1')).toEqual([
      { type: 'PLAY_LAND', cardId: own.id },
      { type: 'END_TURN' },
    ]);
    expect(JSON.stringify(getLegalActions(state, 'p1'))).not.toContain(secret.id);
    expect(getLegalActions(state, 'p2')).toEqual([]);
  });

  it('lists only valid Island and matching-cost pairs during a response', () => {
    const attempted = card('attempted', 'MOUNTAIN', 'p1');
    const island = card('island', 'ISLAND', 'p2');
    const cost = card('cost', 'MOUNTAIN', 'p2');
    const wrong = card('wrong', 'PLAINS', 'p2');
    const state = gameState(
      playerState('p1', { hand: [attempted] }),
      playerState('p2', { hand: [island, cost, wrong] }),
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

    expect(getLegalActions(state, 'p2')).toEqual([
      { type: 'PASS_RESPONSE' },
      {
        type: 'COUNTER_WITH_ISLAND',
        islandCardId: island.id,
        discardCardId: cost.id,
      },
    ]);
    expect(getLegalActions(state, 'p1')).toEqual([]);
  });

  it('lists engine-owned targets for every pending choice', () => {
    const ownGrave = card('own-grave', 'PLAINS', 'p1');
    const opposingField = card('opposing-field', 'ISLAND', 'p2');
    const mountainState = gameState(
      playerState('p1'),
      playerState('p2', { field: [opposingField] }),
      {
        landPlayedThisTurn: true,
        pending: { kind: 'MOUNTAIN_TARGET', controllerId: 'p1' },
      },
    );
    expect(getLegalActions(mountainState, 'p1')).toEqual([
      {
        type: 'CHOOSE_MOUNTAIN_TARGET',
        targetLandId: opposingField.id,
      },
    ]);

    const forestState = gameState(
      playerState('p1', { graveyard: [ownGrave] }),
      playerState('p2'),
      {
        landPlayedThisTurn: true,
        pending: { kind: 'FOREST_RECOVERY', controllerId: 'p1' },
      },
    );
    expect(getLegalActions(forestState, 'p1')).toEqual([
      {
        type: 'CHOOSE_FOREST_RECOVERY',
        targetCardId: ownGrave.id,
      },
      { type: 'SKIP_FOREST_RECOVERY' },
    ]);
  });

  it('offers only draw in draw phase and nothing after game over', () => {
    const drawing = gameState(playerState('p1'), playerState('p2'), {
      phase: 'DRAW',
    });
    expect(getLegalActions(drawing, 'p1')).toEqual([{ type: 'DRAW' }]);

    const finished = { ...drawing, winnerId: 'p1' };
    expect(getLegalActions(finished, 'p1')).toEqual([]);
  });
});
