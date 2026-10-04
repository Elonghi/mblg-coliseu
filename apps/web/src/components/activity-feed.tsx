import { BOT_PLAYER_ID } from '../game/local-match.js';
import type { MatchNotice } from '../game/local-match.js';
import { LAND_PRESENTATION } from './land-card.js';

interface ActivityFeedProps {
  readonly notices: readonly MatchNotice[];
}

function noticeCopy(notice: MatchNotice): {
  readonly title: string;
  readonly detail: string;
} {
  const actor = notice.actorId === BOT_PLAYER_ID ? 'O Bot' : 'Você';
  const owner = notice.actorId === BOT_PLAYER_ID ? 'seu' : 'do Bot';
  const landName = LAND_PRESENTATION[notice.card.type].name;

  if (notice.kind === 'COUNTERED') {
    return {
      title: `${actor} anulou um terreno ${owner}`,
      detail: `${landName} agora está no cemitério.`,
    };
  }

  return {
    title: `${actor} recuperou do cemitério`,
    detail: `${landName} voltou para a mão.`,
  };
}

export function ActivityFeed({ notices }: ActivityFeedProps) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <aside
      className="activity-feed"
      role="log"
      aria-live="polite"
      aria-label="Eventos recentes da partida"
    >
      {[...notices].reverse().slice(0, 3).map((notice) => {
        const copy = noticeCopy(notice);
        const presentation = LAND_PRESENTATION[notice.card.type];
        return (
          <article
            className={`activity-notice activity-notice--${notice.kind.toLowerCase()}`}
            key={notice.id}
          >
            <span className="activity-notice__symbol" aria-hidden="true">
              {presentation.symbol}
            </span>
            <span className="activity-notice__copy">
              <strong>{copy.title}</strong>
              <small>{copy.detail}</small>
            </span>
          </article>
        );
      })}
    </aside>
  );
}
