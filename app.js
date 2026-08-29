// ============================================================
// app.js — HubQuiz Main Application
// Router + Auth + Host Game Logic + Student Game Logic
// ============================================================

/* global HQ_SUPABASE, AudioEngine, Confetti */

// ---- Constants ----
const QUESTION_TIME = 30; // seconds (global, fixed)
const ANSWER_COLORS = {
  a: { bg: '#0d9488', label: 'A', symbol: '▲' },
  b: { bg: '#F59E0B', label: 'B', symbol: '♦' },
  c: { bg: '#1E293B', label: 'C', symbol: '●' },
  d: { bg: '#f43f5e', label: 'D', symbol: '■' },
};

// ---- App State ----
const State = {
  user:         null,   // Supabase auth user (mentor)
  session:      null,   // current game_session row
  quiz:         null,   // current quiz row
  questions:    [],     // ordered questions array
  players:      [],     // players in session
  playerSelf:   null,   // student's own player row (stored in localStorage)
  realtimeCh:   null,   // Supabase realtime channel
  timerInterval: null,
  muted:        false,
};

// ---- Router ----
const routes = {
  '/':       showJoinOrDashboard,
  '/login':  showLogin,
  '/host':   showDashboard,
  '/play':   showStudentJoin,
};

function navigate(path, params = {}) {
  const url = new URL(window.location.href);
  url.pathname = path;
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  window.history.pushState({}, '', url.toString());
  route();
}

function route() {
  const path = window.location.pathname;
  const handler = routes[path] || routes['/'];
  handler();
}

window.addEventListener('popstate', route);

// ---- Bootstrap ----
document.addEventListener('DOMContentLoaded', async () => {
  // Unlock audio on first interaction
  document.addEventListener('click', () => AudioEngine.unlock(), { once: true });

  // Restore mute preference
  State.muted = localStorage.getItem('hq_muted') === 'true';
  AudioEngine.setMute(State.muted);

  // Check auth
  const { data: { session } } = await HQ_SUPABASE.auth.getSession();
  State.user = session?.user ?? null;

  // Listen for auth changes
  HQ_SUPABASE.auth.onAuthStateChange((_event, session) => {
    State.user = session?.user ?? null;
  });

  // Global listener to close enlarged QR code when clicking outside
  document.addEventListener('click', (e) => {
    const qrImg = document.getElementById('lobby-qr-img');
    if (qrImg && qrImg.classList.contains('qr-enlarged')) {
      if (e.target !== qrImg) {
        qrImg.classList.remove('qr-enlarged');
      }
    }
  });

  route();
});

// ============================================================
// ---- AUTH VIEWS ----
// ============================================================

function showJoinOrDashboard() {
  if (State.user) {
    navigate('/host');
  } else {
    navigate('/play');
  }
}

function showLogin() {
  renderView('login');
  const form = document.getElementById('login-form');
  const signupLink = document.getElementById('show-signup');
  const signupForm = document.getElementById('signup-form');
  const backLink = document.getElementById('back-to-login');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn      = document.getElementById('login-btn');
    setLoading(btn, true);
    clearError('login-error');

    try {
      const { error } = await HQ_SUPABASE.auth.signInWithPassword({ email, password });
      setLoading(btn, false);
      if (error) {
        showError('login-error', error.message);
      } else {
        const { data: { session } } = await HQ_SUPABASE.auth.getSession();
        State.user = session?.user;
        navigate('/host');
      }
    } catch (err) {
      setLoading(btn, false);
      showError('login-error', err.message || 'Network error occurred');
    }
  });

  document.getElementById('show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-panel').classList.add('hidden');
    document.getElementById('signup-panel').classList.remove('hidden');
  });

  document.getElementById('back-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signup-panel').classList.add('hidden');
    document.getElementById('login-panel').classList.remove('hidden');
  });

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const name     = document.getElementById('signup-name').value.trim();
    const btn      = document.getElementById('signup-btn');

    if (!email.endsWith('@erafoundationindia.org') && !email.endsWith('@comedkares.org')) {
      showError('signup-error', 'Mentors must use an @erafoundationindia.org or @comedkares.org email.');
      return;
    }

    setLoading(btn, true);
    clearError('signup-error');

    try {
      const { error } = await HQ_SUPABASE.auth.signUp({
        email, password,
        options: { data: { display_name: name } }
      });
      setLoading(btn, false);
      if (error) {
        showError('signup-error', error.message);
      } else {
        showError('signup-error', 'Account created! Please check your email to confirm, then sign in.', 'success');
      }
    } catch (err) {
      setLoading(btn, false);
      showError('signup-error', err.message || 'Network error occurred');
    }
  });
}

// ============================================================
// ---- DASHBOARD VIEW ----
// ============================================================

async function showDashboard() {
  if (!State.user) { navigate('/login'); return; }

  renderView('dashboard'); // Render dashboard first so modals overlay it, not the login view.
  
  const ADMIN_ID = '3a161b9f-96a0-4440-b2d5-1db1881d4e88';
  if (State.user.id === ADMIN_ID) {
    document.getElementById('template-fdp-btn').style.display = 'inline-flex';
  } else {
    document.getElementById('template-fdp-btn').style.display = 'none';
  }

  // Stop any lingering audio
  AudioEngine.stopLobbyMusic();
  AudioEngine.stopCountdownMusic();

  // Check for active session recovery
  const { data: activeSessions } = await HQ_SUPABASE.from('game_sessions')
    .select('*, quiz:quizzes(*, questions(*)), players(*)')
    .eq('host_id', State.user.id)
    .in('status', ['lobby', 'active', 'question_active', 'question_review'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (activeSessions && activeSessions.length > 0) {
    const s = activeSessions[0];
    
    // Custom modal promise
    const wantsToResume = await new Promise((resolve) => {
      const overlay = document.getElementById('resume-modal-overlay');
      overlay.classList.remove('hidden');
      document.getElementById('resume-yes-btn').onclick = () => {
        overlay.classList.add('hidden');
        resolve(true);
      };
      document.getElementById('resume-no-btn').onclick = () => {
        overlay.classList.add('hidden');
        resolve(false);
      };
    });

    if (wantsToResume) {
      State.session = s;
      State.quiz = s.quiz;
      State.questions = s.quiz.questions.sort((a,b) => a.order_index - b.order_index);
      State.players = s.players || [];
      
      if (s.status === 'lobby') {
        showHostLobby();
      } else if (s.status === 'question_review') {
        subscribeHostChannel(); // re-subscribe
        hostShowReveal(s.questions[s.current_question_index]?.id);
      } else {
        subscribeHostChannel(); // re-subscribe
        hostShowQuestion(s.current_question_index);
      }
      return;
    } else {
      // Mark ALL active sessions as finished so they don't pop up again
      await HQ_SUPABASE.from('game_sessions')
        .update({ status: 'finished' })
        .eq('host_id', State.user.id)
        .in('status', ['lobby', 'active', 'question_active', 'question_review']);
    }
  }

  loadQuizList();
  loadSessionHistory();

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await HQ_SUPABASE.auth.signOut();
    State.user = null;
    navigate('/login');
  });

  document.getElementById('new-quiz-btn')?.addEventListener('click', () => {
    showQuizModal(null);
  });

  document.getElementById('template-vtu-btn')?.addEventListener('click', async (e) => {
    const btn = e.target;
    const originalText = btn.textContent;
    btn.textContent = 'Importing Curriculum...';
    btn.disabled = true;

    try {
      const vtuCurriculum = [
        {
          title: 'VTU Week 1-3: Orientation & Team Formation',
          questions: [
            { order_index: 0, question_text: 'What is the key difference between Innovation and Invention?', option_a: 'Invention is creating something new; Innovation adds value to it', option_b: 'Innovation is just an idea; Invention is a physical product', option_c: 'They are exactly the same thing', option_d: 'Invention is only for engineers; Innovation is for managers', correct_option: 'a' },
            { order_index: 1, question_text: 'What are the 5 core stages of Design Thinking in the correct order?', option_a: 'Empathize, Define, Ideate, Prototype, Test', option_b: 'Define, Empathize, Prototype, Ideate, Test', option_c: 'Ideate, Prototype, Empathize, Define, Test', option_d: 'Test, Prototype, Ideate, Define, Empathize', correct_option: 'a' },
            { order_index: 2, question_text: 'Why are interdisciplinary teams important in Design Thinking?', option_a: 'To finish the project faster', option_b: 'To bring diverse perspectives and skills to problem-solving', option_c: 'Because it is a university rule', option_d: 'To reduce the total cost of the project', correct_option: 'b' },
            { order_index: 3, question_text: 'What is the primary purpose of the warm-up activities in Week 3?', option_a: 'To assess individual programming skills', option_b: 'To finalize the business model', option_c: 'To foster creative thinking and team bonding', option_d: 'To pitch to the jury', correct_option: 'c' }
          ]
        },
        {
          title: 'VTU Week 4-5: Empathy & Field Exploration',
          questions: [
            { order_index: 0, question_text: 'Which of the following is an example of field exploration?', option_a: 'Reading a textbook in the library', option_b: 'Visiting a village or NGO to observe user challenges', option_c: 'Watching a tutorial video online', option_d: 'Writing code in the lab', correct_option: 'b' },
            { order_index: 1, question_text: 'Why is stakeholder interaction crucial during the Empathy stage?', option_a: 'To understand the real needs and pain points of the users', option_b: 'To convince them to buy the product', option_c: 'To ask them for funding', option_d: 'To show off the final prototype', correct_option: 'a' },
            { order_index: 2, question_text: 'Where must all field interaction and observations be recorded?', option_a: 'On a personal blog', option_b: 'In a digital word document', option_c: 'In the handwritten activity book prescribed by the University', option_d: 'They do not need to be recorded', correct_option: 'c' },
            { order_index: 3, question_text: 'Empathy in design thinking means:', option_a: 'Feeling sorry for the users', option_b: "Putting yourself in the user's shoes to deeply understand their experience", option_c: 'Designing what you personally think is best', option_d: 'Ignoring user feedback', correct_option: 'b' }
          ]
        },
        {
          title: 'VTU Week 6-8: Problem Definition',
          questions: [
            { order_index: 0, question_text: 'What does "HMW" stand for in problem framing?', option_a: 'How Might We', option_b: 'How Many Ways', option_c: 'Have More Wisdom', option_d: 'Help Me Win', correct_option: 'a' },
            { order_index: 1, question_text: 'Which tool is used to group related user insights?', option_a: '3D Printer', option_b: 'Affinity Clustering', option_c: 'Arduino', option_d: 'Digital Multimeter', correct_option: 'b' },
            { order_index: 2, question_text: 'What is the purpose of a Problem Tree?', option_a: 'To plant trees for eco-friendly ideas', option_b: 'To map out the root causes and effects of a core problem', option_c: 'To design the aesthetic of the product', option_d: 'To track team attendance', correct_option: 'b' },
            { order_index: 3, question_text: 'A clearly defined challenge statement should be:', option_a: 'Vague and open-ended', option_b: 'Focused purely on technology', option_c: 'Human-centered and actionable', option_d: 'Written by the jury', correct_option: 'c' }
          ]
        },
        {
          title: 'VTU Week 9-11: Ideation Sprint',
          questions: [
            { order_index: 0, question_text: 'What is the main goal of an Ideation Sprint?', option_a: 'Generating a large quantity of diverse ideas', option_b: 'Selecting just one perfect idea immediately', option_c: 'Building the final prototype', option_d: 'Writing the final report', correct_option: 'a' },
            { order_index: 1, question_text: 'What is Mind Mapping used for?', option_a: 'Testing electrical circuits', option_b: 'Visually organizing information and ideas around a central concept', option_c: 'Calculating the budget', option_d: 'Creating 3D models', correct_option: 'b' },
            { order_index: 2, question_text: 'During Idea Filtering, which criteria are emphasized for selecting a suitable idea?', option_a: 'Expensive, complex, and trendy', option_b: 'Creative, eco-friendly, and feasible', option_c: 'Random, untested, and easy', option_d: 'Profitable, loud, and digital', correct_option: 'b' },
            { order_index: 3, question_text: 'What happens immediately after the best idea is shortlisted in Week 10?', option_a: 'The project is considered finished', option_b: 'The team pitches to the jury', option_c: 'Designing and Structuring of the Prototype model begins', option_d: 'Another field visit is scheduled', correct_option: 'c' }
          ]
        },
        {
          title: 'VTU Week 12-14: Rapid Prototyping',
          questions: [
            { order_index: 0, question_text: 'What is a "low-fidelity" prototype?', option_a: 'A fully functional, expensive product ready for market', option_b: 'A quick, simple, and cheap representation of the idea (e.g., using cardboard or paper)', option_c: 'A prototype that does not work at all', option_d: 'A prototype built with low-quality materials that breaks easily', correct_option: 'b' },
            { order_index: 1, question_text: 'Which of the following tools might be used in the Atal Idea Lab for fabrication?', option_a: 'Only Microsoft Word', option_b: 'Arduino, electronics kits, and 3D printers', option_c: 'Only handwritten activity books', option_d: 'Microscopes and test tubes', correct_option: 'b' },
            { order_index: 2, question_text: 'What is the purpose of User Testing in Week 14?', option_a: "To test the students' knowledge", option_b: 'To collect feedback from users to iterate and improve the design', option_c: 'To grade the prototype', option_d: 'To sell the prototype', correct_option: 'b' },
            { order_index: 3, question_text: 'What document is drafted alongside the iterations in Week 14?', option_a: 'A social venture plan / business model for impact', option_b: 'The final exam question paper', option_c: 'A personal diary', option_d: 'A legal patent application', correct_option: 'a' }
          ]
        },
        {
          title: 'VTU Week 15-16: Final Demo & Social Pitch',
          questions: [
            { order_index: 0, question_text: 'What is the primary focus of the final social pitch?', option_a: 'Only the technical details of the code', option_b: 'Presenting the project impact, prototype, and sustainability plan', option_c: 'Explaining how hard the team worked', option_d: 'Asking for good grades', correct_option: 'b' },
            { order_index: 1, question_text: 'What is the minimum qualifying score for the Continuous Internal Evaluation (CIE)?', option_a: '18 out of 50', option_b: '20 out of 50', option_c: '35 out of 50', option_d: '40 out of 50', correct_option: 'b' },
            { order_index: 2, question_text: 'What percentage of the overall course grade is determined by the Semester End Examination (SEE)?', option_a: '20%', option_b: '30%', option_c: '50%', option_d: '100%', correct_option: 'c' },
            { order_index: 3, question_text: 'Who evaluates the SEE exhibition and Viva-voce?', option_a: 'Only the internal faculty', option_b: 'Only external industry experts', option_c: 'One Internal and one External Examiner', option_d: 'The students grade each other', correct_option: 'c' }
          ]
        }
      ];

      for (const template of vtuCurriculum) {
        // Create quiz
        const { data: qz, error: qzErr } = await HQ_SUPABASE.from('quizzes')
          .insert([{ title: template.title, created_by: State.user.id }])
          .select().single();
        
        if (qzErr) throw qzErr;

        // Attach quiz_id to questions
        const questions = template.questions.map(q => ({
          ...q,
          quiz_id: qz.id
        }));

        // Insert questions
        const { error: qsErr } = await HQ_SUPABASE.from('questions').insert(questions);
        if (qsErr) throw qsErr;
      }

      await loadQuizList();
      alert('Success! All 6 VTU curriculum quizzes have been imported into your account.');
    } catch (err) {
      alert('Error importing template: ' + err.message);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });

  document.getElementById('template-fdp-btn')?.addEventListener('click', async (e) => {
    const btn = e.target;
    const originalText = btn.textContent;
    btn.textContent = 'Importing...';
    btn.disabled = true;

    try {
      const fdpCurriculum = [
        {
          title: '"Before We Begin..." - Icebreaker Warm-Up',
          questions: [
            { order_index: 0, question_text: 'In one word - how do you feel about facilitating the IDT Lab this semester?', option_a: 'Excited', option_b: 'Nervous', option_c: 'Confused', option_d: 'Ready', correct_option: null },
            { order_index: 1, question_text: 'How many times have YOUR students left the campus to observe a real-world problem before designing a solution?', option_a: 'Never - we haven\'t started yet', option_b: 'Once or twice in a project', option_c: 'It happens regularly in our college', option_d: 'What do you mean "observe"?', correct_option: null },
            { order_index: 2, question_text: 'If a student came to you and said "Sir/Ma\'am, I want to build an app to solve traffic in Bengaluru" - what would YOUR first instinct be?', option_a: 'Help them start coding immediately', option_b: 'Ask them to research what apps already exist', option_c: 'Ask them who they\'ve spoken to who actually experiences traffic problems', option_d: 'Tell them it\'s too ambitious and simplify the problem', correct_option: null },
            { order_index: 3, question_text: 'On a scale of 1 to 4, how confident are you that your students will complete all 5 stages of Design Thinking by Week 16?', option_a: 'Very confident - we have a solid plan', option_b: 'Somewhat confident - there are a few unknowns', option_c: 'Not very confident - I need more clarity on the process', option_d: 'Not at all confident - that\'s why I\'m here today!', correct_option: null },
            { order_index: 4, question_text: 'Which of these best describes how your 1st-year students currently behave in a lab session?', option_a: 'They wait for me to tell them exactly what to do', option_b: 'They dive in and figure things out on their own', option_c: 'They Google everything first, then ask me', option_d: 'Complete chaos - honestly unpredictable!', correct_option: null },
            { order_index: 5, question_text: 'What is the BIGGEST challenge you expect when running the IDT Lab?', option_a: 'Getting students to take it seriously (it\'s not a "real" exam subject)', option_b: 'Managing the field visits and logistics', option_c: 'Understanding the syllabus and assessment myself', option_d: 'Getting students to stop jumping straight to solutions', correct_option: null },
            { order_index: 6, question_text: 'Which of these tools have you personally used before today?', option_a: 'Mind Mapping', option_b: 'Empathy Map', option_c: 'How Might We (HMW) statements', option_d: 'None of the above - I\'m learning today!', correct_option: null },
            { order_index: 7, question_text: 'If Design Thinking were a Bollywood film genre, what would it be?', option_a: 'Action - fast-paced, build fast, break things', option_b: 'Drama - deep emotions, understand people\'s pain', option_c: 'Comedy - wild ideas, nothing is too crazy', option_d: 'Thriller - you never know what the user actually needs!', correct_option: null },
            { order_index: 8, question_text: 'Be honest - before today, had you read the 3 pre-session reading materials we sent?', option_a: 'Yes, all three - thoroughly!', option_b: 'I skimmed one of them', option_c: 'I opened one and closed it immediately', option_d: 'What reading materials?', correct_option: null }
          ]
        },
        {
          title: '"IDT Lab - Are You Ready to Facilitate?"',
          questions: [
            { order_index: 0, question_text: 'How many credits does the IDT Lab (1BIDTL158) carry?', option_a: '2 Credits', option_b: '3 Credits', option_c: '1 Credit', option_d: '4 Credits', correct_option: 'c' },
            { order_index: 1, question_text: 'What is the minimum CIE score a student must achieve to be eligible to write the SEE?', option_a: '15 out of 50', option_b: '25 out of 50', option_c: '20 out of 50', option_d: '30 out of 50', correct_option: 'c' },
            { order_index: 2, question_text: 'During which weeks of the IDT Lab do students conduct Field Visits?', option_a: 'Weeks 1 and 2', option_b: 'Weeks 4 and 5', option_c: 'Weeks 9 and 10', option_d: 'Weeks 12 and 13', correct_option: 'b' },
            { order_index: 3, question_text: 'The "How Might We" (HMW) framework is used in which phase of Design Thinking?', option_a: 'Empathize', option_b: 'Prototype', option_c: 'Define', option_d: 'Test', correct_option: 'c' },
            { order_index: 4, question_text: 'What does the Empathy Map capture? (Select the most complete answer)', option_a: 'What students think about technology', option_b: 'The user\'s Says, Thinks, Does, and Feels', option_c: 'The engineering specifications of a product', option_d: 'The financial cost of a proposed solution', correct_option: 'b' },
            { order_index: 5, question_text: 'In the Design Challenge activity you just completed, you designed a feature for a product (Gloves, Glasses, Bag, or Shoes). What phase of Design Thinking were you experiencing?', option_a: 'Empathize - you were observing a user', option_b: 'Define - you were writing a problem statement', option_c: 'Ideate - you were generating creative solutions', option_d: 'Test - you were validating a prototype', correct_option: 'c' },
            { order_index: 6, question_text: 'Which of the following is a well-framed "How Might We" statement?', option_a: 'How might we build an app to manage library timings?', option_b: 'How might we fix the parking problem?', option_c: 'How might we help commuter students feel confident and less anxious about their campus journey so they arrive on time?', option_d: 'How might we improve everything about the college experience?', correct_option: 'c' },
            { order_index: 7, question_text: 'In the IDT Lab, the field visit is scheduled on:', option_a: 'Any weekday morning', option_b: 'The full day of the 2nd and 4th Saturdays of the month', option_c: 'One specific Friday per month', option_d: 'During regular 2-hour lab sessions in the college', correct_option: 'b' },
            { order_index: 8, question_text: 'What must students submit as part of their SEE requirements?', option_a: 'A typed research report only', option_b: 'Only a working digital prototype', option_c: 'Handwritten Activity Book, Presentation, Physical Prototype, and Peer Feedback', option_d: 'A business plan and investor pitch deck', correct_option: 'c' },
            { order_index: 9, question_text: 'What is the maximum team size allowed in the IDT Lab?', option_a: '3 students', option_b: '8 students', option_c: '10 students', option_d: '6 students', correct_option: 'd' }
          ]
        },
        {
          title: '"Think Like a Designer" - Generative Thinking & Full Day Wrap',
          questions: [
            { order_index: 0, question_text: 'In Gibson\'s library activity, what was the REAL insight revealed after applying the 5 Whys technique?', option_a: 'The library needs longer opening hours', option_b: 'Students need more computers in the library', option_c: 'Students don\'t believe physical books add value over freely available digital content', option_d: 'The library is too far from classrooms', correct_option: 'c' },
            { order_index: 1, question_text: 'Analytical Design Thinking is best described as:', option_a: 'Starting with users and generating many possible answers', option_b: 'Starting with a given problem and converging on the single correct answer', option_c: 'Using AI tools to generate design solutions', option_d: 'Designing aesthetically beautiful products for premium users', correct_option: 'b' },
            { order_index: 2, question_text: 'Generative Design Thinking is best described as:', option_a: 'Using mathematical formulas to solve engineering challenges', option_b: 'Copying best practices from other industries', option_c: 'Starting with people - observing needs and generating multiple possible solutions', option_d: 'Generating as many engineering specifications as possible', correct_option: 'c' },
            { order_index: 3, question_text: 'In the 5 Whys technique, why do we keep asking "Why?" after each answer?', option_a: 'To confuse the student and challenge their thinking', option_b: 'To move beyond surface symptoms and reach the root cause of the problem', option_c: 'Because the VTU syllabus requires 5 questions per problem', option_d: 'To help students memorize the problem better', correct_option: 'b' },
            { order_index: 4, question_text: 'Which of the following is an example of GENERATIVE thinking applied to a campus problem?', option_a: '"The attendance system is broken. Let us fix the software bug."', option_b: '"Students are absent. Let us install a biometric system."', option_c: '"Why do students skip class? Let us observe and interview them across different contexts to discover the real barriers and co-design solutions with them."', option_d: '"Attendance is low. The best engineering colleges enforce attendance strictly, so let us do the same."', correct_option: 'c' },
            { order_index: 5, question_text: 'When a student presents their empathy findings and says, "We surveyed 50 students on WhatsApp and most said the canteen food is bad," what is the most important gap in their research?', option_a: 'They should have surveyed more students', option_b: 'They only have self-reported opinions, not observed behaviour - they never watched real users interact with the canteen', option_c: 'WhatsApp is not a reliable survey platform', option_d: 'They should have also surveyed the canteen staff', correct_option: 'b' },
            { order_index: 6, question_text: 'After completing the Design Challenge (Smart Gloves/Glasses/Bag/Shoes), Gibson revealed that your team "used IMAGINATION, not EMPATHY." What would you do differently to truly apply the Empathy phase before this same activity?', option_a: 'Research competitors\' products online before sketching', option_b: 'Ask teammates what features they personally want in the product', option_c: 'Spend time observing and interviewing actual users of gloves/bags/shoes in real-world contexts before generating any ideas', option_d: 'Watch product review videos on YouTube for inspiration', correct_option: 'c' },
            { order_index: 7, question_text: 'The "How Might We" statement - "How might we increase library usage at our college?" - is an example of:', option_a: 'A perfectly framed HMW question', option_b: 'A HMW that is too narrow - it assumes the goal is usage numbers', option_c: 'A HMW that is too broad - it doesn\'t target a specific user or emotional need', option_d: 'A HMW that is well-framed but needs a shorter phrasing', correct_option: 'c' },
            { order_index: 8, question_text: 'In the IDT Lab, when should students ideally begin building their first prototype?', option_a: 'Immediately after forming their team in Week 3', option_b: 'Only after their HMW statement has been validated and they have completed the Ideation Sprint (after Week 11)', option_c: 'At the end of Week 16 for the final presentation', option_d: 'Whenever the student feels ready, there is no required sequence', correct_option: 'b' },
            { order_index: 9, question_text: 'Based on everything you have learned today, which statement best describes YOUR role as an IDT Lab facilitator?', option_a: 'To evaluate and correct student designs based on engineering principles', option_b: 'To teach students the theory of Design Thinking through lectures each week', option_c: 'To guide students through the 5-phase process by asking questions, creating space for field visits, and celebrating iteration and failure', option_d: 'To ensure students complete all assignments on time and submit their activity books', correct_option: 'c' }
          ]
        }
      ];

      for (const template of fdpCurriculum) {
        // Create quiz
        const { data: qz, error: qzErr } = await HQ_SUPABASE.from('quizzes')
          .insert([{ title: template.title, created_by: State.user.id }])
          .select().single();
        
        if (qzErr) throw qzErr;

        // Attach quiz_id to questions
        const questions = template.questions.map(q => ({
          ...q,
          quiz_id: qz.id
        }));

        // Insert questions
        const { error: qsErr } = await HQ_SUPABASE.from('questions').insert(questions);
        if (qsErr) throw qsErr;
      }

      await loadQuizList();
      alert('Success! FDP Quizzes have been imported into your account.');
    } catch (err) {
      alert('Error importing FDP Quizzes: ' + err.message);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}

async function loadQuizList() {
  const container = document.getElementById('quiz-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner">Loading quizzes...</div>';

  const { data: quizzes, error } = await HQ_SUPABASE
    .from('quizzes')
    .select('*, questions(count)')
    .eq('created_by', State.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="error-msg">${error.message}</div>`;
    return;
  }

  if (!quizzes.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <p>No quizzes yet. Create your first quiz!</p>
      </div>`;
    return;
  }

  container.innerHTML = quizzes.map(q => {
    const qCount = q.questions?.[0]?.count ?? 0;
    return `
      <div class="quiz-card" data-id="${q.id}">
        <div class="quiz-card-body">
          <h3 class="quiz-title">${escHtml(q.title)}</h3>
          <span class="quiz-meta">${qCount} question${qCount !== 1 ? 's' : ''} &bull; Created by ${State.user?.user_metadata?.display_name || 'You'}</span>
        </div>
        <div class="quiz-card-actions">
          <button class="btn btn-primary btn-start" data-id="${q.id}" title="Start Session">
            ▶ Start
          </button>
          <button class="btn btn-icon btn-edit" data-id="${q.id}" title="Edit Quiz">✏️</button>
          <button class="btn btn-icon btn-delete" data-id="${q.id}" title="Delete Quiz">🗑️</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.btn-start').forEach(btn => {
    btn.addEventListener('click', () => startSession(btn.dataset.id));
  });
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editQuiz(btn.dataset.id));
  });
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteQuiz(btn.dataset.id));
  });
}

// ---- Quiz Modal (Create / Edit) ----

function showQuizModal(quizId) {
  const overlay = document.getElementById('quiz-modal-overlay');
  const titleIn = document.getElementById('qm-title');
  const qList   = document.getElementById('qm-questions');
  const form    = document.getElementById('quiz-modal-form');

  overlay.classList.remove('hidden');
  overlay.dataset.quizId = quizId || '';
  titleIn.value = '';
  qList.innerHTML = '';

  if (quizId) {
    loadQuizIntoModal(quizId);
  } else {
    addQuestionRow();
  }

  document.getElementById('qm-add-question')?.addEventListener('click', addQuestionRow);
  document.getElementById('qm-cancel')?.addEventListener('click', closeQuizModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeQuizModal();
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    await saveQuiz(quizId);
  };
}

async function loadQuizIntoModal(quizId) {
  const { data: quiz } = await HQ_SUPABASE.from('quizzes').select('*').eq('id', quizId).single();
  const { data: qs }   = await HQ_SUPABASE.from('questions').select('*').eq('quiz_id', quizId).order('order_index');
  document.getElementById('qm-title').value = quiz.title;
  qs.forEach(q => addQuestionRow(q));
}

function addQuestionRow(q = null) {
  const list = document.getElementById('qm-questions');
  const idx  = list.children.length;
  const div  = document.createElement('div');
  div.className = 'question-row';
  div.dataset.questionId = q?.id || '';
  div.innerHTML = `
    <div class="q-header">
      <span class="q-num">Q${idx + 1}</span>
      <select class="input-field q-type-select" style="width: auto; padding: 4px 8px; font-size: 0.9rem; margin-left: auto; margin-right: 12px; height: 32px; border-radius: 6px;">
        <option value="mcq" ${q?.question_type !== 'open_ended' ? 'selected' : ''}>Multiple Choice</option>
        <option value="open_ended" ${q?.question_type === 'open_ended' ? 'selected' : ''}>Open Ended</option>
      </select>
      <button type="button" class="btn btn-icon q-remove" title="Remove question">🗑</button>
    </div>
    <textarea class="q-text input-field" placeholder="Question text..." required>${escHtml(q?.question_text || '')}</textarea>
    <div class="q-options" style="${q?.question_type === 'open_ended' ? 'display:none;' : ''}">
      ${['a','b','c','d'].map(opt => `
        <label class="option-row option-${opt}">
          <input type="radio" name="correct-${idx}" value="${opt}" ${q?.correct_option === opt ? 'checked' : ''}>
          <span class="opt-label">${opt.toUpperCase()}</span>
          <input type="text" class="input-field opt-input" placeholder="Option ${opt.toUpperCase()}" value="${escHtml(q?.['option_'+opt] || '')}">
        </label>
      `).join('')}
    </div>`;

  const typeSelect = div.querySelector('.q-type-select');
  const optionsDiv = div.querySelector('.q-options');
  typeSelect.addEventListener('change', (e) => {
    optionsDiv.style.display = e.target.value === 'open_ended' ? 'none' : 'grid';
  });
  
  div.querySelector('.q-remove').addEventListener('click', () => {
    div.remove();
    renumberQuestions();
  });
  list.appendChild(div);
}

function renumberQuestions() {
  document.querySelectorAll('.question-row').forEach((row, i) => {
    row.querySelector('.q-num').textContent = `Q${i + 1}`;
    row.querySelectorAll('input[type="radio"]').forEach(r => r.name = `correct-${i}`);
  });
}

function closeQuizModal() {
  document.getElementById('quiz-modal-overlay').classList.add('hidden');
  document.getElementById('quiz-modal-form').onsubmit = null;
}

async function saveQuiz(quizId) {
  const title = document.getElementById('qm-title').value.trim();
  const rows  = document.querySelectorAll('.question-row');
  const btn   = document.getElementById('qm-save');
  setLoading(btn, true);
  clearError('qm-error');

  if (!title) { showError('qm-error', 'Quiz title is required.'); setLoading(btn, false); return; }
  if (rows.length === 0) { showError('qm-error', 'Add at least one question.'); setLoading(btn, false); return; }

  // Build questions array
  const questions = [];
  let valid = true;
  rows.forEach((row, i) => {
    const text    = row.querySelector('.q-text').value.trim();
    const qType   = row.querySelector('.q-type-select').value;
    const opts    = row.querySelectorAll('.opt-input');
    const correct = row.querySelector('input[type="radio"]:checked')?.value;
    
    if (!text) { valid = false; return; }
    if (qType === 'mcq' && !correct) { valid = false; return; }

    questions.push({
      question_text: text,
      question_type: qType,
      option_a:      qType === 'mcq' ? opts[0].value.trim() : null,
      option_b:      qType === 'mcq' ? opts[1].value.trim() : null,
      option_c:      qType === 'mcq' ? opts[2].value.trim() : null,
      option_d:      qType === 'mcq' ? opts[3].value.trim() : null,
      correct_option: qType === 'mcq' ? correct : null,
      order_index:   i,
      quiz_id:       null, // filled after upsert
      id:            row.dataset.questionId || undefined,
    });
  });

  if (!valid) { showError('qm-error', 'Please fill all question texts, and select correct answers for MCQs.'); setLoading(btn, false); return; }

  try {
    let finalQuizId = quizId;

    if (!State.user) {
      const { data: authData } = await HQ_SUPABASE.auth.getSession();
      State.user = authData?.session?.user;
      if (!State.user) {
        throw new Error("You must be logged in to save a quiz. Please refresh the page.");
      }
    }

    if (quizId) {
      // Update existing
      const { error } = await HQ_SUPABASE.from('quizzes').update({ title }).eq('id', quizId);
      if (error) throw error;
    } else {
      // Create new
      const { data, error } = await HQ_SUPABASE.from('quizzes').insert({ title, created_by: State.user.id }).select().single();
      if (error) throw error;
      if (!data) throw new Error("Could not retrieve the newly created quiz data from the server.");
      finalQuizId = data.id;
    }

    // Upsert questions
    const qData = questions.map((q, i) => ({ ...q, quiz_id: finalQuizId, order_index: i }));
    // Delete old questions if editing (delete all, then re-insert/update)
    if (quizId) {
      const existingIds = qData.map(q => q.id).filter(Boolean);
      if (existingIds.length > 0) {
        // Delete only questions not in the current list
        await HQ_SUPABASE.from('questions')
          .delete()
          .eq('quiz_id', quizId)
          .not('id', 'in', `(${existingIds.map(id => `'${id}'`).join(',')})`);
      } else {
        // No existing questions to preserve — delete all and re-insert
        await HQ_SUPABASE.from('questions').delete().eq('quiz_id', quizId);
      }
    }

    for (const q of qData) {
      if (q.id) {
        await HQ_SUPABASE.from('questions').update(q).eq('id', q.id);
      } else {
        const { id: _, ...insertQ } = q;
        await HQ_SUPABASE.from('questions').insert(insertQ);
      }
    }

    closeQuizModal();
    loadQuizList();
  } catch (err) {
    showError('qm-error', err.message);
  } finally {
    setLoading(btn, false);
  }
}

async function editQuiz(quizId) {
  showQuizModal(quizId);
}

async function deleteQuiz(quizId) {
  const wantsToDelete = await new Promise((resolve) => {
    const overlay = document.getElementById('delete-modal-overlay');
    overlay.classList.remove('hidden');
    document.getElementById('delete-confirm-btn').onclick = () => {
      overlay.classList.add('hidden');
      resolve(true);
    };
    document.getElementById('delete-cancel-btn').onclick = () => {
      overlay.classList.add('hidden');
      resolve(false);
    };
  });

  if (!wantsToDelete) return;

  const { data, error } = await HQ_SUPABASE.from('quizzes').delete().eq('id', quizId).select();
  if (error) { 
    alert('Error deleting quiz: ' + error.message); 
    return; 
  }
  if (!data || data.length === 0) {
    alert('Could not delete quiz. You may not have permission, or it was already deleted.');
    return;
  }
  
  loadQuizList();
}

// ============================================================
// ---- START SESSION ----
// ============================================================

async function startSession(quizId) {
  const ADMIN_ID = '3a161b9f-96a0-4440-b2d5-1db1881d4e88';
  const isUdit = State.user.id === ADMIN_ID;

  if (!isUdit) {
    // Block other mentors if Udit is running a game
    const { data: adminSessions } = await HQ_SUPABASE.from('game_sessions')
      .select('id')
      .eq('host_id', ADMIN_ID)
      .in('status', ['lobby', 'active', 'question_active', 'question_review'])
      .limit(1);

    if (adminSessions && adminSessions.length > 0) {
      alert("Udit is currently conducting a Mega-Quiz. Other sessions are temporarily paused and cannot be started right now.");
      return;
    }
  } else {
    // If Udit starts a game, force-end ALL other active sessions on the server
    const { data: otherSessions } = await HQ_SUPABASE.from('game_sessions')
      .select('id')
      .neq('host_id', ADMIN_ID)
      .in('status', ['lobby', 'active', 'question_active', 'question_review']);

    if (otherSessions && otherSessions.length > 0) {
      await HQ_SUPABASE.from('game_sessions')
        .update({ status: 'finished' })
        .in('id', otherSessions.map(s => s.id));
    }
  }

  // Generate a unique PIN server-side
  const { data: pinData, error: pinError } = await HQ_SUPABASE.rpc('generate_session_pin');
  if (pinError) { alert('Could not generate PIN: ' + pinError.message); return; }

  const pin = pinData;

  // Create game session
  const { data: session, error } = await HQ_SUPABASE.from('game_sessions').insert({
    quiz_id: quizId,
    pin,
    host_id: State.user.id,
    status: 'lobby',
    current_question_index: 0,
  }).select().single();

  if (error) { alert('Could not start session: ' + error.message); return; }

  // Load quiz + questions
  const { data: quiz } = await HQ_SUPABASE.from('quizzes').select('*').eq('id', quizId).single();
  const { data: questions } = await HQ_SUPABASE.from('questions').select('*').eq('quiz_id', quizId).order('order_index');

  State.session   = session;
  State.quiz      = quiz;
  State.questions = questions;
  State.players   = [];

  showHostLobby();
}

// ============================================================
// ---- HOST LOBBY VIEW ----
// ============================================================

function showHostLobby() {
  renderView('host-lobby');
  

  // Display PIN
  const pin = State.session.pin;
  document.getElementById('lobby-pin').textContent = formatPin(pin);
  document.getElementById('lobby-quiz-title').textContent = State.quiz.title;
  document.getElementById('lobby-q-count').textContent = `${State.questions.length} question${State.questions.length !== 1 ? 's' : ''} • Hosted by ${State.user?.user_metadata?.display_name || 'You'}`;

  // Copy PIN button
  const copyBtn = document.getElementById('copy-pin-btn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(pin).then(() => {
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => copyBtn.textContent = '📋 Copy PIN', 1500);
      });
    };
  }

  // QR Enlarge handler
  const qrImg = document.getElementById('lobby-qr-img');
  if (qrImg) {
    const joinUrl = encodeURIComponent(`https://hubquiz.vercel.app/?pin=${pin}`);
    qrImg.src = `https://quickchart.io/qr?text=${joinUrl}&size=300&margin=1`;
    
    qrImg.onclick = (e) => {
      e.target.classList.toggle('qr-enlarged');
    };
  }

  const startBtn = document.getElementById('start-quiz-btn');
  if (startBtn) {
    startBtn.onclick = async () => {
      if (State.players.length === 0) {
        if (!confirm('No players have joined yet. Start anyway?')) return;
      }
      await hostStartQuiz();
    };
  }

  const cancelBtn = document.getElementById('lobby-end-btn');
  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      if (confirm('Are you sure you want to cancel this quiz?')) {
        AudioEngine.stopLobbyMusic();
        await HQ_SUPABASE.from('game_sessions').update({ status: 'finished' }).eq('id', State.session.id);
        await broadcastGameEvent('game:finished');
        State.session.status = 'finished';
        navigate('/host');
      }
    };
  }

  // Load existing players
  loadPlayers();

  // Start lobby music
  AudioEngine.startLobbyMusic();

  // Subscribe to realtime: new players joining
  subscribeHostChannel();
}

async function loadPlayers() {
  const { data: players } = await HQ_SUPABASE
    .from('players')
    .select('*')
    .eq('session_id', State.session.id)
    .order('joined_at');
  State.players = players || [];
  renderPlayerList();
}

function renderPlayerList() {
  const container = document.getElementById('player-list');
  if (!container) return;
  const count = document.getElementById('player-count');
  if (count) count.textContent = State.players.length;

  if (State.players.length === 0) {
    container.innerHTML = '<p class="waiting-text">Waiting for players to join...</p>';
    return;
  }
  container.innerHTML = State.players.map(p =>
    `<div class="player-chip">${escHtml(p.name)}</div>`
  ).join('');
}

function subscribeHostChannel() {
  // Unsubscribe existing
  if (State.realtimeCh) {
    HQ_SUPABASE.removeChannel(State.realtimeCh);
    State.realtimeCh = null;
  }

  const ch = HQ_SUPABASE.channel(`session:${State.session.id}`);

  // New player joined (Postgres Changes)
  ch.on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'players',
    filter: `session_id=eq.${State.session.id}`
  }, (payload) => {
    State.players.push(payload.new);
    renderPlayerList();
  });

  // Listen for session status changes (e.g. if another host ends the game)
  ch.on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'game_sessions',
    filter: `id=eq.${State.session.id}`
  }, (payload) => {
    if (payload.new.status === 'finished' && State.session.status !== 'finished') {
      State.session.status = 'finished';
      alert('The session was ended by another host.');
      navigate('/host');
    }
  });

  // Broadcast events FROM host TO students (and self)
  ch.on('broadcast', { event: 'game:event' }, (payload) => {
    // Host receives its own broadcast — ignore if we're the sender
  });

  ch.subscribe();
  State.realtimeCh = ch;
}

async function broadcastGameEvent(event, data = {}) {
  await State.realtimeCh.send({
    type: 'broadcast',
    event: 'game:event',
    payload: { event, ...data },
  });
}

// ============================================================
// ---- HOST GAME FLOW ----
// ============================================================

async function hostStartQuiz() {
  AudioEngine.stopLobbyMusic();

  const showQsCb = document.getElementById('show-questions-checkbox');
  const showQs = showQsCb ? showQsCb.checked : false;

  // Update session status
  const { error } = await HQ_SUPABASE.from('game_sessions').update({
    status: 'active',
    current_question_index: 0,
    show_questions_on_phones: showQs
  }).eq('id', State.session.id);
  if (error) { alert(error.message); return; }

  State.session.current_question_index = 0;
  State.session.status = 'active';
  State.session.show_questions_on_phones = showQs;

  hostShowQuestion(0);
}

async function hostShowQuestion(index) {
  const q = State.questions[index];
  if (!q) { hostShowFinalLeaderboard(); return; }

  // Record question_started_at
  const now = new Date().toISOString();
  await HQ_SUPABASE.from('game_sessions').update({
    status: 'question_active',
    current_question_index: index,
    question_started_at: now,
  }).eq('id', State.session.id);

  State.session.status = 'question_active';
  State.session.current_question_index = index;
  State.session.question_started_at = now;

  // Broadcast to students
  await broadcastGameEvent('question:start', {
    question_index: index,
    question_started_at: now,
    question_id: q.id,
    show_text: State.session.show_questions_on_phones,
  });

  renderView('host-question');
  

  document.getElementById('hq-q-num').textContent = `Q${index + 1} of ${State.questions.length} • PIN: ${formatPin(State.session.pin)}`;
  document.getElementById('hq-question-text').textContent = q.question_text;
  document.getElementById('hq-answered-count').textContent = '0';
  document.getElementById('hq-total-count').textContent = State.players.length;

  // Render answer blocks
  const blocksEl = document.getElementById('hq-answer-blocks');
  if (q.question_type === 'open_ended') {
    blocksEl.innerHTML = `<div style="text-align:center; padding: 48px; color: var(--grey-500); font-size: 1.5rem;">Waiting for participants to type their answers...</div>`;
  } else {
    blocksEl.innerHTML = ['a','b','c','d']
      .filter(opt => q['option_'+opt] && q['option_'+opt].trim() !== '')
      .map(opt => `
      <div class="host-answer-block answer-${opt}">
        <span class="answer-symbol">${ANSWER_COLORS[opt].symbol}</span>
        <span class="answer-opt-label">${opt.toUpperCase()}</span>
        <span class="answer-opt-text">${escHtml(q['option_'+opt])}</span>
      </div>`
    ).join('');
  }

  // Start timer ring
  startHostTimer(QUESTION_TIME, now);

  // Subscribe to answer inserts for count
  subscribeAnswerCount(q.id);

  const skipBtn = document.getElementById('hq-skip-btn');
  if (skipBtn) {
    skipBtn.onclick = () => {
      clearTimer();
      hostShowReveal(q.id);
    };
  }

  const endBtn = document.getElementById('hq-end-early-btn');
  if (endBtn) {
    endBtn.onclick = () => {
      if (confirm('Are you sure you want to end the quiz early?')) {
        clearTimer();
        hostShowFinalLeaderboard();
      }
    };
  }
}

let _answerCountCh = null;
let _answerCount = 0;

async function subscribeAnswerCount(questionId) {
  // Reset local answer count
  _answerCount = 0;
  
  if (State.players.length > 0) {
    // Fetch existing count in case of page reload mid-question, filtered by our players
    const { count } = await HQ_SUPABASE.from('answers')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId)
      .in('player_id', State.players.map(p => p.id));
      
    _answerCount = count || 0;
  }
  
  const el = document.getElementById('hq-answered-count');
  if (el) el.textContent = _answerCount;

  if (_answerCount >= State.players.length && State.players.length > 0) {
    clearTimer();
    hostShowReveal(questionId);
    return;
  }

  if (_answerCountCh) { HQ_SUPABASE.removeChannel(_answerCountCh); _answerCountCh = null; }

  _answerCountCh = HQ_SUPABASE.channel(`answers:${questionId}:${State.session.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'answers',
      filter: `question_id=eq.${questionId}`,
    }, (payload) => {
      // Only count if the answer came from a player in OUR session
      if (State.players.some(p => p.id === payload.new.player_id)) {
        _answerCount++;
        if (el) el.textContent = _answerCount;
        if (_answerCount >= State.players.length && State.players.length > 0) {
          clearTimer();
          hostShowReveal(questionId);
        }
      }
    })
    .subscribe();
}

function startHostTimer(seconds, startedAt) {
  clearTimer();
  const ring = document.getElementById('timer-ring-progress');
  const ringWrap = document.querySelector('.timer-ring-wrap');
  const numEl = document.getElementById('timer-number');
  const totalLen = ring ? parseFloat(ring.getAttribute('stroke-dasharray')) : 283;

  // Start the 30-sec music right when the timer starts
  AudioEngine.startCountdownMusic();

  function tick() {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
    const remaining = Math.max(0, seconds - elapsed);
    const numRemaining = Math.ceil(remaining);

    if (numEl) numEl.textContent = numRemaining;
    if (ring) {
      const progress = remaining / seconds;
      ring.setAttribute('stroke-dashoffset', totalLen * (1 - progress));
      // Color shift: green -> yellow -> red
      if (remaining > 20) ring.setAttribute('stroke', '#2ECC71');
      else if (remaining > 10) ring.setAttribute('stroke', '#F39C12');
      else ring.setAttribute('stroke', '#E74C3C');
    }

    if (ringWrap) {
      if (remaining <= 3 && remaining > 0) ringWrap.classList.add('timer-shake');
      else ringWrap.classList.remove('timer-shake');
    }

    if (remaining <= 0) {
      clearTimer();
      AudioEngine.playTimesUp();
      const q = State.questions[State.session.current_question_index];
      hostShowReveal(q.id);
      return;
    }

    State.timerInterval = requestAnimationFrame(tick);
  }

  tick();
}

function clearTimer() {
  if (State.timerInterval) {
    cancelAnimationFrame(State.timerInterval);
    State.timerInterval = null;
  }
  AudioEngine.stopCountdownMusic();
  if (_answerCountCh) { HQ_SUPABASE.removeChannel(_answerCountCh); _answerCountCh = null; }
}

async function hostShowReveal(questionId) {
  const index = State.session.current_question_index;
  const q     = State.questions[index];

  // Update session status
  await HQ_SUPABASE.from('game_sessions').update({ status: 'question_review' }).eq('id', State.session.id);
  State.session.status = 'question_review';

  // Fetch leaderboard
  const { data: leaders } = await HQ_SUPABASE.rpc('get_session_leaderboard', {
    p_session_id: State.session.id,
    p_limit: 100,
  });

  // Broadcast reveal to students
  await broadcastGameEvent('question:reveal', {
    question_index: index,
    correct_option: q.correct_option,
    leaders: leaders || [],
  });

  renderView('host-reveal');
  
  AudioEngine.playDrumroll();

  document.getElementById('hr-q-num').textContent = `Q${index + 1} of ${State.questions.length} • PIN: ${formatPin(State.session.pin)}`;
  document.getElementById('hr-question-text').textContent = q.question_text;

  const barsEl = document.getElementById('hr-answer-bars');
  const blocksEl = document.getElementById('hr-answer-blocks');
  
  if (q.question_type === 'open_ended') {
    if (blocksEl) blocksEl.innerHTML = '';
    // Fetch text answers directly
    const { data: textAnswers } = await HQ_SUPABASE.from('answers')
      .select('chosen_text, players!inner(name, session_id)')
      .eq('question_id', questionId)
      .eq('players.session_id', State.session.id)
      .not('chosen_text', 'is', null);

    if (textAnswers && textAnswers.length > 0) {
      barsEl.innerHTML = '<div style="display:flex; flex-wrap:wrap; gap:12px; margin-top: 16px;">' + textAnswers.map(ans => `
        <div style="background:var(--grey-100); color:var(--navy); padding:12px 16px; border-radius:12px; font-size:1.1rem; box-shadow:0 2px 4px rgba(0,0,0,0.05); max-width: 100%;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--grey-500); margin-bottom:4px;">${escHtml(ans.players.name)}</div>
          <div>${escHtml(ans.chosen_text)}</div>
        </div>
      `).join('') + '</div>';
    } else {
      barsEl.innerHTML = '<div style="color:var(--grey-500); padding: 24px 0;">No answers submitted.</div>';
    }
  } else {
    // Fetch answer distribution for MCQ
    const { data: counts } = await HQ_SUPABASE.rpc('get_question_answer_counts', {
      p_session_id:  State.session.id,
      p_question_id: questionId,
    });
    
    if (blocksEl) {
      blocksEl.innerHTML = ['a','b','c','d']
        .filter(opt => q['option_'+opt] && q['option_'+opt].trim() !== '')
        .map(opt => {
          const isCorrect = opt === q.correct_option;
          const revealClass = isCorrect ? 'reveal-correct' : 'reveal-incorrect';
          return `
          <div class="host-answer-block answer-${opt} ${revealClass}">
            <span class="answer-symbol">${ANSWER_COLORS[opt].symbol}</span>
            <span class="answer-opt-label">${opt.toUpperCase()}</span>
            <span class="answer-opt-text">${escHtml(q['option_'+opt])}</span>
          </div>`;
        }).join('');
    }

    const total = counts?.total_players || 1;
    barsEl.innerHTML = ['a','b','c','d'].map(opt => {
      const count = counts?.[opt] ?? 0;
      const pct   = Math.round((count / total) * 100);
      const isCorrect = opt === q.correct_option;
      return `
      <div class="reveal-bar-row ${isCorrect ? 'correct-answer' : ''}">
        <div class="reveal-bar-label answer-${opt}">
          ${ANSWER_COLORS[opt].symbol} ${opt.toUpperCase()}
          ${isCorrect ? '<span class="correct-tick">✓</span>' : ''}
        </div>
        <div class="reveal-bar-track">
          <div class="reveal-bar-fill answer-${opt}" style="width:0%" data-target-width="${pct}%"></div>
        </div>
        <span class="reveal-bar-count">${count}</span>
      </div>`;
    }).join('');
    
    setTimeout(() => {
      document.querySelectorAll('.reveal-bar-fill').forEach(bar => {
        bar.style.width = bar.getAttribute('data-target-width');
      });
    }, 50);
  }

  // Render mini leaderboard
  const lbEl = document.getElementById('hr-leaderboard');
  lbEl.innerHTML = (leaders || []).map(p =>
    `<div class="lb-row"><span class="lb-rank">#${p.rank}</span><span class="lb-name">${escHtml(p.name)}</span><span class="lb-score">${p.score}</span></div>`
  ).join('');

  const nextBtn = document.getElementById('hr-next-btn');
  if (nextBtn) {
    const isLast = index >= State.questions.length - 1;
    nextBtn.textContent = isLast ? '🏆 See Final Results' : '⏭ Next Question';
    nextBtn.onclick = async () => {
      if (isLast) {
        hostShowFinalLeaderboard();
      } else {
        hostShowQuestion(index + 1);
      }
    };
  }
  
  const endBtn = document.getElementById('hr-end-early-btn');
  if (endBtn) {
    endBtn.onclick = () => {
      if (confirm('Are you sure you want to end the quiz early?')) {
        hostShowFinalLeaderboard();
      }
    };
  }
}

async function hostShowFinalLeaderboard() {
  await HQ_SUPABASE.from('game_sessions').update({ status: 'finished' }).eq('id', State.session.id);
  State.session.status = 'finished';

  await broadcastGameEvent('game:finished');

  const { data: leaders } = await HQ_SUPABASE.rpc('get_session_leaderboard', {
    p_session_id: State.session.id,
    p_limit: 50,
  });

  renderView('host-leaderboard');
  document.querySelector('.hl-subtitle').textContent = `Final Leaderboard • PIN: ${formatPin(State.session.pin)}`;
  
  AudioEngine.playFanfare();

  setTimeout(() => Confetti.burst(200), 300);

  // Podium (top 3)
  const podium = document.getElementById('podium');
  const top3   = (leaders || []).slice(0, 3);
  const podiumOrder = [
    top3[1] || null, // 2nd (left)
    top3[0] || null, // 1st (center, tallest)
    top3[2] || null, // 3rd (right)
  ];
  podium.innerHTML = podiumOrder.map((p, i) => {
    if (!p) return '<div class="podium-slot empty"></div>';
    const rank   = i === 0 ? 2 : i === 1 ? 1 : 3;
    const medals = ['🥇','🥈','🥉'];
    const heights = ['130px','170px','100px'];
    return `
      <div class="podium-slot rank-${rank}" style="--podium-h:${heights[i]}">
        <div class="podium-name">${escHtml(p.name)}</div>
        <div class="podium-medal">${medals[rank-1]}</div>
        <div class="podium-score">${p.score} pts</div>
        <div class="podium-base"></div>
      </div>`;
  }).join('');

  // Full ranked list
  const listEl = document.getElementById('full-leaderboard');
  listEl.innerHTML = (leaders || []).map(p => `
    <div class="lb-full-row ${p.rank <= 3 ? 'top-'+p.rank : ''}">
      <span class="lb-rank">#${p.rank}</span>
      <span class="lb-name">${escHtml(p.name)}</span>
      <span class="lb-score">${p.score} pts</span>
    </div>`
  ).join('');

  document.getElementById('hl-end-btn')?.addEventListener('click', () => {
    Confetti.stop();
    cleanupSession();
    navigate('/host');
  });
}

function cleanupSession() {
  if (State.realtimeCh) { HQ_SUPABASE.removeChannel(State.realtimeCh); State.realtimeCh = null; }
  clearTimer();
  AudioEngine.stopLobbyMusic();
  AudioEngine.stopCountdownMusic();
  State.session   = null;
  State.quiz      = null;
  State.questions = [];
  State.players   = [];
}

// ============================================================
// ---- STUDENT JOIN VIEW ----
// ============================================================

function showStudentJoin() {
  renderView('student-join');

  const form = document.getElementById('join-form');
  const pinInput = document.getElementById('join-pin');
  const nameInput = document.getElementById('join-name');

  // Check URL for pin (e.g. from QR scan)
  const urlParams = new URLSearchParams(window.location.search);
  const urlPin = urlParams.get('pin');

  // Auto-fill previous details
  const lastPin = localStorage.getItem('hq_session_pin');
  const lastName = localStorage.getItem('hq_player_name');
  
  if (urlPin && pinInput) {
    pinInput.value = formatPin(urlPin);
    // Clear the URL parameter so it doesn't linger
    window.history.replaceState({}, '', window.location.pathname);
  } else if (lastPin && pinInput) {
    pinInput.value = formatPin(lastPin);
  }

  if (lastName && nameInput) nameInput.value = lastName;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin  = pinInput.value.trim().replace(/\s/g, '');
    const name = nameInput.value.trim();
    const btn  = document.getElementById('join-btn');
    setLoading(btn, true);
    clearError('join-error');

    await joinSession(pin, name, btn);
  });

  // Auto-format PIN input with space in middle
  document.getElementById('join-pin')?.addEventListener('input', (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
    e.target.value = raw.length > 3 ? raw.slice(0,3) + ' ' + raw.slice(3) : raw;
  });

  // Mentor login link
  document.getElementById('mentor-login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });
}

async function joinSession(pin, name, btn) {
  // Find session by PIN
  const cleanPin = pin.padStart(6, '0');
  const { data: sessions, error: sErr } = await HQ_SUPABASE
    .from('game_sessions')
    .select('*')
    .eq('pin', cleanPin)
    .in('status', ['lobby', 'active', 'question_active'])
    .limit(1);

  if (sErr || !sessions?.length) {
    showError('join-error', 'Game not found or not accepting players. Check your PIN.');
    setLoading(btn, false);
    return;
  }

  const session = sessions[0];

  // Validate Name
  if (!/^[A-Za-z0-9 ]+$/.test(name)) {
    showError('join-error', 'Name can only contain letters, numbers, and spaces.');
    setLoading(btn, false);
    return;
  }

  // Check name availability
  const { data: existing } = await HQ_SUPABASE
    .from('players')
    .select('id, name')
    .eq('session_id', session.id)
    .ilike('name', name)
    .limit(1);

  let player;
  
  if (existing?.length) {
    if (localStorage.getItem('hq_player_id') === existing[0].id) {
      // Allow reconnecting as themselves
      player = existing[0];
    } else {
      showError('join-error', 'A player with that name has already joined. Use a different name.');
      setLoading(btn, false);
      return;
    }
  } else {
    // Check total player limit (Max 200) for new players
    const { count: playerCount } = await HQ_SUPABASE
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);
      
    if (playerCount >= 200) {
      showError('join-error', 'This game has reached the maximum capacity of 200 players.');
      setLoading(btn, false);
      return;
    }

    // Insert player
    const { data: newPlayer, error: pErr } = await HQ_SUPABASE
      .from('players')
      .insert({ session_id: session.id, name })
      .select()
      .single();

    if (pErr) {
      showError('join-error', pErr.message.includes('unique') ? 'That name is already taken.' : pErr.message);
      setLoading(btn, false);
      return;
    }
    player = newPlayer;
  }

  // Store in localStorage for reconnect
  localStorage.setItem('hq_player_id', player.id);
  localStorage.setItem('hq_session_id', session.id);
  localStorage.setItem('hq_player_name', name);
  localStorage.setItem('hq_session_pin', cleanPin);

  State.playerSelf = player;
  State.session    = session;

  setLoading(btn, false);
  
  if (session.status === 'question_active') {
    // Manually jump to current question
    const { data: q } = await HQ_SUPABASE.from('questions')
      .select('id')
      .eq('quiz_id', session.quiz_id)
      .order('order_num', { ascending: true })
      .range(session.current_question_index, session.current_question_index)
      .single();
    
    if (q) {
      subscribeStudentChannel(session.id); // Listen for next events
      studentShowQuestion({
        question_index: session.current_question_index,
        question_started_at: session.question_started_at,
        question_id: q.id,
        show_text: session.show_questions_on_phones
      });
      return;
    }
  }

  showStudentLobby(session, player);
}

// ============================================================
// ---- STUDENT LOBBY ----
// ============================================================

function showStudentLobby(session, player) {
  renderView('student-lobby');
  
  document.getElementById('sl-player-name').textContent = player.name;

  const statusEl = document.querySelector('#view-student-lobby .sl-status');
  if (statusEl) {
    if (session.status !== 'lobby') {
      statusEl.innerHTML = `Game in progress! Waiting for the next question<span class="sl-waiting-dots" aria-hidden="true"></span>`;
    } else {
      statusEl.innerHTML = `You're in! Waiting for the host to start<span class="sl-waiting-dots" aria-hidden="true"></span>`;
    }
  }

  // Subscribe to game events
  subscribeStudentChannel(session.id);
}

function subscribeStudentChannel(sessionId) {
  if (State.realtimeCh) { HQ_SUPABASE.removeChannel(State.realtimeCh); State.realtimeCh = null; }

  const ch = HQ_SUPABASE.channel(`session:${sessionId}`)
    .on('broadcast', { event: 'game:event' }, (payload) => {
      handleStudentGameEvent(payload.payload);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'game_sessions',
      filter: `id=eq.${sessionId}`,
    }, (payload) => {
      State.session = payload.new;
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Good to go
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Realtime channel disconnected. Attempting to auto-reconnect...');
      }
    });

  State.realtimeCh = ch;
}

function handleStudentGameEvent(payload) {
  const { event } = payload;
  switch (event) {
    case 'question:start':
      studentShowQuestion(payload);
      break;
    case 'question:reveal':
      studentShowReveal(payload);
      break;
    case 'game:finished':
      studentShowFinalScreen();
      break;
  }
}

// ============================================================
// ---- STUDENT QUESTION ----
// ============================================================

async function studentShowQuestion(payload) {
  const { question_index, question_started_at, question_id } = payload;

  // Fetch the question
  const { data: q } = await HQ_SUPABASE.from('questions').select('*').eq('id', question_id).single();
  if (!q) return;

  State.session.current_question_index = question_index;
  State.session.question_started_at    = question_started_at;

  renderView('student-question');
  

  document.getElementById('sq-q-num').textContent = `Q${question_index + 1}`;

  const textContainer = document.getElementById('sq-question-text');
  if (textContainer) {
    if (payload.show_text) {
      textContainer.textContent = q.question_text;
      textContainer.classList.remove('hidden');
    } else {
      textContainer.classList.add('hidden');
    }
  }

  // Render tappable color blocks or text area
  const blocksEl = document.getElementById('sq-answer-blocks');
  if (q.question_type === 'open_ended') {
    blocksEl.innerHTML = `
      <div class="sq-open-ended-wrap" style="width:100%; display:flex; flex-direction:column; gap:16px;">
        <textarea id="sq-text-input" class="input-field" placeholder="Type your answer here..." style="min-height: 150px; font-size: 1.2rem; padding: 16px; resize: none;"></textarea>
        <button id="sq-submit-text-btn" class="btn btn-primary btn-lg">Submit Answer</button>
      </div>
    `;
    
    const submitBtn = document.getElementById('sq-submit-text-btn');
    const textInput = document.getElementById('sq-text-input');
    
    submitBtn.addEventListener('click', async () => {
      const text = textInput.value.trim();
      if (!text) return;
      submitBtn.disabled = true;
      textInput.disabled = true;
      AudioEngine.playAnswerLocked();
      
      showStudentAnswerLocked(submitBtn);
      await submitStudentOpenAnswer(question_id, text);
    });
  } else {
    blocksEl.innerHTML = ['a','b','c','d']
      .filter(opt => q['option_'+opt] && q['option_'+opt].trim() !== '')
      .map(opt => `
      <button class="student-answer-btn answer-${opt}" data-opt="${opt}" id="sq-btn-${opt}" aria-label="Option ${opt.toUpperCase()}: ${escHtml(q['option_'+opt])}">
        <span class="sa-symbol">${ANSWER_COLORS[opt].symbol}</span>
        <span class="sa-label">${opt.toUpperCase()}</span>
      </button>`
    ).join('');

    // Attach answer handlers
    blocksEl.querySelectorAll('.student-answer-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        
        if (navigator.vibrate) navigator.vibrate(30);

        // Lock all buttons
        blocksEl.querySelectorAll('.student-answer-btn').forEach(b => b.disabled = true);
        btn.classList.add('selected');
        AudioEngine.playAnswerLocked();

        const chosenOpt = btn.dataset.opt;
        showStudentAnswerLocked(btn);

        // Submit to server
        await submitStudentAnswer(question_id, chosenOpt);
      });
    });
  }
  
  // Start the visual timer bar on the student screen
  startStudentTimer(QUESTION_TIME, payload.question_started_at);
}

function startStudentTimer(seconds, startedAt) {
  clearTimer();
  const bar = document.getElementById('sq-timer-bar');

  function tick() {
    const elapsed   = (Date.now() - new Date(startedAt).getTime()) / 1000;
    const remaining = Math.max(0, seconds - elapsed);
    const pct = (remaining / seconds) * 100;

    if (bar) {
      bar.style.width = pct + '%';
      if (remaining > 20) bar.style.background = '#2ECC71';
      else if (remaining > 10) bar.style.background = '#F39C12';
      else bar.style.background = '#E74C3C';
    }

    if (remaining <= 0) { clearTimer(); return; }
    State.timerInterval = requestAnimationFrame(tick);
  }

  State.timerInterval = requestAnimationFrame(tick);
}

function showStudentAnswerLocked(btn) {
  const lockEl = document.getElementById('sq-locked-msg');
  if (lockEl) {
    lockEl.classList.remove('hidden');
    lockEl.textContent = '✓ Answer locked in!';
  }
}

async function submitStudentOpenAnswer(questionId, text) {
  const playerId = State.playerSelf?.id || localStorage.getItem('hq_player_id');
  if (!playerId) return;

  const { data, error } = await HQ_SUPABASE.rpc('submit_open_answer', {
    p_player_id:   playerId,
    p_question_id: questionId,
    p_chosen_text: text,
  });

  if (error) {
    console.warn('Answer submit error:', error.message);
    return;
  }

  // Show result on student device immediately
  const lockEl = document.getElementById('sq-locked-msg');
  const resultsEl = document.getElementById('sq-result');

  if (resultsEl) {
    resultsEl.classList.remove('hidden');
    resultsEl.className = 'sq-result correct';
    resultsEl.innerHTML = `<span class="result-icon">✓</span><span>Answer Submitted! ⏳</span>`;
    AudioEngine.playCorrect();
  }
  if (lockEl) lockEl.classList.add('hidden');
}

async function submitStudentAnswer(questionId, chosenOption) {
  const playerId = State.playerSelf?.id || localStorage.getItem('hq_player_id');
  if (!playerId) return;

  const { data, error } = await HQ_SUPABASE.rpc('submit_answer', {
    p_player_id:   playerId,
    p_question_id: questionId,
    p_chosen:      chosenOption,
  });

  if (error) {
    console.warn('Answer submit error:', error.message);
    return;
  }

  // Show result on student device immediately
  const lockEl = document.getElementById('sq-locked-msg');
  const resultsEl = document.getElementById('sq-result');

  if (resultsEl) {
    // Save for reveal
    State._lastAnswerResult = data;
    
    resultsEl.classList.remove('hidden');
    resultsEl.className = 'sq-result correct';
    resultsEl.innerHTML = `<span class="result-icon">✓</span><span>Answer Submitted! ⏳</span>`;
    AudioEngine.playCorrect();
  }
  if (lockEl) lockEl.classList.add('hidden');
}

function studentShowReveal(payload) {
  const waitEl = document.getElementById('sq-waiting-reveal');
  if (waitEl) waitEl.classList.add('hidden');
  
  const resultsEl = document.getElementById('sq-result');
  const playerName = State.playerSelf?.name || localStorage.getItem('hq_player_name');
  let myRank = '?';
  let myScore = 0;
  
  if (payload.leaders && playerName) {
    const p = payload.leaders.find(l => l.name === playerName);
    if (p) {
      myRank = p.rank || (payload.leaders.findIndex(l => l.name === playerName) + 1);
      myScore = p.score;
    }
  }
  
  if (resultsEl && State._lastAnswerResult) {
    const data = State._lastAnswerResult;
    resultsEl.classList.remove('hidden');
    resultsEl.className = 'sq-result';
    
    if (payload.correct_option === null) {
      if (navigator.vibrate) navigator.vibrate(50);
      triggerFlash('correct');
      
      resultsEl.innerHTML = `
        <div class="feedback-card" style="border-color: var(--grey-300); background: var(--grey-50);">
           <div class="feedback-icon" style="background: var(--grey-200); color: var(--navy);">📝</div>
           <div class="feedback-content">
             <div class="feedback-title" style="color: var(--navy);">Response Recorded</div>
             <div class="feedback-encouragement" style="color: var(--grey-600);">Thanks for sharing!</div>
           </div>
        </div>
      `;
    } else if (data.correct) {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      triggerFlash('correct');
      const elapsed = (Date.now() - new Date(State.session.question_started_at).getTime()) / 1000;
      let encouragement = 'You got it right! 🎉';
      if (myRank <= 3) encouragement = 'You are on fire! 🔥';
      else if (elapsed < 3) encouragement = 'Lightning fast! ⚡';
      else if (elapsed < 8) encouragement = 'Great speed! 🚀';
      else encouragement = 'Moving up! 💪';
      
      resultsEl.innerHTML = `
        <div class="feedback-card">
           <div class="feedback-icon correct-icon">✓</div>
           <div class="feedback-content">
             <div class="feedback-title">Correct! +<span id="pts-countup">0</span></div>
             <div class="feedback-encouragement">${encouragement}</div>
           </div>
           <div class="feedback-stats">
              <div class="stat-box">
                 <div class="stat-label">Rank</div>
                 <div class="stat-value">#${myRank}</div>
              </div>
              <div class="stat-box">
                 <div class="stat-label">Total Score</div>
                 <div class="stat-value">${myScore}</div>
              </div>
           </div>
        </div>`;
      
      // Animate points count up
      const ptsEl = document.getElementById('pts-countup');
      if (ptsEl && data.points_awarded > 0) {
        let startTime = null;
        const duration = 600; // ms
        const target = data.points_awarded;
        function step(timestamp) {
          if (!startTime) startTime = timestamp;
          const progress = Math.min((timestamp - startTime) / duration, 1);
          ptsEl.textContent = Math.floor(progress * target);
          if (progress < 1) window.requestAnimationFrame(step);
          else ptsEl.textContent = target;
        }
        window.requestAnimationFrame(step);
      }

      AudioEngine.playCorrect();
    } else {
      if (navigator.vibrate) navigator.vibrate(50);
      triggerFlash('incorrect');
      resultsEl.innerHTML = `
        <div class="feedback-card">
           <div class="feedback-icon incorrect-icon">❌</div>
           <div class="feedback-content">
             <div class="feedback-title">Incorrect</div>
             <div class="feedback-encouragement">Keep going! Don't give up! 💪</div>
           </div>
           <div class="feedback-stats">
              <div class="stat-box">
                 <div class="stat-label">Rank</div>
                 <div class="stat-value">#${myRank}</div>
              </div>
              <div class="stat-box">
                 <div class="stat-label">Total Score</div>
                 <div class="stat-value">${myScore}</div>
              </div>
           </div>
        </div>`;
      AudioEngine.playIncorrect();
    }
  }
  clearTimer();
}

// ============================================================
// ---- STUDENT FINAL SCREEN ----
// ============================================================

async function studentShowFinalScreen() {
  const playerId = State.playerSelf?.id || localStorage.getItem('hq_player_id');
  const sessionId = State.session?.id || localStorage.getItem('hq_session_id');

  let myRank = '?', myScore = 0, totalPlayers = 0;

  if (playerId && sessionId) {
    const { data: leaders } = await HQ_SUPABASE.rpc('get_session_leaderboard', {
      p_session_id: sessionId,
      p_limit: 100,
    });
    if (leaders) {
      totalPlayers = leaders.length;
      const me = leaders.find(p => p.rank !== undefined);
      // Find by score match + name
      const myName = State.playerSelf?.name || localStorage.getItem('hq_player_name');
      const myRow  = leaders.find(p => p.name === myName);
      if (myRow) { myRank = myRow.rank; myScore = myRow.score; }
    }
  }

  renderView('student-final');

  const rankEl   = document.getElementById('sf-rank');
  const scoreEl  = document.getElementById('sf-score');
  const totalEl  = document.getElementById('sf-total');
  const medalEl  = document.getElementById('sf-medal');

  if (rankEl)  rankEl.textContent  = `#${myRank}`;
  if (scoreEl) scoreEl.textContent = myScore;
  if (totalEl) totalEl.textContent = `of ${totalPlayers} players`;

  let medal = '⭐';
  if (myRank == 1) medal = '🥇';
  else if (myRank == 2) medal = '🥈';
  else if (myRank == 3) medal = '🥉';
  if (medalEl) medalEl.textContent = medal;

  // Clear stored session
  localStorage.removeItem('hq_player_id');
  localStorage.removeItem('hq_session_id');
  localStorage.removeItem('hq_player_name');

  // Play again button
  document.getElementById('sf-play-again')?.addEventListener('click', () => navigate('/play'));
}

// ============================================================
// ---- DISCONNECTION ----
// ============================================================

function showDisconnected() {
  renderView('student-disconnected');
  document.getElementById('sd-rejoin-btn')?.addEventListener('click', () => {
    const pin  = localStorage.getItem('hq_session_pin') || '';
    const name = localStorage.getItem('hq_player_name') || '';
    navigate('/play');
    setTimeout(() => {
      if (pin)  document.getElementById('join-pin').value  = formatPin(pin);
      if (name) document.getElementById('join-name').value = name;
    }, 100);
  });
}

// ============================================================
// ---- UTILITIES ----
// ============================================================

function renderView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const view = document.getElementById(`view-${viewName}`);
  
  const gameplayViews = [
    'host-lobby', 'host-question', 'host-reveal', 'host-leaderboard',
    'student-lobby', 'student-question', 'student-final'
  ];
  if (gameplayViews.includes(viewName)) {
    document.body.classList.add('gameplay');
  } else {
    document.body.classList.remove('gameplay');
  }

  if (view) {
    view.classList.remove('hidden');
    // Scroll to top
    window.scrollTo(0, 0);
  } else {
    console.error(`View not found: view-${viewName}`);
  }
}



function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? 'Loading...' : btn.dataset.originalText;
}

function showError(elId, msg, type = 'error') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent  = msg;
  el.className    = `form-msg ${type}`;
  el.style.display = 'block';
}

function clearError(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent   = '';
  el.style.display = 'none';
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatPin(pin) {
  const p = String(pin).padStart(6, '0');
  return p.slice(0, 3) + ' ' + p.slice(3);
}

function triggerFlash(type) {
  const f = document.createElement('div');
  f.className = 'flash-overlay flash-' + type;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1500);
}

// ============================================================
// ---- SESSION HISTORY ----
// ============================================================

async function loadSessionHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner">Loading history...</div>';

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await HQ_SUPABASE.from('game_sessions')
    .select('*, quiz:quizzes(title), players(id)')
    .eq('host_id', State.user.id)
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<div class="error">Failed to load history.</div>';
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state" style="margin-top: 16px;">No games played in the past 24 hours.</div>';
    return;
  }

  container.innerHTML = '';
  data.forEach(s => {
    const d = new Date(s.created_at);
    const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const pCount = s.players?.length || 0;
    
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div>
        <h3 class="hc-title">${escHtml(s.quiz?.title || 'Unknown Quiz')}</h3>
        <p class="hc-meta">Played on ${dateStr} &bull; ${pCount} Participant${pCount !== 1 ? 's' : ''}</p>
      </div>
      <div class="hc-stats">
        <p class="hc-meta" style="font-weight: 600;">PIN: ${s.pin}</p>
        <span class="${s.status === 'finished' ? 'status-badge' : 'status-badge warning'}">${s.status.toUpperCase()}</span>
      </div>
    `;
    card.onclick = () => showSessionHistoryDetails(s.id);
    container.appendChild(card);
  });
}

async function showSessionHistoryDetails(sessionId) {
  renderView('session-history');
  
  // Set basic placeholders
  document.getElementById('sh-title').textContent = 'Loading...';
  document.getElementById('sh-date').textContent = '';
  document.getElementById('sh-pin').textContent = '';
  const thead = document.getElementById('sh-thead-tr');
  const tbody = document.getElementById('sh-tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '<tr><td colspan="100" style="text-align: center; padding: 40px;">Loading data...</td></tr>';

  // Back button
  document.getElementById('sh-back-btn').onclick = () => {
    renderView('dashboard');
  };

  // Fetch session + quiz + questions
  const { data: session } = await HQ_SUPABASE.from('game_sessions')
    .select('*, quiz:quizzes(*, questions(*))')
    .eq('id', sessionId)
    .single();

  if (!session) {
    tbody.innerHTML = '<tr><td colspan="100" style="text-align: center; padding: 40px;">Session not found.</td></tr>';
    return;
  }

  const d = new Date(session.created_at);
  document.getElementById('sh-title').textContent = session.quiz.title;
  document.getElementById('sh-date').textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  document.getElementById('sh-pin').textContent = session.pin;

  // Fetch players and their answers
  const { data: players } = await HQ_SUPABASE.from('players')
    .select('*, answers(*)')
    .eq('session_id', sessionId)
    .order('score', { ascending: false });

  const questions = session.quiz.questions.sort((a,b) => a.order_num - b.order_num);

  // Render headers
  let thHtml = '<th>Rank</th><th>Player Name</th><th>Total Score</th>';
  questions.forEach((q, idx) => {
    thHtml += `<th>Q${idx + 1}</th>`;
  });
  thead.innerHTML = thHtml;

  // Render rows
  if (!players || players.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${3 + questions.length}" style="text-align: center; padding: 40px;">No participants found.</td></tr>`;
    return;
  }

  let tbHtml = '';
  players.forEach((p, rankIndex) => {
    const rank = rankIndex + 1;
    tbHtml += `<tr>
      <td style="font-weight: 700; color: var(--navy);">#${rank}</td>
      <td style="font-weight: 600;">${escHtml(p.name)}</td>
      <td style="font-weight: 800; color: var(--yellow);">${p.score}</td>
    `;

    questions.forEach(q => {
      const ans = p.answers?.find(a => a.question_id === q.id);
      if (!ans) {
        tbHtml += `<td class="ans-none">-</td>`;
      } else {
        const isCorrect = ans.chosen_option === q.correct_option;
        const pts = ans.points_awarded;
        const cssClass = isCorrect ? 'ans-correct' : 'ans-wrong';
        const icon = isCorrect ? '✓' : '✗';
        tbHtml += `<td class="${cssClass}" title="Answered: ${ans.chosen_option.toUpperCase()} (${pts} pts)">${icon} ${ans.chosen_option.toUpperCase()}</td>`;
      }
    });
    
    tbHtml += '</tr>';
  });
  tbody.innerHTML = tbHtml;
}
