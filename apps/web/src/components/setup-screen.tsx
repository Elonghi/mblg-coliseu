import type { DeckSize } from '@mblg-coliseu/game-engine';

interface SetupScreenProps {
  readonly deckSize: DeckSize;
  readonly onDeckSizeChange: (size: DeckSize) => void;
  readonly onStart: () => void;
  readonly onMultiplayer: () => void;
}

export function SetupScreen({
  deckSize,
  onDeckSizeChange,
  onStart,
  onMultiplayer,
}: SetupScreenProps) {
  return (
    <main className="setup-screen">
      <div className="setup-glow" aria-hidden="true" />
      <section className="setup-panel">
        <p className="eyebrow">Jogo estratégico de terrenos</p>
        <h1>MBLG <span>Coliseu</span></h1>
        <p className="setup-copy">
          Reúna os cinco tipos de terreno ou domine o campo com cinco terrenos
          iguais antes do Bot.
        </p>

        <fieldset className="deck-picker">
          <legend>Escolha o tamanho do deck</legend>
          {([25, 50] as const).map((size) => (
            <label
              key={size}
              className={deckSize === size ? 'deck-option selected' : 'deck-option'}
            >
              <input
                type="radio"
                name="deck-size"
                value={size}
                checked={deckSize === size}
                onChange={() => {
                  onDeckSizeChange(size);
                }}
              />
              <strong>{size}</strong>
              <span>cartas</span>
              <small>{size / 5} de cada terreno</small>
            </label>
          ))}
        </fieldset>

        <button type="button" className="primary-button" onClick={onStart}>
          Jogar contra Bot
        </button>
        <button type="button" className="secondary-button setup-multiplayer-button" onClick={onMultiplayer}>
          Multiplayer
        </button>
        <p className="local-note">Partida local · nenhum login necessário</p>
      </section>
    </main>
  );
}
