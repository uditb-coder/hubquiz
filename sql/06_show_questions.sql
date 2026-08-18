-- Add setting to allow host to display questions on participant phones
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS show_questions_on_phones boolean NOT NULL DEFAULT false;
