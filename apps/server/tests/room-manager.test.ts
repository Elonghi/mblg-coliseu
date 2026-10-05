import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card, GameState, PlayerId } from '@mblg-coliseu/game-engine';
import {
  MemoryConnection,
  createFourPlayerRoom,
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

    const credentials = manager.createRoom(connection, 25, '2P', 'create');

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
    const created = manager.createRoom(first, 25, '2P', 'create');
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
    expect(room.second.latest('game_finished')?.winnerId).toBe(
      room.secondCredentials.playerId,
    );
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

describe('RoomManager 4P', () => {
  it('waits for four players and all READY confirmations', () => {
    const manager = deterministicManager();
    const connections = Array.from({ length: 4 }, () => new MemoryConnection());
    const first = connections[0];
    if (first === undefined) throw new Error('Missing fixture connection.');
    const created = manager.createRoom(first, 25, '4P', 'create');
    if (created === null) throw new Error('Expected room creation.');

    for (const [index, connection] of connections.slice(1).entries()) {
      manager.joinRoom(connection, created.roomCode, `join-${String(index)}`);
    }
    expect(manager.getRoom(created.roomCode)).toMatchObject({
      mode: '4P',
      maxPlayers: 4,
      status: 'READY',
    });
    for (const connection of connections.slice(0, 3)) manager.ready(connection, 'ready');
    expect(first.latest('game_started')).toBeUndefined();
    const fourth = connections[3];
    if (fourth === undefined) throw new Error('Missing fourth connection.');
    manager.ready(fourth, 'ready-fourth');
    expect(manager.getRoom(created.roomCode)?.status).toBe('PLAYING');
    expect(connections.every((connection) => connection.latest('game_started') !== undefined))
      .toBe(true);
  });

  it('rejects a fifth player', () => {
    const room = createFourPlayerRoom();
    const fifth = new MemoryConnection();
    const roomCode = room.credentials[0]?.roomCode;
    if (roomCode === undefined) throw new Error('Missing room code.');

    expect(room.manager.joinRoom(fifth, roomCode, 'fifth')).toBeNull();
    expect(fifth.latest('error')?.code).toBe('ROOM_FULL');
    expect(room.manager.getRoom(roomCode)?.playerIds).toHaveLength(4);
  });

  it('accepts authoritative actions and preserves private hands for four players', () => {
    const room = createFourPlayerRoom();
    const views = room.connections.map((connection) => connection.latest('game_started')?.state);
    const firstView = views[0];
    if (firstView === undefined) throw new Error('Missing started state.');
    const currentId = firstView.publicGameState.currentPlayerId;
    const actorIndex = room.credentials.findIndex((item) => item.playerId === currentId);
    const actor = room.connections[actorIndex];
    const actorView = views[actorIndex];
    if (actor === undefined || actorView === undefined) throw new Error('Missing current actor.');
    const play = actorView.legalActions.find((action) => action.type === 'PLAY_LAND');
    if (play === undefined) throw new Error('Expected legal land play.');

    room.manager.gameAction(actor, toWireAction(play), 'legal-4p');
    expect(actor.latest('game_state')?.requestId).toBe('legal-4p');
    for (const [index, view] of views.entries()) {
      if (view === undefined) throw new Error('Missing player view.');
      const ownSecrets = new Set(view.privatePlayerState.hand.map((card) => card.id));
      const serialized = JSON.stringify(view);
      for (const [otherIndex, otherView] of views.entries()) {
        if (otherIndex === index || otherView === undefined) continue;
        for (const card of otherView.privatePlayerState.hand) {
          if (!ownSecrets.has(card.id)) expect(serialized).not.toContain(card.id);
        }
      }
    }
  });

  it('removes a disconnected player after timeout and keeps a 4P match running', () => {
    vi.useFakeTimers();
    const room = createFourPlayerRoom(deterministicManager({ now: () => Date.now() }));
    const removed = room.connections[1];
    const roomCode = room.credentials[0]?.roomCode;
    const removedId = room.credentials[1]?.playerId;
    if (removed === undefined || roomCode === undefined || removedId === undefined) {
      throw new Error('Missing fixture data.');
    }

    room.manager.disconnect(removed);
    vi.advanceTimersByTime(60_000);

    expect(room.manager.getRoom(roomCode)).toMatchObject({ status: 'PLAYING' });
    expect(room.manager.getRoom(roomCode)?.playerIds).not.toContain(removedId);
    expect(room.manager.getRoom(roomCode)?.playerIds).toHaveLength(3);
    expect(room.connections[0]?.latest('game_state')?.state.publicGameState.players)
      .toHaveLength(3);
  });

  it('reconnects the same 4P player with the correct private state', () => {
    const room = createFourPlayerRoom();
    const oldConnection = room.connections[2];
    const credentials = room.credentials[2];
    if (oldConnection === undefined || credentials === undefined) {
      throw new Error('Missing fixture player.');
    }
    const before = oldConnection.latest('game_started')?.state;
    if (before === undefined) throw new Error('Missing started state.');
    room.manager.disconnect(oldConnection);
    const reconnected = new MemoryConnection();
    room.manager.joinRoom(reconnected, credentials.roomCode, 'reconnect', credentials.sessionToken);

    expect(reconnected.latest('game_state')?.state).toEqual(before);
    expect(room.manager.getRoom(credentials.roomCode)?.playerIds).toHaveLength(4);
  });

  it('finishes a four-player match on an immediate individual victory', () => {
    const room = createFourPlayerRoom(deterministicManager({ gameFactory: nearVictoryGame }));
    const first = room.connections[0];
    if (first === undefined) throw new Error('Missing first connection.');
    room.manager.gameAction(first, { type: 'play_land', cardId: 'player-1-plains-win' }, 'win');
    for (const connection of room.connections.slice(1)) {
      room.manager.gameAction(connection, { type: 'pass_response' }, 'pass');
    }

    expect(room.manager.getRoom(room.credentials[0]?.roomCode ?? '')?.status).toBe('FINISHED');
    expect(room.connections.every(
      (connection) => connection.latest('game_finished')?.winnerId === 'player-1',
    )).toBe(true);
    room.manager.gameAction(first, { type: 'end_turn' }, 'too-late');
    expect(first.latest('action_rejected')?.code).toBe('GAME_FINISHED');
  });
});

describe('room isolation', () => {
  it('keeps 2P and 4P membership, actions and state broadcasts isolated', () => {
    const codes = ['TWO222', 'FOUR44'];
    const manager = deterministicManager({ roomCodeFactory: () => codes.shift() ?? 'EXTRA1' });
    const two = createPlayingRoom(manager);
    const four = createFourPlayerRoom(manager);
    const fourMessageCounts = four.connections.map((connection) => connection.messages.length);
    const twoState = two.first.latest('game_started')?.state;
    if (twoState === undefined) throw new Error('Missing 2P state.');
    const currentIsFirst = twoState.publicGameState.currentPlayerId === two.firstCredentials.playerId;
    const actor = currentIsFirst ? two.first : two.second;
    const actorState = currentIsFirst
      ? two.first.latest('game_started')?.state
      : two.second.latest('game_started')?.state;
    const action = actorState?.legalActions.find((candidate) => candidate.type === 'PLAY_LAND');
    if (action === undefined) throw new Error('Missing 2P action.');

    manager.gameAction(actor, toWireAction(action), 'isolated-action');

    expect(manager.getRoom(two.firstCredentials.roomCode)).toMatchObject({ mode: '2P', maxPlayers: 2 });
    expect(manager.getRoom(four.credentials[0]?.roomCode ?? '')).toMatchObject({ mode: '4P', maxPlayers: 4 });
    expect(four.connections.map((connection) => connection.messages.length)).toEqual(fourMessageCounts);
  });
});

function nearVictoryGame(playerIds: readonly PlayerId[]): GameState {
  const [first, second] = playerIds;
  if (first === undefined || second === undefined) {
    throw new Error('The fixture requires two players.');
  }
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
      ...playerIds.slice(2).map((id) => ({
        id,
        deck: [],
        hand: [],
        field: [],
        graveyard: [],
      })),
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
