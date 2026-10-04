import type { ConnectionStatus as Status } from '../multiplayer/multiplayer-types.js';

export function ConnectionStatus({ status }: { readonly status: Status }) {
  const label: Record<Status, string> = {
    disconnected: 'Desconectado',
    connecting: 'Conectando…',
    connected: 'Conectado',
    lost: 'Conexão perdida',
  };
  return (
    <span className={`connection-status connection-status--${status}`} role="status">
      <span aria-hidden="true" />
      {label[status]}
    </span>
  );
}
