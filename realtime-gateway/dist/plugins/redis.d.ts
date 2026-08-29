import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
declare module 'fastify' {
    interface FastifyInstance {
        redisSub: Redis;
        redisPub: Redis;
    }
}
declare const _default: (fastify: FastifyInstance) => Promise<void>;
export default _default;
//# sourceMappingURL=redis.d.ts.map