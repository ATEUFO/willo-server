/**
 * Plugin Redis Pub/Sub & Streams pour realtime-gateway
 * Écoute les événements diffusés par les autres microservices
 */
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    redisSub: Redis;
    redisPub: Redis;
  }
}

export default fp(async function redisPlugin(fastify: FastifyInstance) {
  const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

  const redisSub = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const redisPub = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redisSub.on('connect', () => {
    fastify.log.info('✅ Redis Subscriber connecté (realtime-gateway)');
  });

  redisSub.on('error', (err: any) => {
    fastify.log.error(`❌ Erreur Redis Subscriber: ${err.message}`);
  });

  // Abonnement aux canaux génériques de publication
  await redisSub.psubscribe('willo:*');

  fastify.decorate('redisSub', redisSub);
  fastify.decorate('redisPub', redisPub);

  fastify.addHook('onClose', async () => {
    redisSub.disconnect();
    redisPub.disconnect();
  });
}, {
  name: 'redis-plugin',
});
