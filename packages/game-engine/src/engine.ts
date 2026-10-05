import { createDeck } from './deck.js';
import { randomIndex, shuffle } from './rng.js';
import type {
  ActionResult,
  CreateGameOptions,
  GameAction,
  GameErrorCode,
  GameState,
  PlayerId,
  PlayerState,
  RandomSource,
} from './types.js';
import { hasWon } from './victory.js';

function replacePlayer(state: GameState, replacement: PlayerState): GameState {
  return {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === replacement.id ? replacement : candidate,
    ),
  };
}

function replacePlayers(
  state: GameState,
  firstReplacement: PlayerState,
  secondReplacement: PlayerState,
): GameState {
  const replacements = new Map([
    [firstReplacement.id, firstReplacement],
    [secondReplacement.id, secondReplacement],
  ]);
  return {
    ...state,
    players: state.players.map(
      (candidate) => replacements.get(candidate.id) ?? candidate,
    ),
  };
}

function player(state: GameState, playerId: PlayerId): PlayerState | undefined {
  return state.players.find((candidate) => candidate.id === playerId);
}

function requiredPlayer(state: GameState, playerId: PlayerId): PlayerState {
  const result = player(state, playerId);
  if (result === undefined) {
    throw new Error('Player no longer exists in the game.');
  }
  return result;
}

function opponents(state: GameState, playerId: PlayerId): readonly PlayerState[] {
  return state.players.filter((candidate) => candidate.id !== playerId);
}

function playersAfter(state: GameState, playerId: PlayerId): readonly PlayerState[] {
  const index = state.players.findIndex((candidate) => candidate.id === playerId);
  if (index < 0) {
    throw new Error('Player no longer exists in the game.');
  }
  return Array.from(
    { length: state.players.length - 1 },
    (_, offset) => state.players[(index + offset + 1) % state.players.length],
  ).filter((candidate): candidate is PlayerState => candidate !== undefined);
}

function nextPlayer(state: GameState, playerId: PlayerId): PlayerState {
  const next = playersAfter(state, playerId)[0];
  if (next === undefined) {
    throw new Error('A game turn requires at least two active players.');
  }
  return next;
}

function success(state: GameState): ActionResult {
  return { ok: true, state };
}

function failure(
  state: GameState,
  code: GameErrorCode,
  message: string,
): ActionResult {
  return { ok: false, state, error: { code, message } };
}

function drawCard(source: PlayerState, rng: RandomSource): PlayerState {
  let deck = [...source.deck];
  let graveyard = [...source.graveyard];

  if (deck.length === 0 && graveyard.length > 0) {
    deck = shuffle(graveyard, rng);
    graveyard = [];
  }

  const drawn = deck.shift();
  if (drawn === undefined) {
    return { ...source, deck, graveyard };
  }
  return { ...source, deck, graveyard, hand: [...source.hand, drawn] };
}

function withWinnerAfterFieldChange(
  state: GameState,
  changedPlayerId: PlayerId,
): GameState {
  const changedPlayer = player(state, changedPlayerId);
  if (changedPlayer !== undefined && hasWon(changedPlayer)) {
    return { ...state, pending: null, winnerId: changedPlayerId };
  }
  return state;
}

function enterPendingLand(
  state: GameState,
  controllerId: PlayerId,
  cardId: string,
  rng: RandomSource,
): GameState {
  const controller = player(state, controllerId);
  if (controller === undefined) {
    throw new Error('Pending land controller no longer exists.');
  }
  const card = controller.hand.find((candidate) => candidate.id === cardId);
  if (card === undefined) {
    throw new Error('Pending land is no longer in its controller hand.');
  }

  const afterEntry = replacePlayer(state, {
    ...controller,
    hand: controller.hand.filter((candidate) => candidate.id !== cardId),
    field: [...controller.field, card],
  });
  const victoryState = withWinnerAfterFieldChange(afterEntry, controllerId);
  if (victoryState.winnerId !== null) {
    return victoryState;
  }

  const otherPlayers = opponents(victoryState, controllerId);
  switch (card.type) {
    case 'MOUNTAIN':
      return otherPlayers.every((target) => target.field.length === 0)
        ? { ...victoryState, pending: null }
        : {
            ...victoryState,
            pending: { kind: 'MOUNTAIN_TARGET', controllerId },
          };
    case 'PLAINS':
      return {
        ...replacePlayer(victoryState, drawCard(requiredPlayer(victoryState, controllerId), rng)),
        pending: null,
      };
    case 'SWAMP': {
      const eligibleTargets = otherPlayers.filter((target) => target.hand.length > 0);
      if (eligibleTargets.length === 0) {
        return { ...victoryState, pending: null };
      }
      const onlyTarget = eligibleTargets[0];
      return eligibleTargets.length === 1 && onlyTarget !== undefined
        ? {
            ...victoryState,
            pending: {
              kind: 'SWAMP_DISCARD',
              controllerId,
              targetPlayerId: onlyTarget.id,
            },
          }
        : {
            ...victoryState,
            pending: { kind: 'SWAMP_TARGET', controllerId },
          };
    }
    case 'FOREST': {
      const currentController = requiredPlayer(victoryState, controllerId);
      return currentController.graveyard.length === 0
        ? { ...victoryState, pending: null }
        : {
            ...victoryState,
            pending: { kind: 'FOREST_RECOVERY', controllerId },
          };
    }
    case 'ISLAND': {
      const currentController = requiredPlayer(victoryState, controllerId);
      const topCard = currentController.deck[0];
      return topCard === undefined
        ? { ...victoryState, pending: null }
        : {
            ...victoryState,
            pending: {
              kind: 'ISLAND_TOP',
              controllerId,
              topCardId: topCard.id,
            },
          };
    }
  }
}

function handlePendingAction(
  state: GameState,
  actorId: PlayerId,
  action: GameAction,
  rng: RandomSource,
): ActionResult {
  const pending = state.pending;
  if (pending === null) {
    return failure(state, 'NO_ACTION_PENDING', 'There is no pending action.');
  }

  if (pending.kind === 'RESPONSE') {
    if (actorId !== pending.responderId) {
      return failure(
        state,
        'NOT_YOUR_TURN',
        'Only the responding player may resolve this response window.',
      );
    }
    if (action.type === 'PASS_RESPONSE') {
      const nextResponderId = pending.remainingResponderIds[0];
      if (nextResponderId !== undefined) {
        return success({
          ...state,
          pending: {
            ...pending,
            responderId: nextResponderId,
            remainingResponderIds: pending.remainingResponderIds.slice(1),
          },
        });
      }
      return success(
        enterPendingLand(
          { ...state, pending: null },
          pending.controllerId,
          pending.cardId,
          rng,
        ),
      );
    }
    if (action.type !== 'COUNTER_WITH_ISLAND') {
      return failure(
        state,
        'WRONG_PENDING_ACTION',
        'The response window accepts only pass or an Island counter.',
      );
    }

    const responder = requiredPlayer(state, actorId);
    const controller = requiredPlayer(state, pending.controllerId);
    const island = responder.hand.find(
      (card) => card.id === action.islandCardId,
    );
    const discard = responder.hand.find(
      (card) => card.id === action.discardCardId,
    );
    if (island === undefined || discard === undefined) {
      return failure(
        state,
        'CARD_NOT_IN_HAND',
        'Both the Island and discard cost must be in the responder hand.',
      );
    }
    if (
      island.type !== 'ISLAND' ||
      discard.type !== pending.landType ||
      island.id === discard.id
    ) {
      return failure(
        state,
        'INVALID_COUNTER_COST',
        'The counter requires an Island and a distinct card matching the countered land type.',
      );
    }
    const attemptedLand = controller.hand.find(
      (card) => card.id === pending.cardId,
    );
    if (attemptedLand === undefined) {
      throw new Error('Countered land is no longer in its controller hand.');
    }

    const nextResponder: PlayerState = {
      ...responder,
      hand: responder.hand.filter(
        (card) => card.id !== island.id && card.id !== discard.id,
      ),
      field: [...responder.field, island],
      graveyard: [...responder.graveyard, discard],
    };
    const nextController: PlayerState = {
      ...controller,
      hand: controller.hand.filter((card) => card.id !== attemptedLand.id),
      graveyard: [...controller.graveyard, attemptedLand],
    };
    const countered = replacePlayers(
      { ...state, pending: null },
      nextResponder,
      nextController,
    );
    return success(withWinnerAfterFieldChange(countered, responder.id));
  }

  if (actorId !== pending.controllerId) {
    return failure(
      state,
      'NOT_YOUR_TURN',
      'Only the ability controller may make this choice.',
    );
  }

  const controller = requiredPlayer(state, actorId);
  switch (pending.kind) {
    case 'MOUNTAIN_TARGET': {
      if (action.type !== 'CHOOSE_MOUNTAIN_TARGET') {
        return failure(
          state,
          'WRONG_PENDING_ACTION',
          'A Mountain target must be chosen.',
        );
      }
      const targetPlayer = opponents(state, actorId).find((candidate) =>
        candidate.field.some((card) => card.id === action.targetLandId),
      );
      const target = targetPlayer?.field.find(
        (card) => card.id === action.targetLandId,
      );
      if (targetPlayer === undefined || target === undefined) {
        return failure(
          state,
          'INVALID_TARGET',
          'Mountain must target a land on the opponent field.',
        );
      }
      return success({
        ...replacePlayer(state, {
          ...targetPlayer,
          field: targetPlayer.field.filter((card) => card.id !== target.id),
          graveyard: [...targetPlayer.graveyard, target],
        }),
        pending: null,
      });
    }
    case 'SWAMP_TARGET': {
      if (action.type !== 'CHOOSE_SWAMP_TARGET') {
        return failure(
          state,
          'WRONG_PENDING_ACTION',
          'An opponent must be chosen for the Swamp ability.',
        );
      }
      const targetPlayer = opponents(state, actorId).find(
        (candidate) => candidate.id === action.targetPlayerId,
      );
      if (targetPlayer === undefined || targetPlayer.hand.length === 0) {
        return failure(
          state,
          'INVALID_TARGET',
          'Swamp must target an opponent with at least one card in hand.',
        );
      }
      return success({
        ...state,
        pending: {
          kind: 'SWAMP_DISCARD',
          controllerId: actorId,
          targetPlayerId: targetPlayer.id,
        },
      });
    }
    case 'SWAMP_DISCARD': {
      if (action.type !== 'CHOOSE_SWAMP_DISCARD') {
        return failure(
          state,
          'WRONG_PENDING_ACTION',
          'A card from the revealed hand must be chosen.',
        );
      }
      const targetPlayer = requiredPlayer(state, pending.targetPlayerId);
      const target = targetPlayer.hand.find(
        (card) => card.id === action.targetCardId,
      );
      if (target === undefined) {
        return failure(
          state,
          'INVALID_TARGET',
          'Swamp must target a card in the opponent hand.',
        );
      }
      return success({
        ...replacePlayer(state, {
          ...targetPlayer,
          hand: targetPlayer.hand.filter((card) => card.id !== target.id),
          graveyard: [...targetPlayer.graveyard, target],
        }),
        pending: null,
      });
    }
    case 'FOREST_RECOVERY': {
      if (action.type === 'SKIP_FOREST_RECOVERY') {
        return success({ ...state, pending: null });
      }
      if (action.type !== 'CHOOSE_FOREST_RECOVERY') {
        return failure(
          state,
          'WRONG_PENDING_ACTION',
          'Choose a land to recover or skip the optional Forest ability.',
        );
      }
      const target = controller.graveyard.find(
        (card) => card.id === action.targetCardId,
      );
      if (target === undefined) {
        return failure(
          state,
          'INVALID_TARGET',
          'Forest must recover a card from its controller graveyard.',
        );
      }
      return success({
        ...replacePlayer(state, {
          ...controller,
          hand: [...controller.hand, target],
          graveyard: controller.graveyard.filter(
            (card) => card.id !== target.id,
          ),
        }),
        pending: null,
      });
    }
    case 'ISLAND_TOP': {
      if (action.type !== 'CHOOSE_ISLAND_TOP') {
        return failure(
          state,
          'WRONG_PENDING_ACTION',
          'The Island top-card placement must be chosen.',
        );
      }
      const top = controller.deck[0];
      if (top?.id !== pending.topCardId) {
        throw new Error('The deck changed while the Island choice was pending.');
      }
      const deck =
        action.placement === 'TOP'
          ? [...controller.deck]
          : [...controller.deck.slice(1), top];
      return success({
        ...replacePlayer(state, { ...controller, deck }),
        pending: null,
      });
    }
  }
}

function successorAfterRemoval(
  state: GameState,
  removedPlayerId: PlayerId,
  remainingPlayers: readonly PlayerState[],
): PlayerState | undefined {
  const removedIndex = state.players.findIndex(
    (candidate) => candidate.id === removedPlayerId,
  );
  if (removedIndex < 0) return undefined;
  for (let offset = 1; offset < state.players.length; offset += 1) {
    const candidate = state.players[(removedIndex + offset) % state.players.length];
    const remaining = remainingPlayers.find((playerState) => playerState.id === candidate?.id);
    if (remaining !== undefined) return remaining;
  }
  return undefined;
}

export function removePlayer(
  state: GameState,
  removedPlayerId: PlayerId,
  rng: RandomSource,
): GameState {
  if (!state.players.some((candidate) => candidate.id === removedPlayerId)) {
    return state;
  }

  const remainingPlayers = state.players.filter(
    (candidate) => candidate.id !== removedPlayerId,
  );
  if (remainingPlayers.length === 0) {
    return { ...state, players: [], pending: null, winnerId: null };
  }
  if (remainingPlayers.length === 1) {
    const winner = remainingPlayers[0];
    if (winner === undefined) return state;
    return {
      ...state,
      players: remainingPlayers,
      currentPlayerId: winner.id,
      startingPlayerId: state.startingPlayerId === removedPlayerId
        ? winner.id
        : state.startingPlayerId,
      pending: null,
      winnerId: winner.id,
    };
  }

  const successor = successorAfterRemoval(state, removedPlayerId, remainingPlayers);
  let nextState: GameState = {
    ...state,
    players: remainingPlayers,
    startingPlayerId: state.startingPlayerId === removedPlayerId
      ? (successor?.id ?? remainingPlayers[0]?.id ?? state.startingPlayerId)
      : state.startingPlayerId,
  };
  if (state.currentPlayerId === removedPlayerId) {
    if (successor === undefined) {
      throw new Error('Unable to find the next active player after removal.');
    }
    nextState = {
      ...nextState,
      currentPlayerId: successor.id,
      turnNumber: state.turnNumber + 1,
      phase: 'DRAW',
      landPlayedThisTurn: false,
    };
  }

  const pending = state.pending;
  if (pending === null) return nextState;
  if (pending.controllerId === removedPlayerId) {
    return { ...nextState, pending: null };
  }

  if (pending.kind === 'RESPONSE') {
    const priority = [pending.responderId, ...pending.remainingResponderIds].filter(
      (candidate) =>
        candidate !== removedPlayerId &&
        remainingPlayers.some((playerState) => playerState.id === candidate),
    );
    const responderId = priority[0];
    if (responderId === undefined) {
      return enterPendingLand(
        { ...nextState, pending: null },
        pending.controllerId,
        pending.cardId,
        rng,
      );
    }
    return {
      ...nextState,
      pending: {
        ...pending,
        responderId,
        remainingResponderIds: priority.slice(1),
      },
    };
  }

  if (
    pending.kind === 'MOUNTAIN_TARGET' &&
    opponents(nextState, pending.controllerId).every(
      (candidate) => candidate.field.length === 0,
    )
  ) {
    return { ...nextState, pending: null };
  }
  if (
    pending.kind === 'SWAMP_DISCARD' &&
    pending.targetPlayerId === removedPlayerId
  ) {
    return { ...nextState, pending: null };
  }
  if (
    pending.kind === 'SWAMP_TARGET' &&
    opponents(nextState, pending.controllerId).every(
      (candidate) => candidate.hand.length === 0,
    )
  ) {
    return { ...nextState, pending: null };
  }
  return nextState;
}

export function createGame(options: CreateGameOptions): GameState {
  if (options.playerIds.length !== 2 && options.playerIds.length !== 4) {
    throw new Error('A game requires exactly two or four players.');
  }
  if (new Set(options.playerIds).size !== options.playerIds.length) {
    throw new Error('A game requires distinct player IDs.');
  }

  const startingPlayerIndex = randomIndex(options.rng, options.playerIds.length);
  const players = options.playerIds.map((id) => {
    const shuffledDeck = createDeck(id, options.deckSize, options.rng);
    return {
      id,
      hand: shuffledDeck.slice(0, 5),
      deck: shuffledDeck.slice(5),
      field: [],
      graveyard: [],
    } satisfies PlayerState;
  });

  const startingPlayer = players[startingPlayerIndex];
  if (startingPlayer === undefined) {
    throw new Error('Starting player index was unexpectedly out of bounds.');
  }
  return {
    players,
    currentPlayerId: startingPlayer.id,
    startingPlayerId: startingPlayer.id,
    turnNumber: 1,
    phase: 'MAIN',
    landPlayedThisTurn: false,
    pending: null,
    winnerId: null,
  };
}

export function applyAction(
  state: GameState,
  actorId: PlayerId,
  action: GameAction,
  rng: RandomSource,
): ActionResult {
  const actor = player(state, actorId);
  if (actor === undefined) {
    return failure(state, 'UNKNOWN_PLAYER', 'The actor does not belong to this game.');
  }
  if (state.winnerId !== null) {
    return failure(state, 'GAME_OVER', 'The game has already ended.');
  }
  if (state.pending !== null) {
    return handlePendingAction(state, actorId, action, rng);
  }

  if (
    action.type === 'PASS_RESPONSE' ||
    action.type === 'COUNTER_WITH_ISLAND' ||
    action.type === 'CHOOSE_MOUNTAIN_TARGET' ||
    action.type === 'CHOOSE_SWAMP_TARGET' ||
    action.type === 'CHOOSE_SWAMP_DISCARD' ||
    action.type === 'CHOOSE_FOREST_RECOVERY' ||
    action.type === 'SKIP_FOREST_RECOVERY' ||
    action.type === 'CHOOSE_ISLAND_TOP'
  ) {
    return failure(state, 'NO_ACTION_PENDING', 'There is no pending action.');
  }
  if (actorId !== state.currentPlayerId) {
    return failure(state, 'NOT_YOUR_TURN', 'It is not this player turn.');
  }

  switch (action.type) {
    case 'DRAW': {
      if (state.phase !== 'DRAW') {
        return failure(
          state,
          'WRONG_PHASE',
          'A normal draw is only legal during the draw phase.',
        );
      }
      return success({
        ...replacePlayer(state, drawCard(actor, rng)),
        phase: 'MAIN',
      });
    }
    case 'PLAY_LAND': {
      if (state.phase !== 'MAIN') {
        return failure(state, 'WRONG_PHASE', 'A land can only be played in the main phase.');
      }
      if (state.landPlayedThisTurn) {
        return failure(
          state,
          'LAND_ALREADY_PLAYED',
          'Only one land may be played during a player turn.',
        );
      }
      const card = actor.hand.find((candidate) => candidate.id === action.cardId);
      if (card === undefined) {
        return failure(
          state,
          'CARD_NOT_IN_HAND',
          'The played land must be in the actor hand.',
        );
      }
      const responders = playersAfter(state, actorId);
      const firstResponder = responders[0];
      const nextState = { ...state, landPlayedThisTurn: true };
      return success(
        firstResponder === undefined
          ? enterPendingLand(nextState, actorId, card.id, rng)
          : {
              ...nextState,
              pending: {
                kind: 'RESPONSE',
                controllerId: actorId,
                responderId: firstResponder.id,
                remainingResponderIds: responders.slice(1).map((responder) => responder.id),
                cardId: card.id,
                landType: card.type,
              },
            },
      );
    }
    case 'END_TURN': {
      if (state.phase !== 'MAIN') {
        return failure(
          state,
          'WRONG_PHASE',
          'The turn can only end during the main phase.',
        );
      }
      const followingPlayer = nextPlayer(state, actorId);
      return success({
        ...state,
        currentPlayerId: followingPlayer.id,
        turnNumber: state.turnNumber + 1,
        phase: 'DRAW',
        landPlayedThisTurn: false,
      });
    }
  }
}
