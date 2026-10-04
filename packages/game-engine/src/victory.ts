import { LAND_TYPES } from './types.js';
import type { PlayerState } from './types.js';

export function hasWon(player: PlayerState): boolean {
  const counts = new Map(LAND_TYPES.map((type) => [type, 0]));
  for (const card of player.field) {
    counts.set(card.type, (counts.get(card.type) ?? 0) + 1);
  }
  const hasAllTypes = LAND_TYPES.every((type) => (counts.get(type) ?? 0) >= 1);
  const hasFiveOfOneType = LAND_TYPES.some(
    (type) => (counts.get(type) ?? 0) >= 5,
  );
  return hasAllTypes || hasFiveOfOneType;
}
