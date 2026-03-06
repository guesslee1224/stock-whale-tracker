-- Enable Supabase Realtime on the institutional_activity table
-- This allows the browser client to subscribe to INSERT events
-- and update the feed in real-time without polling.
--
-- Run this AFTER 0001_initial_schema.sql

ALTER PUBLICATION supabase_realtime ADD TABLE institutional_activity;
