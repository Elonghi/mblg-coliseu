import { useEffect, useMemo, useRef, useState } from 'react';
import type { Card, GameAction, PlayerView } from '@mblg-coliseu/game-engine';
import { useMultiplayer } from '../multiplayer/multiplayer-context.js';
import { CardZone } from './card-zone.js';
import { ChoicePanel } from './choice-panel.js';
import { ConnectionStatus } from './connection-status.js';
import { FieldZone } from './field-zone.js';
import { CardBack } from './land-card.js';

export function RealtimeGameScreen() {
  const multiplayer = useMultiplayer();
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null);
  const automaticKey = useRef<string | null>(null);
  const projected = multiplayer.gameState;

  const automaticAction = useMemo(() => {
    if (projected === null) return null;
    const draw = projected.legalActions.find((action) => action.type === 'DRAW');
    if (draw !== undefined) return draw;
    if (projected.publicGameState.landPlayedThisTurn &&
      projected.publicGameState.pending === null) {
      return projected.legalActions.find((action) => action.type === 'END_TURN') ?? null;
    }
    return null;
  }, [projected]);

  useEffect(() => {
    if (automaticAction === null || projected === null || multiplayer.submitting ||
      multiplayer.connectionStatus !== 'connected') return;
    const key = `${String(projected.publicGameState.turnNumber)}:${automaticAction.type}`;
    if (automaticKey.current === key) return;
    automaticKey.current = key;
    multiplayer.sendAction(automaticAction);
  }, [automaticAction, multiplayer, projected]);

  if (projected === null || multiplayer.credentials === null) {
    return (
      <main className="setup-screen">
        <section className="setup-panel">
          <h1>Reconectando</h1>
          <p className="setup-copy">Precisamos recuperar o estado autoritativo da partida.</p>
          <button type="button" className="primary-button" onClick={() => void multiplayer.reconnect()}>
            Tentar reconectar
          </button>
        </section>
      </main>
    );
  }

  const view: PlayerView = {
    publicState: projected.publicGameState,
    privateState: projected.privatePlayerState,
  };
  const ownId = multiplayer.credentials.playerId;
  const own = view.publicState.players.find((player) => player.id === ownId);
  const opponent = view.publicState.players.find((player) => player.id !== ownId);
  if (own === undefined || opponent === undefined) throw new Error('Projected game is missing a player.');
  const legalActions = projected.legalActions;
  const playActions = legalActions.filter(
    (action): action is Extract<GameAction, { type: 'PLAY_LAND' }> => action.type === 'PLAY_LAND',
  );
  const playByCard = new Map(playActions.map((action) => [action.cardId, action]));
  const mountainActions = legalActions.filter(
    (action): action is Extract<GameAction, { type: 'CHOOSE_MOUNTAIN_TARGET' }> =>
      action.type === 'CHOOSE_MOUNTAIN_TARGET',
  );
  const mountainByTarget = new Map(mountainActions.map((action) => [action.targetLandId, action]));
  const playableIds = new Set(playByCard.keys());
  const targetIds = new Set(mountainByTarget.keys());
  const endTurn = legalActions.find((action) => action.type === 'END_TURN');
  const ownTurn = view.publicState.currentPlayerId === ownId;
  const needsDecision = view.publicState.pending !== null && legalActions.length > 0;
  const statusText = needsDecision
    ? 'Sua decisão é necessária'
    : multiplayer.submitting
      ? 'Aguardando servidor…'
      : ownTurn ? 'Seu turno' : 'Turno do adversário';

  const selectOpponentField = (card: Card) => {
    const action = mountainByTarget.get(card.id);
    if (action !== undefined) multiplayer.sendAction(action);
  };

  return (
    <main className="game-screen realtime-game-screen">
      <header className="game-header">
        <button type="button" className="brand-button" onClick={multiplayer.leaveRoom}>
          MBLG <span>Coliseu</span>
        </button>
        <div className={`turn-indicator ${ownTurn ? 'turn-indicator--human' : 'turn-indicator--bot'}`} role="status">
          <span className="turn-dot" />{statusText}
          <small>Turno {view.publicState.turnNumber}</small>
        </div>
        <div className="match-meta">
          Sala {multiplayer.credentials.roomCode} · <ConnectionStatus status={multiplayer.connectionStatus} />
        </div>
      </header>

      {multiplayer.error !== null && <div className="error-banner" role="alert">{multiplayer.error}</div>}
      {multiplayer.notice !== null && <div className="multiplayer-notice">{multiplayer.notice}</div>}

      <section className="player-area player-area--bot">
        <div className="player-heading">
          <div><span className="player-label">Oponente</span><h2>Adversário</h2></div>
          <div className="resource-summary">
            <span>Deck <strong>{opponent.deckCount}</strong></span>
            <span>Mão <strong>{opponent.handCount}</strong></span>
            <span>Trash <strong>{opponent.graveyard.length}</strong></span>
          </div>
        </div>
        <div className="opponent-resources">
          <div className="hidden-hand" aria-label={`Mão do adversário: ${String(opponent.handCount)}`}>
            {Array.from({ length: Math.min(opponent.handCount, 7) }, (_, index) => (
              <CardBack key={index} label="Carta oculta do adversário" />
            ))}
            {opponent.handCount > 7 && <span>+{opponent.handCount - 7}</span>}
          </div>
          <div className="deck-stack"><CardBack label="Deck do adversário" /><strong>{opponent.deckCount}</strong></div>
        </div>
        <FieldZone
          title="Campo do adversário"
          cards={opponent.field}
          highlightedIds={targetIds}
          actionLabel="Destruir"
          onCardSelect={selectOpponentField}
          emptyMessage="O adversário ainda não baixou terrenos"
        />
        <details className="graveyard-drawer">
          <summary>Cemitério adversário · {opponent.graveyard.length}</summary>
          <CardZone title="Trash adversário" cards={opponent.graveyard} compact />
        </details>
      </section>

      <div className="arena-divider"><span /><b>{statusText.toUpperCase()}</b><span /></div>

      <ChoicePanel
        view={view}
        legalActions={legalActions}
        selectedIslandId={selectedIslandId}
        onIslandSelect={setSelectedIslandId}
        onAction={multiplayer.sendAction}
        opponentLabel="adversário"
      />

      <section className="player-area player-area--human">
        <FieldZone title="Seu campo" cards={own.field} emptyMessage="Baixe um terreno para começar" />
        <div className="human-resources">
          <div className="deck-stack"><CardBack label="Seu deck" /><strong>{own.deckCount}</strong></div>
          <details className="graveyard-drawer" open={view.publicState.pending?.kind === 'FOREST_RECOVERY'}>
            <summary>Seu cemitério · {own.graveyard.length}</summary>
            <CardZone title="Seu trash" cards={own.graveyard} compact />
          </details>
        </div>
        <CardZone
          title="Sua mão"
          cards={view.privateState.hand}
          highlightedIds={playableIds}
          actionLabel="Baixar terreno"
          onCardSelect={(card) => {
            const action = playByCard.get(card.id);
            if (action !== undefined) multiplayer.sendAction(action);
          }}
          emptyMessage="Sua mão está vazia"
        />
        <div className="turn-controls">
          <span>{needsDecision ? 'Resolva a escolha destacada.' : ownTurn ? 'Somente ações autorizadas pelo servidor estão disponíveis.' : 'Aguarde o adversário.'}</span>
          {endTurn !== undefined && !view.publicState.landPlayedThisTurn && (
            <button type="button" className="primary-button" disabled={multiplayer.submitting} onClick={() => {
              multiplayer.sendAction(endTurn);
            }}>
              Passar turno
            </button>
          )}
        </div>
      </section>

      {multiplayer.connectionStatus === 'lost' && (
        <div className="connection-overlay">
          <h2>Conexão perdida</h2>
          <p>A partida permanece no servidor por até 60 segundos.</p>
          <button type="button" className="primary-button" onClick={() => void multiplayer.reconnect()}>Tentar reconectar</button>
        </div>
      )}

      {multiplayer.result !== null && (
        <div className="modal-backdrop" role="presentation">
          <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="multiplayer-result-title">
            <span className="result-emblem" aria-hidden="true">{multiplayer.result.winnerId === ownId ? '✦' : '◆'}</span>
            <p className="eyebrow">Fim da partida</p>
            <h2 id="multiplayer-result-title">
              {multiplayer.result.winnerId === ownId
                ? 'Você venceu!'
                : multiplayer.result.winnerId === null ? 'Partida encerrada' : 'Você perdeu!'}
            </h2>
            <p>{multiplayer.result.reason === 'DISCONNECT_TIMEOUT' ? 'O prazo de reconexão terminou.' : 'O servidor confirmou o resultado da partida.'}</p>
            <div className="choice-actions">
              <button type="button" className="primary-button" onClick={multiplayer.leaveRoom}>Jogar novamente</button>
              <button type="button" className="secondary-button" onClick={multiplayer.leaveRoom}>Voltar ao menu</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
