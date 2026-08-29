/**
 * Plugin Redis Publisher pour fhir-service
 * Publie les événements de mutation (resource.updated) vers le Realtime Gateway
 */
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    redisPub: Redis;
    publishEvent: (type: string, channel: string, payload: unknown) => Promise<void>;
  }
}

export default fp(async function redisPlugin(fastify: FastifyInstance) {
  const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

  const redisPub = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
  });

  redisPub.on('connect', () => {
    fastify.log.info('✅ Redis Publisher connecté (fhir-service)');
  });

  redisPub.on('error', (err: any) => {
    fastify.log.warn(`⚠️ Warning Redis Publisher: ${err.message}`);
  });

  const publishEvent = async (type: string, channel: string, payload: unknown) => {
    try {
      const message = JSON.stringify({ type, payload });
      await redisPub.publish(`willo:${channel}`, message);
    } catch (err: any) {
      fastify.log.error(`Échec publication Redis (${channel}): ${err.message}`);
    }
  };

  fastify.decorate('redisPub', redisPub);
  fastify.decorate('publishEvent', publishEvent);

  fastify.addHook('onClose', async () => {
    redisPub.disconnect();
  });
}, {
  name: 'redis-plugin',
});
