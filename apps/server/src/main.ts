import { buildServer } from './app.js';

const portValue = Number.parseInt(process.env.PORT ?? '3000', 10);
const port = Number.isNaN(portValue) ? 3000 : portValue;
const host = process.env.HOST ?? '0.0.0.0';

const server = await buildServer({ logger: true });

try {
  await server.listen({ host, port });
} catch (error: unknown) {
  server.log.error(error);
  process.exitCode = 1;
}
