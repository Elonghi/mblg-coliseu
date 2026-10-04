import type { GameAction, PlayerView } from '../../src/index.js';

type PublicPlayerState = PlayerView['publicState']['players'][number];

function ownPublicState(view: PlayerView): PublicPlayerState {
  const ownState = view.publicState.players.find(
    (player) => player.id === view.privateState.playerId,
  );
  if (ownState === undefined) {
    throw new Error('Bot player is missing from the public state.');
  }
  return ownState;
}

function opponentPublicState(view: PlayerView): PublicPlayerState {
  const opponent = view.publicState.players.find(
    (player) => player.id !== view.privateState.playerId,
  );
  if (opponent === undefined) {
    throw new Error('Bot opponent is missing from the public state.');
  }
  return opponent;
}

export function chooseSimpleBotAction(view: PlayerView): GameAction {
  const botId = view.privateState.playerId;
  const pending = view.publicState.pending;

  if (pending?.kind === 'RESPONSE') {
    if (pending.responderId !== botId) {
      throw new Error('Bot received a response window belonging to another player.');
    }

    for (const island of view.privateState.hand.filter(
      (card) => card.type === 'ISLAND',
    )) {
      const cost = view.privateState.hand.find(
        (card) => card.type === pending.landType && card.id !== island.id,
      );
      if (cost !== undefined) {
        return {
          type: 'COUNTER_WITH_ISLAND',
          islandCardId: island.id,
          discardCardId: cost.id,
        };
      }
    }
    return { type: 'PASS_RESPONSE' };
  }

  if (pending?.kind === 'MOUNTAIN_TARGET') {
    const target = opponentPublicState(view).field[0];
    if (target === undefined) {
      throw new Error('Mountain choice has no legal target.');
    }
    return { type: 'CHOOSE_MOUNTAIN_TARGET', targetLandId: target.id };
  }

  if (pending?.kind === 'SWAMP_DISCARD') {
    const target = view.privateState.revealedOpponentHand?.[0];
    if (target === undefined) {
      throw new Error('Swamp choice has no revealed legal target.');
    }
    return { type: 'CHOOSE_SWAMP_DISCARD', targetCardId: target.id };
  }

  if (pending?.kind === 'FOREST_RECOVERY') {
    const target = ownPublicState(view).graveyard[0];
    return target === undefined
      ? { type: 'SKIP_FOREST_RECOVERY' }
      : { type: 'CHOOSE_FOREST_RECOVERY', targetCardId: target.id };
  }

  if (pending?.kind === 'ISLAND_TOP') {
    if (view.privateState.deckTop === null) {
      throw new Error('Island choice did not expose the top card to its controller.');
    }
    return { type: 'CHOOSE_ISLAND_TOP', placement: 'BOTTOM' };
  }

  if (view.publicState.phase === 'DRAW') {
    return { type: 'DRAW' };
  }

  const ownState = ownPublicState(view);
  const firstCard = view.privateState.hand[0];
  if (!view.publicState.landPlayedThisTurn && firstCard !== undefined) {
    return { type: 'PLAY_LAND', cardId: firstCard.id };
  }

  if (ownState.id !== view.publicState.currentPlayerId) {
    throw new Error('Bot was asked to act outside its turn.');
  }
  return { type: 'END_TURN' };
}
