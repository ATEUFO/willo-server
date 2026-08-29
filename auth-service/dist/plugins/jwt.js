import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
export default fp(async function jwtPlugin(fastify) {
    const secret = process.env.JWT_SECRET || 'change_me_very_long_secret_min_32_chars';
    await fastify.register(fastifyJwt, {
        secret,
        sign: {
            expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        },
    });
    fastify.log.info('✅ JWT Plugin configuré (auth-service)');
}, {
    name: 'jwt-plugin',
});
//# sourceMappingURL=jwt.js.map