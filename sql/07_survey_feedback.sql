-- ============================================================
-- HubQuiz - Post-Quiz Micro-Surveys (07_survey_feedback.sql)
-- Run this in your Supabase SQL Editor (Cloud and JP Nagar)
--
-- Strict Anonymity:
--   Stores survey answers with zero user IDs, emails, player IDs, or session IDs.
-- Decoupled State:
--   Tracks mentor prompt completion / dismissal count independently with no links or foreign keys to answers.
-- ============================================================

-- 1. Anonymous survey responses table
CREATE TABLE IF NOT EXISTS public.hubquiz_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_version text NOT NULL DEFAULT 'v1',
  audience text NOT NULL CHECK (audience IN ('mentor', 'student')),
  q1_answer text NOT NULL,
  q2_answer text NOT NULL,
  q3_answer text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.hubquiz_survey_responses ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated users to submit responses
DROP POLICY IF EXISTS "survey_insert_policy" ON public.hubquiz_survey_responses;
CREATE POLICY "survey_insert_policy"
  ON public.hubquiz_survey_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow authenticated users to view survey analytics / reports
DROP POLICY IF EXISTS "survey_select_policy" ON public.hubquiz_survey_responses;
CREATE POLICY "survey_select_policy"
  ON public.hubquiz_survey_responses
  FOR SELECT
  TO authenticated
  USING (true);

-- Index for analytics aggregation by survey version and audience
CREATE INDEX IF NOT EXISTS idx_survey_version_audience 
  ON public.hubquiz_survey_responses (survey_version, audience);


-- 2. Decoupled mentor survey state table
-- Note: Contains zero foreign keys or links to hubquiz_survey_responses
CREATE TABLE IF NOT EXISTS public.mentor_survey_state (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survey_version text NOT NULL DEFAULT 'v1',
  completed boolean NOT NULL DEFAULT false,
  dismiss_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, survey_version)
);

-- Enable Row Level Security
ALTER TABLE public.mentor_survey_state ENABLE ROW LEVEL SECURITY;

-- Allow mentors to read and manage their own survey state
DROP POLICY IF EXISTS "mentor_state_select_own" ON public.mentor_survey_state;
CREATE POLICY "mentor_state_select_own"
  ON public.mentor_survey_state
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mentor_state_insert_own" ON public.mentor_survey_state;
CREATE POLICY "mentor_state_insert_own"
  ON public.mentor_survey_state
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mentor_state_update_own" ON public.mentor_survey_state;
CREATE POLICY "mentor_state_update_own"
  ON public.mentor_survey_state
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
