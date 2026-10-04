import type { Card } from '@mblg-coliseu/game-engine';
import { LandCard } from './land-card.js';

interface CardZoneProps {
  readonly title: string;
  readonly cards: readonly Card[];
  readonly compact?: boolean;
  readonly highlightedIds?: ReadonlySet<string>;
  readonly actionLabel?: string;
  readonly onCardSelect?: (card: Card) => void;
  readonly emptyMessage?: string;
}

export function CardZone({
  title,
  cards,
  compact = false,
  highlightedIds = new Set<string>(),
  actionLabel,
  onCardSelect,
  emptyMessage = 'Nenhuma carta',
}: CardZoneProps) {
  return (
    <section className="card-zone" aria-label={title}>
      <div className="zone-title">
        <h3>{title}</h3>
        <span>{cards.length}</span>
      </div>
      <div className="card-row">
        {cards.length === 0 ? (
          <p className="empty-zone">{emptyMessage}</p>
        ) : (
          cards.map((card) => {
            const highlighted = highlightedIds.has(card.id);
            return (
              <LandCard
                key={card.id}
                card={card}
                compact={compact}
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
          })
        )}
      </div>
    </section>
  );
}
