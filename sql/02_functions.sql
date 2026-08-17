-- ============================================================
-- HubQuiz — Postgres Functions (run after 01_schema.sql)
-- ============================================================

-- ============================================================
-- submit_answer
-- Called by the student client after tapping an option.
-- Validates correctness server-side, computes speed-bonus score,
-- inserts the answer, and updates player total score.
-- Returns: {correct, points_awarded}
-- ============================================================
CREATE OR REPLACE FUNCTION submit_answer(
  p_player_id    uuid,
  p_question_id  uuid,
  p_chosen       answer_option
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER   -- bypasses RLS; function itself validates ownership
SET search_path = public
AS $$
DECLARE
  v_correct_option  answer_option;
  v_question_started_at timestamptz;
  v_elapsed         numeric;
  v_is_correct      boolean;
  v_points          integer := 0;
  v_session_status  session_status;
BEGIN
  -- 1. Fetch the correct option for this question
  SELECT q.correct_option
    INTO v_correct_option
    FROM questions q
   WHERE q.id = p_question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  -- 2. Fetch session state for the player's session
  SELECT gs.question_started_at, gs.status
    INTO v_question_started_at, v_session_status
    FROM game_sessions gs
    JOIN players p ON p.session_id = gs.id
   WHERE p.id = p_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player or session not found';
  END IF;

  -- 3. Reject if session is not in question_active state
  IF v_session_status != 'question_active' THEN
    RAISE EXCEPTION 'No active question to answer';
  END IF;

  -- 4. Check if answer already submitted (idempotency)
  IF EXISTS (
    SELECT 1 FROM answers
     WHERE player_id = p_player_id AND question_id = p_question_id
  ) THEN
    RAISE EXCEPTION 'Already answered this question';
  END IF;

  -- 5. Determine correctness
  v_is_correct := (p_chosen = v_correct_option);

  -- 6. Compute speed-bonus score (1000 at 0s, 500 at 30s, linear)
  IF v_is_correct AND v_question_started_at IS NOT NULL THEN
    v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_question_started_at));
    v_elapsed := LEAST(v_elapsed, 30.0);  -- cap at 30s
    v_elapsed := GREATEST(v_elapsed, 0.0); -- floor at 0s
    v_points := ROUND(1000 - (v_elapsed / 30.0) * 500)::integer;
    v_points := GREATEST(v_points, 500);  -- minimum 500 if correct
  END IF;

  -- 7. Insert the answer
  INSERT INTO answers (player_id, question_id, chosen_option, points_awarded)
  VALUES (p_player_id, p_question_id, p_chosen, v_points);

  -- 8. Update player's total score
  UPDATE players
     SET score = score + v_points
   WHERE id = p_player_id;

  -- 9. Return result
  RETURN jsonb_build_object(
    'correct', v_is_correct,
    'points_awarded', v_points,
    'correct_option', v_correct_option
  );
END;
$$;

-- ============================================================
-- generate_session_pin
-- Generates a unique 6-digit PIN not currently in use by
-- any active (non-finished) session.
-- ============================================================
CREATE OR REPLACE FUNCTION generate_session_pin()
RETURNS char(6)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin char(6);
  v_attempts integer := 0;
BEGIN
  LOOP
    v_pin := LPAD(FLOOR(random() * 1000000)::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM game_sessions
       WHERE pin = v_pin AND status != 'finished'
    );
    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique PIN after 100 attempts';
    END IF;
  END LOOP;
  RETURN v_pin;
END;
$$;

-- ============================================================
-- get_question_answer_counts
-- Returns answer distribution for a given question + session.
-- Used by host reveal screen.
-- ============================================================
CREATE OR REPLACE FUNCTION get_question_answer_counts(
  p_session_id  uuid,
  p_question_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'a', COUNT(*) FILTER (WHERE a.chosen_option = 'a'),
    'b', COUNT(*) FILTER (WHERE a.chosen_option = 'b'),
    'c', COUNT(*) FILTER (WHERE a.chosen_option = 'c'),
    'd', COUNT(*) FILTER (WHERE a.chosen_option = 'd'),
    'total_players', (SELECT COUNT(*) FROM players WHERE session_id = p_session_id),
    'answered', COUNT(*)
  )
    INTO v_result
    FROM answers a
    JOIN players pl ON pl.id = a.player_id
   WHERE pl.session_id = p_session_id
     AND a.question_id = p_question_id;

  RETURN v_result;
END;
$$;

-- ============================================================
-- get_session_leaderboard
-- Returns top N players by score for a session.
-- ============================================================
CREATE OR REPLACE FUNCTION get_session_leaderboard(
  p_session_id uuid,
  p_limit      integer DEFAULT 50
)
RETURNS TABLE(rank bigint, name text, score integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY score DESC) AS rank,
    name,
    score
  FROM players
  WHERE session_id = p_session_id
  ORDER BY score DESC
  LIMIT p_limit;
$$;
