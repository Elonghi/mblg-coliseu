import { useEffect, useState } from 'react';
import type { DeckSize } from '@mblg-coliseu/game-engine';
import { GameScreen } from './components/game-screen.js';
import { MultiplayerScreen } from './components/multiplayer-screen.js';
import { RealtimeGameScreen } from './components/realtime-game-screen.js';
import { SetupScreen } from './components/setup-screen.js';
import {
  MultiplayerProvider,
  useMultiplayer,
} from './multiplayer/multiplayer-context.js';

export function App() {
  return (
    <MultiplayerProvider>
      <AppContent />
    </MultiplayerProvider>
  );
}

function AppContent() {
  const [deckSize, setDeckSize] = useState<DeckSize>(25);
  const [matchNumber, setMatchNumber] = useState<number | null>(null);
  const [section, setSection] = useState<'home' | 'local' | 'multiplayer'>(() =>
    window.location.pathname.startsWith('/multiplayer') ||
      window.location.pathname.startsWith('/game/')
      ? 'multiplayer'
      : 'home',
  );
  const multiplayer = useMultiplayer();

  useEffect(() => {
    const handlePopState = () => {
      setSection(window.location.pathname === '/' ? 'home' : 'multiplayer');
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  if (multiplayer.page === 'game') return <RealtimeGameScreen />;

  if (section === 'multiplayer') {
    return (
      <MultiplayerScreen
        onHome={() => {
          if (multiplayer.credentials !== null) multiplayer.leaveRoom();
          window.history.pushState({}, '', '/');
          setSection('home');
        }}
      />
    );
  }

  if (section === 'home' || matchNumber === null) {
    return (
      <SetupScreen
        deckSize={deckSize}
        onDeckSizeChange={setDeckSize}
        onStart={() => {
          setSection('local');
          setMatchNumber(1);
        }}
        onMultiplayer={() => {
          window.history.pushState({}, '', '/multiplayer');
          setSection('multiplayer');
        }}
      />
    );
  }

  return (
    <GameScreen
      key={matchNumber}
      deckSize={deckSize}
      onNewMatch={() => {
        setMatchNumber((current) => (current ?? 0) + 1);
      }}
      onHome={() => {
        setSection('home');
        setMatchNumber(null);
      }}
    />
  );
}
