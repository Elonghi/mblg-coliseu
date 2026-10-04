import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app.js';

describe('playable frontend flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts locally with the selected 50-card deck', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /MBLG Coliseu/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/50.*cartas/i));
    fireEvent.click(
      screen.getByRole('button', { name: 'Jogar contra Bot' }),
    );

    expect(screen.getByText('Deck de 50')).toBeInTheDocument();
    expect(screen.getByText('Seu turno')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sua mão' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Campo do Bot' }),
    ).toBeInTheDocument();
  });
});
