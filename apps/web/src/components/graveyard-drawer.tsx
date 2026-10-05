import { useEffect, useRef } from 'react';
import type { Card } from '@mblg-coliseu/game-engine';
import { CardZone } from './card-zone.js';

interface GraveyardDrawerProps {
  readonly label: string;
  readonly title: string;
  readonly cards: readonly Card[];
  readonly openWhenActive?: boolean;
}

export function GraveyardDrawer({
  label,
  title,
  cards,
  openWhenActive = false,
}: GraveyardDrawerProps) {
  const drawerRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (openWhenActive && drawerRef.current !== null) {
      drawerRef.current.open = true;
    }
  }, [openWhenActive]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const drawer = drawerRef.current;
      const target = event.target;
      if (
        drawer !== null &&
        drawer.open &&
        target instanceof Node &&
        !drawer.contains(target)
      ) {
        drawer.open = false;
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, []);

  return (
    <details
      ref={drawerRef}
      className="graveyard-drawer"
      data-testid="graveyard-drawer"
    >
      <summary>{label} · {cards.length}</summary>
      <CardZone title={title} cards={cards} compact />
    </details>
  );
}
