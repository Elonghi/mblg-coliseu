# Bot - MBLG Coliseu

## MVP

O jogo contra bot não exige login.

Inicialmente haverá somente um nível de dificuldade.

O bot deve usar exatamente o mesmo Game Engine utilizado no multiplayer.

## Regras de informação

O bot não recebe informações que um jogador humano não receberia.

O bot pode conhecer:
- seu próprio estado;
- informações públicas;
- cartas reveladas por efeitos.

O bot não deve acessar diretamente a mão privada do jogador humano.

## Estratégia inicial

O primeiro bot pode utilizar heurísticas simples, por exemplo:
1. verificar se pode vencer;
2. priorizar ações que aproximem da vitória;
3. usar Montanha contra terreno relevante;
4. usar Pântano quando a mão adversária for relevante para a decisão;
5. recuperar terreno com Floresta quando isso gerar progresso;
6. usar Ilha de resposta quando a anulação tiver valor;
7. usar a habilidade própria da Ilha para melhorar o topo do deck.

Não utilizar machine learning no MVP.
