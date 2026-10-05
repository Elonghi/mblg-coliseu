# MBLG Coliseu

Especificação inicial do jogo de cartas MBLG Coliseu.

## Modos
- Bot, sem login.
- Multiplayer em tempo real, com login.

## Objetivo
Vence o primeiro jogador que:
1. tiver os 5 tipos diferentes de terreno em campo; ou
2. tiver 5 terrenos do mesmo tipo em campo.

## Tipos de terreno
- Montanha
- Ilha
- Pântano
- Floresta
- Planície

## Baralhos
- 25 cartas: 5 de cada tipo.
- 50 cartas: 10 de cada tipo.

Consulte `docs/GAME_RULES.md` para as regras completas.

## Desenvolvimento local

Em terminais separados, inicie o servidor e o frontend:

```bash
cd packages/game-engine && npm ci && npm run build
cd ../../packages/bot && npm ci && npm run build
cd ../../apps/server && npm ci && npm run dev
```

```bash
cd apps/web
npm ci
npm run dev -- --host 0.0.0.0
```

Abra `http://localhost:5173`. Em outro dispositivo da mesma rede, substitua
`localhost` pelo IP local do computador.

## Publicação no Render

O arquivo `render.yaml` provisiona:

- `mblg-coliseu-server-elonghi`: servidor Node.js/Fastify e WebSocket;
- `mblg-coliseu-web-elonghi`: frontend React estático;
- conexão segura do frontend com `wss://mblg-coliseu-server-elonghi.onrender.com/ws`;
- rewrite de SPA para que a navegação carregue `index.html`.

Depois de enviar o repositório ao GitHub, use o link abaixo e confirme a criação
dos dois serviços:

[Criar Blueprint no Render](https://dashboard.render.com/blueprint/new?repo=https%3A%2F%2Fgithub.com%2FElonghi%2Fmblg-coliseu)

O plano gratuito está configurado para a primeira publicação. Se o Render
alterar o nome ou a URL pública do servidor, atualize `VITE_WS_URL` no serviço
web com a URL `wss://<host-do-servidor>/ws` e execute um novo deploy do frontend.

> O servidor ainda mantém salas e partidas somente em memória. No plano
> gratuito, ele pode hibernar por inatividade ou reiniciar; nesses casos,
> partidas em andamento são perdidas. Para uso público estável, altere o plano
> do servidor para uma instância paga antes de divulgar amplamente.

## Publicação no Coolify

O arquivo `docker-compose.yaml` cria dois serviços:

- `web`: build do React, arquivos estáticos e proxy Nginx;
- `server`: Fastify e WebSocket, disponível apenas na rede interna.

No Coolify, crie um recurso **Docker Compose** usando a branch `main` e informe
`/docker-compose.yaml` como caminho do Compose. Associe somente o serviço
`web`, porta `80`, ao domínio `https://basiclandgame.com`.

O build usa por padrão `wss://basiclandgame.com/ws`. Para outro domínio,
configure `VITE_WS_URL` como variável de build antes do deploy. Os endpoints
públicos ficam disponíveis no mesmo domínio:

```text
https://basiclandgame.com
https://basiclandgame.com/health
wss://basiclandgame.com/ws
```

Mantenha apenas uma réplica do serviço `server`, pois salas e partidas ainda
são armazenadas em memória.
