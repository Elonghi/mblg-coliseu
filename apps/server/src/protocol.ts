import type { DeckSize, GameAction, PlayerId } from '@mblg-coliseu/game-engine';
import type { ProjectedGameState } from './projection.js';

export const PROTOCOL_VERSION = 1 as const;

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

interface ClientMessageBase {
  readonly version: typeof PROTOCOL_VERSION;
  readonly requestId: string;
}

export type ClientMessage =
  | (ClientMessageBase & {
      readonly type: 'create_room';
      readonly deckSize: DeckSize;
    })
  | (ClientMessageBase & {
      readonly type: 'join_room';
      readonly roomCode: string;
      readonly sessionToken?: string;
    })
  | (ClientMessageBase & { readonly type: 'ready' })
  | (ClientMessageBase & {
      readonly type: 'game_action';
      readonly action: WireGameAction;
    })
  | (ClientMessageBase & { readonly type: 'leave_room' })
  | (ClientMessageBase & { readonly type: 'ping' });

export type RoomStatus = 'WAITING' | 'READY' | 'PLAYING' | 'FINISHED';
export type FinishReason = 'VICTORY' | 'PLAYER_LEFT' | 'DISCONNECT_TIMEOUT';

interface ServerMessageBase {
  readonly version: typeof PROTOCOL_VERSION;
  readonly requestId?: string;
}

export type ServerMessage =
  | (ServerMessageBase & {
      readonly type: 'room_created';
      readonly roomCode: string;
      readonly playerId: PlayerId;
      readonly sessionToken: string;
      readonly status: RoomStatus;
    })
  | (ServerMessageBase & {
      readonly type: 'room_joined';
      readonly roomCode: string;
      readonly playerId: PlayerId;
      readonly sessionToken: string;
      readonly status: RoomStatus;
    })
  | (ServerMessageBase & {
      readonly type: 'player_joined';
      readonly roomCode: string;
      readonly playerId: PlayerId;
    })
  | (ServerMessageBase & {
      readonly type: 'game_started';
      readonly roomCode: string;
      readonly state: ProjectedGameState;
    })
  | (ServerMessageBase & {
      readonly type: 'game_state';
      readonly roomCode: string;
      readonly state: ProjectedGameState;
    })
  | (ServerMessageBase & {
      readonly type: 'action_rejected';
      readonly code: string;
      readonly message: string;
    })
  | (ServerMessageBase & {
      readonly type: 'game_finished';
      readonly roomCode: string;
      readonly winnerId: PlayerId | null;
      readonly reason: FinishReason;
      readonly state: ProjectedGameState | null;
    })
  | (ServerMessageBase & {
      readonly type: 'player_disconnected';
      readonly playerId: PlayerId;
      readonly reconnectDeadline: string;
    })
  | (ServerMessageBase & {
      readonly type: 'player_reconnected';
      readonly playerId: PlayerId;
    })
  | (ServerMessageBase & {
      readonly type: 'error';
      readonly code: string;
      readonly message: string;
    })
  | (ServerMessageBase & { readonly type: 'pong' });

export type DecodeResult =
  | { readonly ok: true; readonly message: ClientMessage }
  | {
      readonly ok: false;
      readonly requestId?: string;
      readonly code: string;
      readonly message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function parseWireAction(value: unknown): WireGameAction | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  switch (value.type) {
    case 'draw':
    case 'pass_response':
    case 'skip_forest_recovery':
    case 'end_turn':
      return hasOnlyKeys(value, ['type']) ? { type: value.type } : null;
    case 'play_land':
      return hasOnlyKeys(value, ['type', 'cardId']) && nonEmptyString(value.cardId)
        ? { type: value.type, cardId: value.cardId }
        : null;
    case 'counter_with_island':
      return hasOnlyKeys(value, ['type', 'islandCardId', 'discardCardId']) &&
        nonEmptyString(value.islandCardId) && nonEmptyString(value.discardCardId)
        ? {
            type: value.type,
            islandCardId: value.islandCardId,
            discardCardId: value.discardCardId,
          }
        : null;
    case 'mountain_target':
    case 'swamp_discard':
    case 'forest_recovery':
      return hasOnlyKeys(value, ['type', 'targetCardId']) && nonEmptyString(value.targetCardId)
        ? { type: value.type, targetCardId: value.targetCardId }
        : null;
    case 'island_top':
      return hasOnlyKeys(value, ['type', 'placement']) &&
        (value.placement === 'top' || value.placement === 'bottom')
        ? { type: value.type, placement: value.placement }
        : null;
    default:
      return null;
  }
}

export function decodeClientMessage(raw: string): DecodeResult {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, code: 'INVALID_JSON', message: 'Message is not valid JSON.' };
  }
  if (!isRecord(value)) {
    return { ok: false, code: 'INVALID_MESSAGE', message: 'Message must be an object.' };
  }
  const requestId = nonEmptyString(value.requestId) ? value.requestId : undefined;
  if (value.version !== PROTOCOL_VERSION) {
    return {
      ok: false,
      ...(requestId === undefined ? {} : { requestId }),
      code: 'UNSUPPORTED_VERSION',
      message: `Protocol version ${String(PROTOCOL_VERSION)} is required.`,
    };
  }
  if (requestId === undefined) {
    return { ok: false, code: 'INVALID_REQUEST_ID', message: 'requestId is required.' };
  }
  switch (value.type) {
    case 'create_room':
      return hasOnlyKeys(value, ['version', 'requestId', 'type', 'deckSize']) &&
        (value.deckSize === 25 || value.deckSize === 50)
        ? {
            ok: true,
            message: {
              version: PROTOCOL_VERSION,
              requestId,
              type: value.type,
              deckSize: value.deckSize,
            },
          }
        : { ok: false, requestId, code: 'INVALID_DECK_SIZE', message: 'deckSize must be 25 or 50.' };
    case 'join_room':
      if (!hasOnlyKeys(value, ['version', 'requestId', 'type', 'roomCode', 'sessionToken'])) {
        return { ok: false, requestId, code: 'INVALID_MESSAGE', message: 'Message has unexpected fields.' };
      }
      if (!nonEmptyString(value.roomCode)) {
        return { ok: false, requestId, code: 'INVALID_ROOM_CODE', message: 'roomCode is required.' };
      }
      if (value.sessionToken !== undefined && !nonEmptyString(value.sessionToken)) {
        return { ok: false, requestId, code: 'INVALID_SESSION_TOKEN', message: 'sessionToken is invalid.' };
      }
      return {
        ok: true,
        message: {
          version: PROTOCOL_VERSION,
          requestId,
          type: value.type,
          roomCode: value.roomCode.toUpperCase(),
          ...(value.sessionToken === undefined ? {} : { sessionToken: value.sessionToken }),
        },
      };
    case 'ready':
    case 'leave_room':
    case 'ping':
      if (!hasOnlyKeys(value, ['version', 'requestId', 'type'])) {
        return { ok: false, requestId, code: 'INVALID_MESSAGE', message: 'Message has unexpected fields.' };
      }
      return {
        ok: true,
        message: { version: PROTOCOL_VERSION, requestId, type: value.type },
      };
    case 'game_action': {
      if (!hasOnlyKeys(value, ['version', 'requestId', 'type', 'action'])) {
        return { ok: false, requestId, code: 'INVALID_MESSAGE', message: 'Message has unexpected fields.' };
      }
      const action = parseWireAction(value.action);
      return action === null
        ? { ok: false, requestId, code: 'INVALID_ACTION', message: 'Game action is malformed.' }
        : {
            ok: true,
            message: {
              version: PROTOCOL_VERSION,
              requestId,
              type: value.type,
              action,
            },
          };
    }
    default:
      return { ok: false, requestId, code: 'UNKNOWN_MESSAGE', message: 'Unknown message type.' };
  }
}

export function toGameAction(action: WireGameAction): GameAction {
  switch (action.type) {
    case 'draw':
      return { type: 'DRAW' };
    case 'play_land':
      return { type: 'PLAY_LAND', cardId: action.cardId };
    case 'pass_response':
      return { type: 'PASS_RESPONSE' };
    case 'counter_with_island':
      return {
        type: 'COUNTER_WITH_ISLAND',
        islandCardId: action.islandCardId,
        discardCardId: action.discardCardId,
      };
    case 'mountain_target':
      return { type: 'CHOOSE_MOUNTAIN_TARGET', targetLandId: action.targetCardId };
    case 'swamp_discard':
      return { type: 'CHOOSE_SWAMP_DISCARD', targetCardId: action.targetCardId };
    case 'forest_recovery':
      return { type: 'CHOOSE_FOREST_RECOVERY', targetCardId: action.targetCardId };
    case 'skip_forest_recovery':
      return { type: 'SKIP_FOREST_RECOVERY' };
    case 'island_top':
      return {
        type: 'CHOOSE_ISLAND_TOP',
        placement: action.placement === 'top' ? 'TOP' : 'BOTTOM',
      };
    case 'end_turn':
      return { type: 'END_TURN' };
  }
}
