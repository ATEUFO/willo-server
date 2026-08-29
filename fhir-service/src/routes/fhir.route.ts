import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface FhirParams {
  resourceType: string;
  fhirId?: string;
}

interface FhirQuery {
  _lastUpdated?: string;       // ex: "gt2026-08-27T10:00:00Z", "ge2026-08-27T10:00:00Z"
  subject?: string;            // fhirId Patient
  encounter?: string;          // fhirId Encounter
  status?: string;
  _page?: string;
  _limit?: string;
}

export default async function fhirRoutes(fastify: FastifyInstance) {

  // ─── 1. DELTA SYNC & RECHERCHE (GET /:resourceType) ─────────────────────
  fastify.get('/:resourceType', async (request: FastifyRequest<{ Params: FhirParams; Querystring: FhirQuery }>, reply: FastifyReply) => {
    const { resourceType } = request.params;
    const { _lastUpdated, subject, encounter, status, _page = '1', _limit = '50' } = request.query;

    const page = Math.max(1, parseInt(_page, 10));
    const limit = Math.min(200, Math.max(1, parseInt(_limit, 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['resource_type = $1'];
    const params: any[] = [resourceType];
    let paramIdx = 2;

    // 5.2 Synchronisation descendante incrémentale (_lastUpdated)
    if (_lastUpdated) {
      let operator = '>';
      let dateStr = _lastUpdated;

      if (_lastUpdated.startsWith('gt')) {
        operator = '>';
        dateStr = _lastUpdated.substring(2);
      } else if (_lastUpdated.startsWith('ge')) {
        operator = '>=';
        dateStr = _lastUpdated.substring(2);
      } else if (_lastUpdated.startsWith('lt')) {
        operator = '<';
        dateStr = _lastUpdated.substring(2);
      } else if (_lastUpdated.startsWith('le')) {
        operator = '<=';
        dateStr = _lastUpdated.substring(2);
      }

      const dateVal = new Date(dateStr);
      if (!isNaN(dateVal.getTime())) {
        conditions.push(`last_updated ${operator} $${paramIdx}`);
        params.push(dateVal);
        paramIdx++;
      }
    }

    if (subject) {
      conditions.push(`subject_id = $${paramIdx}`);
      params.push(subject);
      paramIdx++;
    }

    if (encounter) {
      conditions.push(`encounter_id = $${paramIdx}`);
      params.push(encounter);
      paramIdx++;
    }

    if (status) {
      conditions.push(`status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const client = await fastify.pg.connect();
    try {
      const countRes = await client.query(
        `SELECT COUNT(*) AS total FROM fhir_resources WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countRes.rows[0].total, 10);

      const dataRes = await client.query(
        `SELECT fhir_id, content, last_updated FROM fhir_resources 
         WHERE ${whereClause} 
         ORDER BY last_updated DESC 
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      );

      const entries = dataRes.rows.map((row) => ({
        fullUrl: `${request.protocol}://${request.hostname}/api/fhir/${resourceType}/${row.fhir_id}`,
        resource: row.content,
      }));

      return reply.send({
        resourceType: 'Bundle',
        type: 'searchset',
        total,
        entry: entries,
        meta: {
          lastUpdated: new Date().toISOString(),
        },
      });
    } finally {
      client.release();
    }
  });

  // ─── 2. LECTURE PAR ID (GET /:resourceType/:fhirId) ──────────────────────
  fastify.get('/:resourceType/:fhirId', async (request: FastifyRequest<{ Params: FhirParams }>, reply: FastifyReply) => {
    const { resourceType, fhirId } = request.params;

    const client = await fastify.pg.connect();
    try {
      const res = await client.query(
        `SELECT content, last_updated FROM fhir_resources WHERE resource_type = $1 AND fhir_id = $2`,
        [resourceType, fhirId]
      );

      if (res.rows.length === 0) {
        return reply.code(404).send({
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', diagnostics: `Resource ${resourceType}/${fhirId} not found` }],
        });
      }

      return reply.send(res.rows[0].content);
    } finally {
      client.release();
    }
  });

  // ─── 3. CRÉATION IDEMPOTENTE (POST /:resourceType) ──────────────────────
  fastify.post('/:resourceType', async (request: FastifyRequest<{ Params: FhirParams }>, reply: FastifyReply) => {
    const { resourceType } = request.params;
    const body = request.body as Record<string, any>;

    // Extraire le clientMutationId (body ou header HTTP X-Client-Mutation-Id)
    const clientMutationId =
      body.clientMutationId ||
      (request.headers['x-client-mutation-id'] as string) ||
      null;

    const client = await fastify.pg.connect();
    try {
      // 4.2 Idempotence côté serveur : si déjà reçu, renvoyer la ressource existante
      if (clientMutationId) {
        const existing = await client.query(
          `SELECT content FROM fhir_resources WHERE client_mutation_id = $1`,
          [clientMutationId]
        );

        if (existing.rows.length > 0) {
          request.log.info(`[Idempotence] Mutation ${clientMutationId} déjà traitée.`);
          return reply.code(200).send(existing.rows[0].content);
        }
      }

      // Générer id FHIR s'il n'existe pas
      const fhirId = body.id || crypto.randomUUID();
      const content: Record<string, any> = { ...body, id: fhirId, resourceType };
      delete content.clientMutationId; // Nettoyage du champ temporaire

      // Meta versioning
      content.meta = {
        ...(content.meta || {}),
        versionId: '1',
        lastUpdated: new Date().toISOString(),
      };

      const subjectId = body.subject?.reference?.replace(/^Patient\//, '') || body.patientId || null;
      const encounterId = body.encounter?.reference?.replace(/^Encounter\//, '') || body.encounterId || null;
      const status = body.status || null;

      await client.query(
        `INSERT INTO fhir_resources (resource_type, fhir_id, content, subject_id, encounter_id, status, client_mutation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (resource_type, fhir_id) DO UPDATE SET
           content = EXCLUDED.content,
           subject_id = EXCLUDED.subject_id,
           encounter_id = EXCLUDED.encounter_id,
           status = EXCLUDED.status,
           client_mutation_id = EXCLUDED.client_mutation_id,
           last_updated = NOW()`,
        [resourceType, fhirId, JSON.stringify(content), subjectId, encounterId, status, clientMutationId]
      );

      // 6.7 Publication d'événement Redis pour diffusion temps réel WebSocket
      await fastify.publishEvent('resource.updated', `resource:${resourceType}`, {
        resourceType,
        fhirId,
        clientMutationId,
        resource: content,
      });

      return reply.code(201).send(content);
    } finally {
      client.release();
    }
  });

  // ─── 4. MISE À JOUR & CONFLIT (PUT /:resourceType/:fhirId) ───────────────
  fastify.put('/:resourceType/:fhirId', async (request: FastifyRequest<{ Params: FhirParams }>, reply: FastifyReply) => {
    const { resourceType, fhirId } = request.params;
    const body = request.body as Record<string, any>;
    const ifMatchHeader = request.headers['if-match']; // e.g., 'W/"1"' or '1'

    const client = await fastify.pg.connect();
    try {
      const existingRes = await client.query(
        `SELECT content FROM fhir_resources WHERE resource_type = $1 AND fhir_id = $2`,
        [resourceType, fhirId]
      );

      if (existingRes.rows.length === 0) {
        return reply.code(404).send({
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', diagnostics: `Resource ${resourceType}/${fhirId} not found` }],
        });
      }

      const existingContent = existingRes.rows[0].content;
      const currentVersion = existingContent?.meta?.versionId || '1';

      // 5.4 Gestion des conflits (409 Conflict) avec If-Match
      if (ifMatchHeader) {
        const expectedVersion = ifMatchHeader.replace(/^W\/"/, '').replace(/"$/, '');
        if (expectedVersion !== currentVersion) {
          return reply.code(409).send({
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'conflict',
              diagnostics: `Conflit de version : version attendue ${expectedVersion}, version actuelle serveur ${currentVersion}`,
            }],
            currentResource: existingContent,
          });
        }
      }

      const newVersion = (parseInt(currentVersion, 10) + 1).toString();
      const updatedContent = {
        ...body,
        id: fhirId,
        resourceType,
        meta: {
          ...(body.meta || {}),
          versionId: newVersion,
          lastUpdated: new Date().toISOString(),
        },
      };

      const subjectId = body.subject?.reference?.replace(/^Patient\//, '') || body.patientId || null;
      const encounterId = body.encounter?.reference?.replace(/^Encounter\//, '') || body.encounterId || null;
      const status = body.status || null;

      await client.query(
        `UPDATE fhir_resources 
         SET content = $1, subject_id = $2, encounter_id = $3, status = $4, last_updated = NOW()
         WHERE resource_type = $5 AND fhir_id = $6`,
        [JSON.stringify(updatedContent), subjectId, encounterId, status, resourceType, fhirId]
      );

      // Diffusion temps réel Redis → WebSocket
      await fastify.publishEvent('resource.updated', `resource:${resourceType}`, {
        resourceType,
        fhirId,
        resource: updatedContent,
      });

      return reply.send(updatedContent);
    } finally {
      client.release();
    }
  });

  // ─── 5. BOOTSTRAP INITIAL SYNC (GET /api/sync/bootstrap) ───────────────
  fastify.get('/sync/bootstrap', async (request: FastifyRequest, reply: FastifyReply) => {
    // Role récupéré du JWT ou header pour le périmètre de sync
    const userRole = (request as any).user?.role || 'médecin';

    // Périmètre par rôle (Section 5.1)
    const scopeMap: Record<string, string[]> = {
      accueil: ['Patient', 'Appointment', 'Encounter'],
      médecin: ['Patient', 'Encounter', 'Observation', 'Condition', 'MedicationRequest', 'CarePlan'],
      pharmacien: ['Medication', 'MedicationRequest', 'MedicationDispense', 'SupplyRequest'],
      laborantin: ['ServiceRequest', 'Specimen', 'DiagnosticReport', 'Observation'],
      admin: ['Patient', 'Practitioner', 'Organization', 'Location', 'Device'],
    };

    const targetResources = scopeMap[userRole] || scopeMap.médecin;

    const client = await fastify.pg.connect();
    try {
      const res = await client.query(
        `SELECT resource_type, fhir_id, content, last_updated 
         FROM fhir_resources 
         WHERE resource_type = ANY($1)
         ORDER BY last_updated DESC 
         LIMIT 500`,
        [targetResources]
      );

      const items = res.rows.map((row) => row.content);

      return reply.send({
        role: userRole,
        scope: targetResources,
        timestamp: new Date().toISOString(),
        total: items.length,
        items,
      });
    } finally {
      client.release();
    }
  });
}
