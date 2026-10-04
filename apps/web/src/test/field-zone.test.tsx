import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Card } from '@mblg-coliseu/game-engine';
import { FieldZone } from '../components/field-zone.js';

describe('FieldZone', () => {
  it('stacks equal lands in one vertical solitaire column', () => {
    const cards: Card[] = [
      { id: 'forest-1', type: 'FOREST', ownerId: 'human' },
      { id: 'mountain-1', type: 'MOUNTAIN', ownerId: 'human' },
      { id: 'forest-2', type: 'FOREST', ownerId: 'human' },
      { id: 'forest-3', type: 'FOREST', ownerId: 'human' },
    ];
    const onSelect = vi.fn();

    render(
      <FieldZone
        title="Campo"
        cards={cards}
        highlightedIds={new Set(['forest-3'])}
        actionLabel="Destruir"
        onCardSelect={onSelect}
      />,
    );

    expect(screen.getByLabelText('Floresta: 3 terrenos')).toBeInTheDocument();
    expect(screen.getByLabelText('Montanha: 1 terreno')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Floresta — Destruir' }),
    );
    expect(onSelect).toHaveBeenCalledWith(cards[3]);
  });
});
