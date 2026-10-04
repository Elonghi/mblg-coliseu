import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card, GameState, PlayerId } from '@mblg-coliseu/game-engine';
import {
  MemoryConnection,
  createPlayingRoom,
  deterministicManager,
  toWireAction,
} from './helpers.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('RoomManager', () => {
  it('creates a room with a short code and opaque player credentials', () => {
    const manager = deterministicManager();
    const connection = new MemoryConnection();

    const credentials = manager.createRoom(connection, 25, 'create');

    expect(credentials).toEqual({
      roomCode: 'ABC123',
      playerId: 'player-1',
      sessionToken: 'token-1',
    });
    expect(manager.getRoom('abc123')?.status).toBe('WAITING');
    expect(connection.latest('room_created')?.requestId).toBe('create');
  });

  it('lets a second player join and starts a game for both players', () => {
    const room = createPlayingRoom();

    expect(room.manager.getRoom(room.firstCredentials.roomCode)?.status).toBe('PLAYING');
    expect(room.second.latest('room_joined')?.playerId).toBe(
      room.secondCredentials.playerId,
    );
    expect(room.first.latest('player_joined')?.playerId).toBe(
      room.secondCredentials.playerId,
    );
    expect(room.first.latest('game_started')).toBeDefined();
    expect(room.second.latest('game_started')).toBeDefined();
  });

  it('waits for both connected players to be ready before starting', () => {
    const manager = deterministicManager();
    const first = new MemoryConnection();
    const second = new MemoryConnection();
    const created = manager.createRoom(first, 25, 'create');
    expect(created).not.toBeNull();
    if (created === null) return;
    manager.joinRoom(second, created.roomCode, 'join');

    expect(manager.getRoom(created.roomCode)?.status).toBe('READY');
    expect(first.latest('game_started')).toBeUndefined();
    manager.ready(first, 'first-ready');
    expect(first.latest('game_started')).toBeUndefined();
    manager.ready(second, 'second-ready');

    expect(manager.getRoom(created.roomCode)?.status).toBe('PLAYING');
    expect(first.latest('game_started')).toBeDefined();
    expect(second.latest('game_started')).toBeDefined();
  });

  it('prevents a third player from entering a full room', () => {
    const room = createPlayingRoom();
    const third = new MemoryConnection();

    expect(
      room.manager.joinRoom(third, room.firstCredentials.roomCode, 'join-third'),
    ).toBeNull();
    expect(third.latest('error')?.code).toBe('ROOM_FULL');
    expect(room.manager.getRoom(room.firstCredentials.roomCode)?.playerIds).toHaveLength(2);
  });

  it('accepts a valid action through the authoritative Game Engine', () => {
    const room = createPlayingRoom();
    const firstState = room.first.latest('game_started')?.state;
    const secondState = room.second.latest('game_started')?.state;
    expect(firstState).toBeDefined();
    expect(secondState).toBeDefined();
    if (firstState === undefined || secondState === undefined) return;
    const currentIsFirst = firstState.publicGameState.currentPlayerId ===
      room.firstCredentials.playerId;
    const connection = currentIsFirst ? room.first : room.second;
    const state = currentIsFirst ? firstState : secondState;
    const action = state.legalActions.find((candidate) => candidate.type === 'PLAY_LAND');
    expect(action).toBeDefined();
    if (action === undefined) return;

    room.manager.gameAction(connection, toWireAction(action), 'valid-action');

    expect(connection.latest('game_state')?.requestId).toBe('valid-action');
    expect(connection.latest('action_rejected')).toBeUndefined();
  });

  it('rejects malformed ownership and actions from the wrong player', () => {
    const room = createPlayingRoom();
    const firstState = room.first.latest('game_started')?.state;
    const secondState = room.second.latest('game_started')?.state;
    expect(firstState).toBeDefined();
    expect(secondState).toBeDefined();
    if (firstState === undefined || secondState === undefined) return;
    const firstIsCurrent = firstState.publicGameState.currentPlayerId ===
      room.firstCredentials.playerId;
    const current = firstIsCurrent ? room.first : room.second;
    const other = firstIsCurrent ? room.second : room.first;
    const currentState = firstIsCurrent ? firstState : secondState;
    const otherState = firstIsCurrent ? secondState : firstState;
    const otherCard = otherState.privatePlayerState.hand[0];
    const ownOtherCard = otherState.privatePlayerState.hand[1];
    expect(otherCard).toBeDefined();
    expect(ownOtherCard).toBeDefined();
    if (otherCard === undefined || ownOtherCard === undefined) return;

    room.manager.gameAction(
      current,
      { type: 'play_land', cardId: otherCard.id },
      'opponent-card',
    );
    expect(current.latest('action_rejected')?.code).toBe('CARD_NOT_IN_HAND');

    room.manager.gameAction(
      other,
      { type: 'play_land', cardId: ownOtherCard.id },
      'wrong-turn',
    );
    expect(other.latest('action_rejected')?.code).toBe('NOT_YOUR_TURN');

    room.manager.gameAction(
      current,
      { type: 'play_land', cardId: 'does-not-exist' },
      'invalid-card',
    );
    expect(current.latest('action_rejected')?.requestId).toBe('invalid-card');
    expect(currentState.publicGameState.turnNumber).toBe(1);
  });

  it('keeps a disconnected game and restores the correct state on reconnection', () => {
    const room = createPlayingRoom();
    const before = room.first.latest('game_started')?.state;
    expect(before).toBeDefined();
    if (before === undefined) return;

    room.manager.disconnect(room.first);
    expect(room.second.latest('player_disconnected')?.playerId).toBe(
      room.firstCredentials.playerId,
    );
    expect(room.manager.getRoom(room.firstCredentials.roomCode)?.status).toBe('PLAYING');

    const reconnected = new MemoryConnection();
    const credentials = room.manager.joinRoom(
      reconnected,
      room.firstCredentials.roomCode,
      'reconnect',
      room.firstCredentials.sessionToken,
    );

    expect(credentials?.playerId).toBe(room.firstCredentials.playerId);
    expect(room.second.latest('player_reconnected')?.playerId).toBe(
      room.firstCredentials.playerId,
    );
    const restored = reconnected.latest('game_state')?.state;
    expect(restored?.publicGameState).toEqual(before.publicGameState);
    expect(restored?.privatePlayerState).toEqual(before.privatePlayerState);
  });

  it('finishes the room after the 60 second reconnection window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00.000Z'));
    const room = createPlayingRoom(deterministicManager({ now: () => Date.now() }));

    room.manager.disconnect(room.first);
    vi.advanceTimersByTime(60_000);

    expect(room.manager.getRoom(room.firstCredentials.roomCode)?.status).toBe('FINISHED');
    expect(room.second.latest('game_finished')?.reason).toBe('DISCONNECT_TIMEOUT');
    expect(room.second.latest('game_finished')?.winnerId).toBeNull();
  });

  it('finishes on an engine victory and rejects every later action', () => {
    const manager = deterministicManager({ gameFactory: nearVictoryGame });
    const room = createPlayingRoom(manager);

    manager.gameAction(
      room.first,
      { type: 'play_land', cardId: 'player-1-plains-win' },
      'winning-land',
    );
    manager.gameAction(room.second, { type: 'pass_response' }, 'pass');

    expect(manager.getRoom(room.firstCredentials.roomCode)?.status).toBe('FINISHED');
    expect(room.first.latest('game_finished')?.winnerId).toBe('player-1');
    expect(room.second.latest('game_finished')?.reason).toBe('VICTORY');

    manager.gameAction(room.first, { type: 'end_turn' }, 'after-finish');
    expect(room.first.latest('action_rejected')).toMatchObject({
      requestId: 'after-finish',
      code: 'GAME_FINISHED',
    });
  });
});

function nearVictoryGame(
  playerIds: readonly [PlayerId, PlayerId],
): GameState {
  const [first, second] = playerIds;
  const owned = (id: string, type: Card['type'], ownerId: PlayerId): Card => ({
    id,
    type,
    ownerId,
  });
  return {
    players: [
      {
        id: first,
        deck: [],
        hand: [owned(`${first}-plains-win`, 'PLAINS', first)],
        field: [
          owned(`${first}-mountain`, 'MOUNTAIN', first),
          owned(`${first}-island`, 'ISLAND', first),
          owned(`${first}-swamp`, 'SWAMP', first),
          owned(`${first}-forest`, 'FOREST', first),
        ],
        graveyard: [],
      },
      { id: second, deck: [], hand: [], field: [], graveyard: [] },
    ],
    currentPlayerId: first,
    startingPlayerId: first,
    turnNumber: 1,
    phase: 'MAIN',
    landPlayedThisTurn: false,
    pending: null,
    winnerId: null,
  };
}
