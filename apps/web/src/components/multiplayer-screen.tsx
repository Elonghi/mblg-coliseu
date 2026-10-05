import { useState } from 'react';
import type { DeckSize } from '@mblg-coliseu/game-engine';
import type { RoomMode } from '../multiplayer/multiplayer-types.js';
import { useMultiplayer } from '../multiplayer/multiplayer-context.js';
import { ConnectionStatus } from './connection-status.js';

export function MultiplayerScreen({ onHome }: { readonly onHome: () => void }) {
  const multiplayer = useMultiplayer();
  const [deckSize, setDeckSize] = useState<DeckSize>(25);
  const [mode, setMode] = useState<RoomMode>('2P');
  const [roomCode, setRoomCode] = useState('');
  const [copied, setCopied] = useState(false);

  const copyRoomCode = async () => {
    const code = multiplayer.credentials?.roomCode;
    if (code === undefined) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="setup-screen multiplayer-screen">
      <div className="setup-glow" aria-hidden="true" />
      <section className="setup-panel multiplayer-panel">
        <div className="multiplayer-heading">
          <button type="button" className="brand-button" onClick={onHome}>
            MBLG <span>Coliseu</span>
          </button>
          <ConnectionStatus status={multiplayer.connectionStatus} />
        </div>

        {multiplayer.error !== null && (
          <div className="error-banner" role="alert">
            {multiplayer.error}
            <button type="button" onClick={multiplayer.clearError} aria-label="Fechar erro">×</button>
          </div>
        )}

        {multiplayer.page === 'menu' && (
          <>
            <p className="eyebrow">Arena em tempo real</p>
            <h1>Multiplayer</h1>
            <p className="setup-copy">Crie uma sala privada ou entre usando o código de outro jogador.</p>
            <fieldset className="deck-picker compact-picker">
              <legend>Deck da nova sala</legend>
              {([25, 50] as const).map((size) => (
                <label key={size} className={deckSize === size ? 'deck-option selected' : 'deck-option'}>
                  <input
                    type="radio"
                    name="multiplayer-deck-size"
                    checked={deckSize === size}
                    onChange={() => {
                      setDeckSize(size);
                    }}
                  />
                  <strong>{size}</strong><span>cartas</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="deck-picker compact-picker">
              <legend>Quantidade de jogadores</legend>
              {(['2P', '4P'] as const).map((option) => (
                <label key={option} className={mode === option ? 'deck-option selected' : 'deck-option'}>
                  <input
                    type="radio"
                    name="multiplayer-mode"
                    aria-label={`${option === '2P' ? '2' : '4'} jogadores`}
                    checked={mode === option}
                    onChange={() => { setMode(option); }}
                  />
                  <strong>{option === '2P' ? '2' : '4'}</strong><span>jogadores</span>
                </label>
              ))}
            </fieldset>
            <div className="multiplayer-actions">
              <button
                type="button"
                className="primary-button"
                disabled={multiplayer.submitting}
                onClick={() => void multiplayer.createRoom(deckSize, mode)}
              >
                Criar sala
              </button>
              <button type="button" className="secondary-button" onClick={multiplayer.showJoin}>
                Entrar em sala
              </button>
            </div>
          </>
        )}

        {multiplayer.page === 'join' && (
          <form
            className="join-room-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (roomCode.trim().length > 0) void multiplayer.joinRoom(roomCode);
            }}
          >
            <p className="eyebrow">Multiplayer</p>
            <h1>Entrar na sala</h1>
            <label htmlFor="room-code">Código da sala</label>
            <input
              id="room-code"
              value={roomCode}
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="A7K92"
              onChange={(event) => {
                setRoomCode(event.target.value.toUpperCase());
              }}
            />
            <div className="multiplayer-actions">
              <button type="submit" className="primary-button" disabled={multiplayer.submitting || roomCode.trim() === ''}>
                Entrar
              </button>
              <button type="button" className="secondary-button" onClick={multiplayer.showMenu}>
                Voltar
              </button>
            </div>
          </form>
        )}

        {multiplayer.page === 'lobby' && multiplayer.credentials !== null && (
          <>
            <p className="eyebrow">Sala criada</p>
            <h1 className="room-code" aria-label={`Sala ${multiplayer.credentials.roomCode}`}>
              {multiplayer.credentials.roomCode}
            </h1>
            <p className="setup-copy">Compartilhe este código com seu adversário.</p>
            {multiplayer.room !== null && (
              <p className="lobby-notice">
                Modo: {multiplayer.room.maxPlayers} jogadores · Jogadores:{' '}
                {multiplayer.room.playerIds.length}/{multiplayer.room.maxPlayers}
              </p>
            )}
            <button type="button" className="secondary-button copy-button" onClick={() => void copyRoomCode()}>
              {copied ? 'Código copiado' : 'Copiar código'}
            </button>
            <div className="lobby-players" aria-live="polite">
              {Array.from({ length: multiplayer.room?.maxPlayers ?? 2 }, (_, index) => {
                const playerId = multiplayer.room?.playerIds[index];
                const isLocal = playerId === multiplayer.credentials?.playerId;
                const isReady = playerId !== undefined && (
                  multiplayer.room?.readyPlayerIds.includes(playerId) === true ||
                  (isLocal && multiplayer.localReady)
                );
                return (
                  <div
                    key={playerId ?? `empty-${String(index)}`}
                    className={isReady ? 'lobby-player lobby-player--ready' : 'lobby-player'}
                  >
                    <span>{isLocal ? 'Você' : `Jogador ${String(index + 1)}`}</span>
                    <strong className={playerId === undefined ? 'waiting' : isReady ? 'ready' : ''}>
                      <i aria-hidden="true">{isReady ? '✓' : playerId === undefined ? '…' : '●'}</i>
                      {playerId === undefined ? 'Aguardando' : isReady ? 'Pronto' : 'Conectado'}
                    </strong>
                  </div>
                );
              })}
            </div>
            {multiplayer.notice !== null && <p className="lobby-notice">{multiplayer.notice}</p>}
            {multiplayer.connectionStatus === 'lost' ? (
              <button type="button" className="primary-button" disabled={multiplayer.submitting} onClick={() => void multiplayer.reconnect()}>
                Tentar reconectar
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                disabled={multiplayer.localReady ||
                  multiplayer.room === null ||
                  multiplayer.room.playerIds.length !== multiplayer.room.maxPlayers}
                onClick={multiplayer.ready}
              >
                {multiplayer.localReady ? 'Aguardando jogadores…' : 'Pronto'}
              </button>
            )}
            <button type="button" className="text-button" onClick={multiplayer.leaveRoom}>Cancelar</button>
          </>
        )}
      </section>
    </main>
  );
}
