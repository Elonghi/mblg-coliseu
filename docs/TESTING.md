# Testes - MBLG Coliseu

## Game Engine

Cobrir no mínimo:

### Deck
- 25 cartas;
- 50 cartas;
- quantidades corretas por tipo;
- embaralhamento;
- reciclagem do cemitério.

### Mão
- 5 cartas iniciais;
- ausência de mulligan;
- ausência de limite de mão.

### Turnos
- jogador inicial não compra no primeiro turno;
- segundo jogador compra;
- compra normal nos turnos seguintes;
- um terreno por turno.
- ordem cíclica com quatro jogadores;
- somente o jogador inicial pula a primeira compra.

### Montanha
- destrói terreno;
- alvo vai para cemitério;
- habilidade do terreno destruído não é executada.
- escolha de alvo entre qualquer adversário em `4P`.

### Planície
- compra uma carta;
- recicla o próprio cemitério quando necessário.

### Pântano
- revela a mão adversária apenas para o jogador correto;
- controlador do Pântano escolhe o descarte;
- carta descartada vai para o cemitério.
- escolha do adversário em `4P` sem revelar as outras mãos.

### Floresta
- recupera terreno próprio do cemitério para a mão.

### Ilha
- olha o topo;
- mantém no topo ou coloca no fundo;
- pode responder ao terreno adversário;
- exige descarte do mesmo tipo;
- Ilha entra em campo;
- terreno anulado vai para o cemitério;
- habilidade do terreno anulado não executa;
- não permite cadeia de respostas.
- prioridade sequencial de resposta em `4P` e encerramento na primeira anulação.

### Vitória
- 5 tipos diferentes;
- 5 do mesmo tipo;
- terrenos adicionais não impedem vitória.

## Multiplayer

Testar:
- isolamento de mãos;
- informações reveladas;
- validação de turno;
- ações ilegais;
- ações de outro jogador;
- reconexão;
- sincronização.
- capacidade, READY, início, vitória e reconexão separados para `2P` e `4P`;
- rejeição do terceiro jogador em `2P` e do quinto em `4P`;
- remoção por desconexão sem encerrar uma partida `4P` ainda disputada;
- isolamento integral entre salas de modos diferentes;
- partidas completas por WebSocket nos dois modos.

## RNG

Todos os testes críticos de deck e Ilha devem permitir RNG determinístico.
