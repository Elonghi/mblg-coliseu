import {
  LAND_TYPES,
  applyAction,
  hasWon,
} from '../../src/index.js';
import type {
  DeckSize,
  GameAction,
  GameState,
  PlayerId,
  RandomSource,
} from '../../src/index.js';

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error('Simulation invariant failed: ' + message);
  }
}

function countByType(state: GameState, ownerId: PlayerId): Map<string, number> {
  const counts = new Map<string, number>();
  const owner = state.players.find((player) => player.id === ownerId);
  invariant(owner !== undefined, 'card owner must be a game player');

  for (const zone of [owner.deck, owner.hand, owner.field, owner.graveyard]) {
    for (const card of zone) {
      counts.set(card.type, (counts.get(card.type) ?? 0) + 1);
    }
  }
  return counts;
}

export function validateGameInvariants(
  state: GameState,
  deckSize: DeckSize,
): void {
  invariant(
    new Set(state.players.map((player) => player.id)).size === state.players.length,
    'player IDs are unique',
  );
  invariant(
    state.players.some((player) => player.id === state.currentPlayerId),
    'current player belongs to game',
  );
  invariant(
    state.players.some((player) => player.id === state.startingPlayerId),
    'starting player belongs to game',
  );
  invariant(
    Number.isInteger(state.turnNumber) && state.turnNumber >= 1,
    'turn number is a positive integer',
  );

  const allCardIds = new Set<string>();
  const copiesPerType = deckSize / LAND_TYPES.length;
  for (const owner of state.players) {
    let total = 0;
    for (const zone of [owner.deck, owner.hand, owner.field, owner.graveyard]) {
      for (const card of zone) {
        invariant(card.ownerId === owner.id, 'cards stay in their owner zones');
        invariant(!allCardIds.has(card.id), 'a card exists in exactly one zone');
        allCardIds.add(card.id);
        total += 1;
      }
    }
    invariant(total === deckSize, 'each player conserves every deck card');

    const counts = countByType(state, owner.id);
    for (const type of LAND_TYPES) {
      invariant(
        counts.get(type) === copiesPerType,
        'land-type quantities remain constant',
      );
    }
  }

  const winningPlayers = state.players.filter(hasWon);
  if (state.winnerId === null) {
    invariant(winningPlayers.length === 0, 'a fulfilled victory is recorded immediately');
  } else {
    invariant(state.pending === null, 'a finished game has no pending action');
    invariant(winningPlayers.length === 1, 'a finished game has one valid winner');
    invariant(winningPlayers[0]?.id === state.winnerId, 'winner fulfilled a victory condition');
  }

  if (state.phase === 'DRAW') {
    invariant(state.pending === null, 'draw phase cannot have a pending action');
    invariant(!state.landPlayedThisTurn, 'new turn starts without a played land');
  }

  const pending = state.pending;
  if (pending === null) {
    return;
  }

  invariant(state.phase === 'MAIN', 'pending actions only exist in main phase');
  invariant(state.landPlayedThisTurn, 'pending land action consumed the turn play');
  invariant(
    pending.controllerId === state.currentPlayerId,
    'pending controller is the active player',
  );

  const controller = state.players.find(
    (player) => player.id === pending.controllerId,
  );
  invariant(controller !== undefined, 'pending controller exists');
  const opponent = state.players.find((player) => player.id !== controller.id);
  invariant(opponent !== undefined, 'pending opponent exists');

  switch (pending.kind) {
    case 'RESPONSE': {
      invariant(pending.responderId === opponent.id, 'response belongs to opponent');
      const attempted = controller.hand.find((card) => card.id === pending.cardId);
      invariant(attempted !== undefined, 'attempted land remains controlled while pending');
      invariant(attempted.type === pending.landType, 'response exposes the correct land type');
      break;
    }
    case 'MOUNTAIN_TARGET':
      invariant(opponent.field.length > 0, 'Mountain has a legal opposing target');
      invariant(
        controller.field.some((card) => card.type === 'MOUNTAIN'),
        'Mountain ability has a Mountain in play',
      );
      break;
    case 'SWAMP_DISCARD':
      invariant(pending.targetPlayerId === opponent.id, 'Swamp targets the opponent');
      invariant(opponent.hand.length > 0, 'Swamp has a legal discard target');
      invariant(
        controller.field.some((card) => card.type === 'SWAMP'),
        'Swamp ability has a Swamp in play',
      );
      break;
    case 'FOREST_RECOVERY':
      invariant(controller.graveyard.length > 0, 'Forest has a legal recovery target');
      invariant(
        controller.field.some((card) => card.type === 'FOREST'),
        'Forest ability has a Forest in play',
      );
      break;
    case 'ISLAND_TOP':
      invariant(controller.deck[0]?.id === pending.topCardId, 'Island locks the real top card');
      invariant(
        controller.field.some((card) => card.type === 'ISLAND'),
        'Island ability has an Island in play',
      );
      break;
  }
}

const forbiddenRng: RandomSource = {
  next(): number {
    throw new Error('A rejected action must not consume RNG.');
  },
};

function assertRejected(
  state: GameState,
  actorId: PlayerId,
  action: GameAction,
): void {
  const result = applyAction(state, actorId, action, forbiddenRng);
  invariant(!result.ok, 'an impossible action was accepted');
  invariant(result.state === state, 'a rejected action changed state');
}

export function verifyImpossibleActionsAreRejected(state: GameState): void {
  assertRejected(state, 'not-a-player', { type: 'END_TURN' });

  if (state.pending !== null) {
    const wrongActor = state.players.find(
      (player) =>
        player.id !==
        (state.pending?.kind === 'RESPONSE'
          ? state.pending.responderId
          : state.pending?.controllerId),
    );
    invariant(wrongActor !== undefined, 'wrong pending actor exists');
    assertRejected(state, wrongActor.id, { type: 'END_TURN' });
    return;
  }

  const inactive = state.players.find(
    (player) => player.id !== state.currentPlayerId,
  );
  invariant(inactive !== undefined, 'inactive player exists');
  assertRejected(state, inactive.id, { type: 'END_TURN' });
  assertRejected(state, state.currentPlayerId, {
    type: 'COUNTER_WITH_ISLAND',
    islandCardId: 'missing-island',
    discardCardId: 'missing-cost',
  });
  assertRejected(state, state.currentPlayerId, {
    type: 'PLAY_LAND',
    cardId: 'missing-land',
  });
}
