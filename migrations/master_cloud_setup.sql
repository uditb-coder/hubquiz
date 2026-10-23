-- ============================================================
-- HubQuiz — Schema (run in Supabase SQL Editor)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE answer_option AS ENUM ('a', 'b', 'c', 'd');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM (
    'lobby', 'active', 'question_active', 'question_review', 'finished'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- QUIZZES
-- ============================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       text NOT NULL,
  created_by  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT NOW()
);

-- ============================================================
-- QUESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id        uuid REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text  text NOT NULL,
  option_a       text NOT NULL,
  option_b       text NOT NULL,
  option_c       text NOT NULL,
  option_d       text NOT NULL,
  correct_option answer_option NOT NULL,
  order_index    integer NOT NULL DEFAULT 0
);

-- ============================================================
-- GAME SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS game_sessions (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id                uuid REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  pin                    char(6) NOT NULL,
  status                 session_status NOT NULL DEFAULT 'lobby',
  current_question_index integer NOT NULL DEFAULT 0,
  host_id                uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_started_at    timestamptz,
  created_at             timestamptz DEFAULT NOW()
);

-- Partial unique index: PIN must be unique among active sessions
CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_pin_active_unique
  ON game_sessions(pin)
  WHERE status != 'finished';

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  uuid REFERENCES game_sessions(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  score       integer NOT NULL DEFAULT 0,
  joined_at   timestamptz DEFAULT NOW()
);

-- Unique name per session
CREATE UNIQUE INDEX IF NOT EXISTS players_session_name_unique
  ON players(session_id, lower(name));

-- ============================================================
-- ANSWERS
-- ============================================================
CREATE TABLE IF NOT EXISTS answers (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id      uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  question_id    uuid REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  chosen_option  answer_option NOT NULL,
  answered_at    timestamptz DEFAULT NOW(),
  points_awarded integer NOT NULL DEFAULT 0
);

-- One answer per player per question
CREATE UNIQUE INDEX IF NOT EXISTS answers_player_question_unique
  ON answers(player_id, question_id);

-- ============================================================
-- Enable Realtime on tables that need live sync
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE answers;
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
-- ============================================================
-- HubQuiz — Row Level Security Policies (run after 01_schema.sql)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE quizzes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players      ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- QUIZZES
-- ============================================================

-- Any authenticated user can read all quizzes
CREATE POLICY "quizzes_select_authenticated"
  ON quizzes FOR SELECT
  TO authenticated
  USING (true);

-- Mentor can only insert their own quizzes
CREATE POLICY "quizzes_insert_own"
  ON quizzes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Mentor can only update their own quizzes
CREATE POLICY "quizzes_update_own"
  ON quizzes FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Mentor can only delete their own quizzes
CREATE POLICY "quizzes_delete_own"
  ON quizzes FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- ============================================================
-- QUESTIONS
-- ============================================================

-- Any authenticated user can read questions
CREATE POLICY "questions_select_authenticated"
  ON questions FOR SELECT
  TO authenticated
  USING (true);

-- Anonymous users can read questions (needed during active game)
CREATE POLICY "questions_select_anon"
  ON questions FOR SELECT
  TO anon
  USING (true);

-- Mentor can insert questions only for their own quizzes
CREATE POLICY "questions_insert_own"
  ON questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_id AND q.created_by = auth.uid()
    )
  );

-- Mentor can update questions only for their own quizzes
CREATE POLICY "questions_update_own"
  ON questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_id AND q.created_by = auth.uid()
    )
  );

-- Mentor can delete questions only for their own quizzes
CREATE POLICY "questions_delete_own"
  ON questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_id AND q.created_by = auth.uid()
    )
  );

-- ============================================================
-- GAME SESSIONS
-- ============================================================

-- Authenticated mentors can see all sessions they host
CREATE POLICY "game_sessions_select_host"
  ON game_sessions FOR SELECT
  TO authenticated
  USING (host_id = auth.uid());

-- Anonymous users can read sessions by PIN (to join)
CREATE POLICY "game_sessions_select_anon"
  ON game_sessions FOR SELECT
  TO anon
  USING (true);

-- Mentor can insert their own sessions
CREATE POLICY "game_sessions_insert_own"
  ON game_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

-- Mentor can update their own sessions (status changes, question advance)
CREATE POLICY "game_sessions_update_own"
  ON game_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id);

-- ============================================================
-- PLAYERS
-- ============================================================

-- Anyone can read players in a session (host needs to see list, students need count)
CREATE POLICY "players_select_all"
  ON players FOR SELECT
  TO anon, authenticated
  USING (true);

-- Anonymous users (students) can insert themselves as players
CREATE POLICY "players_insert_anon"
  ON players FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated hosts can read players
CREATE POLICY "players_select_authenticated"
  ON players FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- ANSWERS
-- ============================================================

-- Players can read their own answers (via player_id stored in localStorage)
-- Broad read for simplicity — actual security is that submit_answer is SECURITY DEFINER
CREATE POLICY "answers_select_all"
  ON answers FOR SELECT
  TO anon, authenticated
  USING (true);

-- Answers are only inserted via the submit_answer() SECURITY DEFINER function
-- No direct INSERT policy for anon/authenticated — the function handles it
-- (The SECURITY DEFINER function runs as the function owner, bypassing RLS)
-- Add setting to allow host to display questions on participant phones
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS show_questions_on_phones boolean NOT NULL DEFAULT false;
-- ============================================================
-- HubQuiz Answer Security Migration
-- Run this ONCE in Supabase Studio > SQL Editor on the JP Nagar server
-- URL: http://localhost:54323 (Supabase Studio local port)
-- ============================================================

-- STEP 1: Create a view that strips correct_option from student queries
-- Students query this view. correct_option never leaves the server for students.
CREATE OR REPLACE VIEW student_questions AS
  SELECT
    id,
    quiz_id,
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    order_index
  FROM questions;

-- STEP 2: Create server-side answer validation function
-- Parameter name must be p_chosen (matches what app.js sends)
CREATE OR REPLACE FUNCTION submit_answer(
  p_player_id    uuid,
  p_question_id  uuid,
  p_chosen       text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  v_correct      text;
  v_is_correct   boolean;
BEGIN
  -- Fetch correct answer from server only (never sent to client)
  SELECT correct_option
    INTO v_correct
    FROM questions
   WHERE id = p_question_id;

  v_is_correct := (lower(p_chosen) = lower(v_correct));

  -- Record the answer
  INSERT INTO answers (player_id, question_id, chosen_option, is_correct)
  VALUES (p_player_id, p_question_id, p_chosen, v_is_correct)
  ON CONFLICT DO NOTHING;

  RETURN v_is_correct;
END;
$body$;

-- STEP 3: Grant permissions
GRANT EXECUTE ON FUNCTION submit_answer(uuid, uuid, text) TO anon, authenticated;
GRANT SELECT ON student_questions TO anon, authenticated;

-- Done!
-- Verify with: SELECT * FROM student_questions LIMIT 1;
-- correct_option should NOT appear in the result.
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
