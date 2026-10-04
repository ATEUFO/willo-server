import Fastify from 'fastify';
import cors from '@fastify/cors';
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import fhirRoutes from './routes/fhir.route.js';

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
await server.register(redisPlugin);

// ─── Routes ───────────────────────────────────────────────────────────────
await server.register(fhirRoutes, { prefix: '/api/fhir' });
await server.register(fhirRoutes); // supporte aussi /sync/bootstrap sans /api/fhir prefix si appelé en direct

// ─── Health check ─────────────────────────────────────────────────────────
server.get('/health', async () => {
  const client = await server.pg.connect();
  try {
    const { rows } = await client.query('SELECT NOW() AS now');
    return { status: 'OK', service: 'fhir-service', db: 'connected', time: rows[0].now };
  } finally {
    client.release();
  }
});

server.get('/', async () => {
  return { message: 'Welcome to fhir-service API' };
});

// ─── Démarrage ────────────────────────────────────────────────────────────
const start = async () => {
  try {
    const port = Number(process.env.FHIR_PORT ?? process.env.PORT) || 3002;
    const host = process.env.HOST || '0.0.0.0';
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
