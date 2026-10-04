import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import type { FastifyInstance } from 'fastify';
import type { GameAction, PlayerId } from '@mblg-coliseu/game-engine';
import { buildServer } from '../src/app.js';
import type {
  ClientMessage,
  ServerMessage,
} from '../src/protocol.js';
import type { ProjectedGameState } from '../src/projection.js';
import { RoomManager } from '../src/room-manager.js';
import { toWireAction, zeroRng } from './helpers.js';

let app: FastifyInstance | null = null;
const clients: TestClient[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  if (app !== null) {
    await app.close();
    app = null;
  }
});

describe('WebSocket integration', () => {
  it('runs a complete authoritative game between two WebSocket clients', async () => {
    let playerNumber = 0;
    let tokenNumber = 0;
    const manager = new RoomManager({
      rngFactory: () => zeroRng,
      roomCodeFactory: () => 'WS1234',
      playerIdFactory: () => `ws-player-${String(++playerNumber)}`,
      sessionTokenFactory: () => `ws-token-${String(++tokenNumber)}`,
    });
    app = await buildServer({ roomManager: manager });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `${address.replace('http://', 'ws://')}/ws`;
    const first = await TestClient.connect(url);
    const second = await TestClient.connect(url);
    clients.push(first, second);

    first.send({
      version: 1,
      type: 'create_room',
      requestId: 'create',
      deckSize: 25,
    });
    const created = await first.waitFor('room_created');
    second.send({
      version: 1,
      type: 'join_room',
      requestId: 'join',
      roomCode: created.roomCode,
    });
    const joined = await second.waitFor('room_joined');
    first.send({ version: 1, type: 'ready', requestId: 'ready-first' });
    second.send({ version: 1, type: 'ready', requestId: 'ready-second' });
    const firstStarted = await first.waitFor('game_started');
    const secondStarted = await second.waitFor('game_started');
    const clientsByPlayer = new Map<PlayerId, TestClient>([
      [created.playerId, first],
      [joined.playerId, second],
    ]);
    const states = new Map<PlayerId, ProjectedGameState>([
      [created.playerId, firstStarted.state],
      [joined.playerId, secondStarted.state],
    ]);

    let winnerId: PlayerId | null = null;
    for (let actionNumber = 1; actionNumber <= 1_000; actionNumber += 1) {
      const state = states.get(created.playerId);
      if (state === undefined) throw new Error('Missing current game state.');
      const actorId = decisionPlayer(state);
      const actor = clientsByPlayer.get(actorId);
      const actorState = states.get(actorId);
      if (actor === undefined || actorState === undefined) {
        throw new Error(`Missing client for ${actorId}.`);
      }
      const action = chooseAutomatedAction(actorState);
      const requestId = `action-${String(actionNumber)}`;
      actor.send({
        version: 1,
        type: 'game_action',
        requestId,
        action: toWireAction(action),
      });

      for (const [playerId, client] of clientsByPlayer) {
        const update = await client.waitFor('game_state');
        states.set(playerId, update.state);
      }
      const updated = states.get(created.playerId);
      winnerId = updated?.publicGameState.winnerId ?? null;
      if (winnerId !== null) break;
    }

    expect(winnerId).not.toBeNull();
    expect([created.playerId, joined.playerId]).toContain(winnerId);
    const firstFinished = await first.waitFor('game_finished');
    const secondFinished = await second.waitFor('game_finished');
    expect(firstFinished.winnerId).toBe(winnerId);
    expect(secondFinished.winnerId).toBe(winnerId);
    expect(firstFinished.reason).toBe('VICTORY');
    expect(manager.getRoom(created.roomCode)?.status).toBe('FINISHED');

    first.send({ version: 1, type: 'ping', requestId: 'ping-after-game' });
    expect((await first.waitFor('pong')).requestId).toBe('ping-after-game');
  }, 20_000);
});

function decisionPlayer(state: ProjectedGameState): PlayerId {
  const pending = state.publicGameState.pending;
  if (pending?.kind === 'RESPONSE') return pending.responderId;
  return pending?.controllerId ?? state.publicGameState.currentPlayerId;
}

function chooseAutomatedAction(state: ProjectedGameState): GameAction {
  const actions = state.legalActions;
  const preferredTypes: readonly GameAction['type'][] = [
    'PASS_RESPONSE',
    'SKIP_FOREST_RECOVERY',
    'CHOOSE_ISLAND_TOP',
    'CHOOSE_MOUNTAIN_TARGET',
    'CHOOSE_SWAMP_DISCARD',
    'DRAW',
  ];
  for (const type of preferredTypes) {
    const found = actions.find((action) => action.type === type);
    if (found !== undefined) return found;
  }

  const plays = actions.filter(
    (action): action is Extract<GameAction, { readonly type: 'PLAY_LAND' }> =>
      action.type === 'PLAY_LAND',
  );
  if (plays.length > 0) {
    const own = state.publicGameState.players.find(
      (player) => player.id === state.privatePlayerState.playerId,
    );
    if (own === undefined) throw new Error('Own public player is missing.');
    const typesInField = new Set(own.field.map((card) => card.type));
    const selected = plays.find((play) => {
      const card = state.privatePlayerState.hand.find(
        (candidate) => candidate.id === play.cardId,
      );
      return card !== undefined && !typesInField.has(card.type);
    }) ?? plays[0];
    if (selected !== undefined) return selected;
  }

  const end = actions.find((action) => action.type === 'END_TURN');
  if (end !== undefined) return end;
  throw new Error('Automated WebSocket client has no legal action.');
}

class TestClient {
  readonly #messages: ServerMessage[] = [];
  readonly #listeners = new Set<() => void>();

  private constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      this.#messages.push(JSON.parse(rawDataToText(data)) as ServerMessage);
      for (const listener of this.#listeners) listener();
    });
  }

  static async connect(url: string): Promise<TestClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return new TestClient(socket);
  }

  send(message: ClientMessage): void {
    this.socket.send(JSON.stringify(message));
  }

  async waitFor<T extends ServerMessage['type']>(
    type: T,
  ): Promise<Extract<ServerMessage, { readonly type: T }>> {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const index = this.#messages.findIndex((message) => message.type === type);
      if (index >= 0) {
        const [message] = this.#messages.splice(index, 1);
        if (message === undefined) throw new Error('Message queue was unexpectedly empty.');
        return message as Extract<ServerMessage, { readonly type: T }>;
      }
      await new Promise<void>((resolve) => {
        const listener = () => {
          this.#listeners.delete(listener);
          resolve();
        };
        this.#listeners.add(listener);
        setTimeout(listener, 25);
      });
    }
    throw new Error(`Timed out waiting for ${type}.`);
  }

  close(): void {
    this.socket.close();
  }
}

function rawDataToText(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return Buffer.concat(data).toString('utf8');
}
