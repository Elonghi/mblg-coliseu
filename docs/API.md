# API e contratos - MBLG Coliseu

## Princípio

O backend é autoritativo.

A API HTTP pode cuidar de:
- autenticação;
- usuários;
- criação/entrada em salas;
- informações auxiliares.

WebSocket cuida da partida em tempo real.

## Ações do jogo

As ações devem ser comandos, não estados.

Exemplos:

```json
{
  "type": "DRAW"
}
```

```json
{
  "type": "PLAY_LAND",
  "cardId": "card-123"
}
```

```json
{
  "type": "CHOOSE_MOUNTAIN_TARGET",
  "targetLandId": "land-456"
}
```

```json
{
  "type": "CHOOSE_SWAMP_DISCARD",
  "targetCardId": "card-789"
}
```

```json
{
  "type": "CHOOSE_FOREST_RECOVERY",
  "targetCardId": "card-999"
}
```

```json
{
  "type": "COUNTER_WITH_ISLAND",
  "islandCardId": "card-111",
  "discardCardId": "card-222"
}
```

Os contratos finais devem ser tipados em TypeScript.
