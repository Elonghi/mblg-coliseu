import type {
  DeckSize,
  GameAction,
  PlayerId,
  PlayerView,
  PublicGameState,
} from '@mblg-coliseu/game-engine';

export const PROTOCOL_VERSION = 1 as const;

export interface ProjectedGameState {
  readonly publicGameState: PublicGameState;
  readonly privatePlayerState: PlayerView['privateState'];
  readonly legalActions: readonly GameAction[];
}

export type WireGameAction =
  | { readonly type: 'draw' }
  | { readonly type: 'play_land'; readonly cardId: string }
  | { readonly type: 'pass_response' }
  | {
      readonly type: 'counter_with_island';
      readonly islandCardId: string;
      readonly discardCardId: string;
    }
  | { readonly type: 'mountain_target'; readonly targetCardId: string }
  | { readonly type: 'swamp_discard'; readonly targetCardId: string }
  | { readonly type: 'forest_recovery'; readonly targetCardId: string }
  | { readonly type: 'skip_forest_recovery' }
  | { readonly type: 'island_top'; readonly placement: 'top' | 'bottom' }
  | { readonly type: 'end_turn' };

interface ClientBase {
  readonly version: typeof PROTOCOL_VERSION;
  readonly requestId: string;
}

export type ClientMessage =
  | (ClientBase & { readonly type: 'create_room'; readonly deckSize: DeckSize })
  | (ClientBase & {
      readonly type: 'join_room';
      readonly roomCode: string;
      readonly sessionToken?: string;
    })
  | (ClientBase & { readonly type: 'ready' })
  | (ClientBase & { readonly type: 'game_action'; readonly action: WireGameAction })
  | (ClientBase & { readonly type: 'leave_room' })
  | (ClientBase & { readonly type: 'ping' });

export type RoomStatus = 'WAITING' | 'READY' | 'PLAYING' | 'FINISHED';
export type FinishReason = 'VICTORY' | 'PLAYER_LEFT' | 'DISCONNECT_TIMEOUT';

interface ServerBase {
  readonly version: typeof PROTOCOL_VERSION;
  readonly requestId?: string;
}

export type ServerMessage =
  | (ServerBase & {
      readonly type: 'room_created' | 'room_joined';
      readonly roomCode: string;
      readonly playerId: PlayerId;
      readonly sessionToken: string;
      readonly status: RoomStatus;
    })
  | (ServerBase & {
      readonly type: 'player_joined';
      readonly roomCode: string;
      readonly playerId: PlayerId;
    })
  | (ServerBase & {
      readonly type: 'game_started' | 'game_state';
      readonly roomCode: string;
      readonly state: ProjectedGameState;
    })
  | (ServerBase & {
      readonly type: 'action_rejected' | 'error';
      readonly code: string;
      readonly message: string;
    })
  | (ServerBase & {
      readonly type: 'game_finished';
      readonly roomCode: string;
      readonly winnerId: PlayerId | null;
      readonly reason: FinishReason;
      readonly state: ProjectedGameState | null;
    })
  | (ServerBase & {
      readonly type: 'player_disconnected';
      readonly playerId: PlayerId;
      readonly reconnectDeadline: string;
    })
  | (ServerBase & {
      readonly type: 'player_reconnected';
      readonly playerId: PlayerId;
    })
  | (ServerBase & { readonly type: 'pong' });

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'lost';

export interface MultiplayerCredentials {
  readonly roomCode: string;
  readonly playerId: PlayerId;
  readonly sessionToken: string;
}

export interface GameResult {
  readonly winnerId: PlayerId | null;
  readonly reason: FinishReason;
}
