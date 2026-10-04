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

### Montanha
- destrói terreno;
- alvo vai para cemitério;
- habilidade do terreno destruído não é executada.

### Planície
- compra uma carta;
- recicla o próprio cemitério quando necessário.

### Pântano
- revela a mão adversária apenas para o jogador correto;
- controlador do Pântano escolhe o descarte;
- carta descartada vai para o cemitério.

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

## RNG

Todos os testes críticos de deck e Ilha devem permitir RNG determinístico.
