# Infraestrutura - MBLG Coliseu

## MVP

Uma VPS é suficiente para a primeira versão.

```text
Internet
   |
 Nginx
   |
   +--> Web
   |
   +--> Server
          |
          +--> PostgreSQL
          |
          +--> Redis (opcional)
```

## Docker Compose

Containers sugeridos:
- web
- server
- postgres
- nginx

Redis pode ser adicionado quando houver necessidade.

## HTTPS

Usar HTTPS em produção.

Cloudflare pode ser utilizado para DNS e proteção de borda.

## Não utilizar no MVP

- Kubernetes
- microserviços
- service mesh
- múltiplas regiões
- arquitetura distribuída complexa

## Backups

PostgreSQL deve possuir backup periódico.

O backup deve ser armazenado fora do container do banco.
