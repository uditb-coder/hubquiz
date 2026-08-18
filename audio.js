// ============================================================
// audio.js — Web Audio API Sound Engine for HubQuiz
// All sounds synthesised entirely in the browser — no audio files needed.
// ============================================================

const AudioEngine = (() => {
  let ctx = null;
  let muted = false;
  let lobbyNodes = null;
  let countdownNodes = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function setMute(val) {
    muted = val;
    if (muted) {
      stopLobbyMusic();
      stopCountdownMusic();
    }
  }

  function isMuted() { return muted; }

  // ---- Low-level helpers ----

  function playOscillator(freq, type, startTime, duration, gainVal, ac) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  function playNote(freq, start, dur, vol = 0.3) {
    if (muted) return;
    const ac = getCtx();
    playOscillator(freq, 'sine', ac.currentTime + start, dur, vol, ac);
  }

  function playChord(freqs, start, dur, vol = 0.2) {
    if (muted) return;
    freqs.forEach(f => playNote(f, start, dur, vol));
  }

  function noise(duration, vol = 0.15) {
    if (muted) return;
    const ac = getCtx();
    const bufSize = ac.sampleRate * duration;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    src.connect(gain);
    gain.connect(ac.destination);
    src.start();
    src.stop(ac.currentTime + duration);
  }

  // ---- Lobby music (looping ambient pulsed chords) ----

  let lobbyAudio = null;

  function startLobbyMusic() {
    if (muted) return;
    if (!lobbyAudio) {
      lobbyAudio = new Audio('/assets/lobby.mp3');
      lobbyAudio.loop = true;
    }
    lobbyAudio.play().catch(e => console.warn('Lobby audio autoplay blocked:', e));
  }

  function stopLobbyMusic() {
    if (lobbyAudio) {
      lobbyAudio.pause();
      lobbyAudio.currentTime = 0;
    }
  }

  // ---- Countdown tension music ----
  let isCountdownPlaying = false;
  let countdownTimerId = null;

  function startCountdownMusic(secondsLeft) {
    if (muted || isCountdownPlaying) return;
    isCountdownPlaying = true;
    const ac = getCtx();
    countdownNodes = [];

    function scheduleTick() {
      if (!isCountdownPlaying || muted) return;
      const t = ac.currentTime + 0.05;
      
      // Digital LED clock tick (sharp, short blip)
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(1500, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.03);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.05);
      
      countdownNodes.push(osc);
      
      // Schedule next tick in exactly 1 second
      countdownTimerId = setTimeout(scheduleTick, 1000);
    }

    scheduleTick();
  }

  function stopCountdownMusic() {
    isCountdownPlaying = false;
    clearTimeout(countdownTimerId);
    if (!countdownNodes) return;
    countdownNodes.forEach(n => { try { n.stop(); } catch(e) {} });
    countdownNodes = null;
  }

  // ---- Single sound effects ----

  function playTick() {
    if (muted) return;
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ac.currentTime);
    gain.gain.setValueAtTime(0.05, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.1);
  }

  function playAnswerLocked() {
    // Soft chime — 3 ascending notes
    if (muted) return;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      playNote(f, i * 0.08, 0.2, 0.25);
    });
  }

  function playTimesUp() {
    // Descending blurp
    if (muted) return;
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, ac.currentTime);
    osc.frequency.linearRampToValueAtTime(150, ac.currentTime + 0.4);
    gain.gain.setValueAtTime(0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.5);
  }

  function playCorrect() {
    // Major chord arpeggio — C E G C
    if (muted) return;
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      playNote(f, i * 0.07, 0.3, 0.3);
    });
  }

  function playIncorrect() {
    // Minor blip — descending minor interval
    if (muted) return;
    [300, 250].forEach((f, i) => {
      playNote(f, i * 0.12, 0.2, 0.2);
    });
  }

  function playDrumroll() {
    // Rapid noise burst
    if (muted) return;
    for (let i = 0; i < 12; i++) {
      setTimeout(() => noise(0.06, 0.12), i * 60);
    }
  }

  function playFanfare() {
    // Ascending arpeggio for final leaderboard
    if (muted) return;
    const freqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    freqs.forEach((f, i) => {
      playNote(f, i * 0.1, 0.4, 0.25);
    });
    // Big chord at the end
    setTimeout(() => {
      if (!muted) playChord([523.25, 659.25, 783.99, 1046.50], 0, 0.8, 0.2);
    }, freqs.length * 100 + 100);
  }

  return {
    setMute,
    isMuted,
    startLobbyMusic,
    stopLobbyMusic,
    startCountdownMusic,
    stopCountdownMusic,
    playTick,
    playAnswerLocked,
    playTimesUp,
    playCorrect,
    playIncorrect,
    playDrumroll,
    playFanfare,
    // Unlock audio context on first user interaction
    unlock: () => { try { getCtx(); } catch(e) {} },
  };
})();

window.AudioEngine = AudioEngine;
