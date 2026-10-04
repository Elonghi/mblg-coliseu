import { useMemo } from 'react';
import type {
  Card,
  GameAction,
  PlayerView,
} from '@mblg-coliseu/game-engine';
import { CardZone } from './card-zone.js';
import { LAND_PRESENTATION, LandCard } from './land-card.js';

type CounterAction = Extract<
  GameAction,
  { readonly type: 'COUNTER_WITH_ISLAND' }
>;
type SwampAction = Extract<
  GameAction,
  { readonly type: 'CHOOSE_SWAMP_DISCARD' }
>;
type ForestAction = Extract<
  GameAction,
  { readonly type: 'CHOOSE_FOREST_RECOVERY' }
>;

interface ChoicePanelProps {
  readonly view: PlayerView;
  readonly legalActions: readonly GameAction[];
  readonly selectedIslandId: string | null;
  readonly onIslandSelect: (cardId: string) => void;
  readonly onAction: (action: GameAction) => void;
  readonly opponentLabel?: string;
}

function uniqueCards(cards: readonly Card[]): Card[] {
  return [...new Map(cards.map((card) => [card.id, card])).values()];
}

export function ChoicePanel({
  view,
  legalActions,
  selectedIslandId,
  onIslandSelect,
  onAction,
  opponentLabel = 'Bot',
}: ChoicePanelProps) {
  const pending = view.publicState.pending;
  const counterActions = legalActions.filter(
    (action): action is CounterAction =>
      action.type === 'COUNTER_WITH_ISLAND',
  );
  const handById = useMemo(
    () => new Map(view.privateState.hand.map((card) => [card.id, card])),
    [view.privateState.hand],
  );

  if (pending === null || legalActions.length === 0) {
    return null;
  }

  if (pending.kind === 'MOUNTAIN_TARGET') {
    return (
      <aside className="choice-panel choice-panel--danger">
        <span className="choice-kicker">Habilidade da Montanha</span>
        <h2>Escolha um terreno do {opponentLabel} para destruir</h2>
        <p>Os alvos válidos estão destacados no campo adversário.</p>
      </aside>
    );
  }

  if (pending.kind === 'SWAMP_DISCARD') {
    const discardActions = legalActions.filter(
      (action): action is SwampAction =>
        action.type === 'CHOOSE_SWAMP_DISCARD',
    );
    const actionByCard = new Map(
      discardActions.map((action) => [action.targetCardId, action]),
    );
    return (
      <aside className="choice-panel choice-panel--swamp">
        <span className="choice-kicker">Habilidade do Pântano</span>
        <h2>A mão do {opponentLabel} foi revelada</h2>
        <p>Escolha a carta que será enviada ao cemitério.</p>
        <CardZone
          title="Mão revelada do Bot"
          cards={view.privateState.revealedOpponentHand ?? []}
          highlightedIds={new Set(actionByCard.keys())}
          actionLabel="Descartar"
          onCardSelect={(card) => {
            const action = actionByCard.get(card.id);
            if (action !== undefined) onAction(action);
          }}
        />
      </aside>
    );
  }

  if (pending.kind === 'FOREST_RECOVERY') {
    const recoveryActions = legalActions.filter(
      (action): action is ForestAction =>
        action.type === 'CHOOSE_FOREST_RECOVERY',
    );
    const actionByCard = new Map(
      recoveryActions.map((action) => [action.targetCardId, action]),
    );
    const own = view.publicState.players.find(
      (player) => player.id === view.privateState.playerId,
    );
    const skip = legalActions.find(
      (action) => action.type === 'SKIP_FOREST_RECOVERY',
    );
    return (
      <aside className="choice-panel choice-panel--forest">
        <span className="choice-kicker">Habilidade da Floresta</span>
        <h2>Recupere um terreno do seu cemitério</h2>
        <CardZone
          title="Terrenos recuperáveis"
          cards={own?.graveyard ?? []}
          highlightedIds={new Set(actionByCard.keys())}
          actionLabel="Recuperar"
          onCardSelect={(card) => {
            const action = actionByCard.get(card.id);
            if (action !== undefined) onAction(action);
          }}
        />
        {skip !== undefined && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onAction(skip);
            }}
          >
            Não recuperar
          </button>
        )}
      </aside>
    );
  }

  if (pending.kind === 'ISLAND_TOP') {
    const top = view.privateState.deckTop;
    const keep = legalActions.find(
      (action) =>
        action.type === 'CHOOSE_ISLAND_TOP' && action.placement === 'TOP',
    );
    const bottom = legalActions.find(
      (action) =>
        action.type === 'CHOOSE_ISLAND_TOP' && action.placement === 'BOTTOM',
    );
    return (
      <aside className="choice-panel choice-panel--island">
        <span className="choice-kicker">Habilidade da Ilha</span>
        <h2>Você encontrou no topo</h2>
        {top !== null && <LandCard card={top} />}
        <div className="choice-actions">
          {keep !== undefined && (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                onAction(keep);
              }}
            >
              Manter no topo
            </button>
          )}
          {bottom !== undefined && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                onAction(bottom);
              }}
            >
              Colocar no fundo
            </button>
          )}
        </div>
      </aside>
    );
  }

  {
    const islandCards = uniqueCards(
      counterActions
        .map((action) => handById.get(action.islandCardId))
        .filter((card): card is Card => card !== undefined),
    );
    const selectedIsValid = counterActions.some(
      (action) => action.islandCardId === selectedIslandId,
    );
    const activeIslandId = selectedIsValid ? selectedIslandId : null;
    const costOptions = activeIslandId === null
      ? []
      : counterActions.filter(
          (action) => action.islandCardId === activeIslandId,
        );
    const costCards = uniqueCards(
      costOptions
        .map((action) => handById.get(action.discardCardId))
        .filter((card): card is Card => card !== undefined),
    );
    const pass = legalActions.find(
      (action) => action.type === 'PASS_RESPONSE',
    );

    return (
      <aside className="choice-panel choice-panel--response">
        <span className="choice-kicker">Janela de resposta</span>
        <h2>
          O {opponentLabel} tenta baixar{' '}
          {LAND_PRESENTATION[pending.landType].name}
        </h2>
        <p>
          Você pode anulá-la com uma Ilha e descartar uma carta do mesmo tipo.
        </p>

        {islandCards.length > 0 ? (
          <>
            <h3>1. Escolha a Ilha</h3>
            <div className="card-row">
              {islandCards.map((card) => (
                <LandCard
                  key={card.id}
                  card={card}
                  compact
                  highlighted
                  selected={activeIslandId === card.id}
                  actionLabel="Usar como resposta"
                  onSelect={() => {
                    onIslandSelect(card.id);
                  }}
                />
              ))}
            </div>

            {activeIslandId !== null && (
              <>
                <h3>2. Escolha o custo para descartar</h3>
                <div className="card-row">
                  {costCards.map((card) => {
                    const action = costOptions.find(
                      (candidate) => candidate.discardCardId === card.id,
                    );
                    return (
                      <LandCard
                        key={card.id}
                        card={card}
                        compact
                        highlighted
                        actionLabel="Descartar e anular"
                        onSelect={
                          action === undefined
                            ? undefined
                            : () => {
                                onAction(action);
                              }
                        }
                      />
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <p className="notice">Você não possui o pagamento necessário.</p>
        )}

        {pass !== undefined && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onAction(pass);
            }}
          >
            Deixar o terreno resolver
          </button>
        )}
      </aside>
    );
  }

  return null;
}
