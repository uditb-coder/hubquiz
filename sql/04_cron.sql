-- ============================================================
-- HubQuiz — pg_cron Cleanup Job (run after enabling pg_cron)
-- ============================================================
-- NOTE: pg_cron must be enabled in your Supabase project first.
-- Go to: Supabase Dashboard → Database → Extensions → Enable pg_cron
-- Then run this SQL in the SQL Editor.
-- ============================================================

-- Delete finished sessions older than 24 hours (cascade deletes players + answers)
SELECT cron.schedule(
  'hubquiz-cleanup-old-sessions',
  '0 * * * *',  -- runs every hour
  $$
    DELETE FROM public.game_sessions
    WHERE status = 'finished'
      AND created_at < NOW() - INTERVAL '24 hours';
  $$
);

-- To verify the job is scheduled:
-- SELECT * FROM cron.job;

-- To remove the job if needed:
-- SELECT cron.unschedule('hubquiz-cleanup-old-sessions');
