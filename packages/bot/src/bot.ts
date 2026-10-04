import { hasWon } from '@mblg-coliseu/game-engine';
import type {
  Card,
  GameAction,
  LandType,
  PlayerState,
  PlayerView,
} from '@mblg-coliseu/game-engine';

type PublicPlayer = PlayerView['publicState']['players'][number];

export const BOT_DIFFICULTY = 'STANDARD' as const;
export type BotDifficulty = typeof BOT_DIFFICULTY;

function ownPublic(view: PlayerView): PublicPlayer {
  const result = view.publicState.players.find(
    (player) => player.id === view.privateState.playerId,
  );
  if (result === undefined) {
    throw new Error('Bot player is missing from its public view.');
  }
  return result;
}

function opponentPublic(view: PlayerView): PublicPlayer {
  const result = view.publicState.players.find(
    (player) => player.id !== view.privateState.playerId,
  );
  if (result === undefined) {
    throw new Error('Bot opponent is missing from its public view.');
  }
  return result;
}

function playerForField(id: string, field: readonly Card[]): PlayerState {
  return {
    id,
    deck: [],
    hand: [],
    field,
    graveyard: [],
  };
}

function winsWith(
  playerId: string,
  field: readonly Card[],
  card: Card,
): boolean {
  return hasWon(playerForField(playerId, [...field, card]));
}

function typeCount(field: readonly Card[], type: LandType): number {
  return field.filter((card) => card.type === type).length;
}

function distinctTypeCount(field: readonly Card[]): number {
  return new Set(field.map((card) => card.type)).size;
}

function maximumTypeCount(field: readonly Card[]): number {
  let maximum = 0;
  for (const card of field) {
    maximum = Math.max(maximum, typeCount(field, card.type));
  }
  return maximum;
}

function fieldProgress(playerId: string, field: readonly Card[]): number {
  if (hasWon(playerForField(playerId, field))) {
    return 1_000_000;
  }
  const distinct = distinctTypeCount(field);
  const repeated = maximumTypeCount(field);
  const distinctThreat = distinct === 4 ? 20_000 : distinct * 1_000;
  const repeatedThreat = repeated >= 4 ? 20_000 : repeated * 1_000;
  return distinctThreat + repeatedThreat;
}

function futureLandValue(
  playerId: string,
  field: readonly Card[],
  card: Card,
): number {
  if (winsWith(playerId, field, card)) {
    return 1_000_000;
  }

  const sameType = typeCount(field, card.type);
  const newTypeBonus = sameType === 0 ? 10_000 : 0;
  return newTypeBonus + sameType * 1_000;
}

function bestCard(
  cards: readonly Card[],
  score: (card: Card) => number,
): Card | undefined {
  let selected: Card | undefined;
  let selectedScore = Number.NEGATIVE_INFINITY;
  for (const card of cards) {
    const currentScore = score(card);
    if (selected === undefined || currentScore > selectedScore) {
      selected = card;
      selectedScore = currentScore;
    }
  }
  return selected;
}

function chooseLand(view: PlayerView): Card | undefined {
  const own = ownPublic(view);
  const opponent = opponentPublic(view);
  return bestCard(view.privateState.hand, (card) => {
    let score = futureLandValue(own.id, own.field, card);

    switch (card.type) {
      case 'MOUNTAIN':
        if (opponent.field.length > 0) score += 600;
        break;
      case 'SWAMP':
        if (opponent.handCount > 0) score += 400;
        break;
      case 'FOREST':
        if (own.graveyard.length > 0) score += 500;
        break;
      case 'PLAINS':
        score += 300;
        break;
      case 'ISLAND':
        score += 200;
        break;
    }
    return score;
  });
}

function chooseMountainTarget(view: PlayerView): Card {
  const opponent = opponentPublic(view);
  const selected = bestCard(opponent.field, (candidate) => {
    const remaining = opponent.field.filter((card) => card.id !== candidate.id);
    return (
      fieldProgress(opponent.id, opponent.field) -
      fieldProgress(opponent.id, remaining)
    );
  });
  if (selected === undefined) {
    throw new Error('Mountain ability has no target in the supplied view.');
  }
  return selected;
}

function chooseSwampDiscard(view: PlayerView): Card {
  const opponent = opponentPublic(view);
  const revealed = view.privateState.revealedOpponentHand;
  if (revealed === null) {
    throw new Error('Swamp hand was not revealed to its controller.');
  }

  const selected = bestCard(revealed, (card) =>
    futureLandValue(opponent.id, opponent.field, card),
  );
  if (selected === undefined) {
    throw new Error('Swamp ability has no discard target in the supplied view.');
  }
  return selected;
}

function chooseForestRecovery(view: PlayerView): Card | undefined {
  const own = ownPublic(view);
  return bestCard(own.graveyard, (card) =>
    futureLandValue(own.id, own.field, card),
  );
}

function shouldKeepIslandTop(view: PlayerView, top: Card): boolean {
  const own = ownPublic(view);
  if (winsWith(own.id, own.field, top)) {
    return true;
  }
  const count = typeCount(own.field, top.type);
  return count === 0 || count >= 3;
}

function counterPair(
  view: PlayerView,
  landType: LandType,
): { readonly island: Card; readonly cost: Card } | undefined {
  const own = ownPublic(view);
  let selected:
    | { readonly island: Card; readonly cost: Card; readonly costValue: number }
    | undefined;

  for (const island of view.privateState.hand.filter(
    (card) => card.type === 'ISLAND',
  )) {
    for (const cost of view.privateState.hand.filter(
      (card) => card.type === landType && card.id !== island.id,
    )) {
      const costValue = futureLandValue(own.id, own.field, cost);
      if (selected === undefined || costValue < selected.costValue) {
        selected = { island, cost, costValue };
      }
    }
  }

  return selected === undefined
    ? undefined
    : { island: selected.island, cost: selected.cost };
}

function shouldCounter(view: PlayerView, attemptedType: LandType): boolean {
  const own = ownPublic(view);
  const opponent = opponentPublic(view);
  const attempted: Card = {
    id: 'attempted-land-for-evaluation',
    type: attemptedType,
    ownerId: opponent.id,
  };
  const responseIsland: Card = {
    id: 'response-island-for-evaluation',
    type: 'ISLAND',
    ownerId: own.id,
  };

  if (winsWith(own.id, own.field, responseIsland)) {
    return true;
  }
  if (winsWith(opponent.id, opponent.field, attempted)) {
    return true;
  }

  const opponentSameType = typeCount(opponent.field, attemptedType);
  if (opponentSameType === 0 || opponentSameType >= 3) {
    return true;
  }

  switch (attemptedType) {
    case 'MOUNTAIN':
      return own.field.length > 0;
    case 'SWAMP':
      return view.privateState.hand.length > 2;
    case 'FOREST':
      return opponent.graveyard.length > 0;
    case 'PLAINS':
      return opponent.deckCount > 0 || opponent.graveyard.length > 0;
    case 'ISLAND':
      return false;
  }
}

export function chooseBotAction(view: PlayerView): GameAction {
  const botId = view.privateState.playerId;
  const pending = view.publicState.pending;

  if (pending?.kind === 'RESPONSE') {
    if (pending.responderId !== botId) {
      throw new Error('Response window belongs to another player.');
    }
    const pair = counterPair(view, pending.landType);
    if (pair !== undefined && shouldCounter(view, pending.landType)) {
      return {
        type: 'COUNTER_WITH_ISLAND',
        islandCardId: pair.island.id,
        discardCardId: pair.cost.id,
      };
    }
    return { type: 'PASS_RESPONSE' };
  }

  if (pending !== null && pending.controllerId !== botId) {
    throw new Error('Pending choice belongs to another player.');
  }

  switch (pending?.kind) {
    case 'MOUNTAIN_TARGET':
      return {
        type: 'CHOOSE_MOUNTAIN_TARGET',
        targetLandId: chooseMountainTarget(view).id,
      };
    case 'SWAMP_DISCARD':
      return {
        type: 'CHOOSE_SWAMP_DISCARD',
        targetCardId: chooseSwampDiscard(view).id,
      };
    case 'FOREST_RECOVERY': {
      const target = chooseForestRecovery(view);
      return target === undefined
        ? { type: 'SKIP_FOREST_RECOVERY' }
        : { type: 'CHOOSE_FOREST_RECOVERY', targetCardId: target.id };
    }
    case 'ISLAND_TOP': {
      const top = view.privateState.deckTop;
      if (top === null) {
        throw new Error('Island top card is not visible to its controller.');
      }
      return {
        type: 'CHOOSE_ISLAND_TOP',
        placement: shouldKeepIslandTop(view, top) ? 'TOP' : 'BOTTOM',
      };
    }
    case undefined:
      break;
  }

  if (view.publicState.currentPlayerId !== botId) {
    throw new Error('Bot was asked to act outside its turn.');
  }
  if (view.publicState.phase === 'DRAW') {
    return { type: 'DRAW' };
  }
  if (!view.publicState.landPlayedThisTurn) {
    const land = chooseLand(view);
    if (land !== undefined) {
      return { type: 'PLAY_LAND', cardId: land.id };
    }
  }
  return { type: 'END_TURN' };
}
