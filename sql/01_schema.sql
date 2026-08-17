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
