import type { RandomSource } from './types.js';

export function randomIndex(rng: RandomSource, length: number): number {
  const value = rng.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('RNG must return a finite number in the range [0, 1).');
  }
  return Math.floor(value * length);
}

export function shuffle<T>(items: readonly T[], rng: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(rng, index + 1);
    const current = result[index];
    const other = result[swapIndex];
    if (current === undefined || other === undefined) {
      throw new Error('Shuffle index was unexpectedly out of bounds.');
    }
    result[index] = other;
    result[swapIndex] = current;
  }
  return result;
}
