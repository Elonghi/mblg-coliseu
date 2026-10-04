import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Card, PublicGameState } from '@mblg-coliseu/game-engine';
import { MultiplayerScreen } from '../components/multiplayer-screen.js';
import { RealtimeGameScreen } from '../components/realtime-game-screen.js';
import {
  MultiplayerProvider,
  useMultiplayer,
} from '../multiplayer/multiplayer-context.js';
import { MultiplayerService } from '../multiplayer/multiplayer-service.js';
import type {
  ProjectedGameState,
  ServerMessage,
} from '../multiplayer/multiplayer-types.js';
import { RealtimeWebSocketClient } from '../multiplayer/websocket-client.js';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('multiplayer frontend', () => {
  it('connects, creates a room, renders the lobby and sends a game action', async () => {
    const harness = createHarness();
    renderFlow(harness.service);

    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    const socket = harness.sockets[0];
    expect(socket).toBeDefined();
    if (socket === undefined) return;
    act(() => { socket.open(); });

    await waitFor(() => { expect(socket.sent[0]).toMatchObject({ type: 'create_room', deckSize: 25 }); });
    act(() => { socket.receive(roomMessage('room_created')); });

    expect(await screen.findByText('ROOM42')).toBeInTheDocument();
    expect(screen.getByText('Aguardando adversário…')).toBeInTheDocument();
    act(() => { socket.receive({
      version: 1,
      type: 'player_joined',
      roomCode: 'ROOM42',
      playerId: 'player-2',
    }); });
    fireEvent.click(screen.getByRole('button', { name: 'Pronto' }));
    expect(socket.sent.at(-1)).toMatchObject({ type: 'ready' });

    act(() => { socket.receive({
      version: 1,
      type: 'game_started',
      roomCode: 'ROOM42',
      state: projectedState(),
    }); });
    expect(await screen.findByRole('heading', { name: 'Sua mão' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Floresta — Baixar terreno' }));
    expect(socket.sent.at(-1)).toMatchObject({
      type: 'game_action',
      action: { type: 'play_land', cardId: 'player-1-forest' },
    });

    act(() => { socket.receive({
      version: 1,
      type: 'action_rejected',
      requestId: 'action',
      code: 'NOT_YOUR_TURN',
      message: 'internal detail',
    }); });
    expect(screen.getByRole('alert')).toHaveTextContent('Agora é o turno do adversário.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('internal detail');
  });

  it('joins a room and shows friendly errors', async () => {
    const harness = createHarness();
    renderFlow(harness.service);

    fireEvent.click(screen.getByRole('button', { name: 'Entrar em sala' }));
    fireEvent.change(screen.getByLabelText('Código da sala'), { target: { value: 'bad123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const socket = harness.sockets[0];
    expect(socket).toBeDefined();
    if (socket === undefined) return;
    act(() => { socket.open(); });
    await waitFor(() => { expect(socket.sent[0]).toMatchObject({
      type: 'join_room',
      roomCode: 'BAD123',
    }); });

    act(() => { socket.receive({
      version: 1,
      type: 'error',
      requestId: 'join',
      code: 'ROOM_NOT_FOUND',
      message: 'Room does not exist.',
    }); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Sala não encontrada');
  });

  it('detects a dropped connection and reconnects with the same session token', async () => {
    const harness = createHarness();
    renderFlow(harness.service);
    const first = await createAndStart(harness);

    act(() => { first.remoteClose(); });
    expect(await screen.findByRole('heading', { name: 'Conexão perdida' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar reconectar' }));
    const replacement = harness.sockets[1];
    expect(replacement).toBeDefined();
    if (replacement === undefined) return;
    act(() => { replacement.open(); });

    await waitFor(() => { expect(replacement.sent[0]).toMatchObject({
      type: 'join_room',
      roomCode: 'ROOM42',
      sessionToken: 'session-1',
    }); });
    act(() => { replacement.receive(roomMessage('room_joined', 'PLAYING')); });
    act(() => { replacement.receive({
      version: 1,
      type: 'game_state',
      roomCode: 'ROOM42',
      state: projectedState(),
    }); });
    expect(await screen.findByRole('heading', { name: 'Sua mão' })).toBeInTheDocument();
  });

  it.each([
    ['Você venceu!', 'player-1'],
    ['Você perdeu!', 'player-2'],
  ] as const)('renders the server result: %s', async (title, winnerId) => {
    const harness = createHarness();
    renderFlow(harness.service);
    const socket = await createAndStart(harness);

    act(() => { socket.receive({
      version: 1,
      type: 'game_finished',
      roomCode: 'ROOM42',
      winnerId,
      reason: 'VICTORY',
      state: projectedState(winnerId),
    }); });

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });
});

function MultiplayerFlow({ service }: { readonly service: MultiplayerService }) {
  return (
    <MultiplayerProvider service={service}>
      <FlowContent />
    </MultiplayerProvider>
  );
}

function FlowContent() {
  const multiplayer = useMultiplayer();
  return multiplayer.page === 'game'
    ? <RealtimeGameScreen />
    : <MultiplayerScreen onHome={() => undefined} />;
}

function renderFlow(service: MultiplayerService): void {
  render(<MultiplayerFlow service={service} />);
}

function createHarness(): {
  readonly service: MultiplayerService;
  readonly sockets: FakeSocket[];
} {
  const sockets: FakeSocket[] = [];
  const client = new RealtimeWebSocketClient(() => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket as unknown as WebSocket;
  });
  return { service: new MultiplayerService(client, 'ws://test/ws'), sockets };
}

async function createAndStart(harness: ReturnType<typeof createHarness>): Promise<FakeSocket> {
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
  const socket = harness.sockets[0];
  if (socket === undefined) throw new Error('Socket was not created.');
  act(() => { socket.open(); });
  await waitFor(() => { expect(socket.sent).toHaveLength(1); });
  act(() => { socket.receive(roomMessage('room_created')); });
  act(() => { socket.receive({
    version: 1,
    type: 'player_joined',
    roomCode: 'ROOM42',
    playerId: 'player-2',
  }); });
  act(() => { socket.receive({
    version: 1,
    type: 'game_started',
    roomCode: 'ROOM42',
    state: projectedState(),
  }); });
  await screen.findByRole('heading', { name: 'Sua mão' });
  return socket;
}

function roomMessage(
  type: 'room_created' | 'room_joined',
  status: 'WAITING' | 'PLAYING' = 'WAITING',
): ServerMessage {
  return {
    version: 1,
    type,
    requestId: 'room',
    roomCode: 'ROOM42',
    playerId: 'player-1',
    sessionToken: 'session-1',
    status,
  };
}

function projectedState(winnerId: string | null = null): ProjectedGameState {
  const forest: Card = { id: 'player-1-forest', type: 'FOREST', ownerId: 'player-1' };
  const publicGameState: PublicGameState = {
    players: [
      { id: 'player-1', deckCount: 20, handCount: 1, field: [], graveyard: [] },
      { id: 'player-2', deckCount: 20, handCount: 5, field: [], graveyard: [] },
    ],
    currentPlayerId: 'player-1',
    startingPlayerId: 'player-1',
    turnNumber: 1,
    phase: 'MAIN',
    landPlayedThisTurn: false,
    pending: null,
    winnerId,
  };
  return {
    publicGameState,
    privatePlayerState: {
      playerId: 'player-1',
      hand: [forest],
      deckTop: null,
      revealedOpponentHand: null,
    },
    legalActions: winnerId === null
      ? [{ type: 'PLAY_LAND', cardId: forest.id }, { type: 'END_TURN' }]
      : [],
  };
}

class FakeSocket extends EventTarget {
  readyState: number = WebSocket.CONNECTING;
  readonly sent: Array<Record<string, unknown>> = [];

  open(): void {
    this.readyState = WebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  receive(message: ServerMessage): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  }

  remoteClose(): void {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent('close'));
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent('close'));
  }
}
