-- Migration: Add free data source values (replace Quiver API dependency)
-- Run this in your Supabase SQL editor after 0002_realtime.sql

-- Drop the existing source CHECK constraint
ALTER TABLE institutional_activity
  DROP CONSTRAINT IF EXISTS institutional_activity_source_check;

-- Re-add with old + new source values so existing data is preserved
ALTER TABLE institutional_activity
  ADD CONSTRAINT institutional_activity_source_check
  CHECK (source IN (
    -- Legacy Quiver values (kept for any existing rows)
    'quiver_congress', 'quiver_insider', 'quiver_institutional',
    -- Free replacements
    'house_congress',   -- House member trades (housestockwatcher.com)
    'senate_congress',  -- Senate member trades (senatestockwatcher.com)
    'sec_form4',        -- Insider trades via SEC EDGAR Form 4
    -- Existing free source
    'sec_13f'
  ));
