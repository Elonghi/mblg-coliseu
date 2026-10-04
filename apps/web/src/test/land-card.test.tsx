import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Card, LandType } from '@mblg-coliseu/game-engine';
import { LandCard } from '../components/land-card.js';

const cases: ReadonlyArray<readonly [LandType, string]> = [
  ['MOUNTAIN', 'Montanha'],
  ['ISLAND', 'Ilha'],
  ['SWAMP', 'Pântano'],
  ['FOREST', 'Floresta'],
  ['PLAINS', 'Planície'],
];

describe('LandCard', () => {
  it.each(cases)('renders %s as %s', (type, name) => {
    const card: Card = { id: type, type, ownerId: 'human' };
    render(<LandCard card={card} />);
    expect(screen.getByLabelText(name)).toBeInTheDocument();
  });
});
