import Fastify from 'fastify';
import cors from '@fastify/cors';
import dbPlugin from './plugins/db.js';

const server = Fastify({
  logger: process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }
    : true,
});

// ─── Plugins ──────────────────────────────────────────────────────────────
await server.register(cors, { origin: true });
await server.register(dbPlugin);

// ─── Health check ─────────────────────────────────────────────────────────
server.get('/health', async () => {
  const client = await server.pg.connect();
  try {
    const { rows } = await client.query('SELECT NOW() AS now');
    return { status: 'OK', service: 'audit-service', db: 'connected', time: rows[0].now };
  } finally {
    client.release();
  }
});

server.get('/', async () => {
  return { message: 'Welcome to audit-service API' };
});

// ─── Démarrage ────────────────────────────────────────────────────────────
const start = async () => {
  try {
    const port = Number(process.env.AUDIT_PORT ?? process.env.PORT) || 3009;
    const host = process.env.HOST || '0.0.0.0';
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

