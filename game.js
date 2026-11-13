// Save History — "37 SECONDS": steer the Titanic through the ice field.
import { createWorld } from './world.js';

const NOOP = { style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, set textContent(v) {}, children: [] };
const $ = id => document.getElementById(id) || NOOP;
const W = createWorld($('world'));
const { THREE, scene, camera, ship, renderer } = W;

const SHIP_Z = 6, HALF_LEN = 13, HALF_W = 1.55, LANE = 12, SPAWN_Z = -170, BASE_SPEED = 30;
const engine = th => ({ k: 0.6 + 0.4 * th, steer: 0.6 + 0.4 * th, mult: 1 + th });   // throttle 0 (slow) .. 1 (full)
const progress = { unlocked: 1, stars: {}, best: {}, tutorialSeen: false, fixes: {}, xp: 0, voyages: 0, wins: 0, closeTotal: 0, achievements: {}, missions: [], missionsDone: {}, settings: { sound: true, music: true, vibrate: true, shake: true, gfx: 'auto' }, ship: 'titanic', seenShips: ['titanic'], daily: null, seaBonus: null };   // switched to the Playables save API on release

// ---------------- cameras ----------------
const CAM_MENU = { pos: new THREE.Vector3(-16, 20, 38), look: new THREE.Vector3(0, 0, -1) };
const cam = { pos: CAM_MENU.pos.clone(), look: CAM_MENU.look.clone(), shake: 0, mode: 'menu' };

// ---------------- menu ----------------
$('tagline').textContent = TEXTS.tagline;
const ICONS = { titanic: '🚢', pompeii: '🌋', hindenburg: '🎈', london: '🔥', apollo13: '🚀' };
function buildMenu() {
  const tf = LEVELS[0].fixes.length, ff = Object.keys(progress.fixes).length;
  $('fixCount').textContent = `🛠️ History fixes found: ${ff}/${tf}`;
  $('levels').innerHTML = LEVELS.slice(0, Math.max(1, progress.unlocked)).map((l, i) => {
    const open = i < progress.unlocked && l.ready, soon = i < progress.unlocked && !l.ready, s = progress.stars[l.id] || 0;
    if (soon) return `<div class="lvl locked soon"><div class="ico">${ICONS[l.id] || '⭐'}</div><div class="info"><div class="name">${l.name}</div><div class="sub">${l.year} • COMING SOON</div></div><div class="lock">⏳</div></div>`;
    return open
      ? `<div class="lvl open" data-i="${i}"><div class="ico">${ICONS[l.id] || '⭐'}</div><div class="info"><div class="name outline">${l.name}</div><div class="sub">${l.year} • ${l.place}${progress.best[l.id] ? ' • ' + TEXTS.best + ' ' + progress.best[l.id] : ''}</div></div><div class="stars">${[0, 1, 2].map(k => k < s ? '<b>★</b>' : '★').join('')}</div></div>`
      : `<div class="lvl locked"><div class="ico">❔</div><div class="info"><div class="name">NEXT CHAPTER</div><div class="sub">A new moment in history • coming soon</div></div><div class="lock">🔒</div></div>`;
  }).join('');
  const endOpen = (progress.voyages || 0) > 0;
  $('levels').innerHTML += `<div class="lvl ${endOpen ? 'open endless' : 'locked'}" id="endlessRow"><div class="ico">♾️</div><div class="info"><div class="name ${endOpen ? 'outline' : ''}">Endless Voyage</div><div class="sub">${endOpen ? (progress.bestDist ? 'Record ' + progress.bestDist + ' m' : 'How far can you sail?') : 'Finish 1 voyage to unlock'}</div></div>${endOpen ? '<div class="stars"><b>NEW</b></div>' : '<div class="lock">🔒</div>'}</div>`;
  document.querySelectorAll('.lvl.open:not(.endless)').forEach(el => el.onclick = () => startLevel(+el.dataset.i));
  if (endOpen) $('endlessRow').onclick = () => startLevel(0, false, true);
}
// loading screen with a real fact
const FACTS = [
  'The Titanic was 269 metres long — longer than two and a half football fields.',
  'Her four funnels stood about 19 metres tall. Only three worked — the fourth was mostly for looks.',
  'She carried just 20 lifeboats for the 2,224 people on board.',
  'The sea that night was about −2 °C — colder than freezing, because salt water freezes lower.',
  'The Titanic received six ice warnings on 14 April 1912.',
  'From spotting the iceberg to impact: about 37 seconds.',
  'The nearby SS Californian saw the Titanic\'s rockets but did not come to help.'
];
$('lgFact').textContent = FACTS[Math.floor(Math.random() * FACTS.length)];
let lgP = 0; const lgT = setInterval(() => { lgP = Math.min(92, lgP + 7 + Math.random() * 9); $('lgFill').style.width = lgP + '%'; }, 120);
function hideLoading() { clearInterval(lgT); $('lgFill').style.width = '100%'; setTimeout(() => $('loading').classList.add('out'), 450); setTimeout(() => $('loading').classList.add('hidden'), 1100); }

function renderMeta() {
  const r = Meta.rankOf(progress.xp || 0);
  $('rkIco').textContent = r.cur.icon; $('rkName').textContent = r.cur.name.toUpperCase();
  $('rkNext').textContent = r.next ? `${r.toNext} XP to ${r.next.icon} ${r.next.name}` : 'Highest rank reached!';
  setTimeout(() => $('rkFill').style.width = (r.pct * 100) + '%', 200);
  const ms = Meta.ensureMissions(progress);
  $('msList').innerHTML = ms.slice(0, 2).map(m => `<div class="ms"><div class="box"></div><span>${m.text}</span><em>+${m.xp} XP</em></div>`).join('');
}
function renderLive() {
  const sea = Meta.todaysSea(), used = progress.seaBonus === Meta.dayKey();
  $('seaIco').textContent = sea.icon; $('seaName').textContent = sea.name; $('seaTxt').textContent = '';
  $('seaBonus').textContent = used ? '✔' : '×2 XP'; $('seaBonus').classList.toggle('used', used);
  $('streakNum').textContent = (progress.daily && progress.daily.streak) || 0;
  const fresh = Meta.SHIPS.some(l => Meta.shipOk(l, progress) && !(progress.seenShips || []).includes(l.id));
  $('yardDot').classList.toggle('hidden', !fresh);
}
buildMenu(); renderMeta(); renderLive();

// ---------------- daily voyage streak ----------------
function openDaily(auto) {
  const info = Meta.checkDaily(progress), streak = info ? info.streak : (progress.daily && progress.daily.streak) || 0;
  const slot = info ? info.slot : (streak - 1) % 7, cycle = Math.floor(Math.max(0, streak - 1) / 7);
  $('dailySub').innerHTML = info ? (info.reset ? 'Your streak started over — sail every day to grow it!' : `Day <b>${streak}</b> of your voyage streak. Come back tomorrow for more!`) : `Streak: <b>${streak}</b> days. Today's reward is collected — see you tomorrow, Captain!`;
  $('dayGrid').innerHTML = Meta.DAILY.map((d, i) => `<div class="day ${i < slot || (!info && i === slot) ? 'done' : ''} ${info && i === slot ? 'today' : ''} ${i === 6 ? 'big' : ''}">DAY ${cycle * 7 + i + 1}<i>${d.icon}</i><b>+${d.xp} XP</b>${d.note ? `<small>${d.note}</small>` : ''}</div>`).join('');
  const btn = $('dailyClaim'); btn.textContent = info ? 'CLAIM' : 'CLOSE'; btn.classList.toggle('pulse', !!info);
  btn.onclick = () => {
    if (info) {
      Meta.claimDaily(progress, info); Sfx.win(); Sfx.coin(3); confetti && confetti();
      toast(`${info.reward.icon} +${info.reward.xp} XP — DAY ${info.streak}!`);
      if (info.streak >= 7) unlock('veteran');
      Platform.save(progress); renderMeta(); renderLive();
    } else Sfx.tap();
    $('daily').classList.add('hidden');
  };
  if (auto && !info) return;
  $('daily').classList.remove('hidden');
}
$('dailyBtn').onclick = () => { Sfx.resume(); Sfx.tap(); openDaily(false); };

// ---------------- shipyard: unlock real ships with XP ----------------
function applyShip(id) { W.setShipModel(id); }
let yardSel = null;
function openYard() {
  const seen = progress.seenShips = progress.seenShips || ['titanic'], xp = progress.xp || 0;
  yardSel = yardSel || progress.ship;
  const sh = Meta.SHIPS.find(x => x.id === yardSel), ok = Meta.shipOk(sh, progress);
  $('yardHero').innerHTML = `<img src="${W.shipThumb(sh.id)}" class="${ok ? '' : 'sil'}"><div class="yh-name t-m">${ok ? '' : '🔒 '}${sh.name} <span>${sh.year}</span></div><div class="yh-tag t-xs">${sh.tag}</div><div class="yh-story t-xs">${sh.story}</div>`;
  const btn = $('yardUse');
  if (!ok) { const left = sh.xp - xp; btn.textContent = `🔒 ${left.toLocaleString()} XP MORE`; btn.className = 'btn ghost'; btn.onclick = () => { Sfx.bump(); }; }
  else if (progress.ship === sh.id) { btn.textContent = '✔ SAILING'; btn.className = 'btn ghost'; btn.onclick = () => Sfx.tap(); }
  else { btn.textContent = 'SAIL THIS SHIP'; btn.className = 'btn green pulse'; btn.onclick = () => { progress.ship = sh.id; applyShip(sh.id); Sfx.horn(); Sfx.star(2); Platform.save(progress); openYard(); }; }
  $('yardGrid').innerHTML = Meta.SHIPS.map(l => { const o = Meta.shipOk(l, progress); return `<div class="liv ${o ? '' : 'lock'} ${yardSel === l.id ? 'sel' : ''} ${progress.ship === l.id ? 'on' : ''} ${o && !seen.includes(l.id) ? 'new' : ''}" data-id="${l.id}"><img src="${W.shipThumb(l.id)}"><div class="q">${o ? l.name.replace(/^(RMS|HMS) /, '') : '🔒 ' + l.xp.toLocaleString() + ' XP'}</div>${o ? '' : `<i class="xpbar"><b style="width:${Math.min(100, xp / l.xp * 100)}%"></b></i>`}</div>`; }).join('');
  Meta.SHIPS.forEach(l => { if (Meta.shipOk(l, progress) && !seen.includes(l.id)) seen.push(l.id); });
  document.querySelectorAll('.liv').forEach(el => el.onclick = () => { yardSel = el.dataset.id; Sfx.tap(); openYard(); });
  $('yard').classList.remove('hidden'); renderLive();
}
$('yardBtn').onclick = () => { Sfx.resume(); Sfx.tap(); yardSel = progress.ship; openYard(); };
$('yardClose').onclick = () => { Sfx.tap(); $('yard').classList.add('hidden'); Platform.save(progress); };

// captain's log
$('logBtn').onclick = () => {
  Sfx.resume(); Sfx.tap();
  const got = progress.achievements || {};
  $('logStats').innerHTML = `<div><b>${progress.voyages || 0}</b>Voyages</div><div><b>${progress.wins || 0}</b>Times history changed</div><div><b>${progress.closeTotal || 0}</b>Close calls</div><div><b>${Object.keys(progress.fixes || {}).length}/6</b>History fixes</div>`;
  $('achGrid').innerHTML = Meta.ACHIEVEMENTS.map(a => `<div class="ach ${got[a.id] ? 'got' : ''}"><i>${a.icon}</i>${a.name}<small>${a.text}</small></div>`).join('');
  $('log').classList.remove('hidden');
};
$('logClose').onclick = () => { Sfx.tap(); $('log').classList.add('hidden'); };

// settings
function renderSettings() {
  document.querySelectorAll('.tgl').forEach(b => b.classList.toggle('on', !!progress.settings[b.dataset.k]));
  $('gfxBtn').textContent = { auto: 'AUTO', high: 'HIGH', low: 'LOW' }[progress.settings.gfx || 'auto'];
}
$('gearBtn').onclick = () => { Sfx.resume(); Sfx.tap(); renderSettings(); $('settings').classList.remove('hidden'); };
document.querySelectorAll('.tgl').forEach(b => b.onclick = () => { progress.settings[b.dataset.k] = !progress.settings[b.dataset.k]; renderSettings(); applyAudio(); Sfx.tap(); Platform.save(progress); });
$('gfxBtn').onclick = () => { const o = ['auto', 'high', 'low']; progress.settings.gfx = o[(o.indexOf(progress.settings.gfx || 'auto') + 1) % 3]; W.setQuality(progress.settings.gfx === 'low' ? 'low' : progress.settings.gfx === 'high' ? 'high' : (W.isPhone ? 'mid' : 'high')); renderSettings(); Sfx.tap(); Platform.save(progress); };
$('setClose').onclick = () => { Sfx.tap(); $('settings').classList.add('hidden'); };

function kick() { if (progress.settings.shake === false) return; stage.classList.remove('kick'); void stage.offsetWidth; stage.classList.add('kick'); }
function toast(html) { const d = document.createElement('div'); d.className = 'toast outline'; d.innerHTML = html; $('toasts').appendChild(d); setTimeout(() => d.remove(), 2900); }
function vibrate(p) { try { if (progress.settings.vibrate && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

$('playBtn').onclick = () => startLevel(Math.min(progress.unlocked, LEVELS.length) - 1);
function showMenu() {
  cleanup(); cam.mode = 'menu'; buildMenu(); renderMeta(); renderLive();
  setTimeout(() => { if (!G && progress.voyages > 0) openDaily(true); }, 900);
  ['hud', 'result', 'tutorial'].forEach(id => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden'); $('menu').classList.add('on');
  ship.position.set(0, -0.05, SHIP_Z); ship.rotation.set(0, 0, 0);
}

// ---------------- tutorial: what every part of the screen does ----------------
const TUTORIAL = [
  { target: 'wheelBox', title: 'STEER', text: 'Turn the wheel or swipe. Turn early — she is heavy!' },
  { target: 'lever', title: 'SPEED', text: 'UP = fast (×2 score). DOWN = slow and safe.' },
  { target: 'compBox', title: 'HULL', text: 'Each iceberg floods one. Five = she sinks.' },
  { target: null, title: 'GRAB & DODGE', text: '🛟 Lifebuoys repair  •  ✨ Power-ups fix 1912  •  📯 Horn moves boats' }
];
function runTutorial(done) {
  const t = $('tutorial'); t.classList.remove('hidden');
  let i = 0;
  const show = () => {
    const s = TUTORIAL[i];
    $('tutTitle').textContent = s.title; $('tutText').textContent = s.text;
    $('tutStep').textContent = `${i + 1} / ${TUTORIAL.length}`;
    $('tutNext').textContent = i === TUTORIAL.length - 1 ? 'LET’S GO!' : 'NEXT';
    document.querySelectorAll('.spot').forEach(e => e.classList.remove('spot'));
    const spot = s.target && s.target !== 'stage';
    if (spot) $(s.target).classList.add('spot');
    t.classList.toggle('dim', !spot);
    const low = spot && $(s.target).getBoundingClientRect().top > stage.getBoundingClientRect().top + stage.clientHeight / 2;
    $('tutCard').classList.toggle('topcard', !!low);
    $('tutDrag').classList.toggle('hidden', s.demo !== 'drag');
    $('tutCard').style.animation = 'none'; void $('tutCard').offsetWidth; $('tutCard').style.animation = '';
  };
  $('tutNext').onclick = () => { Sfx.tap(); i++; if (i >= TUTORIAL.length) { t.classList.add('hidden'); document.querySelectorAll('.spot').forEach(e => e.classList.remove('spot')); progress.tutorialSeen = true; done(); } else show(); };
  $('tutSkip').onclick = () => { i = TUTORIAL.length - 1; $('tutNext').onclick(); };
  show();
}
$('howBtn').onclick = () => { Sfx.resume(); Sfx.tap(); startLevel(0, true); };

// ---------------- level ----------------
let G = null;
function startLevel(index, forceTutorial = false, endless = false) {
  Sfx.resume(); Sfx.tap(); Music.start(); Music.setMode('calm');
  const ob = document.getElementById('bonus'); if (ob) ob.remove();
  cleanup(); confetti.id = (confetti.id || 0) + 1; const cc = $('confetti'); cc.getContext && cc.getContext('2d').clearRect(0, 0, cc.width, cc.height);
  const level = LEVELS[index];
  G = {
    index, level, state: 'intro', t: 0, nextWave: 0.4, deco: [], nextDeco: 0, lifebuoys: 0, waveCount: 0, finaleDone: false,
    x: 0, vx: 0, wheel: 0, throttle: 1, boats: [], hornCd: 0, nextBoat: 0, score: 0, combo: 1, comboTimer: 0, flooded: 0,
    bergs: [], buoys: [], powers: [], active: {}, shield: null, sink: 0, lastSec: -1, nextPower: 2.5, firstPower: true,
    endless, leg: 1, dist: 0, sea: Meta.todaysSea(), hitStop: 0, stats: { close: 0, buoys: 0, fullTime: 0, boats: 0, fixes: 0, maxCombo: 1, inches: 0, minThrottle: 1 }, slow: 0, usedChance: false, doneNow: [], fpsN: 0, fpsT: 0, slowWin: 0, shownScore: -1
  };
  ['menu', 'result'].forEach(id => { $(id).classList.add('hidden'); $(id).classList.remove('on'); });
  $('hud').classList.remove('hidden');
  const n = level.lives + 1, cw = 132 / n;
  $('cells').innerHTML = Array.from({ length: n }, (_, k) => `<rect class="cell ${k === n - 1 ? 'last' : ''}" x="${34 + k * cw + 2}" y="14" width="${cw - 4}" height="32" rx="4"/>`).join('');
  $('chips').innerHTML = ''; $('edge').classList.remove('on'); $('fixCard').classList.remove('show');
  $('score').textContent = '0'; $('combo').textContent = ''; $('buoyCount').textContent = '🛟 0/5';
  $('timeNum').textContent = endless ? '0' : level.duration; $('timer').querySelector('.unit').textContent = endless ? 'METRES' : 'SEC'; $('timeFill').style.width = '100%'; $('timeFill').style.transform = `scaleX(${endless ? 0 : 1})`; $('timer').classList.remove('danger');
  setThrottle(1); drawWheel(); $('horn').classList.remove('show', 'ready');
  $('introWhen').textContent = level.when; $('introWhat').textContent = endless ? '♾️ ENDLESS VOYAGE' : '37 SECONDS'; $('introHow').textContent = TEXTS.steerHint;
  $('intro').classList.remove('hidden'); $('dragHint').classList.remove('hidden');
  $('water').classList.remove('on');
  ship.position.set(0, -0.05, SHIP_Z); ship.rotation.set(0, 0, 0);
  scene.fog.density = BASE_FOG * (G.sea.fog || 1);
  $('introHow').innerHTML = `<span class="sealine">${G.sea.icon} ${G.sea.name}</span>`;
  cam.mode = 'play';
  if (!cineSeen && !forceTutorial) { playCinematic(() => afterIntro(forceTutorial)); return; }
  afterIntro(forceTutorial);
}
function afterIntro(forceTutorial) {
  $('intro').classList.add('hidden');                     // no start card: the voyage simply begins
  const g = G, go = () => setTimeout(() => { if (G === g) begin(); }, 700);
  if (!progress.tutorialSeen || forceTutorial) { $('dragHint').classList.add('hidden'); runTutorial(go); } else go();
}
// ---------------- cinematic opening (once per session) ----------------
let cineStart = 0, cineSeen = false, cineT = -1, cineDone = null, cineTimers = [];
const CINE_LINES = [[0.3, 'April 14, 1912. The North Atlantic.'], [3.4, 'The "unsinkable" Titanic races west at 22 knots...'], [6.6, '11:39 PM. The lookout sees something in the dark.']];
function playCinematic(done) {
  cineSeen = true; cineDone = done; cineT = 0; cineStart = performance.now(); cam.mode = 'cine';
  $('hud').classList.add('hidden'); $('cine').classList.remove('hidden'); $('cineText').textContent = '';
  cineTimers = CINE_LINES.map(([t, s]) => setTimeout(() => { $('cineText').textContent = ''; typeText($('cineText'), s); if (t > 6) Sfx.bell(3); }, t * 1000));
  cineTimers.push(setTimeout(endCinematic, 10000));
}
function endCinematic() {
  if (cineT < 0) return;
  cineTimers.forEach(clearTimeout); cineT = -1; cam.mode = 'play';
  $('cine').classList.add('hidden'); $('hud').classList.remove('hidden');
  const d = cineDone; cineDone = null; d && d();
}
$('cineSkip').onclick = e => { e.stopPropagation(); Sfx.tap(); endCinematic(); };
$('cine').addEventListener('pointerdown', e => { e.stopPropagation(); if (performance.now() - cineStart > 700) endCinematic(); });   // tap anywhere to skip

function begin() {
  if (!G || G.state !== 'intro' || cineT >= 0 || !$('tutorial').classList.contains('hidden')) return;
  G.state = 'play'; const g = G;
  $('intro').classList.add('hidden');
  if ((progress.voyages || 0) < 2) { $('dragHint').classList.remove('hidden'); setTimeout(() => { if (G === g) $('dragHint').classList.add('hidden'); }, 2600); } else $('dragHint').classList.add('hidden');   // the swipe hand only helps new captains
  Sfx.horn(); Music.setMode('danger');
  for (let i = 0; i < 3; i++) addBuoy(G.x + (i - 1) * 0.6, -40 - i * 9);   // a reward in the first seconds
}
function cleanup() {
  if (!G) return;
  G.bergs.forEach(b => scene.remove(b.mesh)); G.deco.forEach(d => scene.remove(d)); G.buoys.forEach(b => scene.remove(b.mesh)); G.powers.forEach(p => scene.remove(p.mesh)); G.boats.forEach(b => scene.remove(b.mesh));
  if (G.shield) ship.remove(G.shield);
  setBergGlow(0); scene.fog.density = BASE_FOG; W.ship.userData.spotBoost && (W.ship.userData.spotBoost.visible = false);
  G = null;
}

// ---------------- ship's wheel ----------------
const wheelEl = $('wheel'), spokes = $('spokes');
// The wheel: a quarter turn is full rudder, it springs back to centre when you let go,
// and every input (wheel, swipe, keys) is tracked by its own finger so two thumbs never fight.
const WHEEL_LOCK = Math.PI / 2;            // radians of hand movement for full lock
function drawWheel() { if (G) { spokes.setAttribute('transform', `rotate(${G.wheel * 135})`); $('wheelBox').classList.toggle('hard', Math.abs(G.wheel) > 0.92); } }
let wheelDrag = null, swipe = null; const keys = { l: false, r: false };
function setWheel(v) { const before = G.wheel; G.wheel = THREE.MathUtils.clamp(v, -1, 1); drawWheel(); if (Math.abs(G.wheel) >= 1 && Math.abs(before) < 1) { Sfx.tick(); vibrate(12); } }
function wheelPoint(e) { const r = wheelEl.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2); return { x, y, a: Math.atan2(y, x), d: Math.hypot(x, y) / (r.width / 2) }; }
$('wheelBox').addEventListener('pointerdown', e => {
  if (!G) return; e.stopPropagation(); e.preventDefault(); Sfx.resume(); begin();
  const p = wheelPoint(e); wheelDrag = { id: e.pointerId, a: p.a, x: e.clientX };
  try { $('wheelBox').setPointerCapture(e.pointerId); } catch (err) {}
  $('wheelBox').classList.add('grab');
});
$('wheelBox').addEventListener('pointermove', e => {
  if (!wheelDrag || !G || e.pointerId !== wheelDrag.id) return;
  const p = wheelPoint(e), r = wheelEl.getBoundingClientRect();
  let turn;
  if (p.d > 0.3) { let d = p.a - wheelDrag.a; d = Math.atan2(Math.sin(d), Math.cos(d)); turn = d / WHEEL_LOCK; }   // rim: follow the angle
  else turn = (e.clientX - wheelDrag.x) / (r.width * 0.45);                                                           // hub: the angle is unstable there, so slide instead
  wheelDrag.a = p.a; wheelDrag.x = e.clientX;
  setWheel(G.wheel + turn);
});
const wheelUp = e => { if (wheelDrag && (!e || e.pointerId === wheelDrag.id)) { wheelDrag = null; $('wheelBox').classList.remove('grab'); } };
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => $('wheelBox').addEventListener(n, wheelUp));

// swipe anywhere else also turns the wheel
const stage = $('stage');
stage.addEventListener('pointerdown', e => {
  if (!G || swipe || e.target.closest('#wheelBox, #lever, #horn, .btn, button, #tutorial, #chance, #result, #bonus')) return;
  Sfx.resume(); begin();
  swipe = { id: e.pointerId, x: e.clientX };
});
addEventListener('pointermove', e => {
  if (!swipe || !G || e.pointerId !== swipe.id) return;
  setWheel(G.wheel + (e.clientX - swipe.x) / stage.clientWidth * 3.2); swipe.x = e.clientX;
});
const swipeUp = e => { if (swipe && e.pointerId === swipe.id) swipe = null; };
addEventListener('pointerup', swipeUp); addEventListener('pointercancel', swipeUp);
addEventListener('blur', () => { swipe = null; wheelUp(); keys.l = keys.r = false; });
addEventListener('keydown', e => {
  if (!G) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
  if (e.key === 'ArrowLeft' || e.key === 'a') { keys.l = true; begin(); }
  if (e.key === 'ArrowRight' || e.key === 'd') { keys.r = true; begin(); }
  if (e.repeat) return;
  if (e.key === 'ArrowUp' || e.key === 'w') { begin(); setThrottle(Math.min(1, G.throttle + 0.5)); }
  if (e.key === 'ArrowDown' || e.key === 's') { begin(); setThrottle(Math.max(0, G.throttle - 0.5)); }
  if (e.key === ' ') { begin(); horn(); }
});
addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'a') keys.l = false; if (e.key === 'ArrowRight' || e.key === 'd') keys.r = false; });

// ---------------- engine lever ----------------
let leverDrag = false;
function setThrottle(v, snap = true) {
  if (!G) return;
  const prev = G.throttle;
  G.throttle = snap ? Math.round(v * 2) / 2 : v;
  $('knob').style.top = (8 + (1 - G.throttle) * 84) + '%';
  const n = G.throttle >= 0.75 ? 'FULL' : G.throttle >= 0.25 ? 'HALF' : 'SLOW';
  document.querySelectorAll('.notch').forEach(e => e.classList.toggle('cur', e.textContent === n));
  $('knobTxt').textContent = n; $('multTxt').textContent = `×${engine(Math.round(G.throttle * 2) / 2).mult} SCORE`;
  if (snap && prev !== G.throttle) Sfx.bell(1);
}
function leverValue(e) { const r = $('track').getBoundingClientRect(); return THREE.MathUtils.clamp(1 - ((e.clientY - r.top) / r.height - 0.08) / 0.84, 0, 1); }
$('lever').addEventListener('pointerdown', e => { if (!G) return; e.stopPropagation(); begin(); leverDrag = true; try { $('lever').setPointerCapture(e.pointerId); } catch (err) {} setThrottle(leverValue(e), false); });
$('lever').addEventListener('pointermove', e => { if (leverDrag) setThrottle(leverValue(e), false); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => $('lever').addEventListener(n, () => { if (!leverDrag) return; leverDrag = false; if (G) setThrottle(G.throttle); }));

// ---------------- horn ----------------
$('horn').addEventListener('pointerdown', e => { e.stopPropagation(); horn(); });
function horn() {
  if (!G || G.state !== 'play' || G.hornCd > 0 || !$('horn').classList.contains('show')) return;
  G.hornCd = 2.5; Sfx.horn(); cam.shake = 0.15;
  const r = $('horn').getBoundingClientRect(), s = stage.getBoundingClientRect();
  const ring = document.createElement('div'); ring.className = 'honk';
  ring.style.left = (r.left - s.left + r.width / 2) + 'px'; ring.style.top = (r.top - s.top + r.height / 2) + 'px'; ring.style.transform = 'translate(-50%,-50%)';
  $('floats').appendChild(ring); setTimeout(() => ring.remove(), 700);
  let n = 0;
  G.boats.forEach(b => { if (!b.dodge && b.z > -140 && b.z < SHIP_Z - HALF_LEN + 4) { b.dodge = (b.x >= G.x ? 1 : -1); n++; } });
  if (n) floatText(n > 1 ? `📯 ${n} BOATS MOVING!` : '📯 BOAT MOVING!', '#ffe6a0');
}

// ---------------- small boats near the end ----------------
const boatParts = (() => {
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: 0x3a2412 });
  const sail = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, side: THREE.DoubleSide, roughness: 0.9 });
  return { wood, dark, sail };
})();
function makeBoat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.5, 4.6, 8, 1), boatParts.wood); hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, 0.5); hull.position.y = 0.25; g.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), boatParts.dark); cabin.position.set(0, 0.9, 0.8); g.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4, 6), boatParts.dark); mast.position.set(0, 2.4, -0.3); g.add(mast);
  const sl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.8), boatParts.sail); sl.position.set(0.05, 2.5, -0.9); sl.rotation.y = Math.PI / 2 + 0.3; g.add(sl);
  const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.puffTex, color: 0xffc060, transparent: true, depthWrite: false })); lamp.scale.setScalar(2.2); lamp.position.set(0, 1.6, 1.3); g.add(lamp);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function spawnBoat() {
  const mesh = makeBoat(), x = THREE.MathUtils.clamp(G.x + (Math.random() - 0.5) * 6, -LANE, LANE), z = SPAWN_Z;
  mesh.position.set(x, 0, z); mesh.rotation.y = Math.PI; scene.add(mesh);
  G.boats.push({ mesh, x, z, dodge: 0, hit: false, cleared: false });
  if (!$('horn').classList.contains('show')) { $('horn').classList.add('show'); floatText('📯 BOATS AHEAD — USE THE HORN!', '#ffe6a0'); }
}

// ---------------- spawning ----------------
function addBerg(x, z, size = 1) {
  const k = Math.floor(Math.random() * 4), r0 = [1.6, 2.0, 1.3, 1.8][k];
  if (size < 2) x = THREE.MathUtils.clamp(x, -(LANE - 1), LANE - 1);   // obstacles always sit inside the lane, never half-hidden in the edge ice
  const s = (0.95 + Math.random() * 0.45) * size, mesh = W.makeIceberg(k);
  mesh.scale.setScalar(s); mesh.position.set(x, 0, z); mesh.rotation.y = Math.random() * 6;
  const b = { mesh, r: r0 * s * 0.72, x, z, warned: false, hit: false, phase: Math.random() * 6, vx: (prog() > 0.35 && size <= 1 && Math.random() < 0.3) ? (Math.random() < .5 ? -1 : 1) * (1 + Math.random() * 1.5) : 0 };
  G.bergs.push(b); if (G.active && G.active.warning) addBeacon(b);
}
const buoyGeo = new THREE.TorusGeometry(0.55, 0.2, 10, 20);
const buoyMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0x6a1a00, roughness: 0.4 });
function addBuoy(x, z) {
  const mesh = new THREE.Mesh(buoyGeo, buoyMat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.25, z);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.puffTex, color: 0xffb060, transparent: true, opacity: 0.6, depthWrite: false })); glow.scale.setScalar(3); mesh.add(glow);
  scene.add(mesh); G.buoys.push({ mesh, x, z, got: false });
}
const prog = () => G.endless ? Math.min(1, G.t / 150) : G.t / G.level.duration;
function spawnWave() {
  const p = prog(), x0 = (Math.random() - 0.5) * 2 * LANE;
  const pick = Math.random();
  if (p < 0.2 || pick < 0.3) {                         // a few scattered bergs
    for (let i = 0; i < 2 + Math.floor(p * 2); i++) addBerg((Math.random() - 0.5) * 2 * (LANE + 2), SPAWN_Z - i * 12, 1.3);
  } else if (pick < 0.6) {                             // a wall with one gap
    const gap = (Math.random() - 0.5) * 2 * (LANE - 3), width = 10.5 - p * 2;
    for (let x = -LANE + 1; x <= LANE - 1; x += 4.4) if (Math.abs(x - gap) > width / 2 + 1.5) addBerg(x, SPAWN_Z + (Math.random() - 0.5) * 3, 0.9);
    addBuoy(gap, SPAWN_Z);
  } else if (pick < 0.85) {                            // zigzag channel
    for (let i = 0; i < 4; i++) addBerg((i % 2 ? 1 : -1) * (4 + Math.random() * 6), SPAWN_Z - i * 20, 1.25);
  } else {                                             // buoy trail
    for (let i = 0; i < 4; i++) addBuoy(x0 + Math.sin(i) * 3, SPAWN_Z - i * 7);
    addBerg(-x0 * 0.6, SPAWN_Z - 10);
  }
  if (Math.random() < (G.sea.buoyChance || 0.45)) addBuoy((Math.random() - 0.5) * 2 * LANE, SPAWN_Z - 20);
}
function spawnFinale() {
  G.finaleDone = true;
  Sfx.bell(3); Music.setMode('finale');
  const w = $('warning'); w.textContent = TEXTS.rightAhead; w.classList.remove('on'); void w.offsetWidth; w.classList.add('on');
  // the iceberg — straight at the ship, flanked so there is one tight escape
  addBerg(G.x, SPAWN_Z + 10, 2.3);
  const side = G.x > 0 ? -1 : 1;
  addBerg(G.x - side * 15, SPAWN_Z + 6, 1.1);
  addBuoy(G.x + side * 9, SPAWN_Z + 10);
}

// ---------------- power-ups that fix 1912's mistakes ----------------
const BASE_FOG = scene.fog.density;
function iconTexture(emoji) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 62); g.addColorStop(0, 'rgba(255,230,140,.95)'); g.addColorStop(.6, 'rgba(255,170,40,.55)'); g.addColorStop(1, 'rgba(255,140,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.font = '70px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emoji, 64, 70);
  return new THREE.CanvasTexture(c);
}
const powerTex = {};
const ringGeo = new THREE.TorusGeometry(1.25, 0.08, 8, 40), ringMat = new THREE.MeshBasicMaterial({ color: 0xffd36b });
const beamGeo = new THREE.CylinderGeometry(0.6, 1.4, 14, 16, 1, true);
const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
function spawnPower() {
  const fixes = G.level.fixes, unseen = fixes.filter(f => !progress.fixes[f.id]);
  if (G.firstPower) { G.firstPower = false; return placePower(fixes.find(f => f.id === 'bulkhead')); }
  const pool = unseen.length && Math.random() < 0.6 ? unseen : fixes;
  placePower(pool[Math.floor(Math.random() * pool.length)]);
}
function placePower(fix) {
  const grp = new THREE.Group();
  powerTex[fix.id] = powerTex[fix.id] || iconTexture(fix.icon);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: powerTex[fix.id], depthWrite: false })); spr.scale.setScalar(3.2);
  const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2;
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.y = 6;
  grp.add(beam, spr, ring);
  const x = (Math.random() - 0.5) * 2 * (LANE - 2), z = SPAWN_Z;
  grp.position.set(x, 1.2, z); scene.add(grp);
  G.powers.push({ mesh: grp, x, z, fix, got: false });
}
function collectPower(fix) {
  Sfx.win(); bumpCombo(); addScore(30, fix.icon + ' ' + fix.name, '#ffd36b');
  G.used = G.used || {}; G.used[fix.id] = true; G.stats.fixes = Object.keys(G.used).length;
  const first = !progress.fixes[fix.id]; progress.fixes[fix.id] = true;
  showFix(fix, first);
  Platform.save(progress);
  if (fix.id === 'rivets') {
    if (G.flooded > 0) { const c = $('cells').children[G.flooded - 1]; c.classList.remove('flooded'); c.classList.add('repaired'); G.flooded--; floatText('🔩 HULL REPAIRED!', '#36d67a'); }
    else addScore(50, '🔩 HULL REINFORCED', '#36d67a');
    return;
  }
  if (fix.id === 'bulkhead') {
    if (!G.shield) {
      const sh = new THREE.Mesh(new THREE.CapsuleGeometry(2.6, 26, 8, 24), new THREE.MeshBasicMaterial({ color: 0x4be0ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
      sh.rotation.x = Math.PI / 2; sh.position.y = 1.5; ship.add(sh); G.shield = sh;
    }
    addChip(fix, 0); return;
  }
  G.active[fix.id] = fix.time;
  addChip(fix, fix.time);
  if (fix.id === 'binoculars') { scene.fog.density = BASE_FOG * 0.35; setBergGlow(0.9); }
  if (fix.id === 'searchlight') { spotOn(true); setBergGlow(1.2); }
  if (fix.id === 'warning') G.bergs.forEach(addBeacon);
}
function tickPowers(dt) {
  for (const id in G.active) {
    G.active[id] -= dt;
    const fix = G.level.fixes.find(f => f.id === id);
    const chip = document.querySelector(`.chip[data-id="${id}"] .ic`);
    if (chip) chip.style.setProperty('--p', Math.max(0, G.active[id] / fix.time * 100) + '%');
    if (G.active[id] <= 0) {
      delete G.active[id]; removeChip(id);
      if (id === 'binoculars') { scene.fog.density = BASE_FOG; if (!G.active.searchlight) setBergGlow(0); }
      if (id === 'searchlight') { spotOn(false); if (!G.active.binoculars) setBergGlow(0); }
    }
  }
}
function setBergGlow(v) { W.icebergMaterial && (W.icebergMaterial.emissiveIntensity = 0.25 + v); }
const spotCone = new THREE.Mesh(new THREE.ConeGeometry(9, 60, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
spotCone.rotation.x = -Math.PI / 2; spotCone.position.set(0, 3, -43); spotCone.visible = false; ship.add(spotCone); ship.userData.spotBoost = spotCone;
const spotLight = new THREE.SpotLight(0xfff2d0, 0, 120, 0.35, 0.5, 1); spotLight.position.set(0, 4, -12); spotLight.target.position.set(0, 0, -80); ship.add(spotLight, spotLight.target);
function spotOn(on) { spotCone.visible = on; spotLight.intensity = on ? 900 : 0; }
const beaconGeo = new THREE.CylinderGeometry(0.25, 0.25, 30, 8, 1, true);
const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3045, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
function addBeacon(b) { if (b.beacon) return; const m = new THREE.Mesh(beaconGeo, beaconMat); m.position.y = 15; b.mesh.add(m); b.beacon = m; }
function addChip(fix, time) {
  removeChip(fix.id, true);
  const d = document.createElement('div'); d.className = 'chip glass'; d.dataset.id = fix.id;
  d.innerHTML = `<div class="ic"><b>${fix.icon}</b></div><span>${fix.name}</span>`;
  $('chips').appendChild(d);
}
function removeChip(id, now) { const c = document.querySelector(`.chip[data-id="${id}"]`); if (!c) return; if (now) c.remove(); else { c.classList.add('out'); setTimeout(() => c.remove(), 300); } }
let fixTimer = null;
function showFix(fix, first) {
  $('fixIcon').textContent = fix.icon;
  $('fixTitle').textContent = (first ? '🆕 HISTORY FIX: ' : '') + fix.name;
  $('fixReal').textContent = '1912: ' + fix.real;
  const c = $('fixCard'); c.classList.add('show'); clearTimeout(fixTimer); fixTimer = setTimeout(() => c.classList.remove('show'), first ? 4200 : 2200);
}

// ---------------- scoring & feedback ----------------
function addScore(pts, label, color, at) {
  const v = Math.round(pts * G.combo * engine(Math.round(G.throttle * 2) / 2).mult * (G.sea.scoreMult || 1));
  G.score += v; if (G.score !== G.shownScore) { G.shownScore = G.score; $('score').textContent = G.score; }
  if (label) floatText(`${label} +${v}`, color, at);
}
function bumpCombo() {
  G.combo = Math.min(G.combo + 1, 6); G.comboTimer = 4; G.stats.maxCombo = Math.max(G.stats.maxCombo, G.combo); checkMissions();
  const c = $('combo'); c.textContent = `🔥 ×${G.combo}`; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
}
function floatText(txt, color, at) {
  const p = at || { x: stage.clientWidth / 2, y: stage.clientHeight * 0.55 };
  const d = document.createElement('div'); d.className = 'float t-m outline'; d.style.color = color; d.textContent = txt;
  d.style.left = Math.min(Math.max(p.x, stage.clientWidth * 0.22), stage.clientWidth * 0.78) + 'px'; d.style.top = p.y + 'px';
  $('floats').appendChild(d); setTimeout(() => d.remove(), 1000);
}
function banner(txt, color) {
  const d = document.createElement('div'); d.className = 'banner t-xl outline'; d.style.color = color; d.textContent = txt;
  $('floats').appendChild(d); setTimeout(() => d.remove(), 1400);
}
function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x * .5 + .5) * stage.clientWidth, y: (-p.y * .5 + .5) * stage.clientHeight }; }

// ---------------- effects ----------------
const fx = [];
const sprayMat = new THREE.SpriteMaterial({ map: W.puffTex, color: 0xffffff, transparent: true, depthWrite: false });
const shardGeo = new THREE.TetrahedronGeometry(0.35), shardMat = new THREE.MeshStandardMaterial({ color: 0xe6f7ff, roughness: 0.3 });
function burst(x, z, big) {
  for (let i = 0; i < (big ? 30 : 14); i++) {
    const s = new THREE.Sprite(sprayMat.clone()); s.position.set(x, 0.5, z); s.scale.setScalar(1);
    fx.push({ o: s, v: new THREE.Vector3((Math.random() - .5) * 10, 4 + Math.random() * 7, (Math.random() - .5) * 10), life: 0, max: 1, grow: 3 }); scene.add(s);
  }
  for (let i = 0; i < (big ? 14 : 6); i++) {
    const m = new THREE.Mesh(shardGeo, shardMat); m.position.set(x, 1, z);
    fx.push({ o: m, v: new THREE.Vector3((Math.random() - .5) * 12, 5 + Math.random() * 6, (Math.random() - .5) * 12), life: 0, max: 1.2, spin: true }); scene.add(m);
  }
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life += dt; const k = f.life / f.max;
    if (k >= 1) { scene.remove(f.o); fx.splice(i, 1); continue; }
    f.v.y -= 14 * dt; f.o.position.addScaledVector(f.v, dt);
    if (f.spin) { f.o.rotation.x += dt * 8; f.o.rotation.y += dt * 6; }
    else { f.o.scale.setScalar(1 + k * f.grow); f.o.material.opacity = 0.9 * (1 - k); }
  }
}

// ---------------- collisions ----------------
function hitShip(b) {
  if (!G || G.state !== 'play') return;
  b.hit = true;
  if (G.shield) {   // sealed bulkheads absorb the blow
    ship.remove(G.shield); G.shield = null; removeChip('bulkhead');
    Sfx.place(); burst(b.x, b.z, true); if (b.mesh) b.sinking = true; cam.shake = 0.4;
    floatText('🛡️ BLOCKED!', '#4be0ff', toScreen(new THREE.Vector3(b.x, 3, b.z))); return;
  }
  G.flooded++;
  const comps = $('cells').children; if (comps[G.flooded - 1]) comps[G.flooded - 1].classList.add('flooded');
  Sfx.crash(); Sfx.groan(); burst(b.x, b.z, true); vibrate([80, 40, 120]);
  cam.shake = 0.9; G.hitStop = 0.14; kick();
  if (progress.settings.shake !== false) { $('flash').classList.add('on'); setTimeout(() => $('flash').classList.remove('on'), 380); }
  G.combo = 1; $('combo').textContent = '';
  banner(TEXTS.hit, '#ff8a93');
  if (b.mesh) b.sinking = true;
  if (G.flooded > G.level.lives) { if (!G.usedChance) offerChance(); else lose(); }
}

// ---------------- second chance (once per voyage) ----------------
let chanceTimer = null;
function offerChance() {
  G.state = 'chance'; Music.setMode('calm');
  $('chance').classList.remove('hidden');
  let left = 5; $('chNum').textContent = left; $('chRing').style.strokeDashoffset = 0;
  const t0 = performance.now();
  clearInterval(chanceTimer);
  chanceTimer = setInterval(() => {
    const e = (performance.now() - t0) / 1000; left = Math.max(0, 5 - e);
    $('chNum').textContent = Math.ceil(left); $('chRing').style.strokeDashoffset = 276 * (e / 5);
    if (left <= 0) { clearInterval(chanceTimer); $('chance').classList.add('hidden'); lose(); }
  }, 50);
}
$('chYes').onclick = () => {
  clearInterval(chanceTimer); $('chance').classList.add('hidden');
  G.usedChance = true; G.flooded = G.level.lives;
  const c = $('cells').children[G.level.lives]; c.classList.remove('flooded'); c.classList.add('repaired');
  G.bergs.forEach(b => { if (b.z > -60) b.sinking = true; });      // clear the water around the ship
  Sfx.win(); toast('🛟 PUMPS ON — KEEP GOING!'); G.state = 'play'; Music.setMode('danger');
};
$('chNo').onclick = () => { clearInterval(chanceTimer); $('chance').classList.add('hidden'); lose(); };

// ---------------- missions, xp, achievements ----------------
function statValue(m, end) {
  const s = G.stats;
  switch (m.stat) {
    case 'cleanWin': return end && G.state === 'won' && G.flooded === 0 ? 1 : 0;
    case 'win': return end && G.state === 'won' ? 1 : 0;
    case 'score': return G.score;
    default: return s[m.stat] || 0;
  }
}
function checkMissions(end = false) {
  if (!G) return;
  progress.missions.forEach(id => {
    const m = Meta.MISSIONS.find(x => x.id === id);
    if (!m || G.doneNow.includes(id) || progress.missionsDone[id]) return;
    if (statValue(m, end) >= m.goal) { G.doneNow.push(id); toast(`✅ ORDER COMPLETE<br><small>${m.text}</small>`); Sfx.star(2); }
  });
}
function unlock(id) {
  progress.achievements = progress.achievements || {};
  if (progress.achievements[id]) return;
  progress.achievements[id] = true;
  const a = Meta.ACHIEVEMENTS.find(x => x.id === id);
  setTimeout(() => { toast(`🏆 ${a.icon} ${a.name}`); Sfx.star(1); }, 400 + Object.keys(progress.achievements).length * 50);
}
function settleVoyage(won) {
  checkMissions(true);
  const rankBefore = Meta.rankOf(progress.xp || 0).index;
  let xp = Math.round(G.score / 2) + (won ? 150 : 40);
  G.seaDouble = false;
  if (won && progress.seaBonus !== Meta.dayKey()) { xp *= 2; progress.seaBonus = Meta.dayKey(); G.seaDouble = true; }
  G.doneNow.forEach(id => { const m = Meta.MISSIONS.find(x => x.id === id); xp += m.xp; progress.missionsDone[id] = true; progress.missions = progress.missions.filter(x => x !== id); });
  progress.xp = (progress.xp || 0) + xp; G.xpGained = xp;
  progress.voyages = (progress.voyages || 0) + 1; progress.closeTotal = (progress.closeTotal || 0) + G.stats.close;
  if (won) progress.wins = (progress.wins || 0) + 1;
  unlock('first');
  if (won) { unlock('saved'); if (G.flooded === 0 && !G.usedChance) unlock('untouchable'); if (G.flooded >= 4) unlock('thread'); if (G.stats.minThrottle >= 1) unlock('speed'); }
  if (G.stats.boats >= 5) unlock('horn');
  if (G.stats.maxCombo >= 6) unlock('combo');
  if (Object.keys(progress.fixes).length >= 6) unlock('collector');
  const r = Meta.rankOf(progress.xp);
  if (r.cur.name === 'Captain' || r.index > 5) unlock('captain');
  if (r.index > rankBefore) setTimeout(() => levelUp(r.cur), 2400);
  Meta.SHIPS.forEach(l => { if (Meta.shipOk(l, progress) && !(progress.seenShips || []).includes(l.id) && !(G.livToasted || (G.livToasted = [])).includes(l.id)) { G.livToasted.push(l.id); setTimeout(() => toast(`🚢 NEW SHIP UNLOCKED!<br><small>${l.name}</small>`), 3200); } });
  Platform.save(progress);
}
function levelUp(rank) {
  const d = document.createElement('div'); d.className = 'levelup';
  d.innerHTML = `<div><div class="big">${rank.icon}</div><div class="t t-l outline">PROMOTED!</div><div class="t-m outline">${rank.name.toUpperCase()}</div></div>`;
  stage.appendChild(d); Sfx.win(); Sfx.horn(); setTimeout(() => d.remove(), 2700);
}

// ---------------- outcomes ----------------
function win() {
  if (!G || G.state === 'won' || G.state === 'lost') return;
  G.state = 'won'; const g = G;
  const stars = G.flooded === 0 ? 3 : G.flooded <= 2 ? 2 : 1;
  const id = G.level.id;
  const prevBest = progress.best[id] || 0;
  G.newBest = G.score > prevBest; progress.best[id] = Math.max(prevBest, G.score);
  progress.stars[id] = Math.max(progress.stars[id] || 0, stars);
  progress.unlocked = Math.max(progress.unlocked, Math.min(G.index + 2, LEVELS.length));
  settleVoyage(true); Platform.score(G.score);
  Sfx.win(); Music.win(); Sfx.horn();
  banner(TEXTS.saved, '#ffd36b');
  setTimeout(() => { if (G === g) bonusPick(() => showResult(true, stars)); }, 1700);
}
function lose() {
  if (!G || G.state === 'won' || G.state === 'lost') return;
  G.state = 'lost'; Music.lose(); const g = G;
  if (G.endless) { const b = progress.bestDist || 0; G.newBestDist = G.dist > b; progress.bestDist = Math.max(b, Math.floor(G.dist)); Platform.score(G.score); }
  settleVoyage(false);
  $('water').classList.add('on');
  setTimeout(() => { if (G === g) bonusPick(() => showResult(false, 0)); }, 2600);
}

// ---------------- bonus crate: a surprise after every voyage ----------------
function bonusPick(done) {
  if (!G || document.getElementById('bonus')) return;
  const g = G;
  const pool = [25, 40, 60, 80, 120, 200, 400], w = [26, 24, 20, 14, 9, 5, 2];
  const roll = () => { let r = Math.random() * 100; for (let i = 0; i < pool.length; i++) { if ((r -= w[i]) < 0) return pool[i]; } return 25; };
  const vals = [roll(), roll(), roll()]; if (!vals.some(v => v >= 120)) vals[Math.floor(Math.random() * 3)] = Math.random() < .5 ? 200 : 120;   // one crate always tempts
  $('hud').classList.add('hidden');
  const d = document.createElement('div'); d.id = 'bonus'; d.className = 'layer';
  d.innerHTML = `<div class="bn-title t-l outline">PICK A CRATE!</div><div class="bn-row">${[0, 1, 2].map(i => `<button class="crate" data-i="${i}"><span class="box">📦</span><b></b></button>`).join('')}</div>`;
  stage.appendChild(d); Sfx.star(1);
  let picked = false;
  d.querySelectorAll('.crate').forEach(c => c.onclick = () => {
    if (picked) return; picked = true;
    const i = +c.dataset.i, v = vals[i], rb = Meta.rankOf(progress.xp).index;
    d.querySelectorAll('.crate').forEach((o, k) => { o.classList.add(k === i ? 'mine' : 'other'); o.querySelector('.box').textContent = vals[k] >= 200 ? '💎' : vals[k] >= 80 ? '🏅' : '🪙'; o.querySelector('b').textContent = '+' + vals[k] + ' XP'; });
    progress.xp += v; G.xpGained += v; G.bonusXp = v; Platform.save(progress);
    Sfx.coin(3); if (v >= 120) { Sfx.win(); confetti(); vibrate([40, 30, 80]); }
    d.querySelector('.bn-title').textContent = v >= 200 ? 'JACKPOT!' : v >= 80 ? 'NICE!' : 'BONUS!';
    const ra = Meta.rankOf(progress.xp); if (ra.index > rb) setTimeout(() => levelUp(ra.cur), 1500);
    setTimeout(() => { d.remove(); if (G === g) done(); }, 1700);
  });
}
// how close is the next ship? shown on every result card
function nextShipLine() {
  const nx = Meta.SHIPS.find(sh => !Meta.shipOk(sh, progress)); if (!nx) return '';
  const pct = Math.min(100, (progress.xp || 0) / nx.xp * 100);
  return `<div class="nextship"><img src="${W.shipThumb(nx.id)}"><div><div class="t-xs">NEXT SHIP • ${(nx.xp - progress.xp).toLocaleString()} XP TO GO</div><div class="bar"><i style="width:${pct}%"></i></div></div></div>`;
}

// ---------------- result card ----------------
const starSvg = '<svg viewBox="0 0 100 100"><path class="empty" d="M50 6l13 27 30 4-22 21 5 30-26-14-26 14 5-30L7 37l30-4z"/><path class="full" d="M50 6l13 27 30 4-22 21 5 30-26-14-26 14 5-30L7 37l30-4z"/></svg>';
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k]);
function showResult(won, stars) {
  const l = G.level, next = LEVELS[G.index + 1], saved = Object.keys(progress.stars).length;
  $('hud').classList.add('hidden');
  const res = $('result'); res.classList.remove('hidden');
  if (G.endless) {
    const best = progress.bestDist || 0, r = Meta.rankOf(progress.xp);
    res.innerHTML = `<div class="card endless-card">
      <div class="t-s en-k">♾️ ENDLESS VOYAGE</div>
      <div class="en-big outline" id="enDist">0</div><div class="t-s en-unit">METRES SAILED</div>
      ${G.newBestDist ? '<div class="newbest">NEW RECORD!</div>' : `<div class="t-s en-best">RECORD ${best} m</div>`}
      <div class="en-row t-s"><div><b>${G.leg}</b>LEGS</div><div><b>${G.score}</b>SCORE</div><div><b>${G.stats.close}</b>CLOSE CALLS</div></div>
      <div class="xpline t-s">+${G.xpGained} XP${r.next ? ' • ' + r.toNext + ' XP to ' + r.next.name : ''}</div>
      ${nextShipLine()}
      <div class="btns"><button class="btn ghost" id="menuBtn">MENU</button><button class="btn pulse" id="again">SAIL AGAIN</button></div></div>`;
    requestAnimationFrame(() => res.classList.add('on'));
    $('again').onclick = () => startLevel(0, false, true);
    $('menuBtn').onclick = () => { Sfx.tap(); showMenu(); };
    const target = G.dist; let v = 0; const iv = setInterval(() => { v = Math.min(target, v + Math.max(1, target / 30)); $('enDist').textContent = Math.floor(v); Sfx.tick && Sfx.tick(); if (v >= target) { clearInterval(iv); if (G && G.newBestDist) { Sfx.win(); confetti(); } } }, 40);
    return;
  }
  const vs = `<div class="vs t-xs"><div class="you">${TEXTS.you}<div class="big outline">${G.flooded}</div>${TEXTS.flooded}</div><div class="real1">${TEXTS.realShip}<div class="big outline">${l.realFlooded}</div>${TEXTS.flooded}</div></div>`;
  const scoreLine = `<div class="scoreline t-m"><span>${TEXTS.score} <b id="cnt">0</b></span><span class="best">${TEXTS.best} ${progress.best[l.id] || G.score}</span></div>${G.newBest && won ? `<div class="newbest">${TEXTS.newBest}</div>` : ''}`;
  res.innerHTML = won ? `
    <div class="card">
      <h1 class="win t-xl">${TEXTS.saved}</h1>
      <div class="starrow">${[0, 1, 2].map(i => `<div class="star ${i === 1 ? 'mid' : ''}" id="st${i}">${starSvg}</div>`).join('')}</div>
      ${scoreLine}
      <div class="lives t-xs"><div class="ok">LIVES SAVED<b class="outline">2,224</b>everyone on board</div><div class="then">IN 1912<b class="outline">706</b>survived</div></div>
      ${vs}
      <div class="xpline t-s">+${G.xpGained} XP${G.seaDouble ? ' ×2' : ''}${G.doneNow.length ? ` • ✅ ${G.doneNow.length}` : ''}</div>
      ${nextShipLine()}
      <div class="usedfix t-xs">${G.used && Object.keys(G.used).length ? 'HISTORY FIXES USED: ' + Object.keys(G.used).map(k => G.level.fixes.find(f => f.id === k).icon).join(' ') : ''}</div>
      ${next && next.ready ? `<div class="next t-s"><span class="lock">🔒</span>${fill(TEXTS.nextUp, { name: next.name.toUpperCase(), year: next.year })}</div>` : `<div class="next t-s">⏳ NEXT CHAPTER — COMING SOON</div>`}
      <div class="btns"><button class="btn ghost" id="again">${TEXTS.retry}</button>${next && next.ready ? `<button class="btn green pulse" id="nextBtn">${TEXTS.next}</button>` : `<button class="btn green pulse" id="menuBtn">MENU</button>`}</div>
    </div>` : `
    <div class="card">
      <h1 class="lose t-xl">${TEXTS.failed}</h1>
      <div class="held t-m">${fill(TEXTS.soClose, { time: Math.min(G.t, l.duration).toFixed(1), total: l.duration })}<div class="bar"><i id="hbar"></i><span>${l.duration}s</span></div></div>
      ${scoreLine}${vs}
      <div class="xpline t-s">+${G.xpGained} XP • ${Meta.rankOf(progress.xp).next ? Meta.rankOf(progress.xp).toNext + ' XP to ' + Meta.rankOf(progress.xp).next.name : ''}</div>
      ${nextShipLine()}
      <div class="btns"><button class="btn ghost" id="menuBtn">MENU</button><button class="btn pulse" id="again">${TEXTS.retry}</button></div>
    </div>`;
  requestAnimationFrame(() => res.classList.add('on'));
  $('again').onclick = () => startLevel(G.index);
  if ($('menuBtn')) $('menuBtn').onclick = () => { Sfx.tap(); showMenu(); };
  if ($('nextBtn')) $('nextBtn').onclick = () => {
    if (!next || !next.ready) { Sfx.tap(); showMenu(); floatText(TEXTS.allDone, '#ffd36b'); return; }
    startLevel(G.index + 1);
  };
  // count the score up
  const target = G.score; let c = 0; const step = Math.max(1, Math.round(target / 40));
  const count = () => { c = Math.min(target, c + step); $('cnt').textContent = c; if (c < target) { Sfx.coin(c % 5); setTimeout(count, 25); } };
  setTimeout(count, 500);
  if (won) {
    for (let i = 0; i < stars; i++) setTimeout(() => { $('st' + i).classList.add('lit'); Sfx.star(i); }, 700 + i * 400);
    
    setTimeout(() => { $('pbar').style.width = (saved / LEVELS.length * 100) + '%'; }, 1000);
    confetti();
  } else setTimeout(() => { $('hbar').style.width = Math.min(G.t / l.duration, 1) * 100 + '%'; }, 500);
}
function typeText(el, str) { let i = 0; const go = () => { el.textContent = str.slice(0, ++i); if (i < str.length) setTimeout(go, 16); }; go(); }
function confetti() {
  const c = $('confetti'), x = c.getContext('2d'); c.width = stage.clientWidth; c.height = stage.clientHeight;
  const cols = ['#ffc83d', '#ff4d6d', '#4be0ff', '#36d67a', '#ffffff', '#b37bff'];
  const P = Array.from({ length: 170 }, () => ({ x: Math.random() * c.width, y: -Math.random() * c.height * .6, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 3, r: Math.random() * 6, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: cols[Math.random() * cols.length | 0], s: Math.random() * .2 }));
  const id = (confetti.id = (confetti.id || 0) + 1);
  let t = 0; const loop = () => { if (id !== confetti.id) return; x.clearRect(0, 0, c.width, c.height); t++; P.forEach(p => { p.x += p.vx + Math.sin(t * .05 + p.r) * .6; p.y += p.vy; p.r += p.s; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.abs(Math.cos(p.r * 2))); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore(); }); if (t < 260) requestAnimationFrame(loop); else x.clearRect(0, 0, c.width, c.height); };
  loop();
}

// ---------------- main loop ----------------
let last = performance.now(), clock = 0, paused = false;
function applyAudio() { const base = Platform.audioOn && !paused; Sfx.setMuted(!(base && progress.settings.sound)); Music.mute(!(base && progress.settings.music)); }
Platform.on('pause', () => { paused = true; applyAudio(); });
Platform.on('resume', () => { paused = false; last = performance.now(); applyAudio(); });
Platform.on('audio', applyAudio);
function frame(now) {
  if (paused) { requestAnimationFrame(frame); return; }
  const dt = Math.min((now - last) / 1000, 0.05); last = now; clock += dt;
  W.update(clock);
  if (G) tick(dt);
  updateFx(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function tick(dt) {
  const realDt = dt;
  if (G.hitStop > 0) { G.hitStop -= realDt; dt *= 0.04; }
  if (G.slow > 0) { G.slow -= realDt; dt *= 0.3; } $('inchFx').classList.toggle('on', G.slow > 0);
  const sp = engine(G.throttle), playing = G.state === 'play';
  if (playing) {
    if (G.throttle >= 1) G.stats.fullTime += dt;
    G.stats.minThrottle = Math.min(G.stats.minThrottle, G.throttle);
    G.fpsT += realDt; G.fpsN++;   // watch the frame rate all voyage long and step the quality down when it dips
    if (G.fpsT >= 2) { const fps = G.fpsN / G.fpsT; G.fpsT = G.fpsN = 0; if ((progress.settings.gfx || 'auto') === 'auto' && fps < 42 && ++G.slowWin >= 2) { G.slowWin = 0; W.setQuality(W.tier() === 'high' ? 'mid' : 'low'); } else if (fps >= 42) G.slowWin = 0; }
    if (G.flooded > 0 && Math.random() < G.flooded * 0.25) {     // steam and spray venting from the damaged bow
      const s = new THREE.Sprite(sprayMat.clone()); const side = Math.random() < .5 ? -1 : 1;
      s.position.set(G.x + side * 1.7, 0.6, SHIP_Z - HALF_LEN + 3 + Math.random() * 6); s.scale.setScalar(0.8);
      fx.push({ o: s, v: new THREE.Vector3(side * (1 + Math.random() * 2), 2 + Math.random() * 2, 2), life: 0, max: 1.2, grow: 2.5 }); scene.add(s);
    }
    if (Math.floor(G.stats.fullTime) % 5 === 0) checkMissions();
  }
  const flow = (G.endless ? 1 + Math.min(0.8, G.t / 160) : 1) * (G.state === 'lost' || G.state === 'chance' ? 0.15 : G.state === 'won' ? 1.2 : G.state === 'intro' ? 0.35 : 1) * BASE_SPEED * sp.k;

  if (playing) {
    G.t += dt;
    const total = G.level.duration, left = G.endless ? 999 : Math.max(0, total - G.t), sec = Math.ceil(left);
    if (G.endless) {
      G.dist += dt * 11.3 * (1 + Math.min(0.8, G.t / 160)) * (0.4 + 0.6 * G.throttle);   // 22 knots ≈ 11.3 m/s
      { const dm = Math.floor(G.dist); if (dm !== G.shownSec) { G.shownSec = dm; $('timeNum').textContent = dm; } }
      const legT = 30, into = G.t - (G.leg - 1) * legT; $('timeFill').style.transform = `scaleX(${Math.min(1, into / legT)})`;
      if (into >= legT) {   // every 30 s: a new leg — faster sea, a big iceberg, a bonus
        G.leg++; Sfx.bell(2); addScore(100 * G.leg, `⚡ LEG ${G.leg} — FASTER!`, '#ffd36b'); kick();
        const w = $('warning'); w.textContent = `LEG ${G.leg}`; w.classList.remove('on'); void w.offsetWidth; w.classList.add('on');
        addBerg(G.x, SPAWN_Z + 10, 2.0); addBuoy(G.x + (G.x > 0 ? -9 : 9), SPAWN_Z + 10);
      }
    } else {
    if (sec !== G.shownSec) { G.shownSec = sec; $('timeNum').textContent = sec; } $('timeFill').style.transform = `scaleX(${left / total})`;
    $('timer').classList.toggle('danger', left <= 5); $('edge').classList.toggle('on', left <= 5);
    }
    if (!G.endless && sec !== G.lastSec) { G.lastSec = sec; if (sec <= 5 && sec > 0) { Sfx.heartbeat(); const bc = $('bigCount'); bc.textContent = sec; bc.classList.remove('go'); void bc.offsetWidth; bc.classList.add('go'); } }
    G.nextPower -= dt; if (G.nextPower <= 0 && left > 6) { spawnPower(); G.nextPower = 3.5 + Math.random() * 1.5; }
    tickPowers(dt);
    const p = prog(), gapT = (G.level.density[0] + (G.level.density[1] - G.level.density[0]) * p) * (G.sea.dens || 1);
    if (p > (G.sea.boatsEarly || 0.45) && left > G.level.finale + 2) { G.nextBoat -= dt; if (G.nextBoat <= 0) { spawnBoat(); G.nextBoat = (3.5 + Math.random() * 2) * (G.sea.boatGap || 1); } }
    G.nextWave -= dt; if (G.nextWave <= 0 && left > G.level.finale + 1) { spawnWave(); G.nextWave = gapT * 2.5; }
    if (!G.endless && !G.finaleDone && left <= G.level.finale + 3.2) spawnFinale();
    addScore(dt * 10, null);
    if (G.comboTimer > 0 && (G.comboTimer -= dt) <= 0) { G.combo = 1; $('combo').textContent = ''; }
    if (!G.endless && left <= 0) win();
  }

  // heavy-ship steering: the rudder needs speed to bite
  if (G.state !== 'lost') {
    const rud = G.active.rudder ? 1.8 : 1;
    const want = G.wheel * 14.5 * sp.steer * rud;                 // sideways speed the rudder asks for
    G.vx += (want - G.vx) * Math.min(1, 2.4 * rud * dt);        // a heavy ship answers slowly
    G.x += (G.vx + (playing && G.sea.drift ? Math.sin(G.t * 0.35) * G.sea.drift : 0)) * dt;
    // the lane ends at the pack ice: the ship is eased back instead of bouncing off an invisible wall
    const lim = LANE + 0.5, over = Math.abs(G.x) - lim, sx = Math.sign(G.x);
    if (over > 0) { if (G.vx * sx > 0) G.vx *= Math.max(0, 1 - dt * 9); G.x -= sx * over * Math.min(1, dt * 6); if (Math.abs(G.x) > lim + 1) G.x = sx * (lim + 1); }
    const near = playing ? THREE.MathUtils.clamp((Math.abs(G.x) - (lim - 2.5)) / 2.5, 0, 1) : 0;
    if (near !== G.shownEdge) { G.shownEdge = near; $('edgeL').style.opacity = sx < 0 ? near : 0; $('edgeR').style.opacity = sx > 0 ? near : 0; }
    const kdir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
    if (kdir) setWheel(G.wheel + kdir * dt * 4);                                         // keys: hold to turn
    else if (!wheelDrag && !swipe && G.wheel) { G.wheel *= Math.exp(-dt * 6); if (Math.abs(G.wheel) < 0.01) G.wheel = 0; drawWheel(); }   // let go: the wheel springs back
  }
  ship.position.x = G.x;
  ship.rotation.y = THREE.MathUtils.clamp(-G.vx * 0.028, -0.28, 0.28);
  ship.rotation.z = G.vx * 0.012 + (G.flooded * 0.012);
  if (G.state !== 'lost') { ship.rotation.x = -G.flooded * 0.008; ship.position.y = -0.05 - G.flooded * 0.12; }

  // move the sea past the ship
  W.growlers.forEach(g => { g.position.z += flow * dt; if (g.position.z > 40) { g.position.z -= 180; g.position.x = (Math.random() - .5) * 70; } });
  const bowZ = SHIP_Z - HALF_LEN;
  G.bergs.forEach(b => {
    b.z += flow * dt; b.mesh.position.z = b.z;
    if (b.vx && !b.sinking) { b.x += b.vx * dt; b.mesh.position.x = b.x; b.mesh.rotation.y += b.vx * dt * 0.1; }
    if (b.sinking) { b.mesh.position.y -= dt * 2; return; }
    b.mesh.position.y = Math.sin(clock * 0.8 + b.phase) * 0.08;
    if (!playing) return;
    const dx = Math.max(Math.abs(b.x - G.x) - HALF_W, 0), dz = Math.max(Math.abs(b.z - SHIP_Z) - HALF_LEN, 0);
    const gap = Math.hypot(dx, dz) - b.r;
    if (gap < 0 && !b.hit) hitShip(b);
    else if (!b.hit && !b.inched && gap < 0.9 && b.z > bowZ + 2) {
      b.inched = true; G.slow = 0.7; G.stats.inches++; Sfx.whooshNear(); vibrate(30);
      addScore(50 * (G.sea.closeMult || 1), '😱 INCHES AWAY!', '#4be0ff', toScreen(new THREE.Vector3(b.x, 4, b.z))); checkMissions();
    }
    else if (!b.hit && !b.warned && gap < SETTINGS.nearMiss && b.z > bowZ + 2) {
      b.warned = true; Sfx.whooshNear(); G.stats.close++; bumpCombo();
      addScore(25 * (G.sea.closeMult || 1), TEXTS.closeCall, '#ff6b6b', toScreen(new THREE.Vector3(b.x, 3, b.z)));
    }
  });
  G.buoys.forEach(b => {
    b.z += flow * dt; b.mesh.position.z = b.z; b.mesh.position.y = 0.25 + Math.sin(clock * 3 + b.x) * 0.08; b.mesh.rotation.z += dt;
    if (!b.got && playing && Math.abs(b.x - G.x) < 2.6 && Math.abs(b.z - bowZ) < 2.5) {
      b.got = true; scene.remove(b.mesh); Sfx.coin(G.combo); bumpCombo();
      addScore(10 * (G.sea.buoyMult || 1), '🛟', '#ffb060', toScreen(new THREE.Vector3(b.x, 2, b.z)));
      G.lifebuoys++; G.stats.buoys++;
      if (G.lifebuoys % 5 === 0) {
        if (G.flooded > 0) { const c = $('cells').children[G.flooded - 1]; c.classList.remove('flooded'); c.classList.add('repaired'); G.flooded--; floatText('🛟×5 → HULL REPAIRED!', '#36d67a'); Sfx.win(); }
        else addScore(100, '🛟×5 BONUS', '#36d67a');
      }
      $('buoyCount').textContent = `🛟 ${G.lifebuoys % 5}/5`;
    }
  });
  G.powers.forEach(p => {
    p.z += flow * dt; p.mesh.position.z = p.z; p.mesh.position.y = 1.2 + Math.sin(clock * 3 + p.x) * 0.25; p.mesh.rotation.y += dt * 2;
    if (!p.got && playing && Math.abs(p.x - G.x) < 3 && Math.abs(p.z - bowZ) < 3) { p.got = true; scene.remove(p.mesh); collectPower(p.fix); }
  });
  G.powers = G.powers.filter(p => p.z < 60 && !p.got);
  G.boats.forEach(b => {
    b.z += flow * dt * 0.85; b.mesh.position.z = b.z;
    if (b.dodge) { b.x += b.dodge * 7 * dt; b.mesh.rotation.y = Math.PI - b.dodge * 0.6; }
    b.mesh.position.x = b.x; b.mesh.position.y = Math.sin(clock * 2 + b.z) * 0.12; b.mesh.rotation.z = Math.sin(clock * 1.7 + b.x) * 0.06;
    if (!playing || b.hit) return;
    const dx = Math.abs(b.x - G.x) - HALF_W - 1.0, dz = Math.max(Math.abs(b.z - SHIP_Z) - HALF_LEN, 0);
    if (dx < 0 && dz < 1.2) { b.hit = true; b.dodge = b.x >= G.x ? 1 : -1; hitShip({ x: b.x, z: b.z, hit: false }); floatText('💥 BOAT COLLISION!', '#ff8a93'); }
    else if (!b.cleared && b.z > SHIP_Z - HALF_LEN && b.dodge) { b.cleared = true; G.stats.boats++; addScore(40, '⛵ BOAT CLEARED', '#9fe8ff', toScreen(new THREE.Vector3(b.x, 3, b.z))); bumpCombo(); }
  });
  G.boats = G.boats.filter(b => { if (b.z > 60) { scene.remove(b.mesh); return false; } return true; });
  if (G.hornCd > 0) { G.hornCd = Math.max(0, G.hornCd - dt); }
  $('hornCd').style.setProperty('--cd', (G.hornCd / 2.5 * 100) + '%');
  $('horn').classList.toggle('ready', G.hornCd === 0 && G.boats.some(b => !b.dodge && b.z > -120 && b.z < SHIP_Z - HALF_LEN));
  // warning beacons follow their icebergs
  G.bergs.forEach(b => { if (b.beacon) b.beacon.visible = !!G.active.warning; });
  // scenery: a field of big icebergs either side of the shipping lane (no collision)
  const deco = (x, sc, z = SPAWN_Z - Math.random() * 6) => { const d = W.makeIceberg(Math.floor(Math.random() * 4)); d.children.filter(c => c.material.transparent).forEach(c => d.remove(c)); d.scale.setScalar(sc); d.position.set(x, 0, z); d.rotation.y = Math.random() * 6; G.deco.push(d); };
  G.nextDeco -= dt * (flow / BASE_SPEED);
  if (G.nextDeco <= 0) { G.nextDeco = 0.8 + Math.random() * 0.5; deco((Math.random() < .5 ? -1 : 1) * (LANE + 20 + Math.random() * 30), 2 + Math.random() * 2.6); }
  // a solid wall of pack ice on both edges, so the limit of the lane is something you can see
  if (!G.shelfInit) { G.shelfInit = true; for (let z = SPAWN_Z + 11; z < 50; z += 11) [-1, 1].forEach(sd => deco(sd * (LANE + 8.5 + Math.random() * 1.5), 2.9 + Math.random() * 0.9, z)); }
  G.shelfD = (G.shelfD || 0) - flow * dt;
  if (G.shelfD <= 0) { G.shelfD = 11; [-1, 1].forEach(sd => deco(sd * (LANE + 8.5 + Math.random() * 1.5), 2.9 + Math.random() * 0.9)); }
  G.deco = G.deco.filter(d => { d.position.z += flow * dt; if (d.position.z > 70) { scene.remove(d); return false; } return true; });
  // forget things far behind
  G.bergs = G.bergs.filter(b => { if (b.z > 60) { scene.remove(b.mesh); return false; } return true; });
  G.buoys = G.buoys.filter(b => b.z < 60 && !b.got);

  if (G.state === 'lost') { G.sink += dt; ship.rotation.x = -Math.min(G.sink * 0.06, 0.16); ship.position.y = -Math.min(G.sink * 0.9, 2.2); }
}

function updateCamera(dt) {
  let pos, look;
  if (cam.mode === 'cine') {
    cineT += dt;
    const k = Math.min(cineT / 9, 1), e = k * k * (3 - 2 * k), a = -2.4 + e * 2.4;
    pos = new THREE.Vector3(Math.sin(a) * (34 - e * 4), 3 + e * 21, SHIP_Z + Math.cos(a) * (34 - e * 4) * (e < .5 ? -1 : 1) * (1 - e) + e * 34);
    look = new THREE.Vector3(0, 3 - e * 3, SHIP_Z - e * 40);
    cam.pos.lerp(pos, Math.min(dt * 1.5, 1)); cam.look.lerp(look, Math.min(dt * 1.5, 1));
    camera.position.copy(cam.pos); camera.lookAt(cam.look); return;
  }
  if (cam.mode === 'menu') {
    const a = clock * 0.05;
    pos = new THREE.Vector3(Math.sin(a) * 30 - 10, 18, SHIP_Z + Math.cos(a) * 30 + 6); look = new THREE.Vector3(0, 1, SHIP_Z - 4);
  } else {
    const x = G ? G.x : 0;
    pos = new THREE.Vector3(x * 0.8 + 3.5, 21, SHIP_Z + 44); look = new THREE.Vector3(x * 0.85 + 0.8, 0, SHIP_Z - 34);
    if (G && G.state === 'lost') { pos.y += 4; pos.z += 6; }
  }
  cam.pos.lerp(pos, Math.min(dt * 2.4, 1)); cam.look.lerp(look, Math.min(dt * 2.4, 1));
  camera.position.copy(cam.pos);
  const fovT = 48 + (G && G.state === 'play' ? G.throttle * 5 + (G.slow > 0 ? -4 : 0) : 0);
  if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt); const s = cam.shake * 0.8 * (progress.settings.shake === false ? 0 : 1); camera.position.x += (Math.random() - .5) * s; camera.position.y += (Math.random() - .5) * s; }
  camera.lookAt(cam.look);
}

requestAnimationFrame(t => { frame(t); Platform.firstFrameReady(); });
Platform.load().then(saved => {
  const s = saved || {}; Object.assign(progress, s, { settings: Object.assign({}, progress.settings, s.settings || {}) });
  if (progress.settings.gfx === 'low') W.setQuality('low'); else if (progress.settings.gfx === 'high') W.setQuality('high');
  document.body.classList.toggle('lite', W.isPhone);
  applyShip(Meta.SHIPS.some(x => x.id === progress.ship) ? progress.ship : 'titanic');
  buildMenu(); renderMeta(); renderLive(); applyAudio(); hideLoading(); Platform.gameReady();
  setTimeout(() => { if (progress.voyages > 0 && $('menu').classList.contains('on') && !G) openDaily(true); }, 1300);
});
window.READY = true;
window.__game = { startLevel, get G() { return G; }, progress, collect: id => collectPower(G.level.fixes.find(f => f.id === id)), hit: () => hitShip({ x: G.x, z: SHIP_Z - 13, hit: false }) };
