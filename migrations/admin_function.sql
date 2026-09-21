-- ============================================================
-- Admin Stats Function
-- Only accessible by admin@comedkares.org
-- Returns live session counts, player counts, and active hub details
-- Run this in BOTH local Supabase Studio AND cloud Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_caller_email text;
BEGIN
  -- Check if caller is admin
  SELECT email INTO v_caller_email
    FROM auth.users
   WHERE id = auth.uid();

  IF v_caller_email IS NULL OR v_caller_email != 'admin@comedkares.org' THEN
    RAISE EXCEPTION 'Unauthorized: admin access only';
  END IF;

  SELECT jsonb_build_object(
    'live_sessions', (SELECT COUNT(*) FROM game_sessions WHERE status != 'finished'),
    'live_players', (
      SELECT COUNT(*)
      FROM players p
      JOIN game_sessions gs ON p.session_id = gs.id
      WHERE gs.status != 'finished'
    ),
    'sessions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'session_id', gs.id,
        'quiz_title', q.title,
        'status', gs.status,
        'pin', gs.pin,
        'player_count', (SELECT COUNT(*) FROM players WHERE session_id = gs.id),
        'host_email', u.email,
        'created_at', gs.created_at
      ) ORDER BY gs.created_at DESC)
      FROM game_sessions gs
      JOIN quizzes q ON gs.quiz_id = q.id
      JOIN auth.users u ON gs.host_id = u.id
      WHERE gs.status != 'finished'
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_stats() TO authenticated;
