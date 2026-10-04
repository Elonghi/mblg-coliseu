import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { DeckSize, GameAction } from '@mblg-coliseu/game-engine';
import { MultiplayerService } from './multiplayer-service.js';
import type {
  ConnectionStatus,
  GameResult,
  MultiplayerCredentials,
  ProjectedGameState,
  ServerMessage,
} from './multiplayer-types.js';

export type MultiplayerPage = 'menu' | 'join' | 'lobby' | 'game';

export interface MultiplayerState {
  readonly page: MultiplayerPage;
  readonly connectionStatus: ConnectionStatus;
  readonly credentials: MultiplayerCredentials | null;
  readonly opponentConnected: boolean;
  readonly localReady: boolean;
  readonly gameState: ProjectedGameState | null;
  readonly result: GameResult | null;
  readonly error: string | null;
  readonly notice: string | null;
  readonly submitting: boolean;
}

interface MultiplayerContextValue extends MultiplayerState {
  readonly showJoin: () => void;
  readonly showMenu: () => void;
  readonly createRoom: (deckSize: DeckSize) => Promise<void>;
  readonly joinRoom: (roomCode: string) => Promise<void>;
  readonly ready: () => void;
  readonly sendAction: (action: GameAction) => void;
  readonly reconnect: () => Promise<void>;
  readonly leaveRoom: () => void;
  readonly clearError: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

function initialState(service: MultiplayerService): MultiplayerState {
  const credentials = service.loadCredentials();
  return {
    page: credentials === null ? 'menu' : 'lobby',
    connectionStatus: credentials === null ? 'disconnected' : 'lost',
    credentials,
    opponentConnected: false,
    localReady: false,
    gameState: null,
    result: null,
    error: null,
    notice: credentials === null ? null : 'Sessão encontrada. Reconecte para continuar.',
    submitting: false,
  };
}

function friendlyError(code: string): string {
  const messages: Record<string, string> = {
    ROOM_NOT_FOUND: 'Sala não encontrada. Confira o código e tente novamente.',
    ROOM_FULL: 'Esta sala está cheia ou a partida já começou.',
    INVALID_ROOM_CODE: 'O código informado é inválido.',
    INVALID_SESSION_TOKEN: 'A sessão não é mais válida.',
    SESSION_IN_USE: 'Este jogador já está conectado em outro navegador.',
    NOT_IN_ROOM: 'Você não está conectado a uma sala.',
    GAME_FINISHED: 'Esta partida já terminou.',
    NOT_YOUR_TURN: 'Agora é o turno do adversário.',
    CARD_NOT_IN_HAND: 'Essa carta não está disponível na sua mão.',
  };
  return messages[code] ?? 'Não foi possível concluir a ação. Tente novamente.';
}

function navigate(path: string): void {
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
}

export function MultiplayerProvider({
  children,
  service: providedService,
}: {
  readonly children: ReactNode;
  readonly service?: MultiplayerService;
}) {
  const [service] = useState(() => providedService ?? new MultiplayerService());
  const [state, setState] = useState<MultiplayerState>(() => initialState(service));

  useEffect(() => service.client.onStatus((connectionStatus) => {
    setState((current) => ({
      ...current,
      connectionStatus,
      submitting: connectionStatus === 'connected' ? current.submitting : false,
      notice: connectionStatus === 'lost'
        ? 'Conexão perdida. Sua partida continua reservada por 60 segundos.'
        : current.notice,
    }));
  }), [service]);

  useEffect(() => service.onMessage((message) => {
    setState((current) => reduceServerMessage(current, message));
  }), [service]);

  const showJoin = useCallback(() => {
    navigate('/multiplayer');
    setState((current) => ({ ...current, page: 'join', error: null }));
  }, []);

  const showMenu = useCallback(() => {
    navigate('/multiplayer');
    setState((current) => ({ ...current, page: 'menu', error: null }));
  }, []);

  const createRoom = useCallback(async (deckSize: DeckSize) => {
    setState((current) => ({ ...current, submitting: true, error: null }));
    try {
      await service.createRoom(deckSize);
    } catch {
      setState((current) => ({
        ...current,
        submitting: false,
        error: 'Não foi possível conectar ao servidor multiplayer.',
      }));
    }
  }, [service]);

  const joinRoom = useCallback(async (roomCode: string) => {
    setState((current) => ({ ...current, submitting: true, error: null }));
    try {
      await service.joinRoom(roomCode);
    } catch {
      setState((current) => ({
        ...current,
        submitting: false,
        error: 'Não foi possível conectar ao servidor multiplayer.',
      }));
    }
  }, [service]);

  const ready = useCallback(() => {
    try {
      service.ready();
      setState((current) => ({ ...current, localReady: true, error: null }));
    } catch {
      setState((current) => ({ ...current, error: 'A conexão com a sala foi perdida.' }));
    }
  }, [service]);

  const sendAction = useCallback((action: GameAction) => {
    try {
      service.sendAction(action);
      setState((current) => ({ ...current, submitting: true, error: null }));
    } catch {
      setState((current) => ({ ...current, error: 'A conexão com a partida foi perdida.' }));
    }
  }, [service]);

  const reconnect = useCallback(async () => {
    setState((current) => ({ ...current, submitting: true, error: null }));
    try {
      await service.reconnect();
    } catch {
      setState((current) => ({
        ...current,
        submitting: false,
        error: 'Não foi possível recuperar a sessão. O prazo pode ter expirado.',
      }));
    }
  }, [service]);

  const leaveRoom = useCallback(() => {
    service.leaveRoom();
    navigate('/multiplayer');
    setState({
      ...initialState(service),
      page: 'menu',
      credentials: null,
      connectionStatus: 'disconnected',
      notice: null,
    });
  }, [service]);

  const clearError = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
  }, []);

  const value = useMemo<MultiplayerContextValue>(() => ({
    ...state,
    showJoin,
    showMenu,
    createRoom,
    joinRoom,
    ready,
    sendAction,
    reconnect,
    leaveRoom,
    clearError,
  }), [
    state,
    showJoin,
    showMenu,
    createRoom,
    joinRoom,
    ready,
    sendAction,
    reconnect,
    leaveRoom,
    clearError,
  ]);

  return <MultiplayerContext.Provider value={value}>{children}</MultiplayerContext.Provider>;
}

function reduceServerMessage(
  state: MultiplayerState,
  message: ServerMessage,
): MultiplayerState {
  switch (message.type) {
    case 'room_created':
      navigate('/multiplayer');
      return {
        ...state,
        page: 'lobby',
        credentials: {
          roomCode: message.roomCode,
          playerId: message.playerId,
          sessionToken: message.sessionToken,
        },
        opponentConnected: false,
        submitting: false,
        notice: 'Aguardando adversário…',
        error: null,
      };
    case 'room_joined':
      return {
        ...state,
        page: message.status === 'PLAYING' ? state.page : 'lobby',
        credentials: {
          roomCode: message.roomCode,
          playerId: message.playerId,
          sessionToken: message.sessionToken,
        },
        opponentConnected: message.status !== 'WAITING',
        submitting: false,
        notice: message.status === 'PLAYING' ? 'Sessão recuperada.' : state.notice,
        error: null,
      };
    case 'player_joined':
      return { ...state, opponentConnected: true, notice: 'Adversário conectado.' };
    case 'game_started':
    case 'game_state':
      navigate(`/game/${message.roomCode}`);
      return {
        ...state,
        page: 'game',
        gameState: message.state,
        result: null,
        submitting: false,
        notice: null,
        error: null,
      };
    case 'game_finished':
      return {
        ...state,
        page: 'game',
        gameState: message.state ?? state.gameState,
        result: { winnerId: message.winnerId, reason: message.reason },
        submitting: false,
      };
    case 'action_rejected':
    case 'error':
      return {
        ...state,
        submitting: false,
        error: friendlyError(message.code),
      };
    case 'player_disconnected':
      return {
        ...state,
        opponentConnected: false,
        notice: 'O adversário perdeu a conexão. Aguardando reconexão…',
      };
    case 'player_reconnected':
      return {
        ...state,
        opponentConnected: true,
        notice: message.playerId === state.credentials?.playerId
          ? 'Sua sessão foi recuperada.'
          : 'O adversário reconectou.',
      };
    case 'pong':
      return state;
  }
}

export function useMultiplayer(): MultiplayerContextValue {
  const context = useContext(MultiplayerContext);
  if (context === null) throw new Error('useMultiplayer requires MultiplayerProvider.');
  return context;
}
