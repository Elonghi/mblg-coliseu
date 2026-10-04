export const LAND_TYPES = [
  'MOUNTAIN',
  'ISLAND',
  'SWAMP',
  'FOREST',
  'PLAINS',
] as const;

export type LandType = (typeof LAND_TYPES)[number];
export type DeckSize = 25 | 50;
export type PlayerId = string;

export interface Card {
  readonly id: string;
  readonly type: LandType;
  readonly ownerId: PlayerId;
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly deck: readonly Card[];
  readonly hand: readonly Card[];
  readonly field: readonly Card[];
  readonly graveyard: readonly Card[];
}

export type TurnPhase = 'DRAW' | 'MAIN';

export type PendingAction =
  | {
      readonly kind: 'RESPONSE';
      readonly controllerId: PlayerId;
      readonly responderId: PlayerId;
      readonly cardId: string;
      readonly landType: LandType;
    }
  | {
      readonly kind: 'MOUNTAIN_TARGET';
      readonly controllerId: PlayerId;
    }
  | {
      readonly kind: 'SWAMP_DISCARD';
      readonly controllerId: PlayerId;
      readonly targetPlayerId: PlayerId;
    }
  | {
      readonly kind: 'FOREST_RECOVERY';
      readonly controllerId: PlayerId;
    }
  | {
      readonly kind: 'ISLAND_TOP';
      readonly controllerId: PlayerId;
      readonly topCardId: string;
    };

export interface GameState {
  readonly players: readonly [PlayerState, PlayerState];
  readonly currentPlayerId: PlayerId;
  readonly startingPlayerId: PlayerId;
  readonly turnNumber: number;
  readonly phase: TurnPhase;
  readonly landPlayedThisTurn: boolean;
  readonly pending: PendingAction | null;
  readonly winnerId: PlayerId | null;
}

export interface RandomSource {
  next(): number;
}

export interface CreateGameOptions {
  readonly playerIds: readonly [PlayerId, PlayerId];
  readonly deckSize: DeckSize;
  readonly rng: RandomSource;
}

export type GameAction =
  | { readonly type: 'DRAW' }
  | { readonly type: 'PLAY_LAND'; readonly cardId: string }
  | { readonly type: 'PASS_RESPONSE' }
  | {
      readonly type: 'COUNTER_WITH_ISLAND';
      readonly islandCardId: string;
      readonly discardCardId: string;
    }
  | {
      readonly type: 'CHOOSE_MOUNTAIN_TARGET';
      readonly targetLandId: string;
    }
  | {
      readonly type: 'CHOOSE_SWAMP_DISCARD';
      readonly targetCardId: string;
    }
  | {
      readonly type: 'CHOOSE_FOREST_RECOVERY';
      readonly targetCardId: string;
    }
  | { readonly type: 'SKIP_FOREST_RECOVERY' }
  | {
      readonly type: 'CHOOSE_ISLAND_TOP';
      readonly placement: 'TOP' | 'BOTTOM';
    }
  | { readonly type: 'END_TURN' };

export type GameErrorCode =
  | 'GAME_OVER'
  | 'UNKNOWN_PLAYER'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'ACTION_PENDING'
  | 'NO_ACTION_PENDING'
  | 'WRONG_PENDING_ACTION'
  | 'CARD_NOT_IN_HAND'
  | 'LAND_ALREADY_PLAYED'
  | 'INVALID_TARGET'
  | 'INVALID_COUNTER_COST';

export interface GameError {
  readonly code: GameErrorCode;
  readonly message: string;
}

export type ActionResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly state: GameState; readonly error: GameError };

export interface PublicPlayerState {
  readonly id: PlayerId;
  readonly deckCount: number;
  readonly handCount: number;
  readonly field: readonly Card[];
  readonly graveyard: readonly Card[];
}

export type PublicPendingAction =
  | Exclude<PendingAction, { readonly kind: 'ISLAND_TOP' }>
  | { readonly kind: 'ISLAND_TOP'; readonly controllerId: PlayerId };

export interface PublicGameState {
  readonly players: readonly [PublicPlayerState, PublicPlayerState];
  readonly currentPlayerId: PlayerId;
  readonly startingPlayerId: PlayerId;
  readonly turnNumber: number;
  readonly phase: TurnPhase;
  readonly landPlayedThisTurn: boolean;
  readonly pending: PublicPendingAction | null;
  readonly winnerId: PlayerId | null;
}

export interface PlayerView {
  readonly publicState: PublicGameState;
  readonly privateState: {
    readonly playerId: PlayerId;
    readonly hand: readonly Card[];
    readonly deckTop: Card | null;
    readonly revealedOpponentHand: readonly Card[] | null;
  };
}
