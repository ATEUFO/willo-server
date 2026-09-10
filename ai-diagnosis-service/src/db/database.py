import os
import json
import logging
import time
from typing import Optional, Dict, Any, List
import asyncpg

logger = logging.getLogger("ai_diagnosis_db")

PG_HOST = os.getenv("POSTGRES_HOST", os.getenv("PGHOST", "localhost"))
PG_PORT = os.getenv("POSTGRES_PORT", os.getenv("PGPORT", "5432"))
PG_USER = os.getenv("POSTGRES_USER", os.getenv("PGUSER", "sih_admin"))
PG_PASSWORD = os.getenv("POSTGRES_PASSWORD", os.getenv("PGPASSWORD", "change_me_in_production"))
PG_DB = os.getenv("POSTGRES_DB", os.getenv("PGDATABASE", "sih_db"))

pool: Optional[asyncpg.Pool] = None
_last_failed_time: float = 0
_COOLDOWN_SECONDS: float = 30.0


def _get_candidate_hosts() -> List[str]:
    hosts = [PG_HOST]
    fallbacks = ["localhost", "127.0.0.1"]
    for fb in fallbacks:
        if fb not in hosts:
            hosts.append(fb)
    return hosts


async def get_db_pool() -> Optional[asyncpg.Pool]:
    global pool, _last_failed_time
    if pool is not None:
        return pool

    now = time.time()
    if _last_failed_time > 0 and (now - _last_failed_time) < _COOLDOWN_SECONDS:
        return None

    candidate_hosts = _get_candidate_hosts()
    last_exception = None

    for host in candidate_hosts:
        try:
            pool = await asyncpg.create_pool(
                host=host,
                port=int(PG_PORT),
                user=PG_USER,
                password=PG_PASSWORD,
                database=PG_DB,
                min_size=1,
                max_size=10,
                timeout=5.0
            )
            logger.info(f"Connected to PostgreSQL database successfully (host: {host}).")
            _last_failed_time = 0
            return pool
        except Exception as e:
            last_exception = e

    _last_failed_time = time.time()
    logger.warning(f"Could not connect to PostgreSQL (tried {candidate_hosts}): {last_exception}. DB logging will be disabled until DB is online.")
    return None


async def init_ai_schema():
    db_pool = await get_db_pool()
    if db_pool is None:
        return

    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE SCHEMA IF NOT EXISTS ai;

            CREATE TABLE IF NOT EXISTS ai.model_versions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                nom_modele VARCHAR(100) NOT NULL,
                version VARCHAR(50) NOT NULL,
                fichier_onnx VARCHAR(255),
                date_publication TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(nom_modele, version)
            );

            CREATE TABLE IF NOT EXISTS ai.inference_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                model_id UUID REFERENCES ai.model_versions(id) ON DELETE SET NULL,
                patient_id VARCHAR(255) NOT NULL,
                encounter_id VARCHAR(255),
                input_features JSONB NOT NULL,
                prediction_output JSONB NOT NULL,
                score_probabilite NUMERIC(5, 4),
                niveau_risque VARCHAR(50),
                execution_time_ms INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        logger.info("Database schema `ai` initialized.")


async def record_model_version(nom_modele: str, version: str, fichier_onnx: str) -> Optional[str]:
    db_pool = await get_db_pool()
    if db_pool is None:
        return None

    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO ai.model_versions (nom_modele, version, fichier_onnx)
                VALUES ($1, $2, $3)
                ON CONFLICT (nom_modele, version) DO UPDATE 
                SET fichier_onnx = EXCLUDED.fichier_onnx, date_publication = CURRENT_TIMESTAMP
                RETURNING id;
            """, nom_modele, version, fichier_onnx)
            return str(row['id']) if row else None
    except Exception as e:
        logger.error(f"Error recording model version: {e}")
        return None


async def log_inference(
    nom_modele: str,
    version: str,
    patient_id: str,
    encounter_id: Optional[str],
    input_features: Dict[str, Any],
    prediction_output: Dict[str, Any],
    score_probabilite: float,
    niveau_risque: str,
    execution_time_ms: int
):
    db_pool = await get_db_pool()
    if db_pool is None:
        return

    try:
        async with db_pool.acquire() as conn:
            # Find model_version id
            model_row = await conn.fetchrow("""
                SELECT id FROM ai.model_versions WHERE nom_modele = $1 AND version = $2
            """, nom_modele, version)
            
            model_id = model_row['id'] if model_row else None

            await conn.execute("""
                INSERT INTO ai.inference_logs (
                    model_id, patient_id, encounter_id, input_features,
                    prediction_output, score_probabilite, niveau_risque, execution_time_ms
                )
                VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)
            """, model_id, patient_id, encounter_id, json.dumps(input_features), json.dumps(prediction_output), score_probabilite, niveau_risque, execution_time_ms)
    except Exception as e:
        logger.error(f"Error logging inference to PostgreSQL: {e}")
