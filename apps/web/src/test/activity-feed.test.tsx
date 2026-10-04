import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { MatchNotice } from '../game/local-match.js';
import { ActivityFeed } from '../components/activity-feed.js';

afterEach(cleanup);

describe('ActivityFeed', () => {
  it('shows which human land the Bot countered', () => {
    const notices: MatchNotice[] = [
      {
        id: 'countered',
        kind: 'COUNTERED',
        actorId: 'bot',
        card: { id: 'mountain-1', type: 'MOUNTAIN', ownerId: 'human' },
      },
    ];

    const { getByRole } = render(<ActivityFeed notices={notices} />);

    expect(getByRole('log')).toHaveTextContent(
      'O Bot anulou um terreno seu',
    );
    expect(getByRole('log')).toHaveTextContent(
      'Montanha agora está no cemitério.',
    );
  });

  it('shows which land the Bot recovered with Forest', () => {
    const notices: MatchNotice[] = [
      {
        id: 'recovered',
        kind: 'RECOVERED',
        actorId: 'bot',
        card: { id: 'island-1', type: 'ISLAND', ownerId: 'bot' },
      },
    ];

    const { getByRole } = render(<ActivityFeed notices={notices} />);

    expect(getByRole('log')).toHaveTextContent(
      'O Bot recuperou do cemitério',
    );
    expect(getByRole('log')).toHaveTextContent(
      'Ilha voltou para a mão.',
    );
  });

  it('renders only the three most recent notices', () => {
    const notices: MatchNotice[] = ['1', '2', '3', '4'].map((id) => ({
      id,
      kind: 'RECOVERED',
      actorId: 'human',
      card: { id: `forest-${id}`, type: 'FOREST', ownerId: 'human' },
    }));

    const { getAllByRole } = render(<ActivityFeed notices={notices} />);

    expect(getAllByRole('article')).toHaveLength(3);
  });
});
