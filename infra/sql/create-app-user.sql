-- ============================================================================
-- Dynasties — Least-privilege app_user role (idempotent)
-- ============================================================================
-- Run as the database superuser (the role used by `DATABASE_URL`).
-- Safe to re-run: all statements use IF NOT EXISTS or DO/EXCEPTION patterns.
--
-- Usage:
--   psql "$DATABASE_URL" \
--     -v app_user_password="$APP_USER_PASSWORD" \
--     -f infra/sql/create-app-user.sql
--
-- After running, the API task should connect via APP_DATABASE_URL:
--   postgres://app_user:<password>@<host>/dynasties
-- ============================================================================

\set ON_ERROR_STOP on

-- 1. Create the role idempotently (no-op if it already exists)
DO $$
BEGIN
  CREATE ROLE app_user LOGIN PASSWORD :'app_user_password';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Role app_user already exists, skipping CREATE ROLE';
END $$;

-- 2. Always reset the password (in case it was rotated)
ALTER ROLE app_user WITH LOGIN PASSWORD :'app_user_password';

-- 3. Connect privilege
GRANT CONNECT ON DATABASE dynasties TO app_user;

-- 4. Schema usage (read-only, no CREATE)
GRANT USAGE ON SCHEMA public TO app_user;

-- 5. DML on all existing application tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- 6. Sequence access (needed for SERIAL/BIGSERIAL inserts)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 7. Default privileges for FUTURE tables/sequences created by migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- 8. Grant access to the stripe schema if it exists (sync ledger)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'stripe') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA stripe TO app_user';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA stripe TO app_user';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA stripe GRANT SELECT ON TABLES TO app_user';
  END IF;
END $$;

-- 9. Explicitly DENY dangerous privileges (defense in depth)
REVOKE CREATE ON SCHEMA public FROM app_user;
REVOKE ALL ON SCHEMA information_schema FROM app_user;

-- Verification
SELECT
  rolname,
  rolsuper,
  rolcreaterole,
  rolcreatedb,
  rolcanlogin
FROM pg_roles
WHERE rolname = 'app_user';
