(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = { hp: $('hpText'), hpMeter: $('hpMeter'), mana: $('manaText'), manaMeter: $('manaMeter'), wave: $('waveText'), level: $('levelText'), xp: $('xpText'), xpMeter: $('xpMeter'), enemyCount: $('enemyCount'), overlay: $('overlay'), eyebrow: $('overlayEyebrow'), title: $('overlayTitle'), copy: $('overlayCopy'), action: $('overlayAction'), hint: $('overlayHint'), toast: $('toast'), arena: $('arenaName'), score: $('scoreText'), joy: $('joystick'), knob: $('joyKnob') };
  const spells = {
    fire: { name: 'Fireball', cost: 18, cooldown: .48, damage: 29, speed: 330, color: '#ff9258', radius: 5, splash: 45 },
    ice: { name: 'Ice Dart', cost: 13, cooldown: .30, damage: 18, speed: 430, color: '#81dfff', radius: 4, slow: 2.4 },
    void: { name: 'Void Orb', cost: 30, cooldown: .82, damage: 48, speed: 245, color: '#bd8cff', radius: 8, splash: 24 }
  };
  const maps = [
    { name: 'CATHEDRAL REVIVAL', colors: ['#1b2425', '#172021', '#202126'], line: '#d6d2be0a', accent: '#c9aa6b18', motif: 'rings' },
    { name: 'THE SUNKEN CHAPEL', colors: ['#15272c', '#102027', '#1d2930'], line: '#9bd7d50d', accent: '#68c6ca24', motif: 'pool' },
    { name: 'ASHEN SANCTUM', colors: ['#30201d', '#211918', '#2b2021'], line: '#efb18b0c', accent: '#d7734b2b', motif: 'crater' },
    { name: 'MOONLIT CLOISTER', colors: ['#20202f', '#171a2a', '#202b30'], line: '#b8c5f00d', accent: '#9cb2ef25', motif: 'stars' }
  ];
  const skillMilestones = { 3: 'earth', 6: 'stoneSkin', 9: 'arcaneSurge', 12: 'runicFocus' };
  const skillNames = { earth: 'Earth Bolt', stoneSkin: 'Stone Skin', arcaneSurge: 'Arcane Surge', runicFocus: 'Runic Focus' };
  let W = 0, H = 0, dpr = 1, last = 0, state = 'intro', selected = 'fire', wave = 1, score = 0, level = 1, xp = 0, xpNext = 55;
  let unlockedSkills = new Set(), rods = [];
  let best = Number(localStorage.getItem('magestorm-best') || 0);
  let player, enemies = [], shots = [], particles = [], decor = [], keys = {}, move = { x: 0, y: 0 }, joyPointer = null, pointer = null;
  let castCooldown = 0, spawnClock = 0, waveWait = 0, toastTimer = 0, soundOn = false, audio = null, shake = 0, frame = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildDecor(); draw();
  }
  function buildDecor() {
    decor = []; const gap = Math.max(42, Math.min(60, W / 7));
    for (let y = 28; y < H; y += gap) for (let x = 20; x < W; x += gap) decor.push({ x: x + ((Math.floor(y / gap) % 2) * gap / 2), y, r: rand(1.2, 2.2), a: rand(.04, .13) });
  }
  function reset() {
    player = { x: W / 2, y: H * .56, r: 12, hp: 100, mana: 100, invuln: 0, facing: -Math.PI / 2 };
    enemies = []; shots = []; particles = []; rods = []; wave = 1; score = 0; level = 1; xp = 0; xpNext = 55; unlockedSkills = new Set(); document.querySelector('[data-spell="earth"]').classList.add('locked'); spawnClock = .2; waveWait = 0; castCooldown = 0; shake = 0;
    makeWave(); updateUI();
  }
  function makeWave() {
    let count = Math.min(3 + wave, 12);
    for (let i = 0; i < count; i++) spawnEnemy(i);
    ui.wave.textContent = String(wave).padStart(2, '0');
    const map = maps[Math.floor((wave - 1) / 6) % maps.length];
    ui.arena.textContent = map.name;
    const newMap = wave > 1 && (wave - 1) % 6 === 0;
    toast(newMap ? `NEW MAP · ${map.name}` : `WAVE ${String(wave).padStart(2, '0')} · THE GATES OPEN`);
  }
  function spawnEnemy(index = 0) {
    const angle = (index / Math.max(1, Math.min(3 + wave, 12))) * Math.PI * 2 + rand(-.22, .22);
    const edge = Math.random(); let x, y;
    if (edge < .25) { x = rand(15, W - 15); y = 20; }
    else if (edge < .5) { x = W - 20; y = rand(30, H - 25); }
    else if (edge < .75) { x = rand(15, W - 15); y = H - 20; }
    else { x = 20; y = rand(30, H - 25); }
    const heavy = wave >= 3 && Math.random() < .18;
    enemies.push({ x, y, r: heavy ? 14 : 10, hp: heavy ? 76 + wave * 5 : 42 + wave * 3, maxHp: heavy ? 76 + wave * 5 : 42 + wave * 3, speed: (heavy ? 37 : 48) + Math.min(24, wave * 1.8), damage: heavy ? 17 : 10, hit: 0, attack: rand(.1, .7), slow: 0, type: heavy ? 'brute' : 'wisp', phase: rand(0, 6.28), angle });
  }
  function toast(text) { ui.toast.textContent = text; ui.toast.classList.add('show'); toastTimer = 1.8; }
  function updateUI() {
    if (!player) return;
    ui.hp.textContent = Math.ceil(player.hp); ui.hpMeter.style.width = `${player.hp}%`;
    ui.mana.textContent = Math.floor(player.mana); ui.manaMeter.style.width = `${player.mana}%`;
    ui.enemyCount.textContent = `${enemies.length} ${enemies.length === 1 ? 'FOE' : 'FOES'}`;
    ui.level.textContent = `LV ${level}`; ui.xp.textContent = `${xp}/${xpNext} XP`; ui.xpMeter.style.width = `${Math.min(100, xp / xpNext * 100)}%`;
    best = Math.max(best, score); localStorage.setItem('magestorm-best', String(best));
    ui.score.textContent = `BEST ${String(best).padStart(4, '0')}`;
  }
  function showOverlay(kind) {
    state = kind; ui.overlay.classList.remove('hidden');
    if (kind === 'intro') { ui.eyebrow.textContent = 'A POCKET-SIZED DUEL'; ui.title.innerHTML = 'Enter the<br><em>Storm.</em>'; ui.copy.textContent = 'Three spells. Endless waves. How long can you hold the Cathedral?'; ui.action.innerHTML = 'ENTER THE ARENA <span>↗</span>'; ui.hint.innerHTML = 'MOVE <b>WASD</b> / JOYSTICK &nbsp;·&nbsp; CAST <b>1–4</b> / SPELL BUTTONS'; }
    else if (kind === 'paused') { ui.eyebrow.textContent = 'CATCH YOUR BREATH'; ui.title.innerHTML = 'The storm<br><em>waits.</em>'; ui.copy.textContent = 'The arena is paused. Regroup, then return to the fight.'; ui.action.innerHTML = 'RESUME DUEL <span>↗</span>'; ui.hint.innerHTML = 'TIP · ICE DART SLOWS PURSUING WISPS'; }
    else { ui.eyebrow.textContent = 'THE ARENA CLAIMS ANOTHER'; ui.title.innerHTML = 'Storm<br><em>fallen.</em>'; ui.copy.textContent = `You reached wave ${wave} and banished ${score} foes. The Cathedral remembers.`; ui.action.innerHTML = 'RISE AGAIN <span>↗</span>'; ui.hint.innerHTML = 'MOVE <b>WASD</b> / JOYSTICK &nbsp;·&nbsp; CAST <b>1–4</b> / SPELL BUTTONS'; }
  }
  function begin() {
    if (state === 'paused') { state = 'playing'; ui.overlay.classList.add('hidden'); last = performance.now(); return; }
    reset(); state = 'playing'; ui.overlay.classList.add('hidden'); last = performance.now(); canvas.focus({ preventScroll: true });
  }
  function togglePause() { if (state === 'playing') showOverlay('paused'); else if (state === 'paused') begin(); }
  function chooseSpell(name) {
    if (!spells[name] && name !== 'earth') return;
    if (name === 'earth' && !unlockedSkills.has('earth')) { toast('EARTH BOLT UNLOCKS AT LEVEL 3'); return; }
    selected = name; document.querySelectorAll('.spell-button').forEach(b => b.classList.toggle('selected', b.dataset.spell === name));
  }
  function targetEnemy() {
    if (pointer && pointer.inside) return enemies.reduce((best, e) => !best || dist(e, pointer) < dist(best, pointer) ? e : best, null);
    return enemies.reduce((best, e) => !best || dist(player, e) < dist(player, best) ? e : best, null);
  }
  function cast(name = selected) {
    if (name === 'earth') return castEarthBolt();
    if (state !== 'playing' || castCooldown > 0) return;
    const s = spells[name]; if (!s || player.mana < s.cost) { toast('NOT ENOUGH MANA'); return; }
    const target = targetEnemy(); let angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facing;
    player.facing = angle; player.mana -= s.cost; castCooldown = s.cooldown;
    const x = player.x + Math.cos(angle) * 17, y = player.y + Math.sin(angle) * 17;
    shots.push({ x, y, vx: Math.cos(angle) * s.speed, vy: Math.sin(angle) * s.speed, spell: name, life: 1.8, r: s.radius, color: s.color, damage: s.damage, splash: s.splash || 0, slow: s.slow || 0, trail: [] });
    burst(x, y, s.color, 5, 35); ping(name === 'fire' ? 220 : name === 'ice' ? 580 : 145);
  }
  function castEarthBolt() {
    if (state !== 'playing' || castCooldown > 0) return;
    if (!unlockedSkills.has('earth')) { toast('EARTH BOLT UNLOCKS AT LEVEL 3'); return; }
    if (player.mana < 24) { toast('NOT ENOUGH MANA'); return; }
    const target = targetEnemy();
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facing;
    const length = target ? Math.min(360, dist(player, target)) : 190;
    const end = { x: player.x + Math.cos(angle) * length, y: player.y + Math.sin(angle) * length };
    player.facing = angle; player.mana -= 24; castCooldown = .42;
    rods.push({ x: player.x, y: player.y, endX: end.x, endY: end.y, life: .32, max: .32 });
    if (target && dist(player, target) <= 360) {
      target.hp -= 24; target.hit = .2;
      const push = 120; // Approximately 10 in-game meters at the arena's mobile scale.
      target.x = clamp(target.x + Math.cos(angle) * push, 18, W - 18);
      target.y = clamp(target.y + Math.sin(angle) * push, 30, H - 24);
      burst(target.x, target.y, '#b9a17a', 14, 100); shake = 2;
    }
    burst(player.x + Math.cos(angle) * 22, player.y + Math.sin(angle) * 22, '#9f8a63', 10, 55); ping(165);
  }
  function gainXP(amount) {
    xp += amount;
    while (xp >= xpNext) {
      xp -= xpNext; level++; xpNext = Math.round(55 + (level - 1) * 22);
      player.hp = Math.min(100, player.hp + 8); player.mana = Math.min(100, player.mana + 18);
      const skill = skillMilestones[level];
      if (skill) {
        unlockedSkills.add(skill);
        toast(`LEVEL ${level} · NEW SKILL: ${skillNames[skill].toUpperCase()}`);
        if (skill === 'earth') { const button = document.querySelector('[data-spell="earth"]'); button.classList.remove('locked'); button.title = 'Cast Earth Bolt'; button.setAttribute('aria-label', 'Cast Earth Bolt'); }
      } else toast(`LEVEL UP · LEVEL ${level}`);
    }
    updateUI();
  }
  function burst(x, y, color, count = 8, force = 90) {
    for (let i = 0; i < count; i++) { const a = rand(0, Math.PI * 2), v = rand(force * .2, force); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.22, .62), max: .62, color, r: rand(1, 3) }); }
  }
  function ping(freq) {
    if (!soundOn) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), g = audio.createGain(); o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(.035, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .12); o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + .13); } catch (_) {}
  }
  function update(dt) {
    frame += dt; if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) ui.toast.classList.remove('show'); }
    if (state !== 'playing') return;
    castCooldown = Math.max(0, castCooldown - dt); player.mana = Math.min(100, player.mana + dt * (unlockedSkills.has('arcaneSurge') ? 10 : 7.5)); player.invuln = Math.max(0, player.invuln - dt); shake = Math.max(0, shake - dt * 20);
    for (let i = rods.length - 1; i >= 0; i--) { rods[i].life -= dt; if (rods[i].life <= 0) rods.splice(i, 1); }
    let dx = move.x, dy = move.y;
    if (keys.ArrowLeft || keys.a) dx -= 1; if (keys.ArrowRight || keys.d) dx += 1;
    if (keys.ArrowUp || keys.w) dy -= 1; if (keys.ArrowDown || keys.s) dy += 1;
    const mag = Math.hypot(dx, dy); if (mag > 1) { dx /= mag; dy /= mag; }
    if (mag > .08) player.facing = Math.atan2(dy, dx);
    const speed = 155; player.x = clamp(player.x + dx * speed * dt, 22, W - 22); player.y = clamp(player.y + dy * speed * dt, 36, H - 24);
    for (const e of enemies) {
      e.phase += dt * (e.type === 'brute' ? 2 : 3.2); e.hit = Math.max(0, e.hit - dt); e.slow = Math.max(0, e.slow - dt); e.attack -= dt;
      let ex = player.x - e.x, ey = player.y - e.y, d = Math.hypot(ex, ey) || 1;
      if (d > player.r + e.r + 2) { const sp = e.speed * (e.slow > 0 ? .48 : 1); e.x += ex / d * sp * dt; e.y += ey / d * sp * dt; }
      if (d < player.r + e.r + 3 && e.attack <= 0 && player.invuln <= 0) { player.hp -= e.damage * (unlockedSkills.has('stoneSkin') ? .75 : 1); player.invuln = .48; e.attack = .78; shake = 5; burst(player.x, player.y, '#ff7982', 9, 75); ping(110); if (player.hp <= 0) { player.hp = 0; updateUI(); showOverlay('over'); return; } }
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const p = shots[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (frame % .04 < dt) { p.trail.push({ x: p.x, y: p.y, life: .22 }); if (p.trail.length > 6) p.trail.shift(); }
      let hit = null;
      for (const e of enemies) if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) { hit = e; break; }
      if (hit) {
        hit.hp -= p.damage * (unlockedSkills.has('runicFocus') ? 1.18 : 1); hit.hit = .15; if (p.slow) hit.slow = p.slow;
        burst(p.x, p.y, p.color, p.spell === 'void' ? 14 : 9, 90);
        if (p.splash) for (const e of enemies) if (e !== hit && Math.hypot(e.x - hit.x, e.y - hit.y) < p.splash) { e.hp -= p.damage * .48; e.hit = .12; burst(e.x, e.y, p.color, 4, 45); }
        if (p.spell === 'void') { for (const e of enemies) if (e !== hit && Math.hypot(e.x - hit.x, e.y - hit.y) < 70) e.hp -= p.damage * .24; }
        shots.splice(i, 1); shake = p.spell === 'fire' ? 1.5 : 0; continue;
      }
      for (const t of p.trail) t.life -= dt;
      if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) { shots.splice(i, 1); }
    }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].hp <= 0) { const e = enemies[i]; score++; gainXP(e.type === 'brute' ? 18 : 12); burst(e.x, e.y, e.type === 'brute' ? '#e7aa78' : '#c69aff', 16, 105); enemies.splice(i, 1); }
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; if (p.life <= 0) particles.splice(i, 1); }
    if (!enemies.length) { waveWait += dt; if (waveWait > 1.4) { wave++; waveWait = 0; makeWave(); } } else waveWait = 0;
    updateUI();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function draw() {
    if (!W || !H) return;
    ctx.save(); if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    const map = maps[Math.floor((wave - 1) / 6) % maps.length];
    const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, map.colors[0]); bg.addColorStop(.52, map.colors[1]); bg.addColorStop(1, map.colors[2]); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // Each six-wave region has its own palette and arena floor motif.
    const gap = Math.max(42, Math.min(60, W / 7));
    for (let y = -gap; y < H + gap; y += gap) { ctx.strokeStyle = map.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + ((Math.floor(y / gap) % 2) * gap / 2)); ctx.lineTo(W, y + ((Math.floor(y / gap) % 2) * gap / 2)); ctx.stroke(); }
    for (const d of decor) { ctx.fillStyle = `rgba(218,203,164,${d.a})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = map.accent; ctx.lineWidth = 1;
    if (map.motif === 'rings' || map.motif === 'pool') {
      ctx.beginPath(); ctx.ellipse(W / 2, H * .53, W * .31, H * .26, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(W / 2, H * .53, W * .24, H * .2, 0, 0, Math.PI * 2); ctx.stroke();
      if (map.motif === 'pool') { ctx.fillStyle = '#4eb8c014'; ctx.beginPath(); ctx.ellipse(W / 2, H * .53, W * .17, H * .13, 0, 0, Math.PI * 2); ctx.fill(); }
    } else if (map.motif === 'crater') {
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(W / 2, H * .53, W * (.12 + i * .065), H * (.09 + i * .055), i * .18, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, x = W / 2 + Math.cos(a) * W * .23, y = H * .53 + Math.sin(a) * H * .2; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(W / 2, H * .53, W * .31, H * .26, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // Broken columns, niches and altar at the perimeter
    const margin = 17; for (let i = 0; i < 6; i++) { const x = margin + (W - margin * 2) * i / 5; drawColumn(x, 19, .8); drawColumn(x, H - 19, .75); }
    for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + p.life / p.max * .5), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
    ctx.globalAlpha = 1;
    for (const p of shots) {
      for (const t of p.trail) { ctx.globalAlpha = Math.max(0, t.life / .22) * .32; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(t.x, t.y, p.r * .72, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = p.spell === 'void' ? 19 : 12; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.globalAlpha = .65; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .55, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (const rod of rods) drawEarthRod(rod);
    for (const e of enemies) drawEnemy(e);
    if (player) drawPlayer();
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * .22, W / 2, H / 2, H * .8); vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, '#0809109e'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function drawColumn(x, y, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.fillStyle = '#11171a'; ctx.strokeStyle = '#b7aa8a38'; ctx.lineWidth = 1;
    roundRect(-7, -7, 14, 14, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#aaa18522'; roundRect(-4, -4, 8, 8, 2); ctx.fill();
    ctx.restore();
  }
  function drawEarthRod(rod) {
    const dx = rod.endX - rod.x, dy = rod.endY - rod.y, length = Math.hypot(dx, dy) || 1, nx = -dy / length, ny = dx / length;
    const alpha = clamp(rod.life / rod.max, 0, 1);
    ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = '#b9a17a'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#756447'; ctx.strokeStyle = '#d1bd8e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rod.x + nx * 8, rod.y + ny * 8); ctx.lineTo(rod.endX + nx * 5, rod.endY + ny * 5); ctx.lineTo(rod.endX + dx / length * 10, rod.endY + dy / length * 10); ctx.lineTo(rod.endX - nx * 5, rod.endY - ny * 5); ctx.lineTo(rod.x - nx * 8, rod.y - ny * 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#e0cfaa'; ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) { const t = i / 5, x = rod.x + dx * t, y = rod.y + dy * t, w = 7 * (1 - t) + 2; ctx.beginPath(); ctx.moveTo(x - nx * w, y - ny * w); ctx.lineTo(x + nx * w, y + ny * w); ctx.stroke(); }
    ctx.restore();
  }
  function drawEnemy(e) {
    ctx.save(); ctx.translate(e.x, e.y + Math.sin(e.phase) * 1.5);
    ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(0, e.r * .75, e.r * 1.2, e.r * .48, 0, 0, Math.PI * 2); ctx.fill();
    const color = e.hit > 0 ? '#fff4dc' : e.type === 'brute' ? '#e79b68' : '#b184e8';
    ctx.shadowColor = color; ctx.shadowBlur = e.type === 'brute' ? 12 : 16;
    if (e.type === 'brute') {
      ctx.fillStyle = '#503842'; ctx.beginPath(); ctx.moveTo(-e.r, -e.r * .5); ctx.lineTo(-e.r * .75, -e.r); ctx.lineTo(-2, -e.r * .75); ctx.lineTo(e.r * .7, -e.r); ctx.lineTo(e.r, -e.r * .3); ctx.lineTo(e.r * .75, e.r * .7); ctx.lineTo(0, e.r); ctx.lineTo(-e.r * .9, e.r * .55); ctx.closePath(); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-3, -2, 2, 0, Math.PI * 2); ctx.arc(4, -2, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#45344f'; ctx.beginPath(); ctx.moveTo(0, -e.r); ctx.quadraticCurveTo(e.r * 1.35, -e.r * .1, 0, e.r); ctx.quadraticCurveTo(-e.r * 1.35, -e.r * .1, 0, -e.r); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, e.r * .34, e.r * .5, 0, 0, Math.PI * 2); ctx.fill();
      if (e.slow > 0) { ctx.strokeStyle = '#8edfff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, e.r + 4, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.shadowBlur = 0;
    const barW = e.type === 'brute' ? 27 : 21, hpW = barW * clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = '#090a0d'; roundRect(-barW / 2, -e.r - 8, barW, 3, 2); ctx.fill();
    ctx.fillStyle = e.type === 'brute' ? '#edaa75' : '#bd90ef'; roundRect(-barW / 2, -e.r - 8, hpW, 3, 2); ctx.fill();
    ctx.restore();
  }
  function drawPlayer() {
    const p = player; if (p.invuln > 0 && Math.floor(frame * 20) % 2) return;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(0, 7, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 24); glow.addColorStop(0, '#dbb87855'); glow.addColorStop(1, '#dbb87800'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.facing); ctx.fillStyle = '#342d40'; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(3, -13); ctx.lineTo(11, -7); ctx.lineTo(8, 7); ctx.lineTo(-2, 11); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d1b879'; ctx.beginPath(); ctx.arc(1, -2, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f7d99a'; ctx.beginPath(); ctx.arc(2, -3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e7c98a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(16, 0); ctx.stroke(); ctx.fillStyle = '#fff0bd'; ctx.shadowColor = '#e7c98a'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(16, 0, 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.restore();
  }
  function joyMove(event) {
    const r = ui.joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const max = r.width * .32, x = event.clientX - cx, y = event.clientY - cy, d = Math.hypot(x, y), scale = d > max ? max / d : 1;
    move.x = x * scale / max; move.y = y * scale / max;
    ui.knob.style.left = `calc(50% + ${x * scale}px)`; ui.knob.style.top = `calc(50% + ${y * scale}px)`;
  }
  ui.joy.addEventListener('pointerdown', e => { joyPointer = e.pointerId; ui.joy.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
  ui.joy.addEventListener('pointermove', e => { if (joyPointer === e.pointerId) joyMove(e); });
  const joyEnd = e => { if (joyPointer === e.pointerId) { joyPointer = null; move.x = move.y = 0; ui.knob.style.left = '50%'; ui.knob.style.top = '50%'; } };
  ui.joy.addEventListener('pointerup', joyEnd); ui.joy.addEventListener('pointercancel', joyEnd);
  document.querySelectorAll('.spell-button').forEach(button => {
    button.addEventListener('click', () => { chooseSpell(button.dataset.spell); cast(button.dataset.spell); });
  });
  ui.action.addEventListener('click', begin);
  $('pauseButton').addEventListener('click', togglePause);
  $('soundButton').addEventListener('click', e => { soundOn = !soundOn; e.currentTarget.textContent = soundOn ? '♫' : '♪'; e.currentTarget.style.color = soundOn ? '#e4bb72' : ''; if (soundOn) ping(440); });
  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) keys[key.length === 1 ? key : ({ arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight' })[key]] = true;
    if (key === '1') { chooseSpell('fire'); cast('fire'); } if (key === '2') { chooseSpell('ice'); cast('ice'); } if (key === '3') { chooseSpell('void'); cast('void'); } if (key === '4') { chooseSpell('earth'); cast('earth'); }
    if (key === 'escape' || key === 'p') togglePause();
    if (key === ' ' && state === 'intro') begin();
  });
  window.addEventListener('keyup', e => { const key = e.key.toLowerCase(); if (key.length === 1) keys[key] = false; else if (key.startsWith('arrow')) keys[({ arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight' })[key]] = false; });
  canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true }; });
  canvas.addEventListener('pointerleave', () => { if (pointer) pointer.inside = false; });
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && state === 'playing') cast(); });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') showOverlay('paused'); });
  function loop(now) {
    const dt = Math.min(.04, Math.max(0, (now - last) / 1000 || 0)); last = now;
    update(dt); draw(); requestAnimationFrame(loop);
  }
  resize(); showOverlay('intro'); last = performance.now(); requestAnimationFrame(loop);
})();
