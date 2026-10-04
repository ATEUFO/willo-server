/**
 * auth-service — Plugin PostgreSQL
 * Enregistre @fastify/postgres avec la DATABASE_URL de auth-service.
 */
import fp from 'fastify-plugin';
import fastifyPostgres from '@fastify/postgres';
import type { FastifyInstance } from 'fastify';

export default fp(async function dbPlugin(fastify: FastifyInstance) {
  const connectionString =
    process.env.AUTH_DATABASE_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER ?? 'sih_admin'}:${process.env.POSTGRES_PASSWORD ?? 'change_me'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? 'sih_db'}`;

  await fastify.register(fastifyPostgres, {
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  fastify.log.info('✅ PostgreSQL connecté (auth-service)');
}, {
  name: 'db-plugin',
});
