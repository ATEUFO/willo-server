/**
 * Plugin Redis Publisher pour fhir-service
 * Publie les événements de mutation (resource.updated) vers le Realtime Gateway
 */
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
export default fp(async function redisPlugin(fastify) {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const redisPub = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
    });
    redisPub.on('connect', () => {
        fastify.log.info('✅ Redis Publisher connecté (fhir-service)');
    });
    redisPub.on('error', (err) => {
        fastify.log.warn(`⚠️ Warning Redis Publisher: ${err.message}`);
    });
    const publishEvent = async (type, channel, payload) => {
        try {
            const message = JSON.stringify({ type, payload });
            await redisPub.publish(`willo:${channel}`, message);
        }
        catch (err) {
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
//# sourceMappingURL=redis.js.map