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
