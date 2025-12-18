-- ============================================================================
-- 00_preflight.sql
-- Purpose: Pre-flight checks and extensions setup for Supabase
-- Run Order: 1 of 3
-- ============================================================================

SET search_path TO public, auth;

-- Extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- VERIFICATION QUERIES (run separately after execution)
-- ============================================================================

-- V1: Check extensions loaded
-- SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto');

-- V2: Check auth schema exists (confirms Supabase)
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';

-- V3: Check auth.users exists
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users';
