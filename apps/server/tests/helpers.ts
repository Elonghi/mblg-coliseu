import type {
  GameAction,
  RandomSource,
} from '@mblg-coliseu/game-engine';
import type {
  ServerMessage,
  WireGameAction,
} from '../src/protocol.js';
import { RoomManager } from '../src/room-manager.js';
import type {
  ClientConnection,
  PlayerCredentials,
  RoomManagerOptions,
} from '../src/room-manager.js';

export const zeroRng: RandomSource = { next: () => 0 };

export class MemoryConnection implements ClientConnection {
  readonly messages: ServerMessage[] = [];

  send(message: ServerMessage): void {
    this.messages.push(message);
  }

  latest<T extends ServerMessage['type']>(
    type: T,
  ): Extract<ServerMessage, { readonly type: T }> | undefined {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const message = this.messages[index];
      if (message?.type === type) {
        return message as Extract<ServerMessage, { readonly type: T }>;
      }
    }
    return undefined;
  }
}

export function deterministicManager(
  overrides: RoomManagerOptions = {},
): RoomManager {
  let playerNumber = 0;
  let tokenNumber = 0;
  return new RoomManager({
    reconnectMs: 60_000,
    rngFactory: () => zeroRng,
    roomCodeFactory: () => 'ABC123',
    playerIdFactory: () => `player-${String(++playerNumber)}`,
    sessionTokenFactory: () => `token-${String(++tokenNumber)}`,
    ...overrides,
  });
}

export interface PlayingRoom {
  readonly manager: RoomManager;
  readonly first: MemoryConnection;
  readonly second: MemoryConnection;
  readonly firstCredentials: PlayerCredentials;
  readonly secondCredentials: PlayerCredentials;
}

export function createPlayingRoom(
  manager = deterministicManager(),
): PlayingRoom {
  const first = new MemoryConnection();
  const second = new MemoryConnection();
  const firstCredentials = manager.createRoom(first, 25, 'create-1');
  if (firstCredentials === null) throw new Error('Expected room creation.');
  const secondCredentials = manager.joinRoom(second, firstCredentials.roomCode, 'join-1');
  if (secondCredentials === null) throw new Error('Expected room join.');
  manager.ready(first, 'ready-1');
  manager.ready(second, 'ready-2');
  return { manager, first, second, firstCredentials, secondCredentials };
}

export function toWireAction(action: GameAction): WireGameAction {
  switch (action.type) {
    case 'DRAW':
      return { type: 'draw' };
    case 'PLAY_LAND':
      return { type: 'play_land', cardId: action.cardId };
    case 'PASS_RESPONSE':
      return { type: 'pass_response' };
    case 'COUNTER_WITH_ISLAND':
      return {
        type: 'counter_with_island',
        islandCardId: action.islandCardId,
        discardCardId: action.discardCardId,
      };
    case 'CHOOSE_MOUNTAIN_TARGET':
      return { type: 'mountain_target', targetCardId: action.targetLandId };
    case 'CHOOSE_SWAMP_DISCARD':
      return { type: 'swamp_discard', targetCardId: action.targetCardId };
    case 'CHOOSE_FOREST_RECOVERY':
      return { type: 'forest_recovery', targetCardId: action.targetCardId };
    case 'SKIP_FOREST_RECOVERY':
      return { type: 'skip_forest_recovery' };
    case 'CHOOSE_ISLAND_TOP':
      return {
        type: 'island_top',
        placement: action.placement === 'TOP' ? 'top' : 'bottom',
      };
    case 'END_TURN':
      return { type: 'end_turn' };
  }
}
