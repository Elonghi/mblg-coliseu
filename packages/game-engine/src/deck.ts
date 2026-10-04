import { LAND_TYPES } from './types.js';
import type { Card, DeckSize, PlayerId, RandomSource } from './types.js';
import { shuffle } from './rng.js';

function isSupportedDeckSize(value: unknown): value is DeckSize {
  return value === 25 || value === 50;
}

export function createDeck(
  ownerId: PlayerId,
  deckSize: DeckSize,
  rng: RandomSource,
): Card[] {
  if (!isSupportedDeckSize(deckSize)) {
    throw new RangeError('Deck size must be exactly 25 or 50 cards.');
  }
  const copiesPerType = deckSize / LAND_TYPES.length;
  const cards = LAND_TYPES.flatMap((type) =>
    Array.from({ length: copiesPerType }, (_, index) => ({
      id: `${ownerId}-${type.toLowerCase()}-${String(index + 1)}`,
      type,
      ownerId,
    })),
  );
  return shuffle(cards, rng);
}
