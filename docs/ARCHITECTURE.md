# Arquitetura - MBLG Coliseu

## Princípio central

O Game Engine é a fonte única da verdade das regras.

```text
apps/
  web/
  server/

packages/
  game-engine/

docs/
infra/
```

## Game Engine

Responsável por:
- deck;
- mão;
- campo;
- cemitério;
- turnos;
- compras;
- habilidades dos terrenos;
- respostas com Ilha;
- vitória;
- RNG;
- validação das ações.

O Game Engine não deve importar React, Fastify, WebSocket, PostgreSQL ou Redis.

## Servidor

Responsável por:
- autenticação multiplayer;
- salas;
- conexões WebSocket;
- autorização;
- execução do Game Engine;
- sincronização do estado;
- persistência quando necessário.

O cliente nunca decide o resultado de uma ação.

## Frontend

Responsável por:
- interface;
- animações;
- seleção de cartas;
- envio de ações;
- apresentação do estado recebido do servidor.

O frontend não deve possuir lógica de autoridade sobre regras.

## Estado público e privado

O estado deve ser dividido em:
- estado público da partida;
- estado privado do jogador;
- informações temporariamente reveladas.

Isso é especialmente importante para Pântano e para a mão dos jogadores.

## Persistência

PostgreSQL:
- usuários;
- partidas concluídas;
- resultados;
- dados necessários para histórico.

Não é necessário persistir cada ação de uma partida em tempo real no MVP.

## Redis

Opcional no MVP.

Pode ser introduzido posteriormente para:
- presença;
- matchmaking;
- pub/sub;
- múltiplas instâncias.
