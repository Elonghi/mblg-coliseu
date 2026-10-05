import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import {
  PROTOCOL_VERSION,
  decodeClientMessage,
} from './protocol.js';
import type { ClientMessage, ServerMessage } from './protocol.js';
import { RoomManager } from './room-manager.js';
import type { ClientConnection } from './room-manager.js';

class WebSocketConnection implements ClientConnection {
  constructor(readonly socket: WebSocket) {}

  send(message: ServerMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}

export interface BuildServerOptions {
  readonly roomManager?: RoomManager;
  readonly logger?: boolean;
}

function rawDataToText(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return Buffer.concat(data).toString('utf8');
}

function dispatchMessage(
  manager: RoomManager,
  connection: ClientConnection,
  message: ClientMessage,
): void {
  switch (message.type) {
    case 'create_room':
      manager.createRoom(connection, message.deckSize, message.mode, message.requestId);
      return;
    case 'join_room':
      manager.joinRoom(
        connection,
        message.roomCode,
        message.requestId,
        message.sessionToken,
      );
      return;
    case 'ready':
      manager.ready(connection, message.requestId);
      return;
    case 'game_action':
      manager.gameAction(connection, message.action, message.requestId);
      return;
    case 'leave_room':
      manager.leaveRoom(connection, message.requestId);
      return;
    case 'ping':
      connection.send({
        version: PROTOCOL_VERSION,
        type: 'pong',
        requestId: message.requestId,
      });
  }
}

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const manager = options.roomManager ?? new RoomManager();
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  app.get('/health', () => ({ status: 'ok', protocolVersion: PROTOCOL_VERSION }));
  app.get('/ws', { websocket: true }, (socket) => {
    const connection = new WebSocketConnection(socket);

    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        connection.send({
          version: PROTOCOL_VERSION,
          type: 'error',
          code: 'BINARY_NOT_SUPPORTED',
          message: 'Only JSON text messages are accepted.',
        });
        return;
      }
      const decoded = decodeClientMessage(rawDataToText(data));
      if (!decoded.ok) {
        connection.send({
          version: PROTOCOL_VERSION,
          type: 'error',
          ...(decoded.requestId === undefined ? {} : { requestId: decoded.requestId }),
          code: decoded.code,
          message: decoded.message,
        });
        return;
      }
      try {
        dispatchMessage(manager, connection, decoded.message);
      } catch (error: unknown) {
        app.log.error(error);
        connection.send({
          version: PROTOCOL_VERSION,
          type: 'error',
          requestId: decoded.message.requestId,
          code: 'INTERNAL_ERROR',
          message: 'The server could not process this message.',
        });
      }
    });

    socket.on('close', () => {
      manager.disconnect(connection);
    });
  });

  return app;
}
