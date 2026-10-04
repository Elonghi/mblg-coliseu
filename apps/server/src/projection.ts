import {
  getLegalActions,
  getPlayerView,
} from '@mblg-coliseu/game-engine';
import type {
  GameAction,
  GameState,
  PlayerId,
  PlayerView,
  PublicGameState,
} from '@mblg-coliseu/game-engine';

export interface ProjectedGameState {
  readonly publicGameState: PublicGameState;
  readonly privatePlayerState: PlayerView['privateState'];
  readonly legalActions: readonly GameAction[];
}

export function getPublicGameState(
  state: GameState,
  playerId: PlayerId,
): PublicGameState {
  return getPlayerView(state, playerId).publicState;
}

export function getPrivatePlayerState(
  state: GameState,
  playerId: PlayerId,
): PlayerView['privateState'] {
  return getPlayerView(state, playerId).privateState;
}

export function projectGameState(
  state: GameState,
  playerId: PlayerId,
): ProjectedGameState {
  return {
    publicGameState: getPublicGameState(state, playerId),
    privatePlayerState: getPrivatePlayerState(state, playerId),
    legalActions: getLegalActions(state, playerId),
  };
}
