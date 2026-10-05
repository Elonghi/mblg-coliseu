import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Card } from '@mblg-coliseu/game-engine';
import { GraveyardDrawer } from '../components/graveyard-drawer.js';

const graveyard: readonly Card[] = [
  { id: 'graveyard-mountain', type: 'MOUNTAIN', ownerId: 'human' },
];

afterEach(cleanup);

describe('GraveyardDrawer', () => {
  it('stays open for interactions inside it', () => {
    render(
      <GraveyardDrawer
        label="Seu cemitério"
        title="Seu trash"
        cards={graveyard}
        openWhenActive
      />,
    );

    const drawer = screen.getByTestId('graveyard-drawer');
    fireEvent.pointerDown(screen.getByText('Montanha'));

    expect(drawer).toHaveAttribute('open');
  });

  it('closes when the player interacts outside it', () => {
    render(
      <GraveyardDrawer
        label="Seu cemitério"
        title="Seu trash"
        cards={graveyard}
        openWhenActive
      />,
    );

    const drawer = screen.getByTestId('graveyard-drawer');
    fireEvent.pointerDown(document.body);

    expect(drawer).not.toHaveAttribute('open');
  });
});
