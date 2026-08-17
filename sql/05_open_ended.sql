-- ============================================================
-- HubQuiz — Database Migration for Open-Ended Questions
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add question_type to questions table
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS question_type text DEFAULT 'mcq';

-- 2. Make MCQ fields optional in questions table
ALTER TABLE public.questions
ALTER COLUMN option_a DROP NOT NULL,
ALTER COLUMN option_b DROP NOT NULL,
ALTER COLUMN option_c DROP NOT NULL,
ALTER COLUMN option_d DROP NOT NULL,
ALTER COLUMN correct_option DROP NOT NULL;

-- 3. Update answers table for text input
ALTER TABLE public.answers
ADD COLUMN IF NOT EXISTS chosen_text text;

ALTER TABLE public.answers
ALTER COLUMN chosen_option DROP NOT NULL;

-- 4. Create new function to handle open-ended answers
CREATE OR REPLACE FUNCTION submit_open_answer(
  p_player_id    uuid,
  p_question_id  uuid,
  p_chosen_text  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_status  session_status;
BEGIN
  -- 1. Fetch session state for the player's session
  SELECT gs.status
    INTO v_session_status
    FROM game_sessions gs
    JOIN players p ON p.session_id = gs.id
   WHERE p.id = p_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player or session not found';
  END IF;

  -- 2. Reject if session is not in question_active state
  IF v_session_status != 'question_active' THEN
    RAISE EXCEPTION 'No active question to answer';
  END IF;

  -- 3. Check if answer already submitted (idempotency)
  IF EXISTS (
    SELECT 1 FROM answers
     WHERE player_id = p_player_id AND question_id = p_question_id
  ) THEN
    RAISE EXCEPTION 'Already answered this question';
  END IF;

  -- 4. Insert the answer (0 points for open-ended)
  INSERT INTO answers (player_id, question_id, chosen_text, points_awarded)
  VALUES (p_player_id, p_question_id, p_chosen_text, 0);

  -- 5. Return result
  RETURN jsonb_build_object(
    'success', true,
    'points_awarded', 0
  );
END;
$$;
