// ============================================================
// app.js — HubQuiz Main Application
// Router + Auth + Host Game Logic + Student Game Logic
// ============================================================

/* global HQ_SUPABASE, AudioEngine, Confetti */

// ---- Constants ----
const QUESTION_TIME = 30; // seconds (global, fixed)
const ANSWER_COLORS = {
  a: { bg: '#E74C3C', label: 'A', symbol: '▲' },
  b: { bg: '#3498DB', label: 'B', symbol: '◆' },
  c: { bg: '#F39C12', label: 'C', symbol: '●' },
  d: { bg: '#2ECC71', label: 'D', symbol: '■' },
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

  renderView('dashboard');
  setupMuteToggle('host-mute');
  loadQuizList();

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await HQ_SUPABASE.auth.signOut();
    State.user = null;
    navigate('/login');
  });

  document.getElementById('new-quiz-btn')?.addEventListener('click', () => {
    showQuizModal(null);
  });
}

async function loadQuizList() {
  const container = document.getElementById('quiz-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner">Loading quizzes...</div>';

  const { data: quizzes, error } = await HQ_SUPABASE
    .from('quizzes')
    .select('*, questions(count)')
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
          <span class="quiz-meta">${qCount} question${qCount !== 1 ? 's' : ''}</span>
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
      <button type="button" class="btn btn-icon q-remove" title="Remove question">✕</button>
    </div>
    <textarea class="q-text input-field" placeholder="Question text..." required>${escHtml(q?.question_text || '')}</textarea>
    <div class="q-options">
      ${['a','b','c','d'].map(opt => `
        <label class="option-row option-${opt}">
          <input type="radio" name="correct-${idx}" value="${opt}" ${q?.correct_option === opt ? 'checked' : ''} required>
          <span class="opt-label">${opt.toUpperCase()}</span>
          <input type="text" class="input-field opt-input" placeholder="Option ${opt.toUpperCase()}" value="${escHtml(q?.['option_'+opt] || '')}" required>
        </label>
      `).join('')}
    </div>`;
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
    const opts    = row.querySelectorAll('.opt-input');
    const correct = row.querySelector('input[type="radio"]:checked')?.value;
    if (!text || !correct) { valid = false; return; }
    questions.push({
      question_text: text,
      option_a:      opts[0].value.trim(),
      option_b:      opts[1].value.trim(),
      option_c:      opts[2].value.trim(),
      option_d:      opts[3].value.trim(),
      correct_option: correct,
      order_index:   i,
      quiz_id:       null, // filled after upsert
      id:            row.dataset.questionId || undefined,
    });
  });

  if (!valid) { showError('qm-error', 'All questions need text and a correct answer selected.'); setLoading(btn, false); return; }

  try {
    let finalQuizId = quizId;

    if (quizId) {
      // Update existing
      const { error } = await HQ_SUPABASE.from('quizzes').update({ title }).eq('id', quizId);
      if (error) throw error;
    } else {
      // Create new
      const { data, error } = await HQ_SUPABASE.from('quizzes').insert({ title, created_by: State.user.id }).select().single();
      if (error) throw error;
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
  if (!confirm('Delete this quiz? This cannot be undone.')) return;
  const { error } = await HQ_SUPABASE.from('quizzes').delete().eq('id', quizId);
  if (error) { alert('Error deleting quiz: ' + error.message); return; }
  loadQuizList();
}

// ============================================================
// ---- START SESSION ----
// ============================================================

async function startSession(quizId) {
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
  setupMuteToggle('lobby-mute');

  // Display PIN
  const pin = State.session.pin;
  document.getElementById('lobby-pin').textContent = formatPin(pin);
  document.getElementById('lobby-quiz-title').textContent = State.quiz.title;
  document.getElementById('lobby-q-count').textContent = `${State.questions.length} question${State.questions.length !== 1 ? 's' : ''}`;

  // Copy PIN button
  document.getElementById('copy-pin-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(pin).then(() => {
      const btn = document.getElementById('copy-pin-btn');
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = '📋 Copy PIN', 1500);
    });
  });

  // Start quiz button
  document.getElementById('start-quiz-btn')?.addEventListener('click', async () => {
    if (State.players.length === 0) {
      if (!confirm('No players have joined yet. Start anyway?')) return;
    }
    await hostStartQuiz();
  });

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

  // Answer submitted (track count for auto-advance)
  ch.on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'answers',
  }, () => {
    checkAllAnswered();
  });

  // Broadcast events FROM host TO students (and self)
  ch.on('broadcast', { event: 'game:event' }, (payload) => {
    // Host receives its own broadcast — ignore if we're the sender
    // (used mainly by students)
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

  // Update session status
  const { error } = await HQ_SUPABASE.from('game_sessions').update({
    status: 'active',
    current_question_index: 0,
  }).eq('id', State.session.id);
  if (error) { alert(error.message); return; }

  State.session.current_question_index = 0;
  State.session.status = 'active';

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
  });

  renderView('host-question');
  setupMuteToggle('hq-mute');

  document.getElementById('hq-q-num').textContent = `Q${index + 1} of ${State.questions.length}`;
  document.getElementById('hq-question-text').textContent = q.question_text;
  document.getElementById('hq-answered-count').textContent = '0';
  document.getElementById('hq-total-count').textContent = State.players.length;

  // Render answer blocks
  const blocksEl = document.getElementById('hq-answer-blocks');
  blocksEl.innerHTML = ['a','b','c','d'].map(opt => `
    <div class="host-answer-block answer-${opt}">
      <span class="answer-symbol">${ANSWER_COLORS[opt].symbol}</span>
      <span class="answer-opt-label">${opt.toUpperCase()}</span>
      <span class="answer-opt-text">${escHtml(q['option_'+opt])}</span>
    </div>`
  ).join('');

  // Start timer ring
  startHostTimer(QUESTION_TIME, now);

  // Subscribe to answer inserts for count
  subscribeAnswerCount(q.id);
}

let _answerCountCh = null;
let _answerCount = 0;

function subscribeAnswerCount(questionId) {
  _answerCount = 0;
  if (_answerCountCh) { HQ_SUPABASE.removeChannel(_answerCountCh); _answerCountCh = null; }

  _answerCountCh = HQ_SUPABASE.channel(`answers:${questionId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'answers',
      filter: `question_id=eq.${questionId}`,
    }, () => {
      _answerCount++;
      const el = document.getElementById('hq-answered-count');
      if (el) el.textContent = _answerCount;
      if (_answerCount >= State.players.length && State.players.length > 0) {
        // All answered — auto-advance
        clearTimer();
        hostShowReveal(questionId);
      }
    })
    .subscribe();
}

function startHostTimer(seconds, startedAt) {
  clearTimer();
  const ring    = document.getElementById('timer-ring-progress');
  const numEl   = document.getElementById('timer-number');
  const totalLen = ring ? parseFloat(ring.getAttribute('stroke-dasharray')) : 283;

  function tick() {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
    const remaining = Math.max(0, seconds - elapsed);
    const numRemaining = Math.ceil(remaining);

    if (numEl) numEl.textContent = numRemaining;
    if (ring) {
      const progress = remaining / seconds;
      ring.setAttribute('stroke-dashoffset', totalLen * (1 - progress));
      // Color shift: green → yellow → red
      if (remaining > 20) ring.setAttribute('stroke', '#2ECC71');
      else if (remaining > 10) ring.setAttribute('stroke', '#F39C12');
      else ring.setAttribute('stroke', '#E74C3C');
    }

    if (remaining <= 10 && remaining > 0) {
      AudioEngine.startCountdownMusic(remaining);
    }

    if (numRemaining <= remaining + 0.5) {
      AudioEngine.playTick();
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

  State.timerInterval = requestAnimationFrame(tick);
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

  // Broadcast reveal to students
  await broadcastGameEvent('question:reveal', {
    question_index: index,
    correct_option: q.correct_option,
  });

  // Fetch answer distribution
  const { data: counts } = await HQ_SUPABASE.rpc('get_question_answer_counts', {
    p_session_id:  State.session.id,
    p_question_id: questionId,
  });

  // Fetch leaderboard
  const { data: leaders } = await HQ_SUPABASE.rpc('get_session_leaderboard', {
    p_session_id: State.session.id,
    p_limit: 5,
  });

  renderView('host-reveal');
  setupMuteToggle('hr-mute');
  AudioEngine.playDrumroll();

  document.getElementById('hr-q-num').textContent = `Q${index + 1} of ${State.questions.length}`;
  document.getElementById('hr-question-text').textContent = q.question_text;

  // Render answer bars
  const total = counts?.total_players || 1;
  const barsEl = document.getElementById('hr-answer-bars');
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
          <div class="reveal-bar-fill answer-${opt}" style="width:${pct}%"></div>
        </div>
        <span class="reveal-bar-count">${count}</span>
      </div>`;
  }).join('');

  // Render mini leaderboard
  const lbEl = document.getElementById('hr-leaderboard');
  lbEl.innerHTML = (leaders || []).map(p =>
    `<div class="lb-row"><span class="lb-rank">#${p.rank}</span><span class="lb-name">${escHtml(p.name)}</span><span class="lb-score">${p.score}</span></div>`
  ).join('');

  const isLast = index >= State.questions.length - 1;
  const nextBtn = document.getElementById('hr-next-btn');
  if (nextBtn) {
    nextBtn.textContent = isLast ? '🏆 See Final Results' : '⏭ Next Question';
    nextBtn.onclick = async () => {
      if (isLast) {
        hostShowFinalLeaderboard();
      } else {
        hostShowQuestion(index + 1);
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
  setupMuteToggle('hl-mute');
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
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin  = document.getElementById('join-pin').value.trim().replace(/\s/g, '');
    const name = document.getElementById('join-name').value.trim();
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
  document.getElementById('mentor-login-link')?.addEventListener('click', () => navigate('/login'));
}

async function joinSession(pin, name, btn) {
  // Find session by PIN
  const cleanPin = pin.padStart(6, '0');
  const { data: sessions, error: sErr } = await HQ_SUPABASE
    .from('game_sessions')
    .select('*')
    .eq('pin', cleanPin)
    .in('status', ['lobby'])
    .limit(1);

  if (sErr || !sessions?.length) {
    showError('join-error', 'Game not found or not accepting players. Check your PIN.');
    setLoading(btn, false);
    return;
  }

  const session = sessions[0];

  // Check name availability
  const { data: existing } = await HQ_SUPABASE
    .from('players')
    .select('id')
    .eq('session_id', session.id)
    .ilike('name', name)
    .limit(1);

  if (existing?.length) {
    showError('join-error', 'A player with that name has already joined. Use a different name.');
    setLoading(btn, false);
    return;
  }

  // Insert player
  const { data: player, error: pErr } = await HQ_SUPABASE
    .from('players')
    .insert({ session_id: session.id, name })
    .select()
    .single();

  if (pErr) {
    showError('join-error', pErr.message.includes('unique') ? 'That name is already taken.' : pErr.message);
    setLoading(btn, false);
    return;
  }

  // Store in localStorage for reconnect
  localStorage.setItem('hq_player_id', player.id);
  localStorage.setItem('hq_session_id', session.id);
  localStorage.setItem('hq_player_name', name);

  State.playerSelf = player;
  State.session    = session;

  setLoading(btn, false);
  showStudentLobby(session, player);
}

// ============================================================
// ---- STUDENT LOBBY ----
// ============================================================

function showStudentLobby(session, player) {
  renderView('student-lobby');
  setupMuteToggle('sl-mute');
  document.getElementById('sl-player-name').textContent = player.name;

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
        showDisconnected();
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
  setupMuteToggle('sq-mute');

  document.getElementById('sq-q-num').textContent = `Q${question_index + 1}`;

  // Render tappable color blocks
  const blocksEl = document.getElementById('sq-answer-blocks');
  blocksEl.innerHTML = ['a','b','c','d'].map(opt => `
    <button class="student-answer-btn answer-${opt}" data-opt="${opt}" id="sq-btn-${opt}" aria-label="Option ${opt.toUpperCase()}: ${escHtml(q['option_'+opt])}">
      <span class="sa-symbol">${ANSWER_COLORS[opt].symbol}</span>
      <span class="sa-label">${opt.toUpperCase()}</span>
    </button>`
  ).join('');

  // Start progress bar
  startStudentTimer(QUESTION_TIME, question_started_at);

  // Attach answer handlers
  blocksEl.querySelectorAll('.student-answer-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
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
    resultsEl.classList.remove('hidden');
    if (data.correct) {
      resultsEl.className = 'sq-result correct';
      resultsEl.innerHTML = `<span class="result-icon">✓</span><span>Correct! +${data.points_awarded} pts</span>`;
      AudioEngine.playCorrect();
    } else {
      resultsEl.className = 'sq-result incorrect';
      resultsEl.innerHTML = `<span class="result-icon">✗</span><span>Incorrect</span>`;
      AudioEngine.playIncorrect();
    }
  }
}

function studentShowReveal(payload) {
  // Wait for reveal from host — student already got feedback, just show "waiting"
  const resultsEl = document.getElementById('sq-result');
  const waitEl    = document.getElementById('sq-waiting-reveal');
  if (waitEl) waitEl.classList.remove('hidden');
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
  if (view) {
    view.classList.remove('hidden');
    // Scroll to top
    window.scrollTo(0, 0);
  } else {
    console.error(`View not found: view-${viewName}`);
  }
}

function setupMuteToggle(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.textContent = AudioEngine.isMuted() ? '🔇' : '🔊';
  btn.onclick = () => {
    const newMute = !AudioEngine.isMuted();
    AudioEngine.setMute(newMute);
    State.muted = newMute;
    localStorage.setItem('hq_muted', newMute);
    btn.textContent = newMute ? '🔇' : '🔊';
  };
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
