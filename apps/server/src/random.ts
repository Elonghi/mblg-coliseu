import { randomInt } from 'node:crypto';
import type { RandomSource } from '@mblg-coliseu/game-engine';

export class CryptoRandomSource implements RandomSource {
  next(): number {
    return randomInt(0, 0x1_0000_0000) / 0x1_0000_0000;
  }
}
