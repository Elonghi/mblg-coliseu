import { randomInt, randomUUID } from 'node:crypto';
import {
  applyAction,
  createGame,
  removePlayer,
} from '@mblg-coliseu/game-engine';
import type {
  DeckSize,
  GameState,
  PlayerId,
  RandomSource,
} from '@mblg-coliseu/game-engine';
import {
  PROTOCOL_VERSION,
  toGameAction,
} from './protocol.js';
import type {
  FinishReason,
  RoomMode,
  RoomStatePayload,
  RoomStatus,
  ServerMessage,
  WireGameAction,
} from './protocol.js';
import { projectGameState } from './projection.js';
import { CryptoRandomSource } from './random.js';

export interface ClientConnection {
  send(message: ServerMessage): void;
}

export interface PlayerCredentials {
  readonly roomCode: string;
  readonly playerId: PlayerId;
  readonly sessionToken: string;
}

export interface RoomSummary {
  readonly code: string;
  readonly status: RoomStatus;
  readonly deckSize: DeckSize;
  readonly mode: RoomMode;
  readonly maxPlayers: 2 | 4;
  readonly playerIds: readonly PlayerId[];
  readonly connectedPlayerIds: readonly PlayerId[];
  readonly winnerId: PlayerId | null;
}

type TimerHandle = ReturnType<typeof setTimeout>;

interface RoomPlayer {
  readonly playerId: PlayerId;
  readonly sessionToken: string;
  connection: ClientConnection | null;
  reconnectTimer: TimerHandle | null;
  reconnectDeadline: number | null;
  ready: boolean;
}

interface Room {
  readonly code: string;
  readonly deckSize: DeckSize;
  readonly mode: RoomMode;
  readonly maxPlayers: 2 | 4;
  readonly players: RoomPlayer[];
  readonly rng: RandomSource;
  status: RoomStatus;
  gameState: GameState | null;
  finishReason: FinishReason | null;
}

interface Membership {
  readonly room: Room;
  readonly player: RoomPlayer;
}

export interface RoomManagerOptions {
  readonly reconnectMs?: number;
  readonly rngFactory?: () => RandomSource;
  readonly roomCodeFactory?: () => string;
  readonly playerIdFactory?: () => PlayerId;
  readonly sessionTokenFactory?: () => string;
  readonly now?: () => number;
  readonly gameFactory?: (
    playerIds: readonly PlayerId[],
    deckSize: DeckSize,
    rng: RandomSource,
  ) => GameState;
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function defaultRoomCode(): string {
  return Array.from(
    { length: 6 },
    () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)] ?? 'A',
  ).join('');
}

function sendError(
  connection: ClientConnection,
  requestId: string,
  code: string,
  message: string,
): void {
  connection.send({
    version: PROTOCOL_VERSION,
    type: 'error',
    requestId,
    code,
    message,
  });
}

export class RoomManager {
  readonly #rooms = new Map<string, Room>();
  readonly #reconnectMs: number;
  readonly #rngFactory: () => RandomSource;
  readonly #roomCodeFactory: () => string;
  readonly #playerIdFactory: () => PlayerId;
  readonly #sessionTokenFactory: () => string;
  readonly #now: () => number;
  readonly #gameFactory: NonNullable<RoomManagerOptions['gameFactory']>;

  constructor(options: RoomManagerOptions = {}) {
    this.#reconnectMs = options.reconnectMs ?? 60_000;
    this.#rngFactory = options.rngFactory ?? (() => new CryptoRandomSource());
    this.#roomCodeFactory = options.roomCodeFactory ?? defaultRoomCode;
    this.#playerIdFactory = options.playerIdFactory ?? (() => `player-${randomUUID()}`);
    this.#sessionTokenFactory = options.sessionTokenFactory ?? randomUUID;
    this.#now = options.now ?? Date.now;
    this.#gameFactory = options.gameFactory ?? ((playerIds, deckSize, rng) =>
      createGame({ playerIds, deckSize, rng }));
  }

  createRoom(
    connection: ClientConnection,
    deckSize: DeckSize,
    mode: RoomMode,
    requestId: string,
  ): PlayerCredentials | null {
    if (this.#membershipForConnection(connection) !== null) {
      sendError(connection, requestId, 'ALREADY_IN_ROOM', 'Connection already belongs to a room.');
      return null;
    }
    const code = this.#uniqueRoomCode();
    const player = this.#createPlayer(connection);
    const maxPlayers = mode === '2P' ? 2 : 4;
    const room: Room = {
      code,
      deckSize,
      mode,
      maxPlayers,
      players: [player],
      rng: this.#rngFactory(),
      status: 'WAITING',
      gameState: null,
      finishReason: null,
    };
    this.#rooms.set(code, room);
    connection.send({
      version: PROTOCOL_VERSION,
      type: 'room_created',
      requestId,
      playerId: player.playerId,
      sessionToken: player.sessionToken,
      ...this.#roomState(room),
    });
    return { roomCode: code, playerId: player.playerId, sessionToken: player.sessionToken };
  }

  joinRoom(
    connection: ClientConnection,
    roomCode: string,
    requestId: string,
    sessionToken?: string,
  ): PlayerCredentials | null {
    if (this.#membershipForConnection(connection) !== null) {
      sendError(connection, requestId, 'ALREADY_IN_ROOM', 'Connection already belongs to a room.');
      return null;
    }
    const room = this.#rooms.get(roomCode.toUpperCase());
    if (room === undefined) {
      sendError(connection, requestId, 'ROOM_NOT_FOUND', 'Room does not exist.');
      return null;
    }
    if (sessionToken !== undefined) {
      return this.#reconnect(room, connection, sessionToken, requestId);
    }
    if (room.gameState !== null || room.players.length >= room.maxPlayers) {
      sendError(connection, requestId, 'ROOM_FULL', 'Room cannot accept another player.');
      return null;
    }

    const player = this.#createPlayer(connection);
    room.players.push(player);
    room.status = room.players.length === room.maxPlayers ? 'READY' : 'WAITING';
    connection.send({
      version: PROTOCOL_VERSION,
      type: 'room_joined',
      requestId,
      playerId: player.playerId,
      sessionToken: player.sessionToken,
      ...this.#roomState(room),
    });
    this.#sendToOtherPlayers(room, player.playerId, {
      version: PROTOCOL_VERSION,
      type: 'player_joined',
      playerId: player.playerId,
      ...this.#roomState(room),
    });
    return {
      roomCode: room.code,
      playerId: player.playerId,
      sessionToken: player.sessionToken,
    };
  }

  ready(connection: ClientConnection, requestId: string): void {
    const membership = this.#membershipForConnection(connection);
    if (membership === null) {
      sendError(connection, requestId, 'NOT_IN_ROOM', 'Connection does not belong to a room.');
      return;
    }
    const { room, player } = membership;
    if (room.gameState !== null) {
      this.#sendState(room, player, 'game_state', requestId);
      return;
    }
    player.ready = true;
    connection.send({
      version: PROTOCOL_VERSION,
      type: 'room_joined',
      requestId,
      playerId: player.playerId,
      sessionToken: player.sessionToken,
      ...this.#roomState(room),
    });
    this.#broadcast(room, {
      version: PROTOCOL_VERSION,
      type: 'room_state',
      ...this.#roomState(room),
    });
    if (
      room.players.length === room.maxPlayers &&
      room.players.every((candidate) => candidate.ready)
    ) {
      this.#startGame(room);
    }
  }

  gameAction(
    connection: ClientConnection,
    action: WireGameAction,
    requestId: string,
  ): void {
    const membership = this.#membershipForConnection(connection);
    if (membership === null) {
      sendError(connection, requestId, 'NOT_IN_ROOM', 'Connection does not belong to a room.');
      return;
    }
    const { room, player } = membership;
    if (room.status !== 'PLAYING' || room.gameState === null) {
      connection.send({
        version: PROTOCOL_VERSION,
        type: 'action_rejected',
        requestId,
        code: room.status === 'FINISHED' ? 'GAME_FINISHED' : 'GAME_NOT_STARTED',
        message: room.status === 'FINISHED'
          ? 'The game is already finished.'
          : 'The game has not started.',
      });
      return;
    }

    const result = applyAction(
      room.gameState,
      player.playerId,
      toGameAction(action),
      room.rng,
    );
    if (!result.ok) {
      connection.send({
        version: PROTOCOL_VERSION,
        type: 'action_rejected',
        requestId,
        code: result.error.code,
        message: result.error.message,
      });
      return;
    }

    room.gameState = result.state;
    this.#broadcastState(room, requestId, player.playerId);
    if (result.state.winnerId !== null) {
      this.#finishRoom(room, 'VICTORY');
    }
  }

  leaveRoom(connection: ClientConnection, requestId: string): void {
    const membership = this.#membershipForConnection(connection);
    if (membership === null) {
      sendError(connection, requestId, 'NOT_IN_ROOM', 'Connection does not belong to a room.');
      return;
    }
    const { room, player } = membership;
    this.#clearReconnectTimer(player);
    player.connection = null;
    this.#removePlayer(room, player, 'PLAYER_LEFT');
  }

  disconnect(connection: ClientConnection): void {
    const membership = this.#membershipForConnection(connection);
    if (membership === null) return;
    const { room, player } = membership;
    player.connection = null;
    player.reconnectDeadline = this.#now() + this.#reconnectMs;
    this.#clearReconnectTimer(player);
    player.reconnectTimer = setTimeout(() => {
      this.#expireDisconnectedPlayer(room.code, player.sessionToken);
    }, this.#reconnectMs);
    this.#sendToOtherPlayers(room, player.playerId, {
      version: PROTOCOL_VERSION,
      type: 'player_disconnected',
      playerId: player.playerId,
      reconnectDeadline: new Date(player.reconnectDeadline).toISOString(),
    });
  }

  closeRoom(roomCode: string): boolean {
    const room = this.#rooms.get(roomCode.toUpperCase());
    if (room === undefined) return false;
    for (const player of room.players) this.#clearReconnectTimer(player);
    return this.#rooms.delete(room.code);
  }

  getRoom(roomCode: string): RoomSummary | null {
    const room = this.#rooms.get(roomCode.toUpperCase());
    if (room === undefined) return null;
    return {
      code: room.code,
      status: room.status,
      deckSize: room.deckSize,
      mode: room.mode,
      maxPlayers: room.maxPlayers,
      playerIds: room.players.map((player) => player.playerId),
      connectedPlayerIds: room.players
        .filter((player) => player.connection !== null)
        .map((player) => player.playerId),
      winnerId: room.gameState?.winnerId ?? null,
    };
  }

  get roomCount(): number {
    return this.#rooms.size;
  }

  #uniqueRoomCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = this.#roomCodeFactory().toUpperCase();
      if (!this.#rooms.has(code)) return code;
    }
    throw new Error('Unable to generate a unique room code.');
  }

  #createPlayer(connection: ClientConnection): RoomPlayer {
    return {
      playerId: this.#playerIdFactory(),
      sessionToken: this.#sessionTokenFactory(),
      connection,
      reconnectTimer: null,
      reconnectDeadline: null,
      ready: false,
    };
  }

  #roomState(room: Room): RoomStatePayload {
    return {
      roomCode: room.code,
      mode: room.mode,
      maxPlayers: room.maxPlayers,
      playerIds: room.players.map((candidate) => candidate.playerId),
      readyPlayerIds: room.players
        .filter((candidate) => candidate.ready)
        .map((candidate) => candidate.playerId),
      status: room.status,
    };
  }

  #startGame(room: Room): void {
    if (room.players.length !== room.maxPlayers) return;
    room.gameState = this.#gameFactory(
      room.players.map((player) => player.playerId),
      room.deckSize,
      room.rng,
    );
    room.status = 'PLAYING';
    for (const player of room.players) {
      this.#sendState(room, player, 'game_started');
    }
  }

  #reconnect(
    room: Room,
    connection: ClientConnection,
    sessionToken: string,
    requestId: string,
  ): PlayerCredentials | null {
    const player = room.players.find((candidate) => candidate.sessionToken === sessionToken);
    if (player === undefined) {
      sendError(connection, requestId, 'INVALID_SESSION_TOKEN', 'Session token is not valid for this room.');
      return null;
    }
    if (player.connection !== null) {
      sendError(connection, requestId, 'SESSION_IN_USE', 'Player session is already connected.');
      return null;
    }
    this.#clearReconnectTimer(player);
    player.connection = connection;
    player.reconnectDeadline = null;
    connection.send({
      version: PROTOCOL_VERSION,
      type: 'room_joined',
      requestId,
      playerId: player.playerId,
      sessionToken: player.sessionToken,
      ...this.#roomState(room),
    });
    this.#broadcast(room, {
      version: PROTOCOL_VERSION,
      type: 'player_reconnected',
      playerId: player.playerId,
    });
    if (room.gameState !== null) {
      if (room.status === 'FINISHED') {
        this.#sendFinished(room, player);
      } else {
        this.#sendState(room, player, 'game_state');
      }
    }
    return {
      roomCode: room.code,
      playerId: player.playerId,
      sessionToken: player.sessionToken,
    };
  }

  #membershipForConnection(connection: ClientConnection): Membership | null {
    for (const room of this.#rooms.values()) {
      const player = room.players.find((candidate) => candidate.connection === connection);
      if (player !== undefined) return { room, player };
    }
    return null;
  }

  #broadcastState(room: Room, requestId?: string, actorId?: PlayerId): void {
    for (const player of room.players) {
      this.#sendState(
        room,
        player,
        'game_state',
        actorId !== undefined && player.playerId === actorId ? requestId : undefined,
      );
    }
  }

  #sendState(
    room: Room,
    player: RoomPlayer,
    type: 'game_started' | 'game_state',
    requestId?: string,
  ): void {
    if (player.connection === null || room.gameState === null) return;
    player.connection.send({
      version: PROTOCOL_VERSION,
      type,
      ...(requestId === undefined ? {} : { requestId }),
      roomCode: room.code,
      state: projectGameState(room.gameState, player.playerId),
    });
  }

  #finishRoom(room: Room, reason: FinishReason): void {
    if (room.status === 'FINISHED') return;
    room.status = 'FINISHED';
    room.finishReason = reason;
    for (const player of room.players) this.#sendFinished(room, player);
  }

  #sendFinished(room: Room, player: RoomPlayer): void {
    if (player.connection === null) return;
    player.connection.send({
      version: PROTOCOL_VERSION,
      type: 'game_finished',
      roomCode: room.code,
      winnerId: room.gameState?.winnerId ?? null,
      reason: room.finishReason ?? 'DISCONNECT_TIMEOUT',
      state: room.gameState === null
        ? null
        : projectGameState(room.gameState, player.playerId),
    });
  }

  #expireDisconnectedPlayer(roomCode: string, sessionToken: string): void {
    const room = this.#rooms.get(roomCode);
    const player = room?.players.find((candidate) => candidate.sessionToken === sessionToken);
    if (room === undefined || player === undefined || player.connection !== null) return;
    player.reconnectTimer = null;
    player.reconnectDeadline = null;
    this.#removePlayer(room, player, 'DISCONNECT_TIMEOUT');
  }

  #removePlayer(room: Room, player: RoomPlayer, reason: FinishReason): void {
    const wasPlaying = room.status === 'PLAYING' && room.gameState !== null;
    if (wasPlaying && room.gameState !== null && room.players.length > 1) {
      room.gameState = removePlayer(room.gameState, player.playerId, room.rng);
    }
    room.players.splice(room.players.indexOf(player), 1);
    if (room.players.length === 0) {
      this.#rooms.delete(room.code);
      return;
    }
    if (wasPlaying && room.gameState !== null) {
      if (room.gameState.winnerId !== null) {
        this.#finishRoom(room, reason);
      } else {
        this.#broadcastState(room);
      }
      return;
    }
    if (room.status !== 'FINISHED') {
      room.status = room.players.length === room.maxPlayers ? 'READY' : 'WAITING';
      this.#broadcast(room, {
        version: PROTOCOL_VERSION,
        type: 'room_state',
        ...this.#roomState(room),
      });
    }
  }

  #clearReconnectTimer(player: RoomPlayer): void {
    if (player.reconnectTimer !== null) {
      clearTimeout(player.reconnectTimer);
      player.reconnectTimer = null;
    }
  }

  #broadcast(room: Room, message: ServerMessage): void {
    for (const player of room.players) player.connection?.send(message);
  }

  #sendToOtherPlayers(
    room: Room,
    excludedPlayerId: PlayerId,
    message: ServerMessage,
  ): void {
    for (const player of room.players) {
      if (player.playerId !== excludedPlayerId) player.connection?.send(message);
    }
  }
}
