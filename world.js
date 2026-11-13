// Builds the 3D world: sky, ocean, the Titanic, icebergs, drifting ice, smoke and snow.
import * as THREE from './three.module.min.js';
import { Water } from './Water.js';
import { BUILDERS } from './ships.js';
export { THREE };

export function createWorld(container) {
// Quality tiers: phones start on "mid"; any device that cannot hold a smooth frame rate steps down by itself.
const isPhone = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
let tier = isPhone ? 'mid' : 'high';
const PR = { high: Math.min(devicePixelRatio, 1.5), mid: Math.min(devicePixelRatio, 1.15), low: 0.85 };
const renderer = new THREE.WebGLRenderer({ antialias: !isPhone, powerPreference: 'high-performance' });
renderer.setPixelRatio(PR[tier]);

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = tier === 'high';
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x16304a, 0.0075);
const camera = new THREE.PerspectiveCamera(45, 9 / 16, 0.5, 2000);
camera.position.set(-16, 20, 38);
camera.lookAt(0, 0, -1);

// ---------- sky: gradient dome, stars and moon ----------
const skyGeo = new THREE.SphereGeometry(900, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color(0x030814) }, bottom: { value: new THREE.Color(0x2c4f75) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*2.5,0.,1.); gl_FragColor = vec4(mix(bottom, top, h),1.); }'
});
scene.add(new THREE.Mesh(skyGeo, skyMat));
{
  const n = 1500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = Math.random() * Math.PI * 2, p = Math.random() * 0.5 + 0.05;
    pos.set([Math.cos(t) * Math.cos(p) * 850, Math.sin(p) * 850, Math.sin(t) * Math.cos(p) * 850], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
  // Milky Way: a dense band of faint stars
  const m = 6000, mp = new Float32Array(m * 3), mc = new Float32Array(m * 3);
  for (let i = 0; i < m; i++) {
    const t = Math.random() * Math.PI * 2, band = (Math.random() + Math.random() + Math.random() - 1.5) * 0.18;
    const dir = new THREE.Vector3(Math.cos(t), 0.35 + band + Math.sin(t) * 0.25, Math.sin(t) * 0.6 - 0.4).normalize().multiplyScalar(840);
    if (dir.y < 20) { i--; continue; }
    mp.set([dir.x, dir.y, dir.z], i * 3); const w = 0.6 + Math.random() * 0.4; mc.set([w * 0.9, w * 0.92, w], i * 3);
  }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('color', new THREE.BufferAttribute(mc, 3));
  scene.add(new THREE.Points(mg, new THREE.PointsMaterial({ size: 1.1, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.55, fog: false })));
}
// the SS Californian's lights on the horizon
[[-160, -380], [-150, -381]].forEach(([x, z], i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(i ? 0.9 : 1.3, 8, 8), new THREE.MeshBasicMaterial({ color: i ? 0xff6040 : 0xfff0c0, fog: false })); l.position.set(x, 4 + i * 2, z); scene.add(l); });

const moonDir = new THREE.Vector3(-0.35, 0.45, -1).normalize();
const moon = new THREE.Mesh(new THREE.SphereGeometry(18, 32, 16), new THREE.MeshBasicMaterial({ color: 0xf2f6ff, fog: false }));
moon.position.copy(moonDir).multiplyScalar(800);
// historically accurate: there was no moon that night

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0x9fbfe8, 0x0a1220, 1.1));
const key = new THREE.DirectionalLight(0xdfe9ff, 1.4); key.position.set(-30, 40, 40); scene.add(key);
const moonLight = new THREE.DirectionalLight(0xbcd4ff, 1.6);
moonLight.position.copy(moonDir).multiplyScalar(60);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
Object.assign(moonLight.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 });
scene.add(moonLight);

// ---------- ocean ----------
function waterNormals() {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d'), img = ctx.createImageData(N, N);
  const W = [];
  for (let i = 0; i < 24; i++) W.push([Math.round((Math.random() - .5) * 2 * (2 + i)), Math.round((Math.random() - .5) * 2 * (2 + i)), 1 / (1 + i * 0.6), Math.random() * 6.28]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let dx = 0, dy = 0;
    for (const [fx, fy, a, ph] of W) { const k = (fx * x + fy * y) / N * 6.2832 + ph, cs = Math.cos(k) * a; dx += cs * fx; dy += cs * fy; }
    const s = 0.04, nx = -dx * s, ny = -dy * s, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
    img.data[i] = (nx / l * .5 + .5) * 255; img.data[i + 1] = (ny / l * .5 + .5) * 255; img.data[i + 2] = (nz / l * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const water = new Water(new THREE.PlaneGeometry(2000, 2000), {
  textureWidth: isPhone ? 256 : 512, textureHeight: isPhone ? 256 : 512, waterNormals: waterNormals(),
  sunDirection: moonDir.clone(), sunColor: 0xdbe8ff, waterColor: 0x0b3554, distortionScale: 3.2, fog: true
});
water.rotation.x = -Math.PI / 2;
water.material.uniforms.size.value = 6;
scene.add(water);

// ---------- RMS Titanic ----------
function deckTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 1024; const x = c.getContext('2d');
  x.fillStyle = '#b8955f'; x.fillRect(0, 0, 128, 1024);
  for (let i = 0; i < 128; i += 4) { x.fillStyle = `rgba(80,52,24,${0.15 + Math.random() * 0.2})`; x.fillRect(i, 0, 1, 1024); }
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(60,40,20,${Math.random() * 0.25})`; x.fillRect(Math.floor(Math.random() * 32) * 4, Math.random() * 1024, 4, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function hullTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#121214'; x.fillRect(0, 0, 2048, 256);
  for (let r = 0; r < 256; r += 32) {
    x.fillStyle = r % 64 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.25)'; x.fillRect(0, r, 2048, 32);
    x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, r, 2048, 1);
    for (let p = (r / 32 % 2) * 40; p < 2048; p += 80) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(p, r, 1, 32); }
    for (let p = 0; p < 2048; p += 6) { x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(p, r + 3, 1, 1); }
  }
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(110,60,30,${Math.random() * 0.12})`; x.fillRect(Math.random() * 2048, Math.random() * 256, 2, 6 + Math.random() * 14); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function textTexture(str, color, w = 512, h = 96, font = 'bold 64px Georgia') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.font = font; x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(str, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildTitanic() {
  // Built from the real ship's proportions: 269 m long, 28 m wide.
  const ship = new THREE.Group();
  const L = 26, B = 1.42, HULL = 1.9, DRAFT = 0.75;
  const M = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0.05 }, o));
  const hullTex = hullTexture(); hullTex.repeat.set(0.25, 0.6);
  const black = M({ color: 0xffffff, map: hullTex, roughness: 0.32, metalness: 0.45 });
  const white = M({ color: 0xf2eee3 });
  const buff = M({ color: 0xd7963a, roughness: 0.45 });
  const dark = M({ color: 0x0a0a0a });
  const wood = M({ map: deckTexture(), roughness: 0.85 });
  const red = M({ color: 0x8b1a14 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; ship.add(m); return m; };

  // hull plan: fine bow, long parallel body, rounded counter stern
  const plan = new THREE.Shape();
  plan.moveTo(0, -L / 2);
  plan.bezierCurveTo(B * 0.28, -L / 2 + 1.2, B * 0.95, -L / 2 + 3.6, B, -L / 2 + 6.8);
  plan.lineTo(B, L / 2 - 3.6);
  plan.bezierCurveTo(B, L / 2 - 1.2, B * 0.62, L / 2, 0, L / 2);
  plan.bezierCurveTo(-B * 0.62, L / 2, -B, L / 2 - 1.2, -B, L / 2 - 3.6);
  plan.lineTo(-B, -L / 2 + 6.8);
  plan.bezierCurveTo(-B * 0.95, -L / 2 + 3.6, -B * 0.28, -L / 2 + 1.2, 0, -L / 2);
  const sheer = z => { const u = z / (L / 2); return u < 0 ? 0.55 * u * u * u * u * 1.0 + 0.18 * u * u : 0.22 * u * u * u * u; };
  const shape = (g, full) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i), k = full ? 1 : THREE.MathUtils.clamp(y / HULL, 0, 1); p.setY(i, y + sheer(z) * k); if (z < -L / 2 + 6 && y > 0.2) { const f = 1 + 0.12 * (1 - (z + L / 2) / 6) * THREE.MathUtils.clamp(y / HULL, 0, 1); p.setX(i, p.getX(i) * f); } } g.computeVertexNormals(); return g; };
  const extrude = (h, inset = 1, y0 = 0, full = false) => { const g = new THREE.ExtrudeGeometry(plan, { depth: h, bevelEnabled: false, curveSegments: 48, steps: 1 }); g.rotateX(Math.PI / 2); g.scale(inset, 1, inset); g.translate(0, y0 + h, 0); return y0 >= 0 ? shape(g, full) : g; };

  add(extrude(DRAFT, 0.995, -DRAFT), red, 0, 0, 0);                       // red anti-fouling below the waterline
  add(extrude(HULL, 1, 0), black, 0, 0, 0);                                  // black topsides
  add(extrude(0.06, 1.006, HULL - 0.38, true), white, 0, 0, 0);                    // thin white sheer line
  add(extrude(0.05, 1.008, HULL - 0.26, true), M({ color: 0xd9a441, metalness: 0.7, roughness: 0.3 }), 0, 0, 0);
  add(extrude(0.05, 1.004, -0.02, false), M({ color: 0xf4f1ea }), 0, 0, 0);   // white boot-topping at the waterline    // gilded band
  const deckGeo = new THREE.ShapeGeometry(plan, 48); deckGeo.rotateX(-Math.PI / 2); { const dp = deckGeo.attributes.position; for (let i = 0; i < dp.count; i++) { const z = dp.getZ(i); dp.setY(i, sheer(z)); if (z < -L / 2 + 6) dp.setX(i, dp.getX(i) * (1 + 0.12 * (1 - (z + L / 2) / 6))); } deckGeo.computeVertexNormals(); }
  const uv = deckGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + B) / (2 * B), (uv.getY(i) + L / 2) / L);
  add(deckGeo, wood, 0, HULL + 0.01, 0);
  const D = HULL + 0.01;                                                     // main deck height

  // forecastle and poop deck raised ends
  add(new THREE.BoxGeometry(1.5, 0.3, 2.4), white, 0, D + 0.16 + sheer(-L / 2 + 3.4), -L / 2 + 3.4);
  add(new THREE.BoxGeometry(2.2, 0.32, 2.4), white, 0, D + 0.16 + sheer(L / 2 - 2.0), L / 2 - 2.0);

  // portholes: three rows down each side
  const port = new THREE.InstancedMesh(new THREE.CircleGeometry(0.035, 8), new THREE.MeshBasicMaterial({ color: 0xffd889 }), 1400);
  let n = 0; const o = new THREE.Object3D();
  for (let z = -L / 2 + 3; z < L / 2 - 1.2; z += 0.17) for (const y of [0.55, 0.85, 1.15]) for (const s of [-1, 1]) {
    if (n >= 1400 || Math.random() < 0.12) continue;
    let w = B; if (z < -L / 2 + 6.5) w = B * Math.min(1, (z + L / 2) / 6.5) ** 0.6; if (z > L / 2 - 3.6) w = B * (1 - ((z - (L / 2 - 3.6)) / 3.6) ** 2 * 0.4);
    o.position.set(s * (w + 0.005), y + sheer(z) * (y / HULL), z); o.rotation.set(0, s * Math.PI / 2, 0); o.updateMatrix(); port.setMatrixAt(n++, o.matrix);
  }
  port.count = n; ship.add(port);

  // superstructure decks (A, B and boat deck) with lit promenade windows
  const sx0 = -5.2, sx1 = 7.0, len = sx1 - sx0, mid = (sx0 + sx1) / 2;
  add(new THREE.BoxGeometry(2.5, 0.42, len), white, 0, D + 0.21, mid);
  add(new THREE.BoxGeometry(2.36, 0.4, len - 0.5), white, 0, D + 0.62, mid + 0.1);
  add(new THREE.BoxGeometry(2.6, 0.05, len - 0.2), M({ color: 0xcfc7b4 }), 0, D + 0.84, mid + 0.05);   // boat deck floor
  const win = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.13), new THREE.MeshBasicMaterial({ color: 0xffd27a }), 600);
  n = 0;
  for (let z = sx0 + 0.2; z < sx1 - 0.2; z += 0.19) for (const [y, w] of [[D + 0.24, 1.255], [D + 0.64, 1.185]]) for (const s of [-1, 1]) {
    o.position.set(s * w, y, z); o.rotation.set(0, s * Math.PI / 2, 0); o.updateMatrix(); win.setMatrixAt(n++, o.matrix);
  }
  win.count = n; ship.add(win);

  // officers' quarters, bridge with wings, wheelhouse
  add(new THREE.BoxGeometry(1.5, 0.36, 2.2), white, 0, D + 1.02, sx0 + 1.3);
  add(new THREE.BoxGeometry(2.9, 0.08, 0.5), white, 0, D + 1.18, sx0 + 0.25);
  add(new THREE.BoxGeometry(1.2, 0.3, 0.45), white, 0, D + 1.36, sx0 + 0.4);
  const glass = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }), 12);
  for (let i = 0; i < 12; i++) { o.position.set(-0.55 + i * 0.1, D + 1.38, sx0 + 0.17); o.rotation.set(0, Math.PI, 0); o.updateMatrix(); glass.setMatrixAt(i, o.matrix); }
  ship.add(glass);
  // deckhouses between funnels, grand staircase dome
  [[0.3, 1.1], [2.9, 1.0], [5.6, 1.2]].forEach(([z, l]) => add(new THREE.BoxGeometry(1.2, 0.28, l), white, 0, D + 1.0, z));
  add(new THREE.SphereGeometry(0.26, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M({ color: 0x8fc7d6, roughness: 0.15, metalness: 0.4, emissive: 0x3a5a40, emissiveIntensity: 0.6 }), 0, D + 0.86, -1.3);

  // four raked elliptical funnels: buff with black tops, steam pipes and stay wires
  const funnels = [];
  [-2.6, 0.0, 2.6, 5.2].forEach((z, i) => {
    const f = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 2.6, 32), buff); body.scale.z = 1.35; body.castShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.415, 0.415, 0.55, 32), dark); top.scale.z = 1.35; top.position.y = 1.03;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.025, 6, 32), dark); rim.rotation.x = Math.PI / 2; rim.scale.y = 1.35; rim.position.y = 1.3;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.38, 24), new THREE.MeshBasicMaterial({ color: 0x030303 })); hole.rotation.x = -Math.PI / 2; hole.scale.y = 1.35; hole.position.y = 1.29;
    [-0.15, 0.15].forEach(dx => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.75, 8), buff); p.position.set(dx, 0.08, -0.55); f.add(p); });
    f.add(body, top, rim, hole);
    f.position.set(0, D + 0.86 + 1.3, z); f.rotation.x = 0.17; ship.add(f); funnels.push(f);
  });

  // cowl ventilators around the funnels
  const cowlGeo = new THREE.TorusGeometry(0.08, 0.035, 8, 12, Math.PI / 2);
  [[-3.6], [-1.3], [1.3], [3.9], [6.4]].forEach(([z]) => [-0.85, 0.85].forEach(x => {
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), buff, x, D + 0.97, z);
    add(cowlGeo, buff, x, D + 1.08, z + 0.04, 0, Math.PI / 2, 0);
  }));

  // lifeboats hanging from davits, two groups each side
  const boatGeo = new THREE.CapsuleGeometry(0.09, 0.42, 4, 10); boatGeo.rotateX(Math.PI / 2); boatGeo.scale(1, 0.75, 1);
  const davit = new THREE.TorusGeometry(0.12, 0.012, 6, 10, Math.PI / 2);
  [-4.7, -4.15, -3.6, -3.05, 3.8, 4.35, 4.9, 5.45].forEach(z => [-1, 1].forEach(s => {
    add(boatGeo, white, s * 1.2, D + 1.0, z);
    add(new THREE.BoxGeometry(0.1, 0.015, 0.44), M({ color: 0x6b4a26 }), s * 1.2, D + 1.05, z);
    [-0.22, 0.22].forEach(dz => add(davit, dark, s * 1.13, D + 0.96, z + dz, 0, s > 0 ? 0 : Math.PI, Math.PI / 2));
  }));

  // railings along the boat deck and main deck
  const railMat = new THREE.LineBasicMaterial({ color: 0xe8e2d4, transparent: true, opacity: 0.8 });
  const railPts = [];
  [[1.3, D + 0.98, sx0, sx1], [-1.3, D + 0.98, sx0, sx1]].forEach(([x, y, z0, z1]) => { railPts.push(x, y, z0, x, y, z1); for (let z = z0; z < z1; z += 0.25) railPts.push(x, y, z, x, y - 0.12, z); });
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(railPts, 3));
  ship.add(new THREE.LineSegments(rg, railMat));

  // well-deck cargo cranes and hatches
  [[-L / 2 + 5.4], [-L / 2 + 6.6], [L / 2 - 4.4], [L / 2 - 5.4]].forEach(([z]) => {
    add(new THREE.BoxGeometry(0.5, 0.06, 0.45), M({ color: 0x4a3622 }), 0, D + 0.03, z);
    [-0.6, 0.6].forEach(x => { add(new THREE.CylinderGeometry(0.035, 0.04, 0.4, 8), white, x, D + 0.2, z); add(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), dark, x * 0.7, D + 0.42, z, 0, 0, x > 0 ? 0.9 : -0.9); });
  });

  // masts with crow's nest, docking bridge, aerial wires
  const mastMat = M({ color: 0x8a6a45 });
  add(new THREE.CylinderGeometry(0.035, 0.06, 6.2, 8), mastMat, 0, D + 3.1, -L / 2 + 6.0, -0.09);
  add(new THREE.CylinderGeometry(0.035, 0.06, 5.6, 8), mastMat, 0, D + 2.8, L / 2 - 5.0, -0.09);
  add(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 12), mastMat, 0, D + 2.3, -L / 2 + 5.82);
  add(new THREE.BoxGeometry(2.7, 0.05, 0.22), white, 0, D + 0.75, L / 2 - 1.4);
  const wire = new THREE.LineBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.7 });
  const wpts = [];
  const foreTop = [0, D + 6.1, -L / 2 + 5.45], mainTop = [0, D + 5.5, L / 2 - 5.5];
  wpts.push(...foreTop, ...mainTop, ...foreTop, 0, D + 0.3, -L / 2 + 0.4, ...mainTop, 0, D + 0.3, L / 2 - 0.3);
  [-1, 1].forEach(s => { for (let k = 0; k < 4; k++) wpts.push(...foreTop, s * B * 0.95, D, -L / 2 + 5 + k * 0.35); for (let k = 0; k < 4; k++) wpts.push(...mainTop, s * B * 0.95, D, L / 2 - 5.4 + k * 0.35); });
  funnels.forEach(f => [-1, 1].forEach(s => wpts.push(0, D + 2.7, f.position.z - 0.2, s * 1.25, D + 0.9, f.position.z)));
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wpts, 3));
  ship.add(new THREE.LineSegments(wg, wire));


  // ship's name on both sides of the bow, anchors
  const nameMat = new THREE.MeshBasicMaterial({ map: textTexture('TITANIC', '#e8c25a'), transparent: true });
  [-1, 1].forEach(s => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), nameMat);
    p.position.set(s * 0.62, HULL - 0.55, -L / 2 + 1.9); p.rotation.y = s * (Math.PI / 2 - 0.42); ship.add(p);
    const anc = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 10, Math.PI), dark);
    anc.position.set(s * 0.52, HULL - 0.35, -L / 2 + 1.25); anc.rotation.set(Math.PI, s * (Math.PI / 2 - 0.5), 0); ship.add(anc);
  });

  // navigation lights: red to port, green to starboard
  [[-1, 0xff3030], [1, 0x30ff60]].forEach(([s, c]) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: c }));
    l.position.set(s * 1.45, D + 1.2, sx0 + 0.25); ship.add(l);
    const pl = new THREE.PointLight(c, 1.5, 3, 2); pl.position.copy(l.position); ship.add(pl);
  });

  // passengers strolling the boat deck and promenade
  const people = new THREE.Group();
  const coat = [0x1c1c22, 0x2b2620, 0x3a2f45, 0x5a1f1f, 0x1f2f45, 0xd9d2c2];
  for (let i = 0; i < 40; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 3, 6), M({ color: coat[i % coat.length] }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), M({ color: 0xe0b48f }));
    head.position.y = 0.13; g.add(body, head);
    if (i % 3 === 0) { const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.04, 8), M({ color: 0x111111 })); hat.position.y = 0.17; g.add(hat); }
    const onBoat = i < 40;
    g.position.set((Math.random() < 0.5 ? -1 : 1) * (onBoat ? 0.9 + Math.random() * 0.3 : 1.33), onBoat ? D + 0.95 : D + 0.12, sx0 + 0.5 + Math.random() * (len - 1));
    g.userData = { speed: (Math.random() - 0.5) * 0.4, z0: sx0 + 0.5, z1: sx1 - 0.5 };
    people.add(g);
  }
  ship.add(people); ship.userData.people = people;

  // deck benches and skylights
  for (let z = sx0 + 1; z < sx1 - 0.5; z += 0.9) [-0.75, 0.75].forEach(x => add(new THREE.BoxGeometry(0.06, 0.05, 0.3), M({ color: 0x6b4a26 }), x, D + 0.9, z));
  [[-0.4, 1.6], [0.4, 1.6], [0, 4.2]].forEach(([x, z]) => add(new THREE.BoxGeometry(0.3, 0.1, 0.45), M({ color: 0x9fd0dc, roughness: 0.2, metalness: 0.5, emissive: 0x403010, emissiveIntensity: 0.8 }), x, D + 0.92, z));

  // flags: red ensign at the stern, White Star pennant on the mainmast
  const ens = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.28, 8, 1), M({ color: 0xb3202a, side: THREE.DoubleSide }));
  ens.position.set(0, D + 0.75, L / 2 + 0.05); ens.rotation.y = Math.PI / 2; ship.add(ens); ship.userData.flag = ens;
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), mastMat, 0, D + 0.5, L / 2 - 0.15);

  // lights: deck glow, masthead lamp, searchlight ahead
  const lamp = new THREE.PointLight(0xffcf8a, 5, 9, 2); lamp.position.set(0, D + 1.4, 1); ship.add(lamp);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); head.position.set(0, D + 5.4, -L / 2 + 5.6); ship.add(head);
  const spot = new THREE.SpotLight(0xfff2d0, 70, 70, 0.3, 0.6, 1.2); spot.position.set(0, D + 1.5, sx0); spot.target.position.set(0, 0, -45); ship.add(spot, spot.target);

  ship.userData.funnels = funnels;
  ship.userData.mats = { hull: black, buff, dark, white };
  return ship;
}
function applyTierTo(root) { root.traverse(o => { if (o.isPointLight) o.visible = tier === 'high'; }); }
// the ship on the water is a wrapper; the Shipyard swaps the model inside it
const ship = new THREE.Group();
ship.position.set(0, -0.05, 10);
scene.add(ship);
const shipKit = { hullTexture, deckTexture, textTexture };
const buildModel = id => (id && BUILDERS[id]) ? BUILDERS[id](shipKit) : buildTitanic();
function mergeStatic(root, keep) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), gone = [];
  const skip = o => { for (let p = o; p && p !== root; p = p.parent) if (keep.has(p)) return true; return false; };
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSprite || skip(o) || Array.isArray(o.material) || o.material.transparent) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, uv = g.attributes.uv ? g.attributes.uv.array : new Float32Array(n * 2);
    const m = o.material, named = Object.values(root.userData.mats || {}).includes(m);   // liveried materials stay their own group
    const key = named ? m.uuid : [m.type, m.color && m.color.getHex(), m.roughness, m.metalness, m.map && m.map.uuid, m.emissive && m.emissive.getHex(), m.emissiveIntensity, m.side].join('|');
    const e = groups.get(key) || { mat: m, pos: [], nor: [], uv: [], n: 0 };
    e.pos.push(g.attributes.position.array); e.nor.push(g.attributes.normal.array); e.uv.push(uv); e.n += n; groups.set(key, e); gone.push(o);
  });
  gone.forEach(o => o.parent.remove(o));
  const cat = (list, size, n) => { const out = new Float32Array(n * size); let k = 0; list.forEach(a => { out.set(a, k); k += a.length; }); return out; };
  groups.forEach(e => { const mat = e.mat;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(cat(e.pos, 3, e.n), 3)); g.setAttribute('normal', new THREE.BufferAttribute(cat(e.nor, 3, e.n), 3)); g.setAttribute('uv', new THREE.BufferAttribute(cat(e.uv, 2, e.n), 2));
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; root.add(m);
  });
}
let model = null;
function setShipModel(id) {
  if (model) { ship.remove(model); model.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  model = buildModel(id);
  // funnels become empty markers (the smoke only needs their position); the flag and radar stay separate so they can move
  const marks = (model.userData.funnels || []).map(f => { const o = new THREE.Object3D(); f.updateMatrixWorld(true); o.position.copy(f.position); o.rotation.copy(f.rotation); return o; });
  mergeStatic(model, new Set([model.userData.flag, model.userData.spin].filter(Boolean)));
  marks.forEach(o => model.add(o)); model.userData.funnels = marks; model.userData.people = new THREE.Group();
  ship.add(model);
  Object.assign(ship.userData, model.userData); ship.userData.spin = model.userData.spin || null;
  applyTierTo(model);
}
setShipModel('titanic');
// small studio renders of each ship for the Shipyard cards.
// Drawn with the game's own renderer into an off-screen target: a second WebGL context can make phones drop the first one and freeze the game.
const thumbCache = {}; let thumbRT = null, thumbCv = null;
function shipThumb(id) {
  if (thumbCache[id] !== undefined) return thumbCache[id];
  const TW = 360, TH = 200;
  try {
    thumbRT = thumbRT || new THREE.WebGLRenderTarget(TW, TH);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xcfe3ff, 0x223044, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(-10, 14, -6); sc.add(d);
    const m = buildModel(id); sc.add(m);
    const cam = new THREE.PerspectiveCamera(30, TW / TH, 0.5, 200); cam.position.set(-24, 9, -17); cam.lookAt(0, 1.6, 1);
    const prevRT = renderer.getRenderTarget(), prevA = renderer.getClearAlpha(), prevSh = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false; renderer.setRenderTarget(thumbRT); renderer.setClearAlpha(0); renderer.clear(); renderer.render(sc, cam);
    const px = new Uint8Array(TW * TH * 4); renderer.readRenderTargetPixels(thumbRT, 0, 0, TW, TH, px);
    renderer.setRenderTarget(prevRT); renderer.setClearAlpha(prevA); renderer.shadowMap.enabled = prevSh;
    thumbCv = thumbCv || Object.assign(document.createElement('canvas'), { width: TW, height: TH });
    const ctx = thumbCv.getContext('2d'), img = ctx.createImageData(TW, TH), lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.min(255, Math.pow(Math.min(1, i / 255 * 1.5), 1 / 2.2) * 255);   // linear -> sRGB with a little lift
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) { const si = ((TH - 1 - y) * TW + x) * 4, di = (y * TW + x) * 4; img.data[di] = lut[px[si]]; img.data[di + 1] = lut[px[si + 1]]; img.data[di + 2] = lut[px[si + 2]]; img.data[di + 3] = px[si + 3]; }
    ctx.putImageData(img, 0, 0); thumbCache[id] = thumbCv.toDataURL('image/png');
    m.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  } catch (e) { thumbCache[id] = ''; }
  return thumbCache[id];
}

// ---------- icebergs ----------
const icebergMaterial = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, flatShading: true, emissive: 0x2a7fa0, emissiveIntensity: 0.25 });
function iceberg(seed, r) {
  const g = new THREE.IcosahedronGeometry(r, 3);
  const p = g.attributes.position, v = new THREE.Vector3();
  const hash = (x, y, z) => { const q = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.3) * 43758.5453; return q - Math.floor(q); };
  const noise = (x, y, z) => { // smooth value noise
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    const l = (a, b, t) => a + (b - a) * t * t * (3 - 2 * t);
    const c = (dx, dy, dz) => hash(ix + dx, iy + dy, iz + dz);
    return l(l(l(c(0,0,0), c(1,0,0), fx), l(c(0,1,0), c(1,1,0), fx), fy), l(l(c(0,0,1), c(1,0,1), fx), l(c(0,1,1), c(1,1,1), fx), fy), fz);
  };
  const peak = 1.2 + hash(1, 2, 3) * 0.9;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.clone().normalize();
    let n = 0, f = 1.2, a = 0.5;
    for (let o = 0; o < 4; o++) { n += (noise(d.x * f + 9, d.y * f + 3, d.z * f) - 0.5) * a; f *= 2.1; a *= 0.5; }
    v.multiplyScalar(1 + n * 0.9);
    v.y = v.y > 0 ? v.y * peak : v.y * 0.6;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // colours: bright snow on top, glacial blue in crevices and near the water
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, ny = g.attributes.normal.getY(i);
    const snow = THREE.MathUtils.clamp(ny * 0.8 + y / (r * peak) * 0.4, 0, 1);
    const k = hash(i, 7, 1) * 0.06;
    const c = new THREE.Color().setRGB(0.62 + snow * 0.36 + k, 0.82 + snow * 0.17 + k, 0.92 + snow * 0.08);
    if (y < 0.25) c.lerp(new THREE.Color(0x5fc9d8), 0.5);
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = icebergMaterial;
  const mesh = new THREE.Mesh(g, mat); mesh.castShadow = mesh.receiveShadow = true;
  // the much bigger part hidden under the water
  const ghost = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.7, 1), new THREE.MeshBasicMaterial({ color: 0x3fb8cc, transparent: true, opacity: 0.16, depthWrite: false }));
  ghost.scale.y = 0.35; ghost.position.y = -0.6;
  // foam ring at the waterline
  const foam = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r * 1.25, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.06;
  const grp = new THREE.Group(); grp.add(ghost, mesh, foam); return grp;
}
// ---------- loose ice drifting on the water ----------
const growlers = [];
for (let i = 0; i < 70; i++) {
  const gm = new THREE.Object3D(), sc = 0.5 + Math.random() * 1.2;
  gm.position.set((Math.random() - 0.5) * 70, 0.02, -140 + Math.random() * 170); gm.scale.set(sc, sc * 0.45, sc); gm.rotation.y = Math.random() * 6;
  gm.userData.ph = Math.random() * 6; growlers.push(gm);
}
const growlerMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: 0xe8f6ff, roughness: 0.4, flatShading: true }), growlers.length);
growlerMesh.frustumCulled = false; scene.add(growlerMesh);

// ---------- wake and bow wave foam ----------
const foamPts = 900, foamPos = new Float32Array(foamPts * 3), foamLife = new Float32Array(foamPts);
for (let i = 0; i < foamPts; i++) foamLife[i] = Math.random();
const foamGeo = new THREE.BufferGeometry(); foamGeo.setAttribute('position', new THREE.BufferAttribute(foamPos, 3));
const foamMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.5, depthWrite: false }); const foamPoints = new THREE.Points(foamGeo, foamMat); scene.add(foamPoints);

// ---------- smoke and snow ----------
const puffTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
foamMat.map = puffTex; foamMat.needsUpdate = true;
const smoke = [];
for (let i = 0; i < (isPhone ? 24 : 60); i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0x9aa0aa, transparent: true, depthWrite: false }));
  s.userData = { f: i % 3, life: Math.random() }; scene.add(s); smoke.push(s);
}
const snowN = isPhone ? 500 : 1200, snowPos = new Float32Array(snowN * 3);
for (let i = 0; i < snowN; i++) snowPos.set([(Math.random() - .5) * 120, Math.random() * 50, (Math.random() - .5) * 120], i * 3);
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snowPoints = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.75, map: puffTex, depthWrite: false })); scene.add(snowPoints);

function update(t) {
  water.material.uniforms.time.value = t * 0.6;
  ship.position.y = -0.05 + Math.sin(t * 0.8) * 0.05;
  ship.rotation.z = Math.sin(t * 0.6) * 0.012;
  growlers.forEach((gm, i) => { gm.position.y = Math.sin(t + gm.userData.ph) * 0.03; gm.updateMatrix(); growlerMesh.setMatrixAt(i, gm.matrix); }); growlerMesh.instanceMatrix.needsUpdate = true;
  if (ship.userData.spin) ship.userData.spin.rotation.y = t * 2.5;
  (ship.userData.people ? ship.userData.people.children : []).forEach(pp => { pp.position.z += pp.userData.speed * 0.016; if (pp.position.z < pp.userData.z0 || pp.position.z > pp.userData.z1) pp.userData.speed *= -1; });
  const fl = ship.userData.flag.geometry.attributes.position; for (let i = 0; i < fl.count; i++) fl.setZ(i, Math.sin(t * 6 + fl.getX(i) * 9) * 0.04 * (fl.getX(i) + 0.25)); fl.needsUpdate = true;
  const fp = foamGeo.attributes.position;
  for (let i = 0; i < foamPts; i++) {
    foamLife[i] += 0.006; if (foamLife[i] > 1) foamLife[i] = 0;
    const L = foamLife[i], side = i % 2 ? 1 : -1, bow = i % 5 === 0;
    if (bow) fp.setXYZ(i, ship.position.x + side * (0.2 + L * 2.2), 0.05, ship.position.z - 13 + L * 3 + Math.sin(i) * 0.2);
    else fp.setXYZ(i, ship.position.x + side * (1.4 + L * 4 + Math.sin(i * 3.7) * 0.4), 0.05, ship.position.z - 6 + L * 34 + Math.cos(i) * 0.5);
  }
  fp.needsUpdate = true;
  smoke.forEach(s => {
    s.userData.life = (s.userData.life + 0.004) % 1;
    const fs = ship.userData.funnels, f = fs[s.userData.f % fs.length], L = s.userData.life;
    s.visible = s.userData.f < fs.length || fs.length > 1;
    const wp = new THREE.Vector3(); f.getWorldPosition(wp);
    s.position.set(wp.x + L * 2, wp.y + 1.5 + L * 3, wp.z + L * 7);
    s.scale.setScalar(0.5 + L * 3.2); s.material.opacity = (1 - L) * 0.32;
  });
  const sp = snowGeo.attributes.position;
  for (let i = 0; i < snowN; i++) { let y = sp.getY(i) - 0.05; if (y < 0) y = 50; sp.setY(i, y); }
  sp.needsUpdate = true;
}

  const icebergGeos = [0, 1, 2, 3].map(k => iceberg(k + 1, [1.6, 2.0, 1.3, 1.8][k]));
  function makeIceberg(k) { const g = icebergGeos[k % 4].clone(true); scene.add(g); return g; }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  }
  addEventListener('resize', resize); resize();

  function setQuality(q) {
    if (!PR[q] || q === tier) return;
    tier = q; renderer.setPixelRatio(PR[q]); renderer.shadowMap.enabled = q === 'high';
    icebergMaterial.clearcoat = q === 'high' ? 0.6 : 0;
    applyTierTo(scene);
    scene.traverse(o => { if (o.material && o.material.isMaterial) o.material.needsUpdate = true; });
    resize();
  }
  icebergMaterial.clearcoat = tier === 'high' ? 0.6 : 0;
  // the ocean's mirror pass draws the whole world a second time: skip small things in it, and refresh it less often on weaker tiers
  const mirrorHide = [growlerMesh, foamPoints, snowPoints, ...smoke];
  const mirror = water.onBeforeRender.bind(water); let mirrorFrame = 0;
  water.onBeforeRender = function (r, sc, cam) {
    const every = tier === 'high' ? 1 : tier === 'mid' ? 2 : 6;
    if (mirrorFrame++ % every) return;
    mirrorHide.forEach(o => { o.userData.v = o.visible; o.visible = false; });
    mirror(r, sc, cam);
    mirrorHide.forEach(o => { o.visible = o.userData.v; });
  };
  return { THREE, renderer, scene, camera, water, ship, makeIceberg, update, puffTex, growlers, icebergMaterial, setQuality, setShipModel, shipThumb, isPhone, tier: () => tier };
}
