import { describe, expect, it } from 'vitest';
import type { GameState, RandomSource } from '@mblg-coliseu/game-engine';
import {
  BOT_PLAYER_ID,
  HUMAN_PLAYER_ID,
  automatedAction,
  createLocalMatch,
  executeLocalAction,
  noticeForAcceptedAction,
  snapshotForHuman,
} from '../game/local-match.js';

const zeroRng: RandomSource = { next: () => 0 };

describe('local match adapter', () => {
  it('creates a complete engine match and exposes only the human view', () => {
    const state = createLocalMatch(25, zeroRng);
    const snapshot = snapshotForHuman(state);
    const bot = state.players.find((player) => player.id === BOT_PLAYER_ID);

    expect(snapshot.humanView.privateState.playerId).toBe(HUMAN_PLAYER_ID);
    expect(snapshot.humanView.privateState.hand).toHaveLength(5);
    expect(snapshot.humanActions.some((action) => action.type === 'PLAY_LAND')).toBe(
      true,
    );
    expect(bot).toBeDefined();
    if (bot === undefined) throw new Error('Bot is missing.');
    for (const secret of bot.hand) {
      expect(JSON.stringify(snapshot)).not.toContain(secret.id);
    }
  });

  it('sends a human intention through the authoritative engine', () => {
    const state = createLocalMatch(25, zeroRng);
    const action = snapshotForHuman(state).humanActions.find(
      (candidate) => candidate.type === 'PLAY_LAND',
    );
    expect(action).toBeDefined();
    if (action === undefined) throw new Error('Expected a playable land.');

    const result = executeLocalAction(
      state,
      HUMAN_PLAYER_ID,
      action,
      zeroRng,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.pending?.kind).toBe('RESPONSE');
    }
  });

  it('uses the Bot only when the decision belongs to it', () => {
    const humanStart = createLocalMatch(25, zeroRng);
    expect(automatedAction(humanStart)).toBeNull();

    const botStart = createLocalMatch(25, { next: () => 0.75 });
    const automated = automatedAction(botStart);
    expect(automated?.actorId).toBe(BOT_PLAYER_ID);
    expect(automated?.action.type).toBe('PLAY_LAND');
  });

  it('automatically ends the human turn after a land fully resolves', () => {
    const state = createLocalMatch(25, zeroRng);
    const resolvedLandState = {
      ...state,
      landPlayedThisTurn: true,
    };

    expect(automatedAction(resolvedLandState)).toEqual({
      actorId: HUMAN_PLAYER_ID,
      action: { type: 'END_TURN' },
    });
  });
  it('describes the land countered by an accepted Island response', () => {
    const state = createLocalMatch(25, zeroRng);
    const countered = state.players[0].hand[0];
    expect(countered).toBeDefined();
    if (countered === undefined) throw new Error('Expected a card in hand.');

    const responseState: GameState = {
      ...state,
      pending: {
        kind: 'RESPONSE',
        controllerId: HUMAN_PLAYER_ID,
        responderId: BOT_PLAYER_ID,
        cardId: countered.id,
        landType: countered.type,
      },
    };
    const notice = noticeForAcceptedAction(
      responseState,
      BOT_PLAYER_ID,
      {
        type: 'COUNTER_WITH_ISLAND',
        islandCardId: 'island',
        discardCardId: 'cost',
      },
      'countered-1',
    );

    expect(notice).toEqual({
      id: 'countered-1',
      kind: 'COUNTERED',
      actorId: BOT_PLAYER_ID,
      card: countered,
    });
  });

  it('describes the land recovered from the Bot graveyard by Forest', () => {
    const state = createLocalMatch(25, zeroRng);
    const recovered = state.players[1].hand[0];
    expect(recovered).toBeDefined();
    if (recovered === undefined) throw new Error('Expected a card in hand.');

    const recoveryState: GameState = {
      ...state,
      players: [
        state.players[0],
        {
          ...state.players[1],
          hand: state.players[1].hand.slice(1),
          graveyard: [recovered],
        },
      ],
      pending: {
        kind: 'FOREST_RECOVERY',
        controllerId: BOT_PLAYER_ID,
      },
    };
    const notice = noticeForAcceptedAction(
      recoveryState,
      BOT_PLAYER_ID,
      {
        type: 'CHOOSE_FOREST_RECOVERY',
        targetCardId: recovered.id,
      },
      'recovered-1',
    );

    expect(notice).toEqual({
      id: 'recovered-1',
      kind: 'RECOVERED',
      actorId: BOT_PLAYER_ID,
      card: recovered,
    });
  });
});
