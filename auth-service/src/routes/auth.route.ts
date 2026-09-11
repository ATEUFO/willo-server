import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

export default async function authRoutes(fastify: FastifyInstance) {

  // ─── 1. CONNEXION (POST /login) ──────────────────────────────────────────
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, posteId } = request.body as Record<string, any>;

    if (!email || !password) {
      return reply.code(400).send({ message: 'Email et mot de passe requis' });
    }

    const client = await fastify.pg.connect();
    try {
      // Recherche de l'utilisateur
      const userRes = await client.query(
        `SELECT id, email, password_hash, nom, prenom, telephone, site_id, actif 
         FROM users WHERE email = $1`,
        [email.toLowerCase().trim()]
      );

      if (userRes.rows.length === 0) {
        return reply.code(401).send({ message: 'Identifiants invalides' });
      }

      const user = userRes.rows[0];

      if (!user.actif) {
        return reply.code(403).send({ message: 'Compte désactivé' });
      }

      // Vérification du mot de passe bcrypt (avec fallback démo si pas encore hashé)
      let valid = false;
      if (user.password_hash.startsWith('$2')) {
        valid = await bcrypt.compare(password, user.password_hash);
      } else {
        valid = password === user.password_hash;
      }

      if (!valid) {
        return reply.code(401).send({ message: 'Identifiants invalides' });
      }

      // Récupération des rôles et permissions
      const rolesRes = await client.query(
        `SELECT r.id, r.nom, r.permissions 
         FROM roles r 
         JOIN user_roles ur ON ur.role_id = r.id 
         WHERE ur.user_id = $1`,
        [user.id]
      );

      const roles = rolesRes.rows;
      const primaryRole = roles[0]?.nom || 'médecin';
      const allPermissions = Array.from(
        new Set(roles.flatMap((r: any) => r.permissions || []))
      );

      // Génération des tokens JWT
      const accessToken = fastify.jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: primaryRole,
          siteId: user.site_id,
          permissions: allPermissions,
        },
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      const refreshToken = crypto.randomUUID();
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

      // Enregistrement de la session
      await client.query(
        `INSERT INTO sessions (user_id, refresh_token, expires_at, poste_id, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, refreshTokenHash, expiresAt, posteId || null, request.ip, request.headers['user-agent'] || '']
      );

      // Mise à jour de dernière connexion
      await client.query(`UPDATE users SET derniere_connexion = NOW() WHERE id = $1`, [user.id]);

      return reply.send({
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900,
        },
        user: {
          id: user.id,
          email: user.email,
          nom: user.nom,
          prenom: user.prenom,
          siteId: user.site_id,
          roles,
          permissions: allPermissions,
        },
      });
    } finally {
      client.release();
    }
  });

  // ─── 2. RAFRAÎCHISSEMENT DU TOKEN (POST /refresh) ───────────────────────
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as Record<string, any>;

    if (!refreshToken) {
      return reply.code(400).send({ message: 'Refresh token requis' });
    }

    const client = await fastify.pg.connect();
    try {
      // Récupérer les sessions actives non expirées
      const sessionRes = await client.query(
        `SELECT s.id, s.user_id, s.refresh_token, u.email, u.site_id, u.actif
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.expires_at > NOW() AND s.actif = TRUE AND u.actif = TRUE`
      );

      let matchedSession: any = null;
      for (const sess of sessionRes.rows) {
        const isMatch = await bcrypt.compare(refreshToken, sess.refresh_token);
        if (isMatch) {
          matchedSession = sess;
          break;
        }
      }

      if (!matchedSession) {
        return reply.code(401).send({ message: 'Refresh token invalide ou expiré' });
      }

      // Récupération rôles & permissions
      const rolesRes = await client.query(
        `SELECT r.id, r.nom, r.permissions 
         FROM roles r 
         JOIN user_roles ur ON ur.role_id = r.id 
         WHERE ur.user_id = $1`,
        [matchedSession.user_id]
      );

      const roles = rolesRes.rows;
      const primaryRole = roles[0]?.nom || 'médecin';
      const allPermissions = Array.from(new Set(roles.flatMap((r: any) => r.permissions || [])));

      const newAccessToken = fastify.jwt.sign(
        {
          sub: matchedSession.user_id,
          email: matchedSession.email,
          role: primaryRole,
          siteId: matchedSession.site_id,
          permissions: allPermissions,
        },
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      return reply.send({
        accessToken: newAccessToken,
        expiresIn: 900,
      });
    } finally {
      client.release();
    }
  });

  // ─── 3. PROFIL UTILISATEUR CONNECTÉ (GET /me) ───────────────────────────
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ message: 'Token Authorization Bearer manquant' });
    }

    const token = authHeader.substring(7);
    try {
      const payload: any = fastify.jwt.verify(token);

      const client = await fastify.pg.connect();
      try {
        const userRes = await client.query(
          `SELECT id, email, nom, prenom, telephone, site_id, actif, derniere_connexion 
           FROM users WHERE id = $1`,
          [payload.sub]
        );

        if (userRes.rows.length === 0) {
          return reply.code(404).send({ message: 'Utilisateur non trouvé' });
        }

        const rolesRes = await client.query(
          `SELECT r.id, r.nom, r.permissions 
           FROM roles r 
           JOIN user_roles ur ON ur.role_id = r.id 
           WHERE ur.user_id = $1`,
          [payload.sub]
        );

        return reply.send({
          user: userRes.rows[0],
          roles: rolesRes.rows,
          permissions: payload.permissions || [],
        });
      } finally {
        client.release();
      }
    } catch {
      return reply.code(401).send({ message: 'Token invalide ou expiré' });
    }
  });

  // ─── 4. CODE APPAIRAGE POSTE (POST /pairing/code) ───────────────────────
  fastify.post('/pairing/code', async (request: FastifyRequest, reply: FastifyReply) => {
    const { siteId } = request.body as Record<string, any>;
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // Code 6 chiffres
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    const client = await fastify.pg.connect();
    try {
      let targetSiteId = siteId;
      if (!targetSiteId || targetSiteId === '00000000-0000-0000-0000-000000000000') {
        const siteRes = await client.query(`SELECT id FROM sites LIMIT 1`);
        if (siteRes.rows.length > 0) {
          targetSiteId = siteRes.rows[0].id;
        }
      }

      const res = await client.query(
        `INSERT INTO pairing_codes (code, site_id, expires_at)
         VALUES ($1, $2, $3) RETURNING id, code, expires_at`,
        [code, targetSiteId, expiresAt]
      );

      return reply.send({
        pairingCode: res.rows[0].code,
        expiresAt: res.rows[0].expires_at,
      });
    } finally {
      client.release();
    }
  });
}
