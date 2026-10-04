import type { GameAction, GameState, PlayerId } from './types.js';

export function getLegalActions(
  state: GameState,
  actorId: PlayerId,
): readonly GameAction[] {
  const actor = state.players.find((player) => player.id === actorId);
  if (actor === undefined || state.winnerId !== null) {
    return [];
  }

  const pending = state.pending;
  if (pending?.kind === 'RESPONSE') {
    if (pending.responderId !== actorId) {
      return [];
    }

    const actions: GameAction[] = [{ type: 'PASS_RESPONSE' }];
    for (const island of actor.hand.filter((card) => card.type === 'ISLAND')) {
      for (const cost of actor.hand.filter(
        (card) => card.type === pending.landType && card.id !== island.id,
      )) {
        actions.push({
          type: 'COUNTER_WITH_ISLAND',
          islandCardId: island.id,
          discardCardId: cost.id,
        });
      }
    }
    return actions;
  }

  if (pending !== null) {
    if (pending.controllerId !== actorId) {
      return [];
    }
    const opponent = state.players.find((player) => player.id !== actorId);
    if (opponent === undefined) {
      return [];
    }

    switch (pending.kind) {
      case 'MOUNTAIN_TARGET':
        return opponent.field.map((card) => ({
          type: 'CHOOSE_MOUNTAIN_TARGET',
          targetLandId: card.id,
        }));
      case 'SWAMP_DISCARD':
        return opponent.hand.map((card) => ({
          type: 'CHOOSE_SWAMP_DISCARD',
          targetCardId: card.id,
        }));
      case 'FOREST_RECOVERY':
        return [
          ...actor.graveyard.map(
            (card): GameAction => ({
              type: 'CHOOSE_FOREST_RECOVERY',
              targetCardId: card.id,
            }),
          ),
          { type: 'SKIP_FOREST_RECOVERY' },
        ];
      case 'ISLAND_TOP':
        return [
          { type: 'CHOOSE_ISLAND_TOP', placement: 'TOP' },
          { type: 'CHOOSE_ISLAND_TOP', placement: 'BOTTOM' },
        ];
    }
  }

  if (state.currentPlayerId !== actorId) {
    return [];
  }
  if (state.phase === 'DRAW') {
    return [{ type: 'DRAW' }];
  }

  const actions: GameAction[] = [];
  if (!state.landPlayedThisTurn) {
    actions.push(
      ...actor.hand.map((card) => ({
        type: 'PLAY_LAND' as const,
        cardId: card.id,
      })),
    );
  }
  actions.push({ type: 'END_TURN' });
  return actions;
}
