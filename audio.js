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

  function startLobbyMusic() {
    if (muted || lobbyNodes) return;
    const ac = getCtx();
    lobbyNodes = [];

    // Simple upbeat loop using a ScriptProcessor-free approach:
    // Schedule repeated notes into the future
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4 E4 G4 C5
    const interval = 0.5; // seconds per note
    let time = ac.currentTime + 0.1;

    function scheduleLoop() {
      if (!lobbyNodes || muted) return;
      for (let i = 0; i < 8; i++) {
        const freq = notes[i % notes.length];
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time + i * interval);
        gain.gain.setValueAtTime(0.0001, time + i * interval);
        gain.gain.linearRampToValueAtTime(0.12, time + i * interval + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + i * interval + interval * 0.8);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(time + i * interval);
        osc.stop(time + i * interval + interval);
        lobbyNodes.push(osc);
      }
      time += 8 * interval;
      lobbyNodes._timer = setTimeout(scheduleLoop, 3000);
    }

    scheduleLoop();
  }

  function stopLobbyMusic() {
    if (!lobbyNodes) return;
    clearTimeout(lobbyNodes._timer);
    lobbyNodes.forEach(n => { try { n.stop(); } catch(e) {} });
    lobbyNodes = null;
  }

  // ---- Countdown tension music ----
  let isCountdownPlaying = false;
  let countdownTimerId = null;

  function startCountdownMusic(secondsLeft) {
    if (muted || isCountdownPlaying) return;
    isCountdownPlaying = true;
    const ac = getCtx();
    countdownNodes = [];

    // Catchy 8-bit game loop (120 BPM)
    const freqs = {
      'C4': 261.63, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 
      'C5': 523.25, 'E5': 659.25, 'F5': 698.46
    };
    const melody = [
      'G4', 'E4', 'C4', 'E4', 'G4', 'C5', 'E5', 'C5',
      'A4', 'F4', 'C4', 'F4', 'A4', 'C5', 'F5', 'C5'
    ];

    function scheduleTick() {
      if (!isCountdownPlaying || muted) return;
      const t = ac.currentTime + 0.05;
      
      // Melody (16th notes)
      for (let i = 0; i < 16; i++) {
        if (melody[i]) {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type = 'square';
          osc.frequency.value = freqs[melody[i]];
          
          gain.gain.setValueAtTime(0, t + i*0.125);
          gain.gain.linearRampToValueAtTime(0.04, t + i*0.125 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, t + i*0.125 + 0.1);

          osc.connect(gain);
          gain.connect(ac.destination);
          osc.start(t + i*0.125);
          osc.stop(t + i*0.125 + 0.125);
          countdownNodes.push(osc);
        }
      }

      // Bassline (off-beat 8th notes)
      for (let i = 0; i < 8; i++) {
        const time = t + i * 0.25 + 0.125;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.value = (i < 4) ? 130.81 : 174.61; // C3 then F3
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.12, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(time);
        osc.stop(time + 0.2);
        countdownNodes.push(osc);
      }

      countdownTimerId = setTimeout(scheduleTick, 2000);
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
