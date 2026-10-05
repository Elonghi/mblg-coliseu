# Regras do jogo - MBLG Coliseu

## 1. Objetivo

O primeiro jogador que cumprir uma das condições abaixo vence imediatamente:

- possuir pelo menos uma Montanha, Ilha, Pântano, Floresta e Planície em campo;
- possuir 5 terrenos do mesmo tipo em campo.

Não existe limite máximo de terrenos em campo.

## 2. Baralho

Existem dois tamanhos de baralho:

### 25 cartas
- 5 Montanhas
- 5 Ilhas
- 5 Pântanos
- 5 Florestas
- 5 Planícies

### 50 cartas
- 10 Montanhas
- 10 Ilhas
- 10 Pântanos
- 10 Florestas
- 10 Planícies

## 3. Mão inicial

Cada jogador começa com **5 cartas na mão**.

Não existe mulligan.

## 4. Início da partida

A ordem dos jogadores é definida aleatoriamente.

Uma partida pode ter 2 jogadores (`2P`) ou 4 jogadores (`4P`). No modo `4P`, a
disputa é individual, sem equipes, e os turnos seguem ciclicamente pela ordem da
partida.

O jogador inicial não compra uma carta no primeiro turno.

Os demais jogadores compram normalmente no próprio primeiro turno.

A partir daí, cada jogador compra uma carta no início do próprio turno.

## 5. Terrenos por turno

Normalmente, cada jogador pode baixar somente **1 terreno por turno**.

A Ilha possui uma exceção específica: ela pode ser baixada durante o turno do adversário como resposta/anulação de um terreno.

Quando a Ilha é utilizada dessa forma, ela permanece em campo.

## 6. Montanha

Ao baixar uma Montanha no próprio turno:

- o jogador escolhe 1 terreno de qualquer adversário;
- esse terreno é destruído;
- o terreno destruído vai para o cemitério/trash do proprietário.

A Montanha baixada permanece em campo.

## 7. Planície

Ao baixar uma Planície:

- o jogador compra 1 carta.

Se não houver carta suficiente no deck para realizar a compra:

- o cemitério/trash do próprio jogador é embaralhado;
- essas cartas voltam para o deck;
- a compra é realizada.

A Planície permanece em campo.

## 8. Pântano

Ao baixar um Pântano:

- em `4P`, o controlador escolhe primeiro um adversário;
- o adversário escolhido revela sua mão ao jogador que baixou o Pântano;
- o jogador que baixou o Pântano escolhe 1 carta da mão do adversário;
- a carta escolhida vai para o cemitério/trash do proprietário.

A decisão sobre qual carta será descartada pertence ao controlador do Pântano, não ao adversário.

A Planície não possui relação com essa habilidade.

## 9. Floresta

Ao baixar uma Floresta:

- o jogador pode recuperar 1 terreno do próprio cemitério/trash;
- o terreno escolhido volta para a mão do jogador.

A Floresta permanece em campo.

## 10. Ilha

A Ilha possui duas funções.

### 10.1 Ilha no próprio turno

Ao baixar uma Ilha no próprio turno:

1. o jogador olha a carta do topo do próprio deck;
2. decide se mantém a carta no topo;
3. ou coloca a carta no fundo do deck.

A carta não é comprada pela habilidade.

A Ilha permanece em campo.

### 10.2 Ilha durante o turno do adversário

Quando um adversário tenta baixar um terreno:

1. o jogador pode responder baixando uma Ilha;
2. para utilizar a resposta, deve descartar da própria mão uma carta do mesmo tipo do terreno que está sendo anulado;
3. a Ilha entra em campo;
4. o terreno adversário é anulado;
5. o terreno adversário vai para o cemitério/trash do proprietário;
6. o terreno adversário não entra em campo e sua habilidade de entrada não é executada.

Exemplo:

O adversário tenta baixar uma Montanha.

O jogador responde com uma Ilha e descarta uma Montanha da própria mão.

Resultado:
- a Ilha fica em campo;
- a Montanha adversária vai para o cemitério;
- a habilidade da Montanha não acontece.

A Ilha pode anular qualquer um dos cinco tipos de terreno, desde que o jogador tenha na mão uma carta do mesmo tipo para descartar.

## 11. Resposta com Ilha e limite de ações

Uma Ilha utilizada como resposta conta como a exceção à regra de um terreno por turno.

Em `4P`, cada adversário recebe a oportunidade de responder, seguindo a ordem
cíclica dos turnos a partir do controlador do terreno. A primeira resposta válida
com Ilha anula o terreno e encerra a janela. Se todos passarem, o terreno resolve.

Não existe cadeia de múltiplas Ilhas para a mesma ação: depois da primeira
anulação aceita, nenhum outro jogador pode responder.

Depois que o terreno é anulado, a ação termina.

## 12. Cemitério / Trash

Cada jogador possui seu próprio cemitério/trash.

Cartas destruídas ou descartadas vão para o cemitério/trash de seu proprietário.

A Planície pode embaralhar o próprio cemitério de volta ao deck quando necessário para realizar uma compra.

## 13. Compra

A compra normal acontece no início do turno, seguindo a regra de que o jogador inicial não compra no primeiro turno.

Efeitos que exigem compra seguem a regra de reciclagem do cemitério quando não houver cartas disponíveis no deck.

## 14. Mão

Não existe limite máximo de cartas na mão.

## 15. Campo

O campo possui capacidade infinita para o MVP.

## 16. Vitória

A condição de vitória é verificada após ações que podem alterar o campo.

O jogador vence ao atingir qualquer uma das condições:

- 5 tipos diferentes de terreno;
- 5 terrenos do mesmo tipo.

Ter terrenos adicionais não impede a vitória.

## 17. Empate

Não existe regra especial de empate no MVP.

O servidor deve processar ações em ordem determinística.

## 18. Deck vazio

Para efeitos de compra, se o deck estiver vazio, o jogo tenta reciclar o cemitério do próprio jogador.

Se deck e cemitério estiverem ambos vazios, não existe carta disponível para comprar.

O comportamento final dessa situação deve ser tratado pelo Game Engine como estado de jogo explicitamente testado. A implementação inicial deve evitar criar cartas ou alterar o conteúdo do jogo.

## 19. Informações privadas

O jogador só pode visualizar:
- sua própria mão;
- cartas públicas;
- cartas reveladas por efeitos.

Os adversários não podem receber a mão privada do jogador, exceto durante a
resolução do Pântano, quando somente a mão do alvo escolhido é revelada ao
jogador que ativou o efeito.

## 21. Remoção de jogador no multiplayer

Quando o prazo de reconexão termina, somente o jogador desconectado é removido.
No modo `4P`, a partida continua com os jogadores restantes. Se restar somente
um jogador, ele é o vencedor. Se o removido era o jogador ativo ou tinha a
prioridade de resposta da Ilha, a vez/prioridade avança ao próximo jogador ativo.

No multiplayer, o servidor deve enviar visões diferentes do estado para cada jogador.

## 20. RNG

Embaralhamento e aleatoriedade devem utilizar uma abstração de RNG.

Testes devem poder fornecer RNG determinístico.
