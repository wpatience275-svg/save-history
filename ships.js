// The Shipyard fleet: every ship here was modelled for this game from simple shapes.
// All ships share the same size on the water, so gameplay is identical — only the look changes.
import * as THREE from './three.module.min.js';

const M = o => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0.05 }, o));
const B0 = new THREE.MeshBasicMaterial({ color: 0x030303 });

function kitFor(ship) {
  const o = new THREE.Object3D();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; ship.add(m); return m; };
  const inst = (geo, mat, list) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); list.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3] || 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.count = list.length; ship.add(im); return im; };
  return { add, inst };
}

// ---------- shared hull: plan shape, sheer, flare, waterline ----------
function hull(ship, k, c) {
  const { L, B, H, draft = 0.7 } = c, bow = c.bowLen || 6.5, stern = c.sternLen || 3.4, blunt = c.blunt || 0.28;
  const plan = new THREE.Shape();
  plan.moveTo(0, -L / 2);
  plan.bezierCurveTo(B * blunt, -L / 2 + bow * 0.18, B * 0.95, -L / 2 + bow * 0.55, B, -L / 2 + bow);
  plan.lineTo(B, L / 2 - stern);
  plan.bezierCurveTo(B, L / 2 - stern * 0.3, B * (c.transom || 0.62), L / 2, 0, L / 2);
  plan.bezierCurveTo(-B * (c.transom || 0.62), L / 2, -B, L / 2 - stern * 0.3, -B, L / 2 - stern);
  plan.lineTo(-B, -L / 2 + bow);
  plan.bezierCurveTo(-B * 0.95, -L / 2 + bow * 0.55, -B * blunt, -L / 2 + bow * 0.18, 0, -L / 2);
  const sa = c.sheer ?? 0.5, sheer = z => { const u = z / (L / 2); return u < 0 ? sa * (u ** 4) + sa * 0.3 * u * u : sa * 0.4 * (u ** 4); };
  const flare = c.flare ?? 0.12;
  const shape = (g, full) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i), kk = full ? 1 : THREE.MathUtils.clamp(y / H, 0, 1);
      p.setY(i, y + sheer(z) * kk);
      if (z < -L / 2 + 6 && y > 0.1) p.setX(i, p.getX(i) * (1 + flare * (1 - (z + L / 2) / 6) * THREE.MathUtils.clamp(y / H, 0, 1)));
    }
    g.computeVertexNormals(); return g;
  };
  const extrude = (h, inset = 1, y0 = 0, full = false) => { const g = new THREE.ExtrudeGeometry(plan, { depth: h, bevelEnabled: false, curveSegments: 48 }); g.rotateX(Math.PI / 2); g.scale(inset, 1, inset); g.translate(0, y0 + h, 0); return y0 >= 0 ? shape(g, full) : g; };
  k.add(extrude(draft, 0.99, -draft), c.bottom, 0, 0, 0);
  k.add(extrude(H, 1, 0), c.top, 0, 0, 0);
  if (c.boot) k.add(extrude(0.06, 1.004, -0.03), c.boot, 0, 0, 0);
  (c.bands || []).forEach(([y, mat, hh = 0.05]) => k.add(extrude(hh, 1.007, y, true), mat, 0, 0, 0));
  const deckGeo = new THREE.ShapeGeometry(plan, 48); deckGeo.rotateX(-Math.PI / 2);
  const dp = deckGeo.attributes.position, uv = deckGeo.attributes.uv;
  for (let i = 0; i < dp.count; i++) { const z = dp.getZ(i); dp.setY(i, sheer(z)); if (z < -L / 2 + 6) dp.setX(i, dp.getX(i) * (1 + flare * (1 - (z + L / 2) / 6))); uv.setXY(i, (dp.getX(i) + B) / (2 * B), (z + L / 2) / L); }
  deckGeo.computeVertexNormals();
  k.add(deckGeo, c.deck, 0, H + 0.01, 0);
  // portholes along the hull
  if (c.ports) {
    const list = [], w = z => z < -L / 2 + bow ? B * Math.min(1, (z + L / 2) / bow) ** 0.6 : z > L / 2 - stern ? B * (1 - ((z - (L / 2 - stern)) / stern) ** 2 * 0.4) : B;
    for (let z = -L / 2 + 2.6; z < L / 2 - 1.2; z += c.ports.step || 0.18) c.ports.rows.forEach(y => [-1, 1].forEach(s => { if (Math.random() > 0.12) list.push([s * (w(z) + 0.006), y + sheer(z) * (y / H), z, s * Math.PI / 2]); }));
    k.inst(new THREE.CircleGeometry(c.ports.r || 0.035, 8), new THREE.MeshBasicMaterial({ color: c.ports.color || 0xffd889 }), list);
  }
  return { sheer, D: H + 0.01, plan };
}

// stacked superstructure tier with a strip of lit windows on each side
function tier(k, { z0, z1, w, h, y, mat, win, winH = 0.12, step = 0.19, front }) {
  const len = z1 - z0, mid = (z0 + z1) / 2;
  k.add(new THREE.BoxGeometry(w, h, len), mat, 0, y + h / 2, mid);
  if (win) {
    const list = []; for (let z = z0 + 0.15; z < z1 - 0.1; z += step) [-1, 1].forEach(s => list.push([s * (w / 2 + 0.004), y + h * 0.55, z, s * Math.PI / 2]));
    k.inst(new THREE.PlaneGeometry(step * 0.6, winH), new THREE.MeshBasicMaterial({ color: win }), list);
  }
}
function funnel(ship, { z, y, r = 0.4, h = 2.6, body, top, rake = 0.17, ell = 1.3, bands = [], topH = 0.5 }) {
  const f = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 32), body); b.scale.z = ell; b.castShadow = true; f.add(b);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, topH, 32), top); t.scale.z = ell; t.position.y = h / 2 - topH / 2; f.add(t);
  bands.forEach(([yy, mat]) => { const bd = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.08, 32), mat); bd.scale.z = ell; bd.position.y = yy; f.add(bd); });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 24), B0); hole.rotation.x = -Math.PI / 2; hole.scale.y = ell; hole.position.y = h / 2 + 0.002; f.add(hole);
  f.position.set(0, y + h / 2, z); f.rotation.x = rake; ship.add(f); return f;
}
function mast(k, mat, z, y, h, rake = -0.09) { k.add(new THREE.CylinderGeometry(0.03, 0.055, h, 8), mat, 0, y + h / 2, z, rake); }
function wires(ship, pts, color = 0x1a1a1a) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); ship.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }))); }
function lifeboats(k, zs, x, y, mat = M({ color: 0xf2eee3 })) {
  const g = new THREE.CapsuleGeometry(0.09, 0.42, 4, 10); g.rotateX(Math.PI / 2); g.scale(1, 0.75, 1);
  zs.forEach(z => [-1, 1].forEach(s => k.add(g, mat, s * x, y, z)));
}
function flagOn(ship, x, y, z, color = 0xb3202a) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.28, 8, 1), M({ color, side: THREE.DoubleSide }));
  f.position.set(x, y, z); f.rotation.y = Math.PI / 2; ship.add(f); return f;
}
function navLights(ship, y, z, w) {
  [[-1, 0xff3030], [1, 0x30ff60]].forEach(([s, c]) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: c })); l.position.set(s * w, y, z); ship.add(l); });
  const lamp = new THREE.PointLight(0xffcf8a, 5, 9, 2); lamp.position.set(0, y + 0.3, z + 6); ship.add(lamp);
}
function finish(ship, { funnels, flag, mats, people }) {
  ship.userData = { funnels, flag, mats, people: people || new THREE.Group() };
  if (!people) ship.add(ship.userData.people);
  return ship;
}
const deckWood = kit => M({ map: kit.deckTexture(), roughness: 0.85 });

// ================= RMS CARPATHIA (1903) — the rescue ship =================
function carpathia(kit) {
  const ship = new THREE.Group(), k = kitFor(ship);
  const black = M({ color: 0xffffff, map: kit.hullTexture(), roughness: 0.35, metalness: 0.4 }), white = M({ color: 0xf2eee3 });
  const red = M({ color: 0xc8401f, roughness: 0.45 }), dark = M({ color: 0x0b0b0b }), wood = M({ color: 0x8a6a45 });
  const { D, sheer } = hull(ship, k, { L: 24, B: 1.35, H: 1.75, bottom: M({ color: 0x7a1d14 }), top: black, deck: deckWood(kit), sheer: 0.6, bands: [[1.45, white, 0.05]], ports: { rows: [0.6, 0.95], step: 0.24 } });
  tier(k, { z0: -3.4, z1: 3.6, w: 2.3, h: 0.42, y: D, mat: white, win: 0xffd27a });
  tier(k, { z0: -3.0, z1: 2.4, w: 2.0, h: 0.38, y: D + 0.42, mat: white, win: 0xffe0a0 });
  k.add(new THREE.BoxGeometry(2.8, 0.07, 0.5), white, 0, D + 0.86, -2.9);
  k.add(new THREE.BoxGeometry(1.1, 0.3, 0.5), white, 0, D + 1.03, -2.75);
  // forecastle and poop
  k.add(new THREE.BoxGeometry(1.6, 0.3, 2.6), white, 0, D + 0.15 + sheer(-9.5), -9.5);
  k.add(new THREE.BoxGeometry(2.2, 0.3, 2.2), white, 0, D + 0.15 + sheer(10), 10);
  // ONE tall red funnel with black top and bands — her signature
  const f = funnel(ship, { z: 0.6, y: D + 0.8, r: 0.48, h: 3.4, body: red, top: dark, rake: 0.12, ell: 1.25, bands: [[0.6, dark], [0.25, dark]], topH: 0.6 });
  // four masts with cargo derricks
  [-8.2, -5.8, 5.2, 7.8].forEach(z => {
    mast(k, wood, z, D, 6.4);
    [-1, 1].forEach(s => k.add(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 6), wood, s * 0.35, D + 1.0, z + 0.7, 0.9, 0, s * 0.3));
    k.add(new THREE.BoxGeometry(0.7, 0.08, 0.6), M({ color: 0x4a3622 }), 0, D + 0.05 + sheer(z), z + 1.0);
  });
  const wp = []; [-8.2, -5.8, 5.2, 7.8].forEach(z => [-1, 1].forEach(s => wp.push(0, D + 6.2, z - 0.5, s * 1.3, D, z)));
  wp.push(0, D + 6.2, -8.7, 0, D + 6.0, -6.3, 0, D + 6.0, 4.7, 0, D + 6.2, 7.3, 0, D + 6.2, -8.7, 0, D + 0.4, -11.8);
  wires(ship, wp);
  lifeboats(k, [-2.4, -1.4, 1.2, 2.2], 1.1, D + 0.95);
  navLights(ship, D + 0.9, -2.8, 1.42);
  const flag = flagOn(ship, 0, D + 0.75, 12.05);
  k.add(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), wood, 0, D + 0.5, 11.9);
  return finish(ship, { funnels: [f], flag, mats: { hull: black, buff: red, dark, white } });
}

// ================= RMS LUSITANIA (1907) — the greyhound of the seas =================
function lusitania(kit) {
  const ship = new THREE.Group(), k = kitFor(ship);
  const black = M({ color: 0xffffff, map: kit.hullTexture(), roughness: 0.3, metalness: 0.45 }), white = M({ color: 0xf4f1ea });
  const red = M({ color: 0xc23b22, roughness: 0.45 }), dark = M({ color: 0x0a0a0a }), wood = M({ color: 0x8a6a45 });
  const { D, sheer } = hull(ship, k, { L: 27, B: 1.32, H: 1.95, bottom: M({ color: 0x6e1a12 }), top: black, deck: deckWood(kit), sheer: 0.45, bowLen: 7.5, blunt: 0.2, bands: [[1.56, white, 0.06]], ports: { rows: [0.5, 0.8, 1.1], step: 0.16 } });
  tier(k, { z0: -6.6, z1: 8.6, w: 2.4, h: 0.4, y: D, mat: white, win: 0xffd27a, step: 0.17 });
  tier(k, { z0: -6.2, z1: 8.0, w: 2.25, h: 0.38, y: D + 0.4, mat: white, win: 0xffe4a8, step: 0.17 });
  tier(k, { z0: -5.6, z1: -3.6, w: 1.4, h: 0.32, y: D + 0.78, mat: white, win: 0xfff0c0 });
  k.add(new THREE.BoxGeometry(2.9, 0.07, 0.45), white, 0, D + 1.12, -5.5);
  k.add(new THREE.BoxGeometry(2.55, 0.04, 14.4), M({ color: 0xcfc7b4 }), 0, D + 0.8, 0.9);
  const funnels = [-2.9, -0.2, 2.5, 5.2].map(z => funnel(ship, { z, y: D + 0.8, r: 0.38, h: 2.9, body: red, top: dark, rake: 0.13, ell: 1.4, bands: [[0.55, dark], [0.2, dark], [-0.15, dark]], topH: 0.55 }));
  lifeboats(k, [-4.8, -4.2, -3.6, -1.5, 1.2, 3.8, 6.4, 7.0], 1.15, D + 0.98);
  mast(k, wood, -9.2, D, 7.0, -0.1); mast(k, wood, 10.4, D, 6.6, -0.1);
  wires(ship, [0, D + 6.9, -9.9, 0, D + 6.5, 9.7, 0, D + 6.9, -9.9, 0, D + 0.4, -13.2, ...[-1, 1].flatMap(s => [0, D + 6.9, -9.9, s * 1.3, D, -8.6, 0, D + 6.5, 9.7, s * 1.3, D, 9.6])]);
  k.add(new THREE.BoxGeometry(1.5, 0.28, 2.4), white, 0, D + 0.14 + sheer(-11), -11);
  navLights(ship, D + 1.1, -5.5, 1.45);
  const flag = flagOn(ship, 0, D + 0.75, 13.55);
  return finish(ship, { funnels, flag, mats: { hull: black, buff: red, dark, white } });
}

// ================= POLAR ICEBREAKER — built for exactly this sea =================
function icebreaker(kit) {
  const ship = new THREE.Group(), k = kitFor(ship);
  const red = M({ color: 0xc0281e, roughness: 0.4, metalness: 0.2 }), white = M({ color: 0xf5f5f2 }), dark = M({ color: 0x15171c });
  const ice = M({ color: 0x2b2f36, roughness: 0.5, metalness: 0.5 }), yellow = M({ color: 0xffc928 });
  const { D, sheer } = hull(ship, k, { L: 24, B: 1.65, H: 1.9, bottom: ice, top: red, deck: M({ color: 0x5a6068, roughness: 0.8 }), sheer: 0.7, bowLen: 7, blunt: 0.55, flare: 0.2, transom: 0.85, bands: [[1.62, white, 0.08], [0.0, ice, 0.32]], ports: { rows: [1.2], step: 0.5, color: 0xfff4d6, r: 0.05 } });   // white sheer stripe + dark ice-belt
  // tall white block forward with a wrap-around bridge
  tier(k, { z0: -5.2, z1: 2.8, w: 2.9, h: 0.6, y: D, mat: white, win: 0xd9ecff, winH: 0.16, step: 0.3 });
  tier(k, { z0: -4.9, z1: 1.8, w: 2.6, h: 0.55, y: D + 0.6, mat: white, win: 0xd9ecff, winH: 0.16, step: 0.3 });
  tier(k, { z0: -4.6, z1: 0.6, w: 2.3, h: 0.55, y: D + 1.15, mat: white, win: 0xd9ecff, winH: 0.16, step: 0.3 });
  k.add(new THREE.BoxGeometry(3.4, 0.5, 1.5), white, 0, D + 1.95, -4.0);
  const glass = []; for (let x = -1.55; x <= 1.55; x += 0.22) glass.push([x, D + 2.0, -4.76, Math.PI]);
  k.inst(new THREE.PlaneGeometry(0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x9fd6ff }), glass);
  k.add(new THREE.BoxGeometry(3.45, 0.08, 1.6), dark, 0, D + 2.24, -4.0);
  // radar mast with spinning scanner
  k.add(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 8), white, 0, D + 3.0, -3.6);
  const radar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.12), dark); radar.position.set(0, D + 3.6, -3.6); ship.add(radar); ship.userData.spin = radar;
  // wide funnel with yellow stripes
  const f = funnel(ship, { z: 3.4, y: D + 0.55, r: 0.6, h: 2.1, body: red, top: dark, rake: 0.05, ell: 1.5, bands: [[0.35, yellow], [0.1, yellow]], topH: 0.35 });
  // helideck at the stern
  k.add(new THREE.CylinderGeometry(1.4, 1.4, 0.06, 32), M({ color: 0x3b4a3a }), 0, D + 0.95, 7.6);
  const hTex = kit.textTexture('H', '#ffffff', 128, 128, 'bold 110px Arial');
  const hm = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ map: hTex, transparent: true })); hm.rotation.x = -Math.PI / 2; hm.position.set(0, D + 0.99, 7.6); ship.add(hm);
  [[-1], [1]].forEach(([s]) => k.add(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), white, s * 1.3, D + 0.45, 7.6));
  // big searchlights and a crane
  [-1, 1].forEach(s => k.add(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 12), M({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 1.2 }), s * 1.3, D + 2.4, -4.6, Math.PI / 2));
  k.add(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), yellow, 0.9, D + 1.4, 5.4, 0.6, 0, 0.3);
  k.add(new THREE.BoxGeometry(1.4, 0.3, 2.2), red, 0, D + 0.15 + sheer(-9), -9);
  navLights(ship, D + 2.1, -4.6, 1.75);
  const flag = flagOn(ship, 0, D + 1.0, 12.05, 0x2a5bd7);
  return finish(ship, { funnels: [f], flag, mats: { hull: red, buff: red, dark, white } });
}

// ================= HMS DREADNOUGHT (1906) — the battleship that changed navies =================
function dreadnought(kit) {
  const ship = new THREE.Group(), k = kitFor(ship);
  const grey = M({ color: 0x8a929b, roughness: 0.55, metalness: 0.3 }), dgrey = M({ color: 0x5b636c, roughness: 0.6, metalness: 0.3 }), dark = M({ color: 0x1a1d21 });
  const { D, sheer } = hull(ship, k, { L: 26, B: 1.6, H: 1.25, bottom: M({ color: 0x5c1f18 }), top: grey, deck: M({ color: 0xb09a72, roughness: 0.85 }), sheer: 0.55, bowLen: 6, blunt: 0.25, flare: 0.05, bands: [[0.35, dgrey, 0.08]], ports: { rows: [0.85], step: 0.45, color: 0xffd889 } });
  const turret = (z, side = 0, rot = 0) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.25, 24), dgrey); base.castShadow = true; g.add(base);
    const house = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.38, 1.0), grey); house.position.set(0, 0.3, 0.05); house.castShadow = true; g.add(house);
    [-0.2, 0.2].forEach(x => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.0, 12), dark); b.rotation.x = Math.PI / 2 - 0.04; b.position.set(x, 0.32, -1.3); g.add(b); });
    g.position.set(side, D + 0.12 + sheer(z) * 0.6, z); g.rotation.y = rot; ship.add(g);
  };
  turret(-8.6); turret(-1.2, -1.0, Math.PI / 2 - 0.2); turret(-1.2, 1.0, -Math.PI / 2 + 0.2); turret(5.6, 0, Math.PI); turret(8.8, 0, Math.PI);
  k.add(new THREE.BoxGeometry(1.7, 0.6, 4.0), grey, 0, D + 0.3, -4.4);
  k.add(new THREE.BoxGeometry(1.2, 0.45, 2.0), grey, 0, D + 0.82, -4.8);
  k.add(new THREE.BoxGeometry(2.2, 0.08, 0.8), dgrey, 0, D + 1.1, -5.3);
  k.add(new THREE.BoxGeometry(1.6, 0.55, 3.2), grey, 0, D + 0.28, 2.4);
  const funnels = [-2.6, 1.6].map(z => funnel(ship, { z, y: D + 0.4, r: 0.36, h: 2.4, body: grey, top: dark, rake: 0, ell: 1.5, topH: 0.25 }));
  // tripod mast with spotting top
  const top = [0, D + 5.0, -4.2];
  [[0, -4.2], [-0.6, -3.2], [0.6, -3.2]].forEach(([x, z]) => { const a = new THREE.Vector3(x, D + 0.6, z), b = new THREE.Vector3(...top), m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, a.distanceTo(b), 8), dgrey); m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); m.rotateX(Math.PI / 2); ship.add(m); });
  k.add(new THREE.BoxGeometry(0.7, 0.35, 0.7), dgrey, 0, D + 5.1, -4.2);
  mast(k, dgrey, 4.2, D, 4.2, 0);
  // searchlight platforms and small guns along the side
  for (let z = -6; z < 7; z += 2.2) [-1, 1].forEach(s => k.add(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), dark, s * 1.55, D - 0.25, z, 0, 0, Math.PI / 2));
  wires(ship, [...top, 0, D + 4.2, 4.2, ...top, 0, D + 0.3, -12.9]);
  navLights(ship, D + 1.2, -5.3, 1.1);
  const flag = flagOn(ship, 0, D + 0.75, 13.05, 0xe8e8e8);
  return finish(ship, { funnels, flag, mats: { hull: grey, buff: grey, dark, white: grey } });
}

// ================= STEAM YACHT — a millionaire's 1900s yacht =================
function yacht(kit) {
  const ship = new THREE.Group(), k = kitFor(ship);
  const white = M({ color: 0xfbfaf5, roughness: 0.3, metalness: 0.1 }), gold = M({ color: 0xd9a441, metalness: 0.8, roughness: 0.25 }), teak = M({ color: 0x9a6a3a, roughness: 0.45 });
  const buff = M({ color: 0xe0a64a, roughness: 0.4 }), dark = M({ color: 0x111111 });
  const { D, sheer } = hull(ship, k, { L: 24, B: 1.25, H: 1.45, bottom: M({ color: 0x1d4f8c }), top: white, deck: deckWood(kit), sheer: 0.75, bowLen: 8, blunt: 0.12, flare: 0.22, transom: 0.4, sternLen: 4, boot: gold, bands: [[1.25, gold, 0.05]], ports: { rows: [0.85], step: 0.4, color: 0xffe6a6, r: 0.045 } });
  // clipper bow with bowsprit and figurehead gilding
  k.add(new THREE.CylinderGeometry(0.03, 0.05, 3.2, 8), teak, 0, D + 0.55 + sheer(-12), -13.2, Math.PI / 2 - 0.25);
  // varnished teak deckhouses with brass-lit windows
  tier(k, { z0: -5.0, z1: 6.0, w: 1.8, h: 0.42, y: D, mat: teak, win: 0xffd27a, step: 0.3, winH: 0.16 });
  tier(k, { z0: -4.6, z1: -1.8, w: 1.4, h: 0.38, y: D + 0.42, mat: white, win: 0xffe9b0, step: 0.3 });
  k.add(new THREE.BoxGeometry(2.0, 0.05, 11.2), white, 0, D + 0.44, 0.5);
  const funnels = [-0.4, 1.8].map(z => funnel(ship, { z, y: D + 0.42, r: 0.26, h: 2.0, body: buff, top: dark, rake: 0.22, ell: 1.2, topH: 0.3 }));
  mast(k, teak, -7.0, D, 7.4, 0.12); mast(k, teak, 6.8, D, 6.6, 0.12);
  // furled sails and gaffs
  [[-7.0, 2.2], [6.8, 1.8]].forEach(([z, l]) => { k.add(new THREE.CylinderGeometry(0.03, 0.03, l, 6), teak, 0, D + 1.0, z + l / 2, Math.PI / 2 - 0.1); k.add(new THREE.CylinderGeometry(0.07, 0.07, l * 0.9, 8), white, 0, D + 1.05, z + l / 2, Math.PI / 2 - 0.1); });
  wires(ship, [0, D + 7.3, -7.9, 0, D + 0.6, -14.6, 0, D + 7.3, -7.9, 0, D + 6.5, 6.0, 0, D + 6.5, 6.0, 0, D + 0.4, 11.8, ...[-1, 1].flatMap(s => [0, D + 7.3, -7.9, s * 1.2, D, -6.6, 0, D + 6.5, 6.0, s * 1.2, D, 7.2])], 0x3a2a1a);
  lifeboats(k, [-3.6, 3.4], 1.0, D + 0.7, M({ color: 0x9a6a3a }));
  // gilded rails
  const rp = []; [-1, 1].forEach(s => { for (let z = -9; z < 10; z += 0.3) rp.push(s * 1.22, D + sheer(z) + 0.18, z, s * 1.22, D + sheer(z + 0.3) + 0.18, z + 0.3); });
  wires(ship, rp, 0xd9a441);
  navLights(ship, D + 0.95, -4.6, 0.75);
  const flag = flagOn(ship, 0, D + 0.9, 12.3, 0x1d4f8c);
  return finish(ship, { funnels, flag, mats: { hull: white, buff, dark, white } });
}

// ================= MODERN CRUISE LINER — a floating city =================
function cruise(kit) {
  const ship = new THREE.Group(), k = kitFor(ship);
  const navy = M({ color: 0x1b2c52, roughness: 0.25, metalness: 0.4 }), white = M({ color: 0xfafbfc, roughness: 0.35 }), dark = M({ color: 0x14161a });
  const glass = 0x8fd3ff;
  const { D } = hull(ship, k, { L: 27, B: 1.62, H: 1.35, bottom: M({ color: 0x7a2018 }), top: navy, deck: M({ color: 0xc9b48c, roughness: 0.8 }), sheer: 0.18, bowLen: 7, blunt: 0.3, flare: 0.18, transom: 0.9, bands: [[1.05, M({ color: 0xffc23d, metalness: 0.5, roughness: 0.3 }), 0.05]], ports: { rows: [0.75], step: 0.22, color: 0xd8f0ff } });
  // seven stacked decks of balconies
  for (let i = 0; i < 7; i++) tier(k, { z0: -8.6 + i * 0.35, z1: 11.4 - i * 0.25, w: 3.2 - i * 0.07, h: 0.34, y: D + i * 0.34, mat: white, win: i % 2 ? glass : 0xbfe6ff, winH: 0.2, step: 0.14 });
  // rounded front bridge and glass dome lounge on top
  k.add(new THREE.CylinderGeometry(1.6, 1.6, 2.38, 32, 1, false, -Math.PI / 2, Math.PI), white, 0, D + 1.19, -8.6, 0, 0, 0);
  k.add(new THREE.BoxGeometry(3.7, 0.12, 0.9), white, 0, D + 1.9, -8.2);
  k.add(new THREE.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M({ color: 0x9fdcff, roughness: 0.05, metalness: 0.6, emissive: 0x2a6a9a, emissiveIntensity: 0.6 }), 0, D + 2.38, -5.4);
  // pool deck, slides and a big swept funnel
  k.add(new THREE.BoxGeometry(1.4, 0.04, 2.2), M({ color: 0x28c6ff, emissive: 0x0a6aa0, emissiveIntensity: 0.9, roughness: 0.1 }), 0, D + 2.4, -1.5);
  const slide = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 16 }, (_, i) => new THREE.Vector3(Math.cos(i * 0.55) * 0.5 + 0.7, D + 2.4 + (15 - i) * 0.05, 2.0 + i * 0.12))), 64, 0.07, 8);
  k.add(slide, M({ color: 0xff4f7a, roughness: 0.3 }), 0, 0, 0);
  const f = funnel(ship, { z: 6.4, y: D + 2.2, r: 0.55, h: 1.8, body: white, top: dark, rake: 0.35, ell: 2.2, bands: [[0.2, M({ color: 0x1b2c52 })], [0.0, M({ color: 0xffc23d })]], topH: 0.3 });
  // string lights from bow to stern
  const lp = []; for (let z = -12; z < 12; z += 0.35) lp.push([0, D + 2.8 + Math.sin((z + 12) / 24 * Math.PI) * 1.2, z, 0]);
  k.inst(new THREE.SphereGeometry(0.035, 6, 6), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }), lp);
  mast(k, white, -6.6, D + 2.4, 1.6, 0);
  lifeboats(k, [-4, -2.8, -1.6, 1.6, 2.8, 4.0], 1.68, D + 0.6, M({ color: 0xff8a1f }));
  navLights(ship, D + 1.95, -8.2, 1.85);
  const flag = flagOn(ship, 0, D + 1.0, 13.55, 0x1b2c52);
  return finish(ship, { funnels: [f], flag, mats: { hull: navy, buff: white, dark, white } });
}

// ================= NAUTILUS X — a ship from the future =================
function nautilus(kit) {
  const ship = new THREE.Group(), k = kitFor(ship);
  const body = M({ color: 0x141b2a, roughness: 0.2, metalness: 0.85 }), panel = M({ color: 0x232c40, roughness: 0.3, metalness: 0.8 });
  const neon = new THREE.MeshBasicMaterial({ color: 0x3ff7ff }), pink = new THREE.MeshBasicMaterial({ color: 0xff3fb4 });
  const { D, sheer } = hull(ship, k, { L: 26, B: 1.45, H: 1.4, bottom: panel, top: body, deck: panel, sheer: 0.1, bowLen: 10, blunt: 0.05, flare: -0.1, transom: 0.95, sternLen: 1.2, bands: [[0.95, neon, 0.035], [0.25, pink, 0.03]] });
  // sculpted wedge superstructure with a glass canopy
  const s = new THREE.Shape(); s.moveTo(-1.2, 0); s.lineTo(1.2, 0); s.lineTo(0.85, 0.7); s.lineTo(-0.85, 0.7); s.closePath();
  const sg = new THREE.ExtrudeGeometry(s, { depth: 13, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.2, bevelSegments: 3 }); sg.translate(0, 0, -6.5);
  k.add(sg, panel, 0, D, 1.0);
  const can = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); can.scale(0.85, 0.55, 3.2);
  k.add(can, M({ color: 0x5fe6ff, roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0.65, emissive: 0x0b6a8a, emissiveIntensity: 0.8 }), 0, D + 0.7, -2.5);
  // fins and twin exhaust pods
  [-1, 1].forEach(sd => {
    const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(2.2, 0); fin.lineTo(2.6, 1.4); fin.lineTo(1.6, 1.4); fin.closePath();
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.06, bevelEnabled: false }); fg.rotateY(-Math.PI / 2);
    k.add(fg, panel, sd * 0.5, D + 0.7, 5.6, 0, 0, sd * -0.35);
    k.add(new THREE.BoxGeometry(0.03, 0.03, 9), neon, sd * 1.21, D + 0.45, 1.0);
  });
  const funnels = [-1, 1].map(sd => { const f = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 20), body); f.add(c); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.04, 8, 24), neon); ring.rotation.x = Math.PI / 2; ring.position.y = 0.45; f.add(ring); f.position.set(sd * 0.55, D + 1.15, 6.4); f.rotation.x = 0.4; ship.add(f); return f; });
  // light strips around the hull and a holo-mast
  const dots = []; for (let z = -11; z < 12; z += 0.5) [-1, 1].forEach(sd => dots.push([sd * 1.47, 0.55 + sheer(z) * 0.3, z, sd * Math.PI / 2]));
  k.inst(new THREE.PlaneGeometry(0.28, 0.05), neon, dots);
  k.add(new THREE.CylinderGeometry(0.03, 0.05, 2.4, 8), panel, 0, D + 1.9, -0.5);
  k.add(new THREE.TorusGeometry(0.3, 0.025, 8, 32), pink, 0, D + 3.0, -0.5, Math.PI / 2);
  const glow = new THREE.PointLight(0x3ff7ff, 6, 8, 2); glow.position.set(0, D + 1, 0); ship.add(glow);
  navLights(ship, D + 0.8, -6, 1.3);
  const flag = flagOn(ship, 0, D + 0.5, 13.0, 0x3ff7ff);
  return finish(ship, { funnels, flag, mats: { hull: body, buff: body, dark: panel, white: panel } });
}

export const BUILDERS = { carpathia, lusitania, icebreaker, dreadnought, yacht, cruise, nautilus };
