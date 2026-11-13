// Long-term goals that bring players back: captain ranks, missions and achievements.
window.Meta = (() => {
  const RANKS = [
    { name: 'Deckhand', xp: 0, icon: '⚓' },
    { name: 'Lookout', xp: 600, icon: '🔭' },
    { name: 'Quartermaster', xp: 1600, icon: '🧭' },
    { name: 'Fourth Officer', xp: 3200, icon: '🎖️' },
    { name: 'First Officer', xp: 5600, icon: '⭐' },
    { name: 'Captain', xp: 9000, icon: '🧑‍✈️' },
    { name: 'Commodore', xp: 14000, icon: '🏅' },
    { name: 'Admiral', xp: 21000, icon: '👑' }
  ];

  // stat: what the voyage tracks; goal: how much is needed
  const MISSIONS = [
    { id: 'close3', text: 'Pull off 3 CLOSE CALLS in one voyage', stat: 'close', goal: 3, xp: 200 },
    { id: 'buoys5', text: 'Collect 5 lifebuoys in one voyage', stat: 'buoys', goal: 5, xp: 150 },
    { id: 'clean', text: 'Finish a voyage without flooding a compartment', stat: 'cleanWin', goal: 1, xp: 300 },
    { id: 'full20', text: 'Stay at FULL speed for 20 seconds', stat: 'fullTime', goal: 20, xp: 200 },
    { id: 'horn3', text: 'Clear 3 boats with the horn', stat: 'boats', goal: 3, xp: 200 },
    { id: 'fix2', text: 'Use 2 History Fixes in one voyage', stat: 'fixes', goal: 2, xp: 150 },
    { id: 'combo5', text: 'Reach a ×5 combo', stat: 'maxCombo', goal: 5, xp: 250 },
    { id: 'score900', text: 'Score 6,000 points in one voyage', stat: 'score', goal: 6000, xp: 250 },
    { id: 'survive', text: 'Survive all 37 seconds', stat: 'win', goal: 1, xp: 150 },
    { id: 'inches', text: 'Pass an iceberg by INCHES (super close!)', stat: 'inches', goal: 1, xp: 200 }
  ];

  const ACHIEVEMENTS = [
    { id: 'veteran', icon: '🏅', name: 'Veteran', text: '7-day voyage streak' },
    { id: 'first', icon: '🚢', name: 'Maiden Voyage', text: 'Finish your first voyage' },
    { id: 'saved', icon: '🌅', name: 'History Changed', text: 'Get the Titanic to safety' },
    { id: 'untouchable', icon: '💎', name: 'Untouchable', text: 'Win without a single hit' },
    { id: 'thread', icon: '🧵', name: 'By a Thread', text: 'Win with 4 compartments flooded' },
    { id: 'speed', icon: '⚡', name: 'Full Steam', text: 'Win without ever slowing down' },
    { id: 'horn', icon: '📯', name: 'Horn Master', text: 'Clear 5 boats in one voyage' },
    { id: 'combo', icon: '🔥', name: 'Combo King', text: 'Reach the ×6 combo' },
    { id: 'collector', icon: '🛠️', name: 'Historian', text: 'Find all 6 History Fixes' },
    { id: 'captain', icon: '🧑‍✈️', name: 'Captain', text: 'Reach the rank of Captain' }
  ];

  function rankOf(xp) {
    let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
    const cur = RANKS[i], next = RANKS[i + 1];
    return { index: i, cur, next, pct: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1, toNext: next ? next.xp - xp : 0 };
  }

  function ensureMissions(p) {
    p.missions = (p.missions || []).filter(id => MISSIONS.some(m => m.id === id));
    p.missionsDone = p.missionsDone || {};
    const pool = MISSIONS.filter(m => !p.missions.includes(m.id) && !p.missionsDone[m.id]);
    while (p.missions.length < 3) {
      const src = pool.length ? pool : MISSIONS.filter(m => !p.missions.includes(m.id));
      const m = src.splice(Math.floor(Math.random() * src.length), 1)[0];
      if (!m) break; p.missions.push(m.id);
    }
    return p.missions.map(id => MISSIONS.find(m => m.id === id));
  }


  // ---- shipyard: real ships of the era (and beyond), unlocked with XP — looks only, same handling ----
  const SHIPS = [
    { id: 'titanic', name: 'RMS Titanic', year: 1912, xp: 0, tag: 'The "unsinkable" one', story: 'Largest ship afloat in 1912. 4 funnels — the 4th was a dummy.' },
    { id: 'carpathia', name: 'RMS Carpathia', year: 1903, xp: 600, tag: 'The rescuer', story: 'Raced through the ice at night and saved 705 Titanic survivors.' },
    { id: 'icebreaker', name: 'Polar Icebreaker', year: 2020, xp: 1600, tag: 'Built for ice', story: 'A thick steel bow that rides up onto the ice and crushes it.' },
    { id: 'lusitania', name: 'RMS Lusitania', year: 1907, xp: 3200, tag: 'Greyhound of the seas', story: 'Won the Blue Riband for crossing the Atlantic the fastest.' },
    { id: 'dreadnought', name: 'HMS Dreadnought', year: 1906, xp: 5600, tag: 'The game-changer', story: 'Her big guns made every other battleship old overnight.' },
    { id: 'yacht', name: 'Royal Steam Yacht', year: 1900, xp: 9000, streak: 7, tag: 'Pure luxury', story: 'Gilded rails, teak decks and a clipper bow. Unlock with XP — or a 7-day streak!' },
    { id: 'cruise', name: 'Modern Cruise Liner', year: 2024, xp: 14000, tag: 'A floating city', story: 'Five times bigger than the Titanic — with lifeboats for everyone.' },
    { id: 'nautilus', name: 'Nautilus X', year: 2100, xp: 21000, tag: 'From the future', story: 'Neon hull, glass canopy, wave-piercing bow. Only Admirals sail her.' }
  ];
  const shipOk = (sh, p) => (p.xp || 0) >= sh.xp || (sh.streak && (p.daily && p.daily.best || 0) >= sh.streak);

  // ---- today's sea: one modifier per calendar day, same for everyone ----
  const SEAS = [
    { id: 'fog', icon: '🌫️', name: 'FOG BANK', text: 'Thick fog — icebergs appear late. Trust the binoculars!', fog: 1.9 },
    { id: 'glass', icon: '🪞', name: 'GLASS SEA', text: 'Flat calm — fewer icebergs, more lifebuoys.', dens: 1.25, buoyChance: 0.8 },
    { id: 'busy', icon: '⛵', name: 'BUSY LANES', text: 'Fishing boats everywhere — the horn is your friend.', boatsEarly: 0.25, boatGap: 0.6 },
    { id: 'aurora', icon: '🌌', name: 'NORTHERN LIGHTS', text: 'Lifebuoys are worth double tonight.', buoyMult: 2 },
    { id: 'storm', icon: '❄️', name: 'ICE STORM', text: 'More icebergs — but every point counts ×1.5.', dens: 0.85, scoreMult: 1.5 },
    { id: 'clear', icon: '✨', name: 'CLEAR NIGHT', text: 'Perfect visibility. Close calls give +50%.', closeMult: 1.5, fog: 0.75 },
    { id: 'current', icon: '🌊', name: 'STRONG CURRENT', text: 'The sea pushes you sideways. Steer against it!', drift: 1.6 }
  ];
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayNum = k => Math.round(new Date(k + 'T12:00:00').getTime() / 86400000);
  const todaysSea = () => SEAS[((dayNum(dayKey()) % SEAS.length) + SEAS.length) % SEAS.length];

  // ---- daily voyage calendar: day 7 is a real unlock, not just points ----
  const DAILY = [
    { xp: 50, icon: '⚓' }, { xp: 75, icon: '🧭' }, { xp: 100, icon: '🎁' }, { xp: 125, icon: '🔭' },
    { xp: 150, icon: '🎖️' }, { xp: 200, icon: '💎' }, { xp: 300, icon: '🏅', note: 'VETERAN + Royal Yacht' }
  ];
  // forgiving streak: miss one day and it holds; miss two and it starts over
  function checkDaily(p) {
    const today = dayKey(); p.daily = p.daily || { last: null, streak: 0, best: 0, claimed: null };
    const d = p.daily; if (d.claimed === today) return null;
    const gap = d.last ? dayNum(today) - dayNum(d.last) : 99;
    const streak = gap <= 2 ? d.streak + 1 : 1;
    return { streak, slot: (streak - 1) % 7, reward: DAILY[(streak - 1) % 7], reset: d.streak > 0 && gap > 2 };
  }
  function claimDaily(p, info) {
    const today = dayKey(); p.daily.last = today; p.daily.claimed = today; p.daily.streak = info.streak;
    p.daily.best = Math.max(p.daily.best || 0, info.streak); p.xp = (p.xp || 0) + info.reward.xp;
  }

  return { RANKS, MISSIONS, ACHIEVEMENTS, rankOf, ensureMissions, SHIPS, shipOk, SEAS, DAILY, todaysSea, dayKey, checkDaily, claimDaily };
})();
