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
  
  const ADMIN_ID = '961e9563-848e-4fda-a754-891ed3732dd4';
  if (State.user.id === ADMIN_ID) {
    document.getElementById('template-idt-btn').style.display = 'inline-flex';
  } else {
    document.getElementById('template-idt-btn').style.display = 'none';
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

  document.getElementById('template-idt-btn')?.addEventListener('click', async (e) => {
    const btn = e.target;
    const originalText = btn.textContent;
    btn.textContent = 'Importing...';
    btn.disabled = true;

    try {
      const idtCurriculum = [
          {
            title: ' Session 1: Orientation & Team Formation',
            questions: [
              { order_index: 0, question_text: 'What is the main objective of the IDT course?', option_a: 'To memorize textbooks', option_b: 'To instil 21st-century skills and solve real-world problems', option_c: 'To learn advanced calculus', option_d: 'To build robots for competitions', correct_option: 'b' },
              { order_index: 1, question_text: 'What is the total weightage of the Continuous Internal Evaluation (CIE)?', option_a: '20%', option_b: '30%', option_c: '50%', option_d: '100%', correct_option: 'c' },
              { order_index: 2, question_text: 'To qualify for the SEE, what is the minimum marks required in the CIE?', option_a: '15', option_b: '18', option_c: '20', option_d: '25', correct_option: 'c' },
              { order_index: 3, question_text: 'Which of the following is NOT a stated Course Outcome?', option_a: 'Pitch socially relevant ideas', option_b: 'Empathize with community problems', option_c: 'Memorize all UN resolutions', option_d: 'Collaborate effectively in diverse teams', correct_option: 'c' },
              { order_index: 4, question_text: 'What is a Prototype?', option_a: 'A final product ready for sale', option_b: 'An early version of a product to test an idea', option_c: 'A detailed research paper', option_d: 'A business model', correct_option: 'b' },
              { order_index: 5, question_text: 'What is a "Low-Fidelity" prototype?', option_a: 'A highly polished working model', option_b: 'A simple sketch or paper model', option_c: 'A finalized app coded in Python', option_d: 'A 3D printed engine', correct_option: 'b' },
              { order_index: 6, question_text: 'Why is it important to have a Prototype Testing Plan?', option_a: 'To ensure performance metrics are measured and failures identified', option_b: 'To delay the project deadline', option_c: 'To make the presentation look longer', option_d: 'To assign blame if it fails', correct_option: 'a' },
              { order_index: 7, question_text: 'How many students should ideally be in one group for this course?', option_a: '1 to 2', option_b: 'Min 4 and Max 6', option_c: 'Exactly 10', option_d: 'Whole class as one group', correct_option: 'b' },
              { order_index: 8, question_text: 'Why are IDT teams supposed to be multidisciplinary?', option_a: 'Because the university ran out of space', option_b: 'To bring diverse perspectives from different branches', option_c: 'To make scheduling meetings harder', option_d: 'Because the syllabus says so randomly', correct_option: 'b' },
              { order_index: 9, question_text: 'Switching between video-based and text-based learning helps your brain do what?', option_a: 'Fall asleep faster', option_b: 'Improve memory by training it like a muscle', option_c: 'Forget old information', option_d: 'Ignore the facilitator', correct_option: 'b' }
            ]
          },
          {
            title: ' Session 2: Design Thinking & Social Entrepreneurship',
            questions: [
              { order_index: 0, question_text: 'What is the core focus of Design Thinking?', option_a: 'Making things look pretty', option_b: 'A human-centered approach to problem solving', option_c: 'Writing perfect code', option_d: 'Maximizing company profits', correct_option: 'b' },
              { order_index: 1, question_text: 'What is the FIRST stage of the Design Thinking process?', option_a: 'Define', option_b: 'Test', option_c: 'Empathize', option_d: 'Ideate', correct_option: 'c' },
              { order_index: 2, question_text: 'Which stage involves brainstorming multiple creative solutions?', option_a: 'Empathize', option_b: 'Prototype', option_c: 'Ideate', option_d: 'Define', correct_option: 'c' },
              { order_index: 3, question_text: 'What is the main difference between Invention and Innovation?', option_a: 'Invention applies ideas for value; Innovation creates something new', option_b: 'Invention is creating something new; Innovation is applying ideas to create value', option_c: 'They are identical terms', option_d: 'Invention is only for science; Innovation is for art', correct_option: 'b' },
              { order_index: 4, question_text: 'Social Entrepreneurship combines business thinking with what?', option_a: 'Social responsibility and impact', option_b: 'High prices and monopoly', option_c: 'Government control', option_d: 'Stock market trading', correct_option: 'a' },
              { order_index: 5, question_text: 'In Design Thinking, why do we build prototypes?', option_a: 'Because it is fun', option_b: 'To quickly validate ideas before spending too much time/money', option_c: 'To trick investors', option_d: 'To finish the course early', correct_option: 'b' },
              { order_index: 6, question_text: 'What does the "Define" stage of Design Thinking do?', option_a: 'Collects user feedback', option_b: 'Clearly states the user\'s problem based on insights', option_c: 'Builds the final model', option_d: 'Sells the product', correct_option: 'b' },
              { order_index: 7, question_text: 'Technical solutions without empathy usually end up...', option_a: 'Being huge market successes', option_b: 'Failing in real-world conditions', option_c: 'Winning awards', option_d: 'Being cheaper to make', correct_option: 'b' },
              { order_index: 8, question_text: 'Which of these is an example of an Innovation?', option_a: 'Discovering a new element', option_b: 'Improving a water filter to make it affordable for villages', option_c: 'Writing a sci-fi novel', option_d: 'Dreaming about flying cars', correct_option: 'b' },
              { order_index: 9, question_text: 'During the Ideation stage, what is the best mindset?', option_a: 'Judge every idea immediately', option_b: 'Only accept ideas from the team leader', option_c: 'Go for quantity and wild ideas without judgment', option_d: 'Stop after finding one good idea', correct_option: 'c' }
            ]
          },
          {
            title: ' Session 3: Innovation Warm-Up & SDGs',
            questions: [
              { order_index: 0, question_text: 'What does SDG stand for?', option_a: 'Standard Design Guidelines', option_b: 'Sustainable Development Goals', option_c: 'Social Design Group', option_d: 'System Development Grid', correct_option: 'b' },
              { order_index: 1, question_text: 'How many SDGs were established by the United Nations?', option_a: '10', option_b: '15', option_c: '17', option_d: '20', correct_option: 'c' },
              { order_index: 2, question_text: 'In what year were the SDGs created by the UN?', option_a: '2000', option_b: '2010', option_c: '2015', option_d: '2020', correct_option: 'c' },
              { order_index: 3, question_text: 'Which of the following is an example of an SDG?', option_a: 'Quality Education', option_b: 'Free Netflix for all', option_c: 'Faster internet speeds', option_d: 'Space exploration', correct_option: 'a' },
              { order_index: 4, question_text: 'What is the primary purpose of a Mind Map?', option_a: 'To paint a landscape', option_b: 'To visually organize ideas and make connections', option_c: 'To write a formal essay', option_d: 'To calculate budget', correct_option: 'b' },
              { order_index: 5, question_text: 'Why is mapping a case study important before creating solutions?', option_a: 'To make the report look thicker', option_b: 'To uncover root causes and understand the context', option_c: 'To copy someone else\'s work', option_d: 'To delay the actual work', correct_option: 'b' },
              { order_index: 6, question_text: 'In the context of IDT, engineering projects should ideally align with...', option_a: 'The easiest topic', option_b: 'At least one SDG', option_c: 'A famous movie plot', option_d: 'The facilitator\'s personal hobby', correct_option: 'b' },
              { order_index: 7, question_text: 'What is one of the key communication skills practiced in this session?', option_a: 'Speaking loudly over others', option_b: 'Clear articulation of ideas and active listening', option_c: 'Typing really fast', option_d: 'Avoiding eye contact', correct_option: 'b' },
              { order_index: 8, question_text: 'Breaking down a case into smaller components helps to...', option_a: 'Make it more confusing', option_b: 'Identify hidden patterns and root causes', option_c: 'Lose the main point', option_d: 'Make the team argue', correct_option: 'b' },
              { order_index: 9, question_text: 'Which of these is a major global challenge addressed by the SDGs?', option_a: 'Climate Change', option_b: 'Traffic jams in one city', option_c: 'Broken phone screens', option_d: 'Boredom', correct_option: 'a' }
            ]
          },
          {
            title: ' Session 4: Introduction to Empathy',
            questions: [
              { order_index: 0, question_text: 'What does the "H" in 5W1H stand for?', option_a: 'How', option_b: 'Who', option_c: 'When', option_d: 'Help', correct_option: 'a' },
              { order_index: 1, question_text: 'In 5W1H, which question explores the user\'s environment and context?', option_a: 'What', option_b: 'Why', option_c: 'Where', option_d: 'When', correct_option: 'c' },
              { order_index: 2, question_text: 'Which 5W1H question uncovers deep motivations, beliefs, and feelings?', option_a: 'Who', option_b: 'Why', option_c: 'What', option_d: 'How', correct_option: 'b' },
              { order_index: 3, question_text: 'What is the purpose of Stakeholder Mapping?', option_a: 'To draw a map of the city', option_b: 'To visualize all people affected by the issue', option_c: 'To find the fastest route to the field visit', option_d: 'To plan the final party', correct_option: 'b' },
              { order_index: 4, question_text: 'Who is considered a "Stakeholder"?', option_a: 'Only the person buying the product', option_b: 'Anyone who is affected by or has an interest in the problem', option_c: 'Only the government', option_d: 'The facilitator', correct_option: 'b' },
              { order_index: 5, question_text: 'Why is a field visit advised in this session?', option_a: 'To get out of the classroom for fun', option_b: 'To gather first-hand insights and observe the problem in real life', option_c: 'To take nice photos for Instagram', option_d: 'To buy snacks', correct_option: 'b' },
              { order_index: 6, question_text: 'When defining the "WHO", what is the best approach?', option_a: 'Treat them as a broad, faceless category (e.g., "all humans")', option_b: 'Treat them as a specific person with real feelings and challenges', option_c: 'Ignore their age and background', option_d: 'Assume they are exactly like you', correct_option: 'b' },
              { order_index: 7, question_text: '"What tools do they currently use to solve the problem?" falls under which 5W1H category?', option_a: 'What', option_b: 'Why', option_c: 'When', option_d: 'Where', correct_option: 'a' },
              { order_index: 8, question_text: 'Empathy in Design Thinking means...', option_a: 'Feeling sorry for the user', option_b: 'Putting yourself in the user\'s shoes to deeply understand their experience', option_c: 'Giving them money', option_d: 'Designing what you personally like', correct_option: 'b' },
              { order_index: 9, question_text: '"How do they describe the ideal solution?" helps you understand...', option_a: 'The user\'s budget', option_b: 'The user\'s expectations and desired experience', option_c: 'The exact code to write', option_d: 'The history of the problem', correct_option: 'b' }
            ]
          },
          {
            title: ' Session 5: Interview Techniques with Stakeholder',
            questions: [
              { order_index: 0, question_text: 'What is an "Open-Ended" question?', option_a: 'A question that can only be answered with Yes or No', option_b: 'A question that encourages detailed stories and explanations', option_c: 'A question that has no correct answer in math', option_d: 'A question that ends the interview', correct_option: 'b' },
              { order_index: 1, question_text: 'Which of the following is a good open-ended question?', option_a: 'Do you like this app?', option_b: 'Is this difficult for you?', option_c: 'Can you walk me through how you currently handle this problem?', option_d: 'Are you happy today?', correct_option: 'c' },
              { order_index: 2, question_text: 'What is "Active Listening" during an interview?', option_a: 'Listening while texting on your phone', option_b: 'Fully focusing, understanding, responding, and remembering what is being said', option_c: 'Interrupting the user to share your own story', option_d: 'Only listening for the answer you want to hear', correct_option: 'b' },
              { order_index: 3, question_text: 'A Power-Interest Matrix helps you categorize stakeholders based on...', option_a: 'Their physical strength and hobbies', option_b: 'Their level of influence (power) and their level of concern (interest)', option_c: 'Their wealth and age', option_d: 'Their grades and attendance', correct_option: 'b' },
              { order_index: 4, question_text: 'If a stakeholder has HIGH power and HIGH interest, how should you manage them?', option_a: 'Ignore them completely', option_b: 'Keep them satisfied with minimal contact', option_c: 'Manage them closely and keep them fully engaged', option_d: 'Only send them an email at the end', correct_option: 'c' },
              { order_index: 5, question_text: 'During a stakeholder interview, why use "neutral prompts"?', option_a: 'To avoid leading the interviewee to a specific answer', option_b: 'To make the interview boring', option_c: 'To confuse the user', option_d: 'To show off your vocabulary', correct_option: 'a' },
              { order_index: 6, question_text: 'Which tool visually maps out what a user Says, Thinks, Does, and Feels?', option_a: 'Power-Interest Matrix', option_b: 'Empathy Map', option_c: 'Gantt Chart', option_d: 'Bar Graph', correct_option: 'b' },
              { order_index: 7, question_text: 'What should you do if an interviewee goes off-topic but shares an interesting story about their struggles?', option_a: 'Tell them to stop talking immediately', option_b: 'Listen, as it might uncover hidden needs and context', option_c: 'Walk away', option_d: 'Correct them', correct_option: 'b' },
              { order_index: 8, question_text: 'Why is it important to interview extreme users (not just average users)?', option_a: 'Because they are louder', option_b: 'Extreme users highlight problems and needs more clearly, leading to better innovations', option_c: 'Because it\'s a university rule', option_d: 'It is not important; only average users matter', correct_option: 'b' },
              { order_index: 9, question_text: 'After completing an interview, what is the most crucial next step?', option_a: 'Forget about it and start building', option_b: 'Document the findings and highlight key insights immediately', option_c: 'Ask another team to do your work', option_d: 'Change your project entirely', correct_option: 'b' }
            ]
          },
          {
            title: ' Session 6: Documentation of Field Visit',
            questions: [
              { order_index: 0, question_text: 'What is the main purpose of a group discussion after a field visit?', option_a: 'To decide where to eat lunch', option_b: 'To merge different viewpoints and create a shared understanding of the problem', option_c: 'To argue about who asked the best questions', option_d: 'To complain about the weather', correct_option: 'b' },
              { order_index: 1, question_text: 'Why is it important to share field findings with the facilitators?', option_a: 'To get them to do the work for you', option_b: 'To get guidance, challenge assumptions, and identify gaps in understanding', option_c: 'To impress them with how far you traveled', option_d: 'So they can grade you immediately', correct_option: 'b' },
              { order_index: 2, question_text: 'Which of the following is crucial to include in your field documentation?', option_a: 'Exact user quotes and environmental details', option_b: 'A fictional story about the user', option_c: 'Code for the final app', option_d: 'Random internet pictures', correct_option: 'a' },
              { order_index: 3, question_text: 'Taking photos during a field visit requires...', option_a: 'A highly professional DSLR camera', option_b: 'Explicit permission from the people being photographed', option_c: 'Perfect lighting', option_d: 'Posting them on social media immediately', correct_option: 'b' },
              { order_index: 4, question_text: 'Converting field insights into usable information supports which next stages?', option_a: 'Prototyping and Testing only', option_b: 'Problem Definition and Ideation', option_c: 'Financing and Marketing', option_d: 'Packing up and going home', correct_option: 'b' },
              { order_index: 5, question_text: 'What is a common pitfall when documenting field visits?', option_a: 'Writing down too many exact quotes', option_b: 'Relying on memory instead of taking immediate notes', option_c: 'Drawing sketches of the environment', option_d: 'Taking notes collaboratively', correct_option: 'b' },
              { order_index: 6, question_text: '"Challenges noticed" during the field visit are often symptoms of...', option_a: 'A bad day', option_b: 'Deeper root causes', option_c: 'The facilitator\'s strict grading', option_d: 'Lack of budget', correct_option: 'b' },
              { order_index: 7, question_text: 'If two team members have conflicting observations from the same interview, what should they do?', option_a: 'Ignore both observations', option_b: 'Discuss the context to find out why they perceived it differently', option_c: 'Flip a coin to decide who is right', option_d: 'Kick one member out of the team', correct_option: 'b' },
              { order_index: 8, question_text: 'Why are environmental details (where the user is) important to document?', option_a: 'They aren\'t important at all', option_b: 'Context heavily influences how the user interacts with the problem', option_c: 'To practice descriptive writing', option_d: 'To make the report look colorful', correct_option: 'b' },
              { order_index: 9, question_text: '"Challenging Assumptions" means...', option_a: 'Being rude to team members', option_b: 'Questioning what you previously believed was true based on new evidence', option_c: 'Assuming the user is always wrong', option_d: 'Taking wild guesses', correct_option: 'b' }
            ]
          },
          {
            title: ' Session 7: Problem Definition',
            questions: [
              { order_index: 0, question_text: 'What does the TRUNK of a Problem Tree represent?', option_a: 'The root causes', option_b: 'The core problem statement', option_c: 'The visible effects', option_d: 'The solution', correct_option: 'b' },
              { order_index: 1, question_text: 'What do the LEAVES/BRANCHES of a Problem Tree represent?', option_a: 'The root causes', option_b: 'The core problem', option_c: 'The symptoms or visible effects of the problem', option_d: 'The budget', correct_option: 'c' },
              { order_index: 2, question_text: 'What do the ROOTS of a Problem Tree represent?', option_a: 'The underlying root causes of the problem', option_b: 'The visible effects', option_c: 'The project timeline', option_d: 'The final prototype', correct_option: 'a' },
              { order_index: 3, question_text: 'A well-framed problem statement focuses on...', option_a: 'The technology you want to use', option_b: 'The user\'s needs and the core challenge', option_c: 'Making money', option_d: 'How easy it is to build', correct_option: 'b' },
              { order_index: 4, question_text: 'What does HMW stand for in Design Thinking?', option_a: 'How Might We', option_b: 'How Much Weight', option_c: 'Have More Wealth', option_d: 'Hide My Work', correct_option: 'a' },
              { order_index: 5, question_text: 'Why do we use "How Might We" questions?', option_a: 'To admit defeat', option_b: 'To turn problems into open-ended opportunities for brainstorming', option_c: 'To ask the teacher for answers', option_d: 'To make the problem sound more difficult', correct_option: 'b' },
              { order_index: 6, question_text: '"Students are failing because they are lazy." This is an example of...', option_a: 'A great empathetic problem statement', option_b: 'A biased assumption that ignores deeper root causes', option_c: 'A How Might We question', option_d: 'A Problem Tree branch', correct_option: 'b' },
              { order_index: 7, question_text: 'Which of these is a properly formatted HMW question?', option_a: 'How might we build an app with AI?', option_b: 'How might we make waiting in line less stressful for patients?', option_c: 'How might we get rich quickly?', option_d: 'How might we force users to buy our product?', correct_option: 'b' },
              { order_index: 8, question_text: 'Why do we separate symptoms from root causes?', option_a: 'Because symptoms are fake', option_b: 'Fixing symptoms is temporary; fixing root causes solves the problem long-term', option_c: 'To make the tree look taller', option_d: 'It\'s just a drawing exercise', correct_option: 'b' },
              { order_index: 9, question_text: 'The Define stage converts observations from the Empathy stage into...', option_a: 'A working prototype', option_b: 'A precise definition of the problem', option_c: 'A business model', option_d: 'A printed certificate', correct_option: 'b' }
            ]
          },
          {
            title: ' Session 8: Ideation',
            questions: [
              { order_index: 0, question_text: 'What is the primary goal of the Ideation stage?', option_a: 'To pick the one perfect idea immediately', option_b: 'To generate a large quantity and wide variety of ideas', option_c: 'To build the product', option_d: 'To define the problem', correct_option: 'b' },
              { order_index: 1, question_text: 'During a brainstorming session, which rule is essential?', option_a: 'Criticize bad ideas immediately', option_b: 'Defer judgment and encourage wild ideas', option_c: 'Only the smartest person speaks', option_d: 'Focus only on the budget', correct_option: 'b' },
              { order_index: 2, question_text: 'What is "Affinity Clustering"?', option_a: 'A type of computer server', option_b: 'Grouping similar ideas or insights together to find patterns', option_c: 'A biological term for plants', option_d: 'A way to exclude team members', correct_option: 'b' },
              { order_index: 3, question_text: 'Why are "Wild Ideas" encouraged in brainstorming?', option_a: 'They are always the ones chosen', option_b: 'They stretch the imagination and often lead to innovative, practical solutions', option_c: 'To waste time', option_d: 'Because the facilitator likes jokes', correct_option: 'b' },
              { order_index: 4, question_text: 'After generating many ideas, what is the next logical step?', option_a: 'Build all of them', option_b: 'Idea Filtering and selection based on feasibility and impact', option_c: 'Throw them all away', option_d: 'Ask the user to build it', correct_option: 'b' },
              { order_index: 5, question_text: 'What makes an idea "Feasible"?', option_a: 'It sounds really cool', option_b: 'It can realistically be built with the available time, skills, and resources', option_c: 'It is completely impossible', option_d: 'It costs a million dollars', correct_option: 'b' },
              { order_index: 6, question_text: 'Which tool can be used to visually organize brainstorming ideas?', option_a: 'A Mind Map', option_b: 'A Calculator', option_c: 'A Stopwatch', option_d: 'A Microscope', correct_option: 'a' },
              { order_index: 7, question_text: 'In Idea Filtering, an "eco-friendly" idea means...', option_a: 'It is painted green', option_b: 'It is sustainable and does not harm the environment', option_c: 'It uses a lot of electricity', option_d: 'It is very expensive', correct_option: 'b' },
              { order_index: 8, question_text: '"Yes, and..." is a brainstorming technique used to...', option_a: 'Shut down an argument', option_b: 'Build upon someone else\'s idea positively', option_c: 'Disagree politely', option_d: 'Change the subject', correct_option: 'b' },
              { order_index: 9, question_text: 'What is a common outcome of the Ideation Sprint?', option_a: 'A completed app', option_b: 'Shortlist of creative, feasible ideas ready for prototyping', option_c: 'A final exam', option_d: 'A signed contract', correct_option: 'b' }
            ]
          },
          {
            title: ' Session 9: Prototyping Tool - Digital Prototype (Figma)',
            questions: [
              { order_index: 0, question_text: 'What is "Figma" primarily used for?', option_a: '3D Printing', option_b: 'Writing essays', option_c: 'Collaborative UI/UX design and digital prototyping', option_d: 'Laser cutting', correct_option: 'c' },
              { order_index: 1, question_text: 'What is the difference between UI and UX?', option_a: 'They are exactly the same', option_b: 'UI is how it looks (Interface), UX is how it feels and works (Experience)', option_c: 'UI is for hardware, UX is for software', option_d: 'UI is the backend code, UX is the database', correct_option: 'b' },
              { order_index: 2, question_text: 'What is a "Wireframe"?', option_a: 'A frame made of actual metal wire', option_b: 'A low-fidelity, skeletal outline of a digital interface', option_c: 'A fully coded website', option_d: 'A 3D printed model', correct_option: 'b' },
              { order_index: 3, question_text: 'What is a "High-Fidelity" prototype in Figma?', option_a: 'A sketch on paper', option_b: 'A design that looks and interacts almost exactly like the final product', option_c: 'A wireframe with no colors', option_d: 'An audio recording', correct_option: 'b' },
              { order_index: 4, question_text: 'Which of the following is a common UI design element?', option_a: 'A hammer', option_b: 'A Button', option_c: 'A laser beam', option_d: 'A screwdriver', correct_option: 'b' },
              { order_index: 5, question_text: 'What is a major advantage of using Figma for teams?', option_a: 'Only one person can use it at a time', option_b: 'It requires downloading massive files', option_c: 'Multiple users can design and collaborate in real-time', option_d: 'It costs thousands of dollars', correct_option: 'c' },
              { order_index: 6, question_text: 'What does "Handoff" mean in the context of digital design?', option_a: 'Giving a physical phone to someone', option_b: 'Preparing the design files and specs so developers can code it', option_c: 'Shaking hands after a meeting', option_d: 'Deleting the file', correct_option: 'b' },
              { order_index: 7, question_text: 'Why do designers use Plugins in Figma?', option_a: 'To play video games', option_b: 'To add extra functionality and speed up the workflow (like adding icons or dummy text)', option_c: 'To hack into websites', option_d: 'To crash the software', correct_option: 'b' },
              { order_index: 8, question_text: 'Designing a wireframe FIRST helps you focus on...', option_a: 'Which exact shade of blue to use', option_b: 'Layout, structure, and user flow before worrying about colors and fonts', option_c: 'The background music', option_d: 'The final logo design', correct_option: 'b' },
              { order_index: 9, question_text: 'In Figma, what allows you to link screens together to simulate the user journey?', option_a: 'The Prototyping tab', option_b: 'The Design tab', option_c: 'The Inspect tab', option_d: 'The Export tab', correct_option: 'a' }
            ]
          },
          {
            title: ' Session 11: Prototyping Tool - Digital Fabrication',
            questions: [
              { order_index: 0, question_text: 'What does CAD stand for?', option_a: 'Computer-Aided Design', option_b: 'Creative Art Department', option_c: 'Centralized Application Data', option_d: 'Computerized Audio Device', correct_option: 'a' },
              { order_index: 1, question_text: 'What is Onshape?', option_a: 'A photo editing tool', option_b: 'A cloud-based 3D CAD software', option_c: 'A video game', option_d: 'A type of 3D printer', correct_option: 'b' },
              { order_index: 2, question_text: 'Which software is specifically mentioned for slicing models before 3D printing?', option_a: 'Figma', option_b: 'Ultimaker Cura', option_c: 'Adobe Photoshop', option_d: 'Microsoft Excel', correct_option: 'b' },
              { order_index: 3, question_text: 'What does "Slicing" mean in 3D printing?', option_a: 'Cutting the physical printed model in half', option_b: 'Translating a 3D model into 2D layers and G-code instructions for the printer', option_c: 'Removing the supports with a knife', option_d: 'Designing the model', correct_option: 'b' },
              { order_index: 4, question_text: 'How does a laser cutter generally work?', option_a: 'By shooting physical blades very fast', option_b: 'By directing a high-power laser beam to precisely burn, melt, or vaporize material', option_c: 'By using high-pressure water', option_d: 'By printing plastic layer by layer', correct_option: 'b' },
              { order_index: 5, question_text: 'What makes a Product Design "Iconic"?', option_a: 'It is very cheap', option_b: 'It perfectly blends functionality, aesthetics, and usability to stand the test of time', option_c: 'It is completely useless but looks cool', option_d: 'It breaks easily', correct_option: 'b' },
              { order_index: 6, question_text: 'Which of these is a Rapid Prototyping technique for physical objects?', option_a: '3D Printing', option_b: 'Mind Mapping', option_c: 'Writing a poem', option_d: 'Empathy Mapping', correct_option: 'a' },
              { order_index: 7, question_text: 'Onshape uses a "Parametric Feature-Based" approach. What does this mean?', option_a: 'You can only draw 2D squares', option_b: 'Your design is driven by parameters (dimensions) that can be easily changed to update the model', option_c: 'It is based on magic features', option_d: 'You cannot change the size once drawn', correct_option: 'b' },
              { order_index: 8, question_text: 'What is the main advantage of Rapid Prototyping?', option_a: 'It takes years to finish', option_b: 'It allows you to quickly create physical models to test form and function', option_c: 'It is always made of solid gold', option_d: 'It eliminates the need for user testing', correct_option: 'b' },
              { order_index: 9, question_text: 'Before using a 3D printer, your digital design must usually be exported as which file type?', option_a: '.DOCX', option_b: '.MP3', option_c: '.STL or .OBJ', option_d: '.PDF', correct_option: 'c' }
            ]
          },
          {
            title: ' Session 12 & 13: Prototyping Sessions',
            questions: [
              { order_index: 0, question_text: 'What is the main activity during these Prototyping Sessions?', option_a: 'Reading textbooks silently', option_b: 'Translating ideas into low-fidelity and working models using lab tools', option_c: 'Memorizing the periodic table', option_d: 'Only writing reports', correct_option: 'b' },
              { order_index: 1, question_text: 'Which of the following is an electronics prototyping platform commonly used in Makers Spaces?', option_a: 'Microsoft Word', option_b: 'Arduino', option_c: 'Canva', option_d: 'Excel', correct_option: 'b' },
              { order_index: 2, question_text: 'When using recycled materials to build a low-fidelity model, what are you primarily testing?', option_a: 'How expensive it looks', option_b: 'The core concept, functionality, and form', option_c: 'How heavy it is', option_d: 'Nothing, it\'s just for decoration', correct_option: 'b' },
              { order_index: 3, question_text: 'Iteration in prototyping means...', option_a: 'Giving up after the first try', option_b: 'Repeating the design-build-test cycle to improve the prototype continuously', option_c: 'Only building one version forever', option_d: 'Throwing the prototype away', correct_option: 'b' },
              { order_index: 4, question_text: 'What is a "Breadboard" used for in electronics prototyping?', option_a: 'Cutting actual bread', option_b: 'Slicing 3D models', option_c: 'Quickly plugging in and testing electronic circuits without soldering', option_d: 'Coding the Arduino', correct_option: 'c' },
              { order_index: 5, question_text: 'Why might a team choose to build a Low-Fidelity prototype instead of a High-Fidelity one at first?', option_a: 'It is faster, cheaper, and allows for quick changes without attachment', option_b: 'Because High-Fidelity is illegal', option_c: 'Because they forgot their laptops', option_d: 'To make it look unprofessional', correct_option: 'a' },
              { order_index: 6, question_text: 'Which lab facility is specifically mentioned in the syllabus for prototyping?', option_a: 'Chemistry Lab', option_b: 'Atal Idea Lab / Makers Space', option_c: 'Biology Lab', option_d: 'Cooking Lab', correct_option: 'b' },
              { order_index: 7, question_text: 'If a prototype fails during testing, how should the team view this?', option_a: 'As a complete disaster', option_b: 'As valuable feedback to learn what doesn\'t work and improve', option_c: 'As a reason to drop the course', option_d: 'As the user\'s fault', correct_option: 'b' },
              { order_index: 8, question_text: 'What is the role of sensors in an Arduino project?', option_a: 'To make the code look longer', option_b: 'To detect environmental inputs like light, temperature, or motion', option_c: 'To power the laptop', option_d: 'To print 3D objects', correct_option: 'b' },
              { order_index: 9, question_text: '"Digital Fabrication" typically includes which combination of tools?', option_a: 'Scissors and glue', option_b: '3D printers, Laser Cutters, and CNC machines', option_c: 'Pencils and paper', option_d: 'Paint and canvas', correct_option: 'b' }
            ]
          },
          {
            title: ' Session 14: User Testing & Iteration',
            questions: [
              { order_index: 0, question_text: 'What is the primary purpose of User Testing?', option_a: 'To prove the user is wrong', option_b: 'To observe how real users interact with the prototype and collect feedback', option_c: 'To sell them the prototype immediately', option_d: 'To get a good grade without asking questions', correct_option: 'b' },
              { order_index: 1, question_text: 'During User Testing, what should you do if the user struggles to use your prototype?', option_a: 'Grab it from them and do it yourself', option_b: 'Quietly observe their struggle and take notes on the usability issue', option_c: 'Yell at them for doing it wrong', option_d: 'End the test immediately', correct_option: 'b' },
              { order_index: 2, question_text: 'What is an "Observation Note"?', option_a: 'A love letter', option_b: 'A documented record of what the user did, said, and struggled with during the test', option_c: 'A grade given by the facilitator', option_d: 'A receipt for materials', correct_option: 'b' },
              { order_index: 3, question_text: 'A "Business Model" is created to ensure the project is...', option_a: 'As expensive as possible', option_b: 'Economically feasible, scalable, and sustainable', option_c: 'Never going to make money', option_d: 'Secret from the public', correct_option: 'b' },
              { order_index: 4, question_text: 'What does "Scalability" mean in a Social Venture Plan?', option_a: 'How heavy the prototype is on a scale', option_b: 'The ability of the solution to grow and impact more people without failing', option_c: 'The size of the UI buttons', option_d: 'Climbing a mountain', correct_option: 'b' },
              { order_index: 5, question_text: 'Feedback Forms are primarily used to...', option_a: 'Waste paper', option_b: 'Systematically collect quantitative and qualitative data from users', option_c: 'Test the team\'s grammar', option_d: 'Keep the users busy', correct_option: 'b' },
              { order_index: 6, question_text: 'When aligning your project with SDGs in the Venture Plan, you are highlighting its...', option_a: 'Social impact and relevance', option_b: 'Coding language', option_c: 'Circuit diagram', option_d: 'Weight', correct_option: 'a' },
              { order_index: 7, question_text: 'If 9 out of 10 users complain about a specific feature, what is the best Iteration step?', option_a: 'Ignore them, they don\'t know design', option_b: 'Redesign that specific feature based on their feedback', option_c: 'Start a completely different project', option_d: 'Tell the facilitator the users were biased', correct_option: 'b' },
              { order_index: 8, question_text: 'What is a key component of a "Sustainability Plan"?', option_a: 'How the project will continue to operate and be funded in the long term', option_b: 'What color to paint the prototype', option_c: 'Who will present first', option_d: 'The list of software shortcuts', correct_option: 'a' },
              { order_index: 9, question_text: 'The ultimate goal of this week is to prepare a draft for the...', option_a: 'Mathematics Exam', option_b: 'Social Venture Pitch', option_c: 'Chemistry Practical', option_d: 'Extracurricular sports day', correct_option: 'b' }
            ]
          },
          {
            title: ' Session 15 & 16: Final Demo & SEE (Semester End Exam)',
            questions: [
              { order_index: 0, question_text: 'The Final Demo day involves showcasing your innovation and...', option_a: 'A poster display and project pitching to a jury', option_b: 'Taking a written 3-hour exam', option_c: 'Running a marathon', option_d: 'Doing a silent play', correct_option: 'a' },
              { order_index: 1, question_text: 'During the SEE, what is the maximum total marks awarded?', option_a: '50', option_b: '100', option_c: '200', option_d: '10', correct_option: 'b' },
              { order_index: 2, question_text: 'Which of these evaluation parameters carries the most weight (30 Marks) in the SEE?', option_a: 'Viva Voce', option_b: 'Final Presentation', option_c: 'Prototype / Solution Demonstration', option_d: 'Documentation Report', correct_option: 'c' },
              { order_index: 3, question_text: 'What is assessed during the "Viva Voce" (20 Marks)?', option_a: 'Group dancing skills', option_b: 'Individual understanding, contribution, and learning outcomes', option_c: 'The exact code typed by the leader', option_d: 'The team\'s poster color choice', correct_option: 'b' },
              { order_index: 4, question_text: 'A great "Social Pitch" must include...', option_a: 'Clarity, storytelling, problem-solution fit, and visual aids', option_b: 'Whispering so the jury pays attention', option_c: 'Only reading text directly off the slides', option_d: 'Arguing with the judges', correct_option: 'a' },
              { order_index: 5, question_text: 'What must you submit regarding your Activity Book for the SEE?', option_a: 'A digital copy only', option_b: 'The handwritten activity book with CIE marks', option_c: 'You don\'t need to submit it', option_d: 'A blank notebook', correct_option: 'b' },
              { order_index: 6, question_text: 'To pass the SEE specifically, what is the minimum score required out of 50?', option_a: '10', option_b: '15', option_c: '18', option_d: '25', correct_option: 'c' },
              { order_index: 7, question_text: 'The SEE is conducted by...', option_a: 'Only the internal facilitator', option_b: 'One Internal and one External Examiner', option_c: 'A robot', option_d: 'The students themselves', correct_option: 'b' },
              { order_index: 8, question_text: 'When pitching to the jury, "Storytelling" is used to...', option_a: 'Put them to sleep', option_b: 'Emotionally connect the jury to the problem and the user\'s journey', option_c: 'Hide the fact that the prototype doesn\'t work', option_d: 'Tell fairy tales', correct_option: 'b' },
              { order_index: 9, question_text: '"Feasibility, cost-effectiveness, and alignment with SDGs" are evaluated under which parameter?', option_a: 'Viva Voce', option_b: 'Documentation Report', option_c: 'Business Model / Sustainability Plan', option_d: 'Prototype Demonstration', correct_option: 'c' }
            ]
          }
        ];

      for (const template of idtCurriculum) {
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
      alert('Success! IDT Quizzes have been imported into your account.');
    } catch (err) {
      alert('Error importing IDT Quizzes: ' + err.message);
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
      
      // Fetch current questions from DB to find which ones were removed from the UI
      const { data: currentQs } = await HQ_SUPABASE.from('questions').select('id').eq('quiz_id', quizId);
      const currentIds = currentQs ? currentQs.map(q => q.id) : [];
      const idsToDelete = currentIds.filter(id => !existingIds.includes(id));
      
      // Delete the removed questions
      if (idsToDelete.length > 0) {
        await HQ_SUPABASE.from('questions').delete().in('id', idsToDelete);
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
  const ADMIN_ID = '961e9563-848e-4fda-a754-891ed3732dd4';
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
