import type {
  Card,
  GameState,
  PlayerId,
  PlayerView,
  PublicGameState,
  PublicPendingAction,
} from './types.js';

function publicPending(state: GameState): PublicPendingAction | null {
  if (state.pending?.kind === 'ISLAND_TOP') {
    return {
      kind: state.pending.kind,
      controllerId: state.pending.controllerId,
    };
  }
  if (state.pending?.kind === 'RESPONSE') {
    return {
      kind: state.pending.kind,
      controllerId: state.pending.controllerId,
      responderId: state.pending.responderId,
      cardId: state.pending.cardId,
      landType: state.pending.landType,
    };
  }
  return state.pending;
}

export function getPublicState(state: GameState): PublicGameState {
  return {
    players: state.players.map((player) => ({
      id: player.id,
      deckCount: player.deck.length,
      handCount: player.hand.length,
      field: player.field,
      graveyard: player.graveyard,
    })),
    currentPlayerId: state.currentPlayerId,
    startingPlayerId: state.startingPlayerId,
    turnNumber: state.turnNumber,
    phase: state.phase,
    landPlayedThisTurn: state.landPlayedThisTurn,
    pending: publicPending(state),
    winnerId: state.winnerId,
  };
}

export function getPlayerView(state: GameState, viewerId: PlayerId): PlayerView {
  const viewer = state.players.find((player) => player.id === viewerId);
  if (viewer === undefined) {
    throw new Error(`Unknown player: ${viewerId}`);
  }

  let deckTop: Card | null = null;
  if (
    state.pending?.kind === 'ISLAND_TOP' &&
    state.pending.controllerId === viewerId
  ) {
    deckTop = viewer.deck[0] ?? null;
  }

  let revealedOpponentHand: readonly Card[] | null = null;
  if (
    state.pending?.kind === 'SWAMP_DISCARD' &&
    state.pending.controllerId === viewerId
  ) {
    const targetPlayerId = state.pending.targetPlayerId;
    revealedOpponentHand =
      state.players.find((player) => player.id === targetPlayerId)?.hand ?? null;
  }

  return {
    publicState: getPublicState(state),
    privateState: {
      playerId: viewerId,
      hand: viewer.hand,
      deckTop,
      revealedOpponentHand,
    },
  };
}
