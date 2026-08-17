// ============================================================
// confetti.js — Lightweight canvas confetti engine
// ============================================================

const Confetti = (() => {
  let canvas, ctx2d, particles = [], animId = null;

  const COLORS = [
    '#FFD600', '#FF4136', '#0074D9', '#2ECC40',
    '#FF69B4', '#FF851B', '#7FDBFF', '#FFFFFF'
  ];

  function init() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.cssText = `
      position:fixed;top:0;left:0;width:100vw;height:100vh;
      pointer-events:none;z-index:9999;
    `;
    document.body.appendChild(canvas);
    ctx2d = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x:     Math.random() * canvas.width,
      y:     -10,
      w:     Math.random() * 10 + 6,
      h:     Math.random() * 6 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      angle: Math.random() * Math.PI * 2,
      spin:  (Math.random() - 0.5) * 0.2,
      vx:    (Math.random() - 0.5) * 3,
      vy:    Math.random() * 4 + 2,
      alpha: 1,
      life:  1,
      decay: Math.random() * 0.005 + 0.003,
    };
  }

  function burst(count = 120) {
    init();
    for (let i = 0; i < count; i++) {
      // Stagger spawning for a better effect
      setTimeout(() => {
        particles.push(createParticle());
        // Some from left, some from right, some from center
        const p = particles[particles.length - 1];
        if (i < count / 3) p.x = canvas.width * 0.2;
        else if (i < 2 * count / 3) p.x = canvas.width * 0.5;
        else p.x = canvas.width * 0.8;
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = -(Math.random() * 6 + 4); // shoot upward
      }, i * 10);
    }
    if (!animId) loop();
  }

  function loop() {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);

    particles.forEach(p => {
      ctx2d.save();
      ctx2d.translate(p.x, p.y);
      ctx2d.rotate(p.angle);
      ctx2d.globalAlpha = p.life;
      ctx2d.fillStyle = p.color;
      ctx2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx2d.restore();

      p.x     += p.vx;
      p.y     += p.vy;
      p.vy    += 0.15; // gravity
      p.angle += p.spin;
      p.life  -= p.decay;
    });

    if (particles.length > 0) {
      animId = requestAnimationFrame(loop);
    } else {
      animId = null;
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    particles = [];
    if (ctx2d) ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { burst, stop };
})();

window.Confetti = Confetti;
