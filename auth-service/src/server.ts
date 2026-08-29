import Fastify from 'fastify';
import cors from '@fastify/cors';
import dbPlugin from './plugins/db.js';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.route.js';

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
await server.register(jwtPlugin);

// ─── Routes ───────────────────────────────────────────────────────────────
await server.register(authRoutes, { prefix: '/api/auth' });
await server.register(authRoutes); // supporte aussi les appels sans préfixe si accès direct

// ─── Health check ─────────────────────────────────────────────────────────
server.get('/health', async () => {
  const client = await server.pg.connect();
  try {
    const { rows } = await client.query('SELECT NOW() AS now');
    return { status: 'OK', service: 'auth-service', db: 'connected', time: rows[0].now };
  } finally {
    client.release();
  }
});

server.get('/', async () => {
  return { message: 'Welcome to auth-service API' };
});

// ─── Démarrage ────────────────────────────────────────────────────────────
const start = async () => {
  try {
    const port = Number(process.env.AUTH_PORT ?? process.env.PORT) || 3001;
    const host = process.env.HOST || '0.0.0.0';
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
