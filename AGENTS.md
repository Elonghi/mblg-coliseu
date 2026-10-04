# AGENTS.md - MBLG Coliseu

## Objetivo
Construir o MBLG Coliseu, um jogo de cartas de navegador com partidas contra bot e multiplayer em tempo real.

## Regras obrigatórias para o desenvolvimento
- Não inventar regras de jogo que não estejam documentadas.
- Toda regra deve ser implementada no `packages/game-engine`.
- O frontend nunca é a autoridade sobre regras.
- O servidor é autoritativo no multiplayer.
- Bot e multiplayer devem utilizar o mesmo Game Engine.
- Usar TypeScript strict.
- Criar testes automatizados para as regras.
- RNG deve ser injetável para permitir testes determinísticos.
- Separar estado público de informações privadas.
- O cliente envia intenções/ações, nunca um estado de jogo calculado por ele.
- Não implementar Kubernetes, microserviços ou arquitetura distribuída no MVP.
- Redis é opcional no início.
- Não implementar sistema de contas para partidas contra bot.
- Multiplayer exige login.

## Stack inicial
- Frontend: React + TypeScript + Vite
- Backend: Node.js + TypeScript
- Comunicação em tempo real: WebSocket
- Banco: PostgreSQL
- Infra: Docker Compose + Nginx
- Redis: opcional

## Nome
MBLG Coliseu
