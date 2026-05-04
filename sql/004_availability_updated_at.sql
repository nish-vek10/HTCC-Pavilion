-- pavilion-app/sql/004_availability_updated_at.sql
-- Adds updated_at to availability table + auto-update trigger
-- Run once in Supabase SQL Editor before deploying the timestamp feature

-- ── 1. Add column ─────────────────────────────────────────────────────────────
ALTER TABLE availability
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── 2. Backfill existing rows (use created_at if it exists, else now) ─────────
UPDATE availability
SET    updated_at = COALESCE(created_at, now())
WHERE  updated_at IS NULL;

-- ── 3. Trigger — auto-stamp updated_at on every UPDATE ───────────────────────
CREATE OR REPLACE FUNCTION fn_availability_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_availability_updated_at ON availability;
CREATE TRIGGER trg_availability_updated_at
  BEFORE UPDATE ON availability
  FOR EACH ROW EXECUTE FUNCTION fn_availability_updated_at();

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT id, player_id, status, updated_at FROM availability LIMIT 5;
