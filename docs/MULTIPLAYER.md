# Multiplayer - MBLG Coliseu

## MVP

Multiplayer em tempo real.

O multiplayer exige login.

O modo contra bot não exige login.

## Fluxo inicial

1. usuário faz login;
2. usuário entra na área multiplayer;
3. cria ou entra em uma sala;
4. o criador escolhe o modo `2P` ou `4P` e a sala recebe respectivamente dois ou quatro jogadores;
5. servidor define a ordem inicial aleatoriamente;
6. servidor cria o estado da partida;
7. jogadores recebem suas respectivas visões privadas;
8. ações são enviadas por WebSocket;
9. servidor valida e executa;
10. servidor transmite o novo estado.

## Salas

A primeira versão pode utilizar código de sala.

Matchmaking automático pode ser implementado posteriormente.

Cada sala possui `mode: "2P" | "4P"` e `maxPlayers` igual a 2 ou 4. Uma sala só
inicia quando atinge sua capacidade e todos os participantes confirmam `READY`.
O código identifica uma única sala e seu modo. Salas e transmissões são isoladas.

O modo `4P` é cada-um-por-si, sem equipes. A vitória é individual e imediata.

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
- ao término da janela, remover apenas o jogador desconectado e continuar a
  partida quando houver mais de um jogador ativo.

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
