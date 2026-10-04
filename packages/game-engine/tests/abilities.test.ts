import { describe, expect, it } from 'vitest';
import { applyAction, getPlayerView } from '../src/index.js';
import type { Card, GameState } from '../src/index.js';
import {
  card,
  gameState,
  playerOf,
  playerState,
  stateOf,
  zeroRng,
} from './helpers.js';

function playAndPass(state: GameState, land: Card): GameState {
  const pending = stateOf(
    applyAction(
      state,
      state.currentPlayerId,
      { type: 'PLAY_LAND', cardId: land.id },
      zeroRng,
    ),
  );
  const responder = pending.players.find(
    (player) => player.id !== state.currentPlayerId,
  );
  if (responder === undefined) throw new Error('Missing responder');
  return stateOf(
    applyAction(pending, responder.id, { type: 'PASS_RESPONSE' }, zeroRng),
  );
}

describe('land abilities', () => {
  it('Mountain destroys one opposing land and sends it to its owner graveyard', () => {
    const mountain = card('mountain', 'MOUNTAIN', 'p1');
    const target = card('target', 'ISLAND', 'p2');
    const initial = gameState(
      playerState('p1', { hand: [mountain] }),
      playerState('p2', { field: [target] }),
    );
    const choosing = playAndPass(initial, mountain);

    expect(choosing.pending?.kind).toBe('MOUNTAIN_TARGET');
    expect(playerOf(choosing, 'p1').field).toEqual([mountain]);

    const resolved = stateOf(
      applyAction(
        choosing,
        'p1',
        { type: 'CHOOSE_MOUNTAIN_TARGET', targetLandId: target.id },
        zeroRng,
      ),
    );
    expect(playerOf(resolved, 'p2').field).toEqual([]);
    expect(playerOf(resolved, 'p2').graveyard).toEqual([target]);
  });

  it('Mountain rejects a target outside the opponent field', () => {
    const mountain = card('mountain', 'MOUNTAIN', 'p1');
    const ownLand = card('own', 'ISLAND', 'p1');
    const opposingLand = card('opposing', 'FOREST', 'p2');
    const choosing = playAndPass(
      gameState(
        playerState('p1', { hand: [mountain], field: [ownLand] }),
        playerState('p2', { field: [opposingLand] }),
      ),
      mountain,
    );
    const result = applyAction(
      choosing,
      'p1',
      { type: 'CHOOSE_MOUNTAIN_TARGET', targetLandId: ownLand.id },
      zeroRng,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_TARGET');
  });

  it('does not execute an ability when Mountain destroys an existing land', () => {
    const mountain = card('mountain', 'MOUNTAIN', 'p1');
    const plains = card('existing-plains', 'PLAINS', 'p2');
    const deckTop = card('untouched-top', 'SWAMP', 'p2');
    const choosing = playAndPass(
      gameState(
        playerState('p1', { hand: [mountain] }),
        playerState('p2', { field: [plains], deck: [deckTop] }),
      ),
      mountain,
    );
    const resolved = stateOf(
      applyAction(
        choosing,
        'p1',
        { type: 'CHOOSE_MOUNTAIN_TARGET', targetLandId: plains.id },
        zeroRng,
      ),
    );

    expect(playerOf(resolved, 'p2').hand).toEqual([]);
    expect(playerOf(resolved, 'p2').deck).toEqual([deckTop]);
    expect(playerOf(resolved, 'p2').graveyard).toEqual([plains]);
  });

  it('Plains draws one card and remains on the field', () => {
    const plains = card('plains', 'PLAINS', 'p1');
    const top = card('top', 'SWAMP', 'p1');
    const resolved = playAndPass(
      gameState(
        playerState('p1', { hand: [plains], deck: [top] }),
        playerState('p2'),
      ),
      plains,
    );

    expect(playerOf(resolved, 'p1').field).toEqual([plains]);
    expect(playerOf(resolved, 'p1').hand).toEqual([top]);
  });

  it('Plains recycles its controller graveyard before drawing when needed', () => {
    const plains = card('plains', 'PLAINS', 'p1');
    const discarded = card('discarded', 'MOUNTAIN', 'p1');
    const resolved = playAndPass(
      gameState(
        playerState('p1', { hand: [plains], graveyard: [discarded] }),
        playerState('p2'),
      ),
      plains,
    );

    expect(playerOf(resolved, 'p1').hand).toEqual([discarded]);
    expect(playerOf(resolved, 'p1').graveyard).toEqual([]);
  });

  it('Swamp reveals only the opponent hand to its controller, who chooses the discard', () => {
    const swamp = card('swamp', 'SWAMP', 'p1');
    const first = card('first', 'MOUNTAIN', 'p2');
    const second = card('second', 'ISLAND', 'p2');
    const choosing = playAndPass(
      gameState(
        playerState('p1', { hand: [swamp] }),
        playerState('p2', { hand: [first, second] }),
      ),
      swamp,
    );

    expect(getPlayerView(choosing, 'p1').privateState.revealedOpponentHand).toEqual([
      first,
      second,
    ]);
    expect(getPlayerView(choosing, 'p2').privateState.revealedOpponentHand).toBeNull();

    const wrongActor = applyAction(
      choosing,
      'p2',
      { type: 'CHOOSE_SWAMP_DISCARD', targetCardId: first.id },
      zeroRng,
    );
    expect(wrongActor.ok).toBe(false);

    const resolved = stateOf(
      applyAction(
        choosing,
        'p1',
        { type: 'CHOOSE_SWAMP_DISCARD', targetCardId: second.id },
        zeroRng,
      ),
    );
    expect(playerOf(resolved, 'p2').hand).toEqual([first]);
    expect(playerOf(resolved, 'p2').graveyard).toEqual([second]);
    expect(getPlayerView(resolved, 'p1').privateState.revealedOpponentHand).toBeNull();
  });

  it('Forest optionally recovers one land from its controller graveyard', () => {
    const forest = card('forest', 'FOREST', 'p1');
    const recoverable = card('recoverable', 'PLAINS', 'p1');
    const choosing = playAndPass(
      gameState(
        playerState('p1', { hand: [forest], graveyard: [recoverable] }),
        playerState('p2'),
      ),
      forest,
    );
    const recovered = stateOf(
      applyAction(
        choosing,
        'p1',
        { type: 'CHOOSE_FOREST_RECOVERY', targetCardId: recoverable.id },
        zeroRng,
      ),
    );

    expect(playerOf(recovered, 'p1').hand).toEqual([recoverable]);
    expect(playerOf(recovered, 'p1').graveyard).toEqual([]);
  });

  it('Forest can skip its optional recovery', () => {
    const forest = card('forest', 'FOREST', 'p1');
    const recoverable = card('recoverable', 'PLAINS', 'p1');
    const choosing = playAndPass(
      gameState(
        playerState('p1', { hand: [forest], graveyard: [recoverable] }),
        playerState('p2'),
      ),
      forest,
    );
    const skipped = stateOf(
      applyAction(choosing, 'p1', { type: 'SKIP_FOREST_RECOVERY' }, zeroRng),
    );
    expect(playerOf(skipped, 'p1').graveyard).toEqual([recoverable]);
  });

  it('Island privately shows the top card and can keep it there', () => {
    const island = card('island', 'ISLAND', 'p1');
    const top = card('top', 'MOUNTAIN', 'p1');
    const bottom = card('bottom', 'PLAINS', 'p1');
    const choosing = playAndPass(
      gameState(
        playerState('p1', { hand: [island], deck: [top, bottom] }),
        playerState('p2'),
      ),
      island,
    );

    expect(getPlayerView(choosing, 'p1').privateState.deckTop).toEqual(top);
    expect(getPlayerView(choosing, 'p2').privateState.deckTop).toBeNull();
    const kept = stateOf(
      applyAction(
        choosing,
        'p1',
        { type: 'CHOOSE_ISLAND_TOP', placement: 'TOP' },
        zeroRng,
      ),
    );
    expect(playerOf(kept, 'p1').deck).toEqual([top, bottom]);
    expect(playerOf(kept, 'p1').hand).toEqual([]);
  });

  it('Island can put the looked-at top card on the bottom without drawing it', () => {
    const island = card('island', 'ISLAND', 'p1');
    const top = card('top', 'MOUNTAIN', 'p1');
    const bottom = card('bottom', 'PLAINS', 'p1');
    const choosing = playAndPass(
      gameState(
        playerState('p1', { hand: [island], deck: [top, bottom] }),
        playerState('p2'),
      ),
      island,
    );
    const moved = stateOf(
      applyAction(
        choosing,
        'p1',
        { type: 'CHOOSE_ISLAND_TOP', placement: 'BOTTOM' },
        zeroRng,
      ),
    );
    expect(playerOf(moved, 'p1').deck).toEqual([bottom, top]);
    expect(playerOf(moved, 'p1').hand).toEqual([]);
  });
});
