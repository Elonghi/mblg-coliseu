export { buildServer } from './app.js';
export {
  PROTOCOL_VERSION,
  decodeClientMessage,
  toGameAction,
} from './protocol.js';
export type {
  ClientMessage,
  FinishReason,
  RoomStatus,
  ServerMessage,
  WireGameAction,
} from './protocol.js';
export {
  getPrivatePlayerState,
  getPublicGameState,
  projectGameState,
} from './projection.js';
export type { ProjectedGameState } from './projection.js';
export { RoomManager } from './room-manager.js';
export type {
  ClientConnection,
  PlayerCredentials,
  RoomManagerOptions,
  RoomSummary,
} from './room-manager.js';
