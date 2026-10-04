import type {
  ClientMessage,
  ConnectionStatus,
  ServerMessage,
} from './multiplayer-types.js';

export type SocketFactory = (url: string) => WebSocket;
export type MessageListener = (message: ServerMessage) => void;
export type StatusListener = (status: ConnectionStatus) => void;

function isServerMessage(value: unknown): value is ServerMessage {
  return typeof value === 'object' && value !== null &&
    'version' in value && value.version === 1 &&
    'type' in value && typeof value.type === 'string';
}

export class RealtimeWebSocketClient {
  readonly #socketFactory: SocketFactory;
  readonly #messageListeners = new Set<MessageListener>();
  readonly #statusListeners = new Set<StatusListener>();
  #socket: WebSocket | null = null;
  #status: ConnectionStatus = 'disconnected';
  #intentionalClose = false;

  constructor(socketFactory: SocketFactory = (url) => new WebSocket(url)) {
    this.#socketFactory = socketFactory;
  }

  get status(): ConnectionStatus {
    return this.#status;
  }

  async connect(url: string): Promise<void> {
    if (this.#socket?.readyState === WebSocket.OPEN) return;
    this.#intentionalClose = false;
    this.#setStatus('connecting');
    const socket = this.#socketFactory(url);
    this.#socket = socket;
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => {
        if (this.#socket !== socket) return;
        this.#setStatus('connected');
        resolve();
      }, { once: true });
      socket.addEventListener('error', () => {
        if (this.#socket === socket) this.#setStatus('lost');
        reject(new Error('WebSocket connection failed.'));
      }, { once: true });
      socket.addEventListener('message', (event) => {
        let value: unknown;
        try {
          value = JSON.parse(String(event.data)) as unknown;
        } catch {
          return;
        }
        if (!isServerMessage(value)) return;
        for (const listener of this.#messageListeners) listener(value);
      });
      socket.addEventListener('close', () => {
        if (this.#socket !== socket) return;
        this.#socket = null;
        this.#setStatus(this.#intentionalClose ? 'disconnected' : 'lost');
      });
    });
  }

  disconnect(): void {
    this.#intentionalClose = true;
    this.#socket?.close();
    this.#socket = null;
    this.#setStatus('disconnected');
  }

  send(message: ClientMessage): void {
    if (this.#socket?.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected.');
    }
    this.#socket.send(JSON.stringify(message));
  }

  onMessage(listener: MessageListener): () => void {
    this.#messageListeners.add(listener);
    return () => this.#messageListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.#statusListeners.add(listener);
    listener(this.#status);
    return () => this.#statusListeners.delete(listener);
  }

  #setStatus(status: ConnectionStatus): void {
    if (status === this.#status) return;
    this.#status = status;
    for (const listener of this.#statusListeners) listener(status);
  }
}
