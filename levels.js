// All levels. Safe to edit: change text, timing or difficulty here.
//
// duration   seconds the player must survive
// ink        how much line the player can draw (pixels)
// threats    what attacks:  count, every (seconds between), speed, pull (how hard they chase the target)
// target     what must be saved: x, y in a 720 x 1280 screen
window.LEVELS = [
  {
    id: 'titanic',
    ready: true,
    name: 'Titanic',
    year: 1912,
    place: 'North Atlantic',
    when: 'April 14, 1912 • 11:39 PM',
    intro: 'The lookout spots ice. You have 37 seconds.',
    duration: 37,          // seconds to survive
    lives: 4,              // compartments that can flood (the 5th sinks her — just like 1912)
    density: [1.1, 0.7],  // seconds between ice waves at the start → at the end
    finale: 5,             // the giant iceberg appears this many seconds before the end
    realFlooded: 5,
    // Each power-up fixes one real mistake from 1912.
    fixes: [
      { id: 'binoculars', icon: '🔭', name: 'BINOCULARS', time: 8, real: 'The lookouts had no binoculars — the key to their locker was left ashore in Southampton.' },
      { id: 'warning', icon: '📻', name: 'ICE WARNING', time: 8, real: 'Six ice warnings reached the Titanic that day. The most urgent never made it to the bridge.' },
      { id: 'searchlight', icon: '🔦', name: 'SEARCHLIGHT', time: 8, real: 'It was a moonless night on a flat-calm sea, so no waves broke at the base of the iceberg to reveal it.' },
      { id: 'rudder', icon: '⚙️', name: 'BIG RUDDER', time: 6, real: 'For a ship her size, the Titanic\'s rudder was small — she turned too slowly to miss the ice.' },
      { id: 'bulkhead', icon: '🛡️', name: 'SEALED BULKHEADS', time: 0, real: 'Her watertight walls did not reach the top deck, so water spilled from one compartment into the next.' },
      { id: 'rivets', icon: '🔩', name: 'STEEL RIVETS', time: 0, real: 'Weaker iron rivets in her bow may have popped on impact, opening the seams of the hull.' }
    ],
    fact: 'At 11:40 PM the Titanic struck an iceberg after just 37 seconds of warning. It ripped open 5 of her 16 watertight compartments — she could survive 4. She sank 2 hours and 40 minutes later.',
    photo: 'photo_titanic.jpg'
  },
  {
    id: 'pompeii',
    name: 'Pompeii',
    year: 79,
    place: 'Roman Italy',
    intro: 'AD 79. Mount Vesuvius wakes up.',
    duration: 12,
    ink: 1000,
    target: { x: 360, y: 1020 },
    threats: { kind: 'lavarock', count: 20, every: 0.45, speed: 4, pull: 0.0006, from: 'top' },
    fact: 'Vesuvius buried Pompeii under ash in a single day. The city stayed hidden for over 1,600 years.',
    photo: 'photo_pompeii.jpg'
  },
  {
    id: 'hindenburg',
    name: 'Hindenburg',
    year: 1937,
    place: 'New Jersey, USA',
    intro: 'May 6, 1937. One spark is all it takes.',
    duration: 12,
    ink: 850,
    target: { x: 360, y: 520 },
    threats: { kind: 'spark', count: 22, every: 0.4, speed: 4.5, pull: 0.0008, from: 'bottom' },
    fact: 'The hydrogen-filled Hindenburg burned in about 34 seconds. Amazingly, 62 of the 97 people on board survived.',
    photo: 'photo_hindenburg.jpg'
  },
  {
    id: 'london',
    name: 'Great Fire of London',
    year: 1666,
    place: 'London, England',
    intro: '1666. A bakery fire on Pudding Lane...',
    duration: 14,
    ink: 1100,
    target: { x: 360, y: 980 },
    threats: { kind: 'ember', count: 26, every: 0.38, speed: 3.8, pull: 0.0007, from: 'left' },
    fact: 'The fire burned for four days and destroyed over 13,000 houses — but it started in a single bakery.',
    photo: 'photo_london.jpg'
  },
  {
    id: 'apollo13',
    name: 'Apollo 13',
    year: 1970,
    place: 'Space, 200,000 miles from Earth',
    intro: '1970. "Houston, we\'ve had a problem."',
    duration: 15,
    ink: 900,
    target: { x: 360, y: 700 },
    threats: { kind: 'debris', count: 28, every: 0.36, speed: 4.2, pull: 0.0009, from: 'all' },
    fact: 'An oxygen tank exploded on the way to the Moon. The crew used the lunar module as a lifeboat and made it home alive.',
    photo: 'photo_apollo13.jpg'
  }
];
