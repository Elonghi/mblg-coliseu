import type { DeckSize, GameAction } from '@mblg-coliseu/game-engine';
import {
  PROTOCOL_VERSION,
} from './multiplayer-types.js';
import type {
  ClientMessage,
  MultiplayerCredentials,
  ServerMessage,
  WireGameAction,
} from './multiplayer-types.js';
import { RealtimeWebSocketClient } from './websocket-client.js';

const SESSION_KEY = 'mblg-coliseu.multiplayer-session';
type ClientPayload<T = ClientMessage> = T extends ClientMessage
  ? Omit<T, 'version' | 'requestId'>
  : never;

function requestId(): string {
  return globalThis.crypto.randomUUID();
}

export function defaultWebSocketUrl(): string {
  const configured: unknown = import.meta.env['VITE_WS_URL'];
  if (typeof configured === 'string' && configured.length > 0) return configured;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:3000/ws`;
}

export function toWireAction(action: GameAction): WireGameAction {
  switch (action.type) {
    case 'DRAW': return { type: 'draw' };
    case 'PLAY_LAND': return { type: 'play_land', cardId: action.cardId };
    case 'PASS_RESPONSE': return { type: 'pass_response' };
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
    case 'SKIP_FOREST_RECOVERY': return { type: 'skip_forest_recovery' };
    case 'CHOOSE_ISLAND_TOP':
      return {
        type: 'island_top',
        placement: action.placement === 'TOP' ? 'top' : 'bottom',
      };
    case 'END_TURN': return { type: 'end_turn' };
  }
}

export class MultiplayerService {
  readonly #client: RealtimeWebSocketClient;
  readonly #url: string;

  constructor(
    client = new RealtimeWebSocketClient(),
    url = defaultWebSocketUrl(),
  ) {
    this.#client = client;
    this.#url = url;
    this.#client.onMessage((message) => {
      if (message.type === 'room_created' || message.type === 'room_joined') {
        this.saveCredentials({
          roomCode: message.roomCode,
          playerId: message.playerId,
          sessionToken: message.sessionToken,
        });
      }
    });
  }

  get client(): RealtimeWebSocketClient {
    return this.#client;
  }

  connect(): Promise<void> {
    return this.#client.connect(this.#url);
  }

  disconnect(): void {
    this.#client.disconnect();
  }

  async createRoom(deckSize: DeckSize): Promise<void> {
    await this.connect();
    this.#send({ type: 'create_room', deckSize });
  }

  async joinRoom(roomCode: string): Promise<void> {
    await this.connect();
    this.#send({ type: 'join_room', roomCode: roomCode.trim().toUpperCase() });
  }

  ready(): void {
    this.#send({ type: 'ready' });
  }

  sendAction(action: GameAction): void {
    this.#send({ type: 'game_action', action: toWireAction(action) });
  }

  leaveRoom(): void {
    if (this.#client.status === 'connected') this.#send({ type: 'leave_room' });
    this.clearCredentials();
    this.disconnect();
  }

  async reconnect(): Promise<void> {
    const credentials = this.loadCredentials();
    if (credentials === null) throw new Error('No multiplayer session to reconnect.');
    await this.connect();
    this.#send({
      type: 'join_room',
      roomCode: credentials.roomCode,
      sessionToken: credentials.sessionToken,
    });
  }

  onMessage(listener: (message: ServerMessage) => void): () => void {
    return this.#client.onMessage(listener);
  }

  saveCredentials(credentials: MultiplayerCredentials): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(credentials));
  }

  loadCredentials(): MultiplayerCredentials | null {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored === null) return null;
    try {
      const value = JSON.parse(stored) as Partial<MultiplayerCredentials>;
      return typeof value.roomCode === 'string' &&
        typeof value.playerId === 'string' &&
        typeof value.sessionToken === 'string'
        ? {
            roomCode: value.roomCode,
            playerId: value.playerId,
            sessionToken: value.sessionToken,
          }
        : null;
    } catch {
      return null;
    }
  }

  clearCredentials(): void {
    sessionStorage.removeItem(SESSION_KEY);
  }

  #send(message: ClientPayload): void {
    this.#client.send({
      ...message,
      version: PROTOCOL_VERSION,
      requestId: requestId(),
    });
  }
}
