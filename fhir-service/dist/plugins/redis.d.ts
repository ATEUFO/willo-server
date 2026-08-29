import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
declare module 'fastify' {
    interface FastifyInstance {
        redisPub: Redis;
        publishEvent: (type: string, channel: string, payload: unknown) => Promise<void>;
    }
}
declare const _default: (fastify: FastifyInstance) => Promise<void>;
export default _default;
//# sourceMappingURL=redis.d.ts.map