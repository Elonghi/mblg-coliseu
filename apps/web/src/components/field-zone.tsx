import { LAND_TYPES } from '@mblg-coliseu/game-engine';
import type { Card } from '@mblg-coliseu/game-engine';
import { LAND_PRESENTATION, LandCard } from './land-card.js';

interface FieldZoneProps {
  readonly title: string;
  readonly cards: readonly Card[];
  readonly highlightedIds?: ReadonlySet<string>;
  readonly actionLabel?: string;
  readonly onCardSelect?: (card: Card) => void;
  readonly emptyMessage?: string;
}

export function FieldZone({
  title,
  cards,
  highlightedIds = new Set<string>(),
  actionLabel,
  onCardSelect,
  emptyMessage = 'Nenhum terreno em campo',
}: FieldZoneProps) {
  const groups = LAND_TYPES.map((type) => ({
    type,
    cards: cards.filter((card) => card.type === type),
  })).filter((group) => group.cards.length > 0);

  return (
    <section className="field-zone" aria-label={title}>
      <div className="zone-title">
        <h3>{title}</h3>
        <span>{cards.length}</span>
      </div>

      {groups.length === 0 ? (
        <p className="empty-zone">{emptyMessage}</p>
      ) : (
        <div className="field-stacks">
          {groups.map((group) => (
            <div
              key={group.type}
              className="land-stack"
              aria-label={
                LAND_PRESENTATION[group.type].name +
                ': ' +
                String(group.cards.length) +
                (group.cards.length === 1 ? ' terreno' : ' terrenos')
              }
            >
              <span className="land-stack__count">{group.cards.length}</span>
              {group.cards.map((card) => {
                const highlighted = highlightedIds.has(card.id);
                return (
                  <LandCard
                    key={card.id}
                    card={card}
                    compact
                    highlighted={highlighted}
                    actionLabel={highlighted ? actionLabel : undefined}
                    onSelect={
                      highlighted && onCardSelect !== undefined
                        ? () => {
                            onCardSelect(card);
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
