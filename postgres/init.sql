-- ============================================================
-- Initialization script for PostgreSQL container (sih_db)
-- Creates default schemas for each microservice
-- ============================================================

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS fhir;
CREATE SCHEMA IF NOT EXISTS labo;
CREATE SCHEMA IF NOT EXISTS pharmacie;
CREATE SCHEMA IF NOT EXISTS facturation;
CREATE SCHEMA IF NOT EXISTS statistiques;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS notification;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS files;
CREATE SCHEMA IF NOT EXISTS clinique;
