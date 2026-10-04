import { useMemo, useState } from 'react';
import type {
  Card,
  DeckSize,
  GameAction,
} from '@mblg-coliseu/game-engine';
import { BOT_PLAYER_ID, HUMAN_PLAYER_ID } from '../game/local-match.js';
import { useLocalMatch } from '../hooks/use-local-match.js';
import { ActivityFeed } from './activity-feed.js';
import { CardZone } from './card-zone.js';
import { FieldZone } from './field-zone.js';
import { ChoicePanel } from './choice-panel.js';
import { CardBack } from './land-card.js';

interface GameScreenProps {
  readonly deckSize: DeckSize;
  readonly onNewMatch: () => void;
  readonly onHome: () => void;
}

export function GameScreen({
  deckSize,
  onNewMatch,
  onHome,
}: GameScreenProps) {
  const {
    view,
    legalActions,
    automatedActorId,
    notices,
    error,
    perform,
  } = useLocalMatch(deckSize);
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null);
  const publicState = view.publicState;
  const human = publicState.players.find(
    (player) => player.id === HUMAN_PLAYER_ID,
  );
  const bot = publicState.players.find((player) => player.id === BOT_PLAYER_ID);

  if (human === undefined || bot === undefined) {
    throw new Error('Local game view is missing a player.');
  }

  const playActions = legalActions.filter(
    (action): action is Extract<GameAction, { type: 'PLAY_LAND' }> =>
      action.type === 'PLAY_LAND',
  );
  const playByCard = new Map(
    playActions.map((action) => [action.cardId, action]),
  );
  const mountainActions = legalActions.filter(
    (
      action,
    ): action is Extract<GameAction, { type: 'CHOOSE_MOUNTAIN_TARGET' }> =>
      action.type === 'CHOOSE_MOUNTAIN_TARGET',
  );
  const mountainByTarget = new Map(
    mountainActions.map((action) => [action.targetLandId, action]),
  );
  const endTurn = legalActions.find(
    (action) => action.type === 'END_TURN',
  );
  const playableIds = useMemo(
    () => new Set(playActions.map((action) => action.cardId)),
    [playActions],
  );
  const targetIds = useMemo(
    () => new Set(mountainActions.map((action) => action.targetLandId)),
    [mountainActions],
  );

  const pending = publicState.pending;
  const humanTurn = publicState.currentPlayerId === HUMAN_PLAYER_ID;
  const statusText = publicState.winnerId !== null
    ? publicState.winnerId === HUMAN_PLAYER_ID
      ? 'Você venceu!'
      : 'O Bot venceu'
    : automatedActorId === BOT_PLAYER_ID
      ? 'O Bot está pensando…'
      : automatedActorId === HUMAN_PLAYER_ID
        ? publicState.phase === 'DRAW'
          ? 'Comprando uma carta…'
          : 'Encerrando seu turno…'
      : pending !== null && legalActions.length > 0
        ? 'Sua decisão é necessária'
        : humanTurn
          ? 'Seu turno'
          : 'Turno do Bot';

  const selectBotField = (card: Card) => {
    const action = mountainByTarget.get(card.id);
    if (action !== undefined) perform(action);
  };

  return (
    <main className="game-screen">
      <header className="game-header">
        <button type="button" className="brand-button" onClick={onHome}>
          MBLG <span>Coliseu</span>
        </button>
        <div
          className={
            'turn-indicator ' +
            (humanTurn ? 'turn-indicator--human' : 'turn-indicator--bot')
          }
          role="status"
        >
          <span className="turn-dot" />
          {statusText}
          <small>Turno {publicState.turnNumber}</small>
        </div>
        <div className="match-meta">Deck de {deckSize}</div>
      </header>

      {error !== null && <div className="error-banner">{error}</div>}

      <ActivityFeed notices={notices} />

      <section className="player-area player-area--bot">
        <div className="player-heading">
          <div>
            <span className="player-label">Adversário</span>
            <h2>Bot do Coliseu</h2>
          </div>
          <div className="resource-summary">
            <span>Deck <strong>{bot.deckCount}</strong></span>
            <span>Mão <strong>{bot.handCount}</strong></span>
            <span>Trash <strong>{bot.graveyard.length}</strong></span>
          </div>
        </div>

        <div className="opponent-resources">
          <div className="hidden-hand" aria-label={'Mão do Bot: ' + String(bot.handCount)}>
            {Array.from(
              { length: Math.min(bot.handCount, 7) },
              (_, index) => (
                <CardBack key={index} label="Carta oculta do Bot" />
              ),
            )}
            {bot.handCount > 7 && <span>+{bot.handCount - 7}</span>}
          </div>
          <div className="deck-stack">
            <CardBack label="Deck do Bot" />
            <strong>{bot.deckCount}</strong>
          </div>
        </div>

        <FieldZone
          title="Campo do Bot"
          cards={bot.field}
          highlightedIds={targetIds}
          actionLabel="Destruir"
          onCardSelect={selectBotField}
          emptyMessage="O Bot ainda não baixou terrenos"
        />
        <details className="graveyard-drawer">
          <summary>Cemitério do Bot · {bot.graveyard.length}</summary>
          <CardZone
            title="Trash do Bot"
            cards={bot.graveyard}
            compact
          />
        </details>
      </section>

      <div className="arena-divider">
        <span />
        <b>ARENA</b>
        <span />
      </div>

      <ChoicePanel
        view={view}
        legalActions={legalActions}
        selectedIslandId={selectedIslandId}
        onIslandSelect={setSelectedIslandId}
        onAction={perform}
      />

      <section className="player-area player-area--human">
        <FieldZone
          title="Seu campo"
          cards={human.field}
          emptyMessage="Baixe um terreno para começar"
        />

        <div className="human-resources">
          <div className="deck-stack">
            <CardBack label="Seu deck" />
            <strong>{human.deckCount}</strong>
          </div>
          <details className="graveyard-drawer" open={pending?.kind === 'FOREST_RECOVERY'}>
            <summary>Seu cemitério · {human.graveyard.length}</summary>
            <CardZone
              title="Seu trash"
              cards={human.graveyard}
              compact
            />
          </details>
        </div>

        <CardZone
          title="Sua mão"
          cards={view.privateState.hand}
          highlightedIds={playableIds}
          actionLabel="Baixar terreno"
          onCardSelect={(card) => {
            const action = playByCard.get(card.id);
            if (action !== undefined) perform(action);
          }}
          emptyMessage="Sua mão está vazia"
        />

        <div className="turn-controls">
          <span>
            {playableIds.size > 0
              ? 'Cartas iluminadas podem ser jogadas.'
              : humanTurn
                ? publicState.landPlayedThisTurn
                  ? 'O turno será encerrado automaticamente.'
                  : 'Você pode jogar um terreno ou passar.'
                : 'Aguarde a jogada do Bot.'}
          </span>
          {endTurn !== undefined && !publicState.landPlayedThisTurn && (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                perform(endTurn);
              }}
            >
              Passar turno
            </button>
          )}
        </div>
      </section>

      {publicState.winnerId !== null && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="result-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="result-title"
          >
            <span className="result-emblem" aria-hidden="true">
              {publicState.winnerId === HUMAN_PLAYER_ID ? '✦' : '◆'}
            </span>
            <p className="eyebrow">Fim da partida</p>
            <h2 id="result-title">
              {publicState.winnerId === HUMAN_PLAYER_ID
                ? 'Vitória no Coliseu!'
                : 'O Bot venceu desta vez'}
            </h2>
            <p>
              {publicState.winnerId === HUMAN_PLAYER_ID
                ? 'Sua combinação de terrenos conquistou a arena.'
                : 'Reorganize sua estratégia e desafie o Coliseu novamente.'}
            </p>
            <div className="choice-actions">
              <button
                type="button"
                className="primary-button"
                onClick={onNewMatch}
              >
                Nova partida
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={onHome}
              >
                Voltar ao início
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
