// Talks to YouTube Playables when running on YouTube; quietly does nothing elsewhere.
window.Platform = (() => {
  const yt = () => (window.ytgame && window.ytgame.game ? window.ytgame : null);
  const listeners = { pause: [], resume: [], audio: [] };
  let audioOn = true;
  function init() {
    const g = yt();
    if (!g) return;
    try {
      audioOn = g.system.isAudioEnabled();
      g.system.onAudioEnabledChange(on => { audioOn = on; listeners.audio.forEach(f => f(on)); });
      g.system.onPause(() => listeners.pause.forEach(f => f()));
      g.system.onResume(() => listeners.resume.forEach(f => f()));
    } catch (e) { /* keep playing even if a call is unavailable */ }
  }
  return {
    init,
    get audioOn() { return audioOn; },
    on(evt, fn) { listeners[evt].push(fn); },
    firstFrameReady() { try { yt() && yt().game.firstFrameReady(); } catch (e) {} },
    gameReady() { try { yt() && yt().game.gameReady(); } catch (e) {} },
    async load() { try { return yt() ? JSON.parse((await yt().game.loadData()) || '{}') : {}; } catch (e) { return {}; } },
    save(obj) { try { yt() && yt().game.saveData(JSON.stringify(obj)); } catch (e) {} },
    score(value) { try { yt() && yt().engagement.sendScore({ value: Math.round(value) }); } catch (e) {} }
  };
})();
Platform.init();
