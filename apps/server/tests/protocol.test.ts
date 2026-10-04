import { describe, expect, it } from 'vitest';
import {
  decodeClientMessage,
  toGameAction,
} from '../src/protocol.js';

describe('versioned WebSocket protocol', () => {
  it('decodes a client intention and associates its request id', () => {
    const result = decodeClientMessage(JSON.stringify({
      version: 1,
      type: 'game_action',
      requestId: 'request-1',
      action: { type: 'mountain_target', targetCardId: 'target-1' },
    }));

    expect(result).toEqual({
      ok: true,
      message: {
        version: 1,
        type: 'game_action',
        requestId: 'request-1',
        action: { type: 'mountain_target', targetCardId: 'target-1' },
      },
    });
    if (result.ok && result.message.type === 'game_action') {
      expect(toGameAction(result.message.action)).toEqual({
        type: 'CHOOSE_MOUNTAIN_TARGET',
        targetLandId: 'target-1',
      });
    }
  });

  it('rejects state, result and winner fields supplied by a client', () => {
    const result = decodeClientMessage(JSON.stringify({
      version: 1,
      type: 'game_action',
      requestId: 'request-2',
      action: { type: 'end_turn' },
      state: { winnerId: 'attacker' },
    }));

    expect(result).toMatchObject({ ok: false, code: 'INVALID_MESSAGE' });
  });

  it('rejects unsupported versions and malformed actions', () => {
    expect(decodeClientMessage(JSON.stringify({
      version: 2,
      type: 'ping',
      requestId: 'wrong-version',
    }))).toMatchObject({ ok: false, code: 'UNSUPPORTED_VERSION' });

    expect(decodeClientMessage(JSON.stringify({
      version: 1,
      type: 'game_action',
      requestId: 'bad-action',
      action: { type: 'play_land' },
    }))).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
  });
});
