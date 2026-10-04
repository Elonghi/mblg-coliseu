# Multiplayer - MBLG Coliseu

## MVP

Multiplayer em tempo real.

O multiplayer exige login.

O modo contra bot não exige login.

## Fluxo inicial

1. usuário faz login;
2. usuário entra na área multiplayer;
3. cria ou entra em uma sala;
4. sala recebe dois jogadores;
5. servidor define a ordem inicial aleatoriamente;
6. servidor cria o estado da partida;
7. jogadores recebem suas respectivas visões privadas;
8. ações são enviadas por WebSocket;
9. servidor valida e executa;
10. servidor transmite o novo estado.

## Salas

A primeira versão pode utilizar código de sala.

Matchmaking automático pode ser implementado posteriormente.

## WebSocket

Mensagens devem representar intenções, por exemplo:

```json
{
  "type": "PLAY_LAND",
  "cardId": "..."
}
```

ou:

```json
{
  "type": "COUNTER_WITH_ISLAND",
  "islandCardId": "...",
  "discardCardId": "..."
}
```

O cliente nunca envia o estado final da partida.

## Reconexão

Implementar suporte básico a reconexão no MVP avançado.

Sugestão inicial:
- janela de reconexão de 60 segundos;
- estado da partida mantido no servidor.

## Segurança

O servidor deve validar:
- jogador pertence à partida;
- é o turno correto;
- carta pertence à mão do jogador;
- ação é legal;
- custo da Ilha foi pago;
- condição de resposta é válida.

## Login

Login é obrigatório para multiplayer.

O sistema de autenticação deve ser simples no MVP e preparado para evolução posterior.
