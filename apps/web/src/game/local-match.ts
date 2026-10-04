import { chooseBotAction } from '@mblg-coliseu/bot';
import {
  applyAction,
  createGame,
  getLegalActions,
  getPlayerView,
} from '@mblg-coliseu/game-engine';
import type {
  ActionResult,
  Card,
  DeckSize,
  GameAction,
  GameState,
  PlayerId,
  PlayerView,
  RandomSource,
} from '@mblg-coliseu/game-engine';
export type MatchNotice =
  | {
      readonly id: string;
      readonly kind: 'COUNTERED';
      readonly actorId: PlayerId;
      readonly card: Card;
    }
  | {
      readonly id: string;
      readonly kind: 'RECOVERED';
      readonly actorId: PlayerId;
      readonly card: Card;
    };


export const HUMAN_PLAYER_ID = 'human';
export const BOT_PLAYER_ID = 'bot';

export interface LocalMatchSnapshot {
  readonly humanView: PlayerView;
  readonly humanActions: readonly GameAction[];
}

export class BrowserRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}

export function createLocalMatch(
  deckSize: DeckSize,
  rng: RandomSource,
): GameState {
  return createGame({
    playerIds: [HUMAN_PLAYER_ID, BOT_PLAYER_ID],
    deckSize,
    rng,
  });
}

export function noticeForAcceptedAction(
  state: GameState,
  actorId: PlayerId,
  action: GameAction,
  id: string,
): MatchNotice | null {
  if (action.type === 'COUNTER_WITH_ISLAND' && state.pending?.kind === 'RESPONSE') {
    const pending = state.pending;
    const controller = state.players.find(
      (player) => player.id === pending.controllerId,
    );
    const countered = controller?.hand.find(
      (card) => card.id === pending.cardId,
    );
    return countered === undefined
      ? null
      : { id, kind: 'COUNTERED', actorId, card: countered };
  }

  if (
    action.type === 'CHOOSE_FOREST_RECOVERY' &&
    state.pending?.kind === 'FOREST_RECOVERY'
  ) {
    const controller = state.players.find((player) => player.id === actorId);
    const recovered = controller?.graveyard.find(
      (card) => card.id === action.targetCardId,
    );
    return recovered === undefined
      ? null
      : { id, kind: 'RECOVERED', actorId, card: recovered };
  }

  return null;
}

export function snapshotForHuman(state: GameState): LocalMatchSnapshot {
  return {
    humanView: getPlayerView(state, HUMAN_PLAYER_ID),
    humanActions: getLegalActions(state, HUMAN_PLAYER_ID),
  };
}

export function decisionPlayer(state: GameState): PlayerId {
  if (state.pending?.kind === 'RESPONSE') {
    return state.pending.responderId;
  }
  return state.pending?.controllerId ?? state.currentPlayerId;
}

export function automatedAction(
  state: GameState,
): { readonly actorId: PlayerId; readonly action: GameAction } | null {
  if (state.winnerId !== null) {
    return null;
  }

  const actorId = decisionPlayer(state);
  if (actorId === BOT_PLAYER_ID) {
    return {
      actorId,
      action: chooseBotAction(getPlayerView(state, BOT_PLAYER_ID)),
    };
  }

  if (actorId === HUMAN_PLAYER_ID && state.pending === null) {
    const automaticType = state.phase === 'DRAW'
      ? 'DRAW'
      : state.landPlayedThisTurn
        ? 'END_TURN'
        : null;
    const automatic = getLegalActions(state, HUMAN_PLAYER_ID).find(
      (action) => action.type === automaticType,
    );
    return automatic === undefined ? null : { actorId, action: automatic };
  }

  return null;
}

export function executeLocalAction(
  state: GameState,
  actorId: PlayerId,
  action: GameAction,
  rng: RandomSource,
): ActionResult {
  return applyAction(state, actorId, action, rng);
}
