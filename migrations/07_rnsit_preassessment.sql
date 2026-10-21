-- ============================================================
-- Quiz: RNSIT Pre Assesment
-- Creates or replaces the quiz for ALL users in auth.users
-- ============================================================
DO $$
DECLARE
    u RECORD;
    v_quiz_id UUID;
    v_title TEXT := 'RNSIT Pre Assesment';
BEGIN
    FOR u IN SELECT id FROM auth.users
    LOOP
        -- Check if quiz already exists for this user
        SELECT id INTO v_quiz_id FROM quizzes WHERE created_by = u.id AND title = v_title LIMIT 1;
        
        IF v_quiz_id IS NOT NULL THEN
            -- Delete existing questions to refresh them
            DELETE FROM questions WHERE quiz_id = v_quiz_id;
        ELSE
            -- Create new quiz
            INSERT INTO quizzes (title, created_by, created_at)
            VALUES (v_title, u.id, NOW())
            RETURNING id INTO v_quiz_id;
        END IF;
        
        -- Insert the 20 questions
        INSERT INTO questions (quiz_id, order_index, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES
            (v_quiz_id, 0, 'A team interviews bus commuters before designing a ticket app. Which Design Thinking stage is this?', 'Empathize', 'Define', 'Ideate', 'Test', 'a'::answer_option),
            (v_quiz_id, 1, 'Which is the correct order of the Design Thinking stages?', 'Empathize, Define, Ideate, Prototype, Test', 'Define, Empathize, Prototype, Ideate, Test', 'Ideate, Define, Empathize, Test, Prototype', 'Prototype, Test, Empathize, Define, Ideate', 'a'::answer_option),
            (v_quiz_id, 2, 'First aeroplane built vs. flights made affordable for all. Which is the invention and which the innovation?', 'Aeroplane = invention; cheap flights = innovation', 'Aeroplane = innovation; cheap flights = invention', 'Both are inventions', 'Both are innovations', 'a'::answer_option),
            (v_quiz_id, 3, 'You are designing a school bag for Class 1 children. What is the most human-centred first step?', 'Pick the cheapest material', 'Observe children and parents carrying bags daily', 'Copy the most popular brand', 'Let engineers decide the size', 'b'::answer_option),
            (v_quiz_id, 4, 'In an empathy map, ''checks phone every 2 minutes'' belongs under which quadrant?', 'Says', 'Thinks', 'Does', 'Feels', 'c'::answer_option),
            (v_quiz_id, 5, 'Which is a good, solution-free problem statement?', 'We need an app for farmers', 'Farmers lose crops because they learn of rain only after it starts', 'Build a drone to spray water', 'Farmers are poor at using technology', 'b'::answer_option),
            (v_quiz_id, 6, 'Which is a well-framed ''How Might We'' question?', 'HMW build a mobile app for hostel food?', 'HMW help hostel students get hot meals without long queues?', 'HMW make students stop complaining?', 'HMW buy a bigger canteen?', 'b'::answer_option),
            (v_quiz_id, 7, 'Designing a ramp for a college library: who is a SECONDARY stakeholder?', 'Wheelchair-using students', 'Library staff who help and maintain it', 'A student who never visits', 'The ramp''s paint', 'b'::answer_option),
            (v_quiz_id, 8, 'Which statement is an observation, not an assumption?', 'Users hate the app', 'Three users quit at the payment screen', 'Users want more colours', 'The app is too slow', 'b'::answer_option),
            (v_quiz_id, 9, 'Which is the best interview question to learn how a user buys vegetables?', 'Do you like vegetables?', 'Don''t you think the market is dirty?', 'Walk me through the last time you bought vegetables', 'Would you pay Rs 50 for an app?', 'c'::answer_option),
            (v_quiz_id, 10, 'Student is late daily. Why 1: the bus is late. What is the best next 5 Why question?', 'Why do students never wake up?', 'Why is the bus late?', 'Who is to blame?', 'How can we buy a bike?', 'b'::answer_option),
            (v_quiz_id, 11, 'Which rule helps a brainstorm produce the most ideas?', 'Criticize weak ideas quickly', 'Defer judgement and go for quantity', 'Let the senior member speak first', 'Pick one idea early', 'b'::answer_option),
            (v_quiz_id, 12, 'What does the ''Crazy 8s'' method ask you to do?', 'Sketch 8 ideas in 8 minutes', 'Vote 8 times', 'Build 8 prototypes in a day', 'Interview 8 users', 'a'::answer_option),
            (v_quiz_id, 13, 'Why build a cardboard model before the final product?', 'To impress investors', 'To learn cheaply what works and what does not', 'Because cardboard is eco-friendly', 'To skip user testing', 'b'::answer_option),
            (v_quiz_id, 14, 'A hand-drawn app screen with sticky-note buttons is what type of prototype?', 'Low-fidelity', 'Mid-fidelity', 'High-fidelity', 'Final product', 'a'::answer_option),
            (v_quiz_id, 15, 'In a test, a user cannot find the ''Pay'' button. What should the designer do?', 'Tell the user where it is and move on', 'Note it as a usability issue and improve the design', 'Say the user is careless', 'Ignore it, one user is not enough', 'b'::answer_option),
            (v_quiz_id, 16, 'Your paper prototype failed its first test. The Design Thinking mindset treats this as:', 'A failure to hide', 'Cheap learning to improve the next version', 'Proof the idea is bad', 'A sign to quit', 'b'::answer_option),
            (v_quiz_id, 17, 'Users love your idea but it costs 10x what they can pay. Which lens fails?', 'Desirability', 'Feasibility', 'Viability', 'None', 'c'::answer_option),
            (v_quiz_id, 18, 'What is the best MVP for a hostel food-delivery idea?', 'A full app with payments and tracking', 'A WhatsApp group taking orders and delivering manually for a week', 'A logo and brand name', 'A 20-page business plan', 'b'::answer_option),
            (v_quiz_id, 19, 'Which is NOT a Design Thinking activity?', 'Shadowing users', 'Sketching ideas', 'Fixing the solution first and finding users to agree', 'Testing a prototype', 'c'::answer_option);
    END LOOP;
END;
$$;