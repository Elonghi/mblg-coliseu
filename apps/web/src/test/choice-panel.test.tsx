import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  getLegalActions,
  getPlayerView,
} from '@mblg-coliseu/game-engine';
import type {
  Card,
  GameAction,
  GameState,
  PlayerState,
} from '@mblg-coliseu/game-engine';
import { ChoicePanel } from '../components/choice-panel.js';

function player(
  id: string,
  zones: Partial<Pick<PlayerState, 'hand'>> = {},
): PlayerState {
  return {
    id,
    deck: [],
    hand: zones.hand ?? [],
    field: [],
    graveyard: [],
  };
}

function ResponseHarness({
  state,
  onAction,
}: {
  readonly state: GameState;
  readonly onAction: (action: GameAction) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <ChoicePanel
      view={getPlayerView(state, 'human')}
      legalActions={getLegalActions(state, 'human')}
      selectedIslandId={selected}
      onIslandSelect={setSelected}
      onAction={onAction}
    />
  );
}

describe('ChoicePanel', () => {
  it('guides the two-step Island response using engine-provided actions', () => {
    const attempted: Card = {
      id: 'attempted',
      type: 'MOUNTAIN',
      ownerId: 'bot',
    };
    const island: Card = {
      id: 'island',
      type: 'ISLAND',
      ownerId: 'human',
    };
    const cost: Card = {
      id: 'cost',
      type: 'MOUNTAIN',
      ownerId: 'human',
    };
    const state: GameState = {
      players: [
        player('bot', { hand: [attempted] }),
        player('human', { hand: [island, cost] }),
      ],
      currentPlayerId: 'bot',
      startingPlayerId: 'bot',
      turnNumber: 2,
      phase: 'MAIN',
      landPlayedThisTurn: true,
      pending: {
        kind: 'RESPONSE',
        controllerId: 'bot',
        responderId: 'human',
        remainingResponderIds: [],
        cardId: attempted.id,
        landType: attempted.type,
      },
      winnerId: null,
    };
    const onAction = vi.fn();

    render(<ResponseHarness state={state} onAction={onAction} />);
    expect(screen.getByText('Janela de resposta')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Ilha — Usar como resposta' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Montanha — Descartar e anular',
      }),
    );

    expect(onAction).toHaveBeenCalledWith({
      type: 'COUNTER_WITH_ISLAND',
      islandCardId: island.id,
      discardCardId: cost.id,
    });
  });
});
