/**
 * ai-diagnosis-service — Plugin PostgreSQL
 */
import fp from 'fastify-plugin';
import fastifyPostgres from '@fastify/postgres';
export default fp(async function dbPlugin(fastify) {
    const connectionString = process.env.AI_DATABASE_URL ||
        process.env.DATABASE_URL ||
        `postgresql://${process.env.POSTGRES_USER ?? 'sih_admin'}:${process.env.POSTGRES_PASSWORD ?? 'change_me'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? 'sih_db'}`;
    await fastify.register(fastifyPostgres, {
        connectionString,
        pg: {
            max: 10,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
        },
    });
    fastify.log.info('✅ PostgreSQL connecté (ai-diagnosis-service)');
}, {
    name: 'db-plugin',
});
//# sourceMappingURL=db.js.map