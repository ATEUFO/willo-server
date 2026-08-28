import Fastify from 'fastify';
import cors from '@fastify/cors';
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
// Register CORS
await server.register(cors, {
    origin: true,
});
// Health check and root paths
server.get('/health', async () => {
    return { status: 'OK', service: 'realtime-gateway' };
});
server.get('/', async () => {
    return { message: 'Welcome to realtime-gateway API' };
});
const start = async () => {
    try {
        const port = Number(process.env.PORT) || 3014;
        const host = process.env.HOST || '0.0.0.0';
        await server.listen({ port, host });
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=server.js.map