// Global feel of the game. Safe to edit.
window.SETTINGS = {
  sound: { master: 0.7, music: 0.45, effects: 0.8 },
  stars: { two: 0.35, three: 0.6 },   // ink left needed for 2 and 3 stars (0..1)
  inkPerUnit: 30,                       // level "ink" divided by this = rope length in metres-ish
  nearMiss: 2.6,                        // how close (world units) counts as a CLOSE CALL
  iceSpeed: 7,                          // base iceberg speed
  slowMotion: 0.18
};
