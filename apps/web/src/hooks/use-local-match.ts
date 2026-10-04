import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DeckSize,
  GameAction,
  GameState,
  RandomSource,
} from '@mblg-coliseu/game-engine';
import {
  BrowserRandomSource,
  HUMAN_PLAYER_ID,
  automatedAction,
  createLocalMatch,
  executeLocalAction,
  noticeForAcceptedAction,
  snapshotForHuman,
} from '../game/local-match.js';
import type { MatchNotice } from '../game/local-match.js';

export interface LocalMatchController {
  readonly view: ReturnType<typeof snapshotForHuman>['humanView'];
  readonly legalActions: readonly GameAction[];
  readonly automatedActorId: string | null;
  readonly notices: readonly MatchNotice[];
  readonly error: string | null;
  readonly perform: (action: GameAction) => void;
}

export function useLocalMatch(
  deckSize: DeckSize,
  providedRng?: RandomSource,
): LocalMatchController {
  const [rng] = useState<RandomSource>(
    () => providedRng ?? new BrowserRandomSource(),
  );
  const [state, setState] = useState(() =>
    createLocalMatch(deckSize, rng),
  );
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<readonly MatchNotice[]>([]);
  const snapshot = useMemo(() => snapshotForHuman(state), [state]);
  const automated = useMemo(() => automatedAction(state), [state]);

  const execute = useCallback(
    (actorId: string, action: GameAction, expectedState?: GameState) => {
      setState((current) => {
        if (expectedState !== undefined && current !== expectedState) {
          return current;
        }
        const result = executeLocalAction(
          current,
          actorId,
          action,
          rng,
        );
        if (!result.ok) {
          setError(result.error.message);
          return current;
        }
        setError(null);
        setNotices((existing) => {
          const noticeId = [
            current.turnNumber,
            actorId,
            action.type,
            current.pending?.kind ?? 'none',
          ].join(':');
          const notice = noticeForAcceptedAction(
            current,
            actorId,
            action,
            noticeId,
          );
          if (notice === null || existing.some((item) => item.id === notice.id)) {
            return existing;
          }
          return [...existing, notice].slice(-4);
        });
        return result.state;
      });
    },
    [rng],
  );

  const perform = useCallback(
    (action: GameAction) => {
      execute(HUMAN_PLAYER_ID, action);
    },
    [execute],
  );

  useEffect(() => {
    if (automated === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      execute(automated.actorId, automated.action, state);
    }, automated.actorId === HUMAN_PLAYER_ID ? 180 : 480);

    return () => {
      window.clearTimeout(timer);
    };
  }, [automated, execute, state]);

  return {
    view: snapshot.humanView,
    legalActions: snapshot.humanActions,
    automatedActorId: automated?.actorId ?? null,
    notices,
    error,
    perform,
  };
}
