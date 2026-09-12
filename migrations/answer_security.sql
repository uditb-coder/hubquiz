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
