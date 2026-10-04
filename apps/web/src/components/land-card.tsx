import type { Card, LandType } from '@mblg-coliseu/game-engine';

export const LAND_PRESENTATION: Record<
  LandType,
  { readonly name: string; readonly symbol: string; readonly ability: string }
> = {
  MOUNTAIN: {
    name: 'Montanha',
    symbol: '▲',
    ability: 'Destrói um terreno adversário.',
  },
  ISLAND: {
    name: 'Ilha',
    symbol: '≋',
    ability: 'Manipula o topo ou anula um terreno.',
  },
  SWAMP: {
    name: 'Pântano',
    symbol: '◉',
    ability: 'Revela a mão e descarta uma carta.',
  },
  FOREST: {
    name: 'Floresta',
    symbol: '♣',
    ability: 'Recupera um terreno do cemitério.',
  },
  PLAINS: {
    name: 'Planície',
    symbol: '✦',
    ability: 'Compra uma carta.',
  },
};

interface LandCardProps {
  readonly card: Card;
  readonly compact?: boolean;
  readonly highlighted?: boolean;
  readonly selected?: boolean;
  readonly actionLabel?: string | undefined;
  readonly onSelect?: (() => void) | undefined;
}

export function LandCard({
  card,
  compact = false,
  highlighted = false,
  selected = false,
  actionLabel,
  onSelect,
}: LandCardProps) {
  const presentation = LAND_PRESENTATION[card.type];
  const className = [
    'land-card',
    'land-card--' + card.type.toLowerCase(),
    compact ? 'land-card--compact' : '',
    highlighted ? 'land-card--highlighted' : '',
    selected ? 'land-card--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="land-card__type">{presentation.name}</span>
      <span className="land-card__symbol" aria-hidden="true">
        {presentation.symbol}
      </span>
      {!compact && (
        <span className="land-card__ability">{presentation.ability}</span>
      )}
      {actionLabel !== undefined && (
        <span className="land-card__action">{actionLabel}</span>
      )}
    </>
  );

  if (onSelect !== undefined) {
    return (
      <button
        type="button"
        className={className}
        onClick={onSelect}
        aria-label={
          presentation.name +
          (actionLabel === undefined ? '' : ' — ' + actionLabel)
        }
      >
        {content}
      </button>
    );
  }

  return (
    <article className={className} aria-label={presentation.name}>
      {content}
    </article>
  );
}

export function CardBack({ label = 'Carta' }: { readonly label?: string }) {
  return (
    <div className="card-back" aria-label={label}>
      <span aria-hidden="true">C</span>
    </div>
  );
}
