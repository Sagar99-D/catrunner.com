(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const GROUND = 250;
  const FG = '#535353';

  // ---------- State ----------
  let state = 'ready'; // ready | running | over
  let speed, score, hiScore, obstacles, clouds, spawnTimer, last, frameTick;
  let muted = false;

  try { hiScore = Number(localStorage.getItem('catRunnerHi')) || 0; } catch (e) { hiScore = 0; }

  const cat = {
    x: 60, y: GROUND, vy: 0, jumping: false, ducking: false,
    get w() { return this.ducking && !this.jumping ? 54 : 44; },
    get h() { return this.ducking && !this.jumping ? 24 : 38; },
  };

  function reset() {
    speed = 6;
    score = 0;
    obstacles = [];
    clouds = [
      { x: 200, y: 50 }, { x: 520, y: 80 }, { x: 760, y: 40 },
    ];
    spawnTimer = 60;
    frameTick = 0;
    cat.y = GROUND; cat.vy = 0; cat.jumping = false; cat.ducking = false;
  }
  reset();

  // ---------- Sound ----------
  let audio;
  function beep(freq, dur, type = 'square', vol = 0.05) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch (e) { /* audio not available */ }
  }

  // Pitch-sliding note, used for the funny effects
  function slide(f1, f2, dur, delay = 0, type = 'sawtooth', vol = 0.08) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime + delay;
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
      o.connect(g); g.connect(audio.destination);
      o.start(t); o.stop(t + dur + 0.06);
    } catch (e) { /* audio not available */ }
  }
  // Cartoon "boing" for jumping
  function boing() {
    slide(250, 700, 0.12, 0, 'sine', 0.12);
    slide(700, 350, 0.1, 0.12, 'sine', 0.1);
  }
  // Sad trombone "wah wah wah waaaah" for Ghee Ghatam
  function sadTrombone() {
    slide(392, 370, 0.25, 0.00);
    slide(370, 349, 0.25, 0.30);
    slide(349, 330, 0.25, 0.60);
    slide(330, 220, 0.80, 0.90);
  }

  // Your custom death sound (death.mp3). Falls back to the trombone if it can't play.
  const deathSound = new Audio('death.mp3');
  deathSound.preload = 'auto';
  function playDeathSound() {
    if (muted) return;
    try {
      deathSound.currentTime = 0;
      const p = deathSound.play();
      if (p && p.catch) p.catch(() => sadTrombone());
    } catch (e) { sadTrombone(); }
  }
  function stopDeathSound() {
    try { deathSound.pause(); deathSound.currentTime = 0; } catch (e) {}
  }

  // ---------- Input ----------
  function jump() {
    if (state === 'ready') { state = 'running'; }
    if (state === 'over') { if (performance.now() - overAt > 400) { stopDeathSound(); reset(); state = 'running'; } return; }
    if (!cat.jumping) {
      cat.vy = -13.5;
      cat.jumping = true;
      cat.ducking = false;
      boing();
    }
  }
  function duck(on) {
    if (state !== 'running') return;
    cat.ducking = on;
    if (on && cat.jumping) cat.vy = Math.max(cat.vy, 8); // fast-fall
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); duck(true); }
    else if (e.code === 'KeyM') { muted = !muted; if (muted) stopDeathSound(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown') duck(false);
  });
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const yRel = (e.clientY - r.top) / r.height;
    if (yRel > 0.7 && state === 'running') duck(true); else jump();
  });
  window.addEventListener('pointerup', () => duck(false));

  // ---------- Drawing helpers ----------
  function rect(x, y, w, h) { ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  function drawCat() {
    const x = cat.x, base = cat.y;
    const step = Math.floor(frameTick / 6) % 2;
    ctx.fillStyle = FG;

    if (cat.ducking && !cat.jumping) {
      // Low crouching cat
      rect(x + 8, base - 18, 36, 14);      // body
      rect(x + 38, base - 24, 14, 14);     // head
      rect(x + 38, base - 29, 4, 6);       // ear
      rect(x + 48, base - 29, 4, 6);       // ear
      rect(x, base - 20, 10, 4);           // tail
      rect(x - 4, base - 24, 4, 8);        // tail tip
      const o = step ? 4 : 0;
      rect(x + 12 + o, base - 6, 6, 6);    // legs
      rect(x + 30 - o, base - 6, 6, 6);
      ctx.fillStyle = '#fff';
      rect(x + 46, base - 20, 3, 3);       // eye
      return;
    }

    // Body
    rect(x + 8, base - 24, 28, 16);
    // Head
    rect(x + 28, base - 38, 16, 16);
    // Ears
    rect(x + 28, base - 44, 4, 7);
    rect(x + 40, base - 44, 4, 7);
    // Tail (curved up)
    rect(x + 2, base - 22, 8, 4);
    rect(x - 2, base - 30, 4, 12);
    rect(x - 2, base - 34, 8, 4);
    // Legs
    if (cat.jumping) {
      rect(x + 10, base - 8, 6, 8);
      rect(x + 18, base - 8, 6, 6);
      rect(x + 28, base - 8, 6, 6);
      rect(x + 34, base - 8, 6, 8);
    } else if (step) {
      rect(x + 10, base - 8, 6, 8);
      rect(x + 20, base - 8, 6, 4);
      rect(x + 26, base - 8, 6, 8);
      rect(x + 36, base - 8, 4, 4);
    } else {
      rect(x + 10, base - 8, 6, 4);
      rect(x + 20, base - 8, 6, 8);
      rect(x + 26, base - 8, 6, 4);
      rect(x + 34, base - 8, 6, 8);
    }
    // Face details (white)
    ctx.fillStyle = '#fff';
    rect(x + 37, base - 34, 4, 4);   // eye
    rect(x + 42, base - 28, 2, 2);   // nose
    rect(x + 30, base - 42, 1, 3);   // inner ear
    rect(x + 42, base - 42, 1, 3);
    if (state === 'over') { // X eye
      ctx.fillStyle = FG;
      rect(x + 37, base - 34, 4, 4);
      ctx.fillStyle = '#fff';
      rect(x + 37, base - 34, 1, 1); rect(x + 40, base - 34, 1, 1);
      rect(x + 38, base - 33, 2, 2);
      rect(x + 37, base - 31, 1, 1); rect(x + 40, base - 31, 1, 1);
    }
  }

  function drawBush(o) {
    ctx.fillStyle = FG;
    const n = o.count;
    for (let i = 0; i < n; i++) {
      const bx = o.x + i * 14;
      const bh = o.h - (i % 2) * 8;
      rect(bx + 4, GROUND - bh, 6, bh);          // stem
      rect(bx, GROUND - bh + 8, 4, 10);          // left leaf
      rect(bx + 10, GROUND - bh + 14, 4, 10);    // right leaf
    }
  }

  function drawBird(o) {
    ctx.fillStyle = FG;
    const up = Math.floor(frameTick / 10) % 2;
    rect(o.x + 8, o.y + 8, 22, 8);      // body
    rect(o.x, o.y + 10, 10, 4);         // tail
    rect(o.x + 28, o.y + 6, 8, 8);      // head
    rect(o.x + 36, o.y + 9, 6, 3);      // beak
    if (up) { rect(o.x + 12, o.y, 10, 8); rect(o.x + 16, o.y - 4, 4, 4); }
    else { rect(o.x + 12, o.y + 16, 10, 8); rect(o.x + 16, o.y + 24, 4, 4); }
    ctx.fillStyle = '#fff';
    rect(o.x + 32, o.y + 8, 2, 2);
  }

  function drawCloud(c) {
    ctx.fillStyle = '#e4e4e4';
    rect(c.x, c.y, 40, 8);
    rect(c.x + 8, c.y - 6, 22, 6);
    rect(c.x + 28, c.y - 3, 12, 3);
  }

  function drawGround() {
    ctx.fillStyle = FG;
    rect(0, GROUND, W, 2);
    // moving pebbles
    const off = Math.floor(score * 3) % 80;
    for (let x = -off; x < W; x += 80) {
      rect(x + 20, GROUND + 8, 6, 2);
      rect(x + 55, GROUND + 14, 3, 2);
    }
  }

  function pad(n) { return String(Math.floor(n)).padStart(5, '0'); }

  function drawHUD() {
    ctx.fillStyle = FG;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('HI ' + pad(hiScore) + '  ' + pad(score), W - 16, 28);
  }

  // ---------- Game logic ----------
  function spawn() {
    const canBird = score > 250 && Math.random() < 0.3;
    if (canBird) {
      const ys = [GROUND - 30, GROUND - 52, GROUND - 90];
      const y = ys[Math.floor(Math.random() * ys.length)];
      obstacles.push({ type: 'bird', x: W + 20, y, w: 42, h: 20 });
    } else {
      const count = 1 + Math.floor(Math.random() * (score > 150 ? 3 : 2));
      const h = 32 + Math.floor(Math.random() * 16);
      obstacles.push({ type: 'bush', x: W + 20, h, count, w: count * 14, hbH: h });
    }
    spawnTimer = 50 + Math.random() * 60 + (14 - speed) * 4;
  }

  function hitbox(o) {
    if (o.type === 'bird') return { x: o.x + 4, y: o.y + 2, w: o.w - 8, h: o.h - 4 };
    return { x: o.x + 2, y: GROUND - o.hbH + 2, w: o.w - 4, h: o.hbH - 2 };
  }
  function catBox() {
    return { x: cat.x + 6, y: cat.y - cat.h + 2, w: cat.w - 10, h: cat.h - 4 };
  }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  let overAt = 0;
  function gameOver() {
    state = 'over';
    overAt = performance.now();
    playDeathSound();
    if (score > hiScore) {
      hiScore = Math.floor(score);
      try { localStorage.setItem('catRunnerHi', String(hiScore)); } catch (e) {}
    }
  }

  let lastMilestone = 0;
  function update(dt) {
    frameTick += dt;
    // physics
    if (cat.jumping) {
      cat.vy += 0.7 * dt;
      cat.y += cat.vy * dt;
      if (cat.y >= GROUND) { cat.y = GROUND; cat.vy = 0; cat.jumping = false; }
    }
    // score & speed
    score += speed * dt * 0.1;
    speed = Math.min(15, 6 + score / 200);
    if (Math.floor(score / 100) > lastMilestone) {
      lastMilestone = Math.floor(score / 100);
      beep(880, 0.1, 'square', 0.04);
    }
    // clouds
    clouds.forEach((c) => { c.x -= 0.5 * dt; if (c.x < -50) { c.x = W + 20; c.y = 30 + Math.random() * 70; } });
    // obstacles
    spawnTimer -= dt;
    if (spawnTimer <= 0) spawn();
    obstacles.forEach((o) => { o.x -= (o.type === 'bird' ? speed + 1.5 : speed) * dt; });
    obstacles = obstacles.filter((o) => o.x + (o.w || 60) > -10);
    const cb = catBox();
    for (const o of obstacles) {
      if (overlap(cb, hitbox(o))) { gameOver(); break; }
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    clouds.forEach(drawCloud);
    drawGround();
    obstacles.forEach((o) => (o.type === 'bird' ? drawBird(o) : drawBush(o)));
    drawCat();
    drawHUD();

    ctx.textAlign = 'center';
    ctx.fillStyle = FG;
    if (state === 'ready') {
      ctx.font = 'bold 20px monospace';
      ctx.fillText('Press SPACE or tap to start', W / 2, 120);
    } else if (state === 'over') {
      ctx.font = 'bold 34px monospace';
      ctx.fillText('GHEE GHATAM', W / 2, 110);
      ctx.font = '16px monospace';
      ctx.fillText('Press SPACE or tap to play again', W / 2, 140);
    }
  }

  function loop(now) {
    const dt = Math.min(2.5, (now - (last || now)) / 16.667);
    last = now;
    if (state === 'running') {
      update(dt);
    } else if (state === 'ready') {
      frameTick += dt; // idle animation
    }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
