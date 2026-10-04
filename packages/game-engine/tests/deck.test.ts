import { describe, expect, it, vi } from 'vitest';
import { createDeck, LAND_TYPES, shuffle } from '../src/index.js';
import { sequenceRng, zeroRng } from './helpers.js';

describe('deck construction and RNG', () => {
  it.each([25, 50] as const)('creates a %i-card deck with equal land counts', (size) => {
    const deck = createDeck('p1', size, zeroRng);

    expect(deck).toHaveLength(size);
    for (const type of LAND_TYPES) {
      expect(deck.filter((card) => card.type === type)).toHaveLength(size / 5);
    }
    expect(new Set(deck.map((card) => card.id)).size).toBe(size);
    expect(deck.every((card) => card.ownerId === 'p1')).toBe(true);
  });

  it('uses the injected RNG to shuffle', () => {
    const next = vi.fn(() => 0);
    const shuffled = shuffle([1, 2, 3, 4], { next });

    expect(next).toHaveBeenCalledTimes(3);
    expect(shuffled).toEqual([2, 3, 4, 1]);
  });

  it('supports deterministic RNG sequences', () => {
    expect(shuffle([1, 2, 3], sequenceRng([0.9, 0]))).toEqual([2, 1, 3]);
  });

  it('rejects invalid RNG values', () => {
    expect(() => shuffle([1, 2], { next: () => 1 })).toThrow(RangeError);
  });

  it('rejects unsupported deck sizes at runtime', () => {
    expect(() => createDeck('p1', 30 as never, zeroRng)).toThrow(
      'Deck size must be exactly 25 or 50 cards.',
    );
  });
});
