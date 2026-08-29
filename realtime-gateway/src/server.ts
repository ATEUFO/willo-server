import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import fastifyJwt from '@fastify/jwt';
import redisPlugin from './plugins/redis.js';
import { ConnectionManager, type ExtWebSocket } from './services/connection-manager.js';

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

// ─── Core Plugins ─────────────────────────────────────────────────────────
await server.register(cors, { origin: true });

await server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'change_me_very_long_secret_min_32_chars',
});

await server.register(fastifyWebsocket, {
  options: {
    maxPayload: 1048576, // 1MB max payload per WS message
  },
});

await server.register(redisPlugin);

// ─── Connection Manager ───────────────────────────────────────────────────
const connectionManager = new ConnectionManager();

// Écoute des événements Redis publiés par les microservices (ex: `willo:resource.updated`)
server.ready().then(() => {
  server.redisSub.on('pmessage', (_pattern: string, channel: string, messageStr: string) => {
    try {
      const data = JSON.parse(messageStr);
      // Le canal Redis est sous la forme `willo:user:123` ou `willo:resource:Patient`
      const targetChannel = channel.replace(/^willo:/, '');
      connectionManager.broadcastEvent({
        type: data.type || 'event',
        channel: targetChannel,
        payload: data.payload || data,
      });
    } catch {
      // Ignorer messages non-JSON
    }
  });
});

// ─── Routes WebSocket ─────────────────────────────────────────────────────
server.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection: any, req) => {
    const socket = (connection.socket || connection) as ExtWebSocket;
    fastify.log.info(`🔗 Nouvelle connexion WebSocket (IP: ${req.ip})`);
    
    connectionManager.handleConnection(socket, (token: string) => {
      return fastify.jwt.verify(token);
    });
  });

  // Route fallback / pour compatibilité
  fastify.get('/', { websocket: true }, (connection: any, req) => {
    const socket = (connection.socket || connection) as ExtWebSocket;
    connectionManager.handleConnection(socket, (token: string) => {
      return fastify.jwt.verify(token);
    });
  });
});

// ─── Health check ─────────────────────────────────────────────────────────
server.get('/health', async () => {
  return {
    status: 'OK',
    service: 'realtime-gateway',
    activeConnections: connectionManager.getConnectedCount(),
    time: new Date().toISOString(),
  };
});

// ─── Démarrage ────────────────────────────────────────────────────────────
const start = async () => {
  try {
    const port = Number(process.env.REALTIME_PORT ?? process.env.PORT) || 3011;
    const host = process.env.HOST || '0.0.0.0';
    await server.listen({ port, host });
    server.log.info(`🚀 Realtime Gateway WebSocket actif sur http://${host}:${port}/ws`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
