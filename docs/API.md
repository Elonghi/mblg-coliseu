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

## Salas realtime

O protocolo WebSocket v2 cria salas com modo explícito:

```json
{
  "version": 2,
  "type": "create_room",
  "requestId": "uuid",
  "deckSize": 25,
  "mode": "4P"
}
```

As mensagens de lobby incluem `mode`, `maxPlayers`, `playerIds`,
`readyPlayerIds` e `status`.

No modo `4P`, o Pântano possui a intenção intermediária:

```json
{
  "type": "CHOOSE_SWAMP_TARGET",
  "targetPlayerId": "player-3"
}
```
