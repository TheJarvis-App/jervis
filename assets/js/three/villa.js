// "Building in Blender" (next release): a modern two-storey villa with a swimming pool, assembled piece by piece as you
// scroll, next to the requests that build it. It is recreated for this page from Jarvis's own Blender building kit
// (blender_assets.py), with its numbers: the 'modern' house is 9 x 7 m, two 3.1 m storeys on a 0.25 m concrete plinth,
// walls #e8e6e1, a flat concrete roof and near-black frames round 1.9 x 2.1 m windows (three across the front, the door
// in the middle); the pool is 8 x 4 m and 1.5 m deep, tiled, with a 1.2 m deck, a stone coping and a steel ladder;
// the loungers are 2 x 0.7 m in light wood with cream cushions; the trees are oaks of about 6.5 m.
//
// A daylit architectural model floating in the page's night: one warm sun with soft shadows, a cool sky, a studio for
// the glass and the water to reflect. Drag to look around it.
import { THREE, makeRenderer, fit, loop, lowPower, ease } from './kit.js';

const C = {
  walls: 0xe8e6e1, concrete: 0x9b9a95, trim: 0x111114, glass: 0x22384a, door: 0x3b2a1f, deck: 0xd2cabd, coping: 0xe9e4da,
  tiles: 0x5fb7cc, water: 0x3cc4e2, lawn: 0x5b7f4a, base: 0x141b28, wood: 0xc9a173, cushion: 0xf2efe6, bark: 0x5b4330, leaves: 0x55823d, steel: 0xc8ced6,
};

export function startVilla(root, { still = false } = {}) {
  const stage = root.querySelector('.build-stage');
  const view = root.querySelector('.build-view');
  const steps = [...root.querySelectorAll('.build-step')];
  const canvas = document.createElement('canvas');
  canvas.className = 'build-canvas';
  view.append(canvas);
  let renderer;
  try { renderer = makeRenderer(canvas, { shadows: true }); } catch { canvas.remove(); return null; }
  root.classList.add('is-3d');

  const scene = new THREE.Scene();
  scene.environment = daySky(renderer);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200);
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.1);
  sun.position.set(-14, 22, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(lowPower ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 70 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  const sky = new THREE.HemisphereLight(0xa9d0ff, 0x2a3424, 0.9);
  scene.add(sun, sky);

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
  const M = {
    walls: mat(C.walls), concrete: mat(C.concrete, { roughness: 0.92 }), trim: mat(C.trim, { roughness: 0.5, metalness: 0.4 }),
    glass: mat(0x3a5568, { roughness: 0.06, metalness: 0.9, envMapIntensity: 1.2 }), door: mat(C.door, { roughness: 0.6 }),
    deck: mat(C.deck, { roughness: 0.95 }), coping: mat(C.coping, { roughness: 0.8 }), tiles: mat(C.tiles, { roughness: 0.35 }),
    water: new THREE.MeshStandardMaterial({ color: C.water, emissive: 0x0b5a70, emissiveIntensity: 0.35, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.9, envMapIntensity: 1.3 }),
    lawn: mat(C.lawn, { roughness: 1 }), base: mat(C.base, { roughness: 0.7, metalness: 0.2 }), wood: mat(C.wood, { roughness: 0.7 }),
    cushion: mat(C.cushion, { roughness: 0.95 }), bark: mat(C.bark), leaves: mat(C.leaves, { roughness: 0.9, flatShading: true }),
    steel: mat(C.steel, { roughness: 0.25, metalness: 1 }),
  };
  const SMALL = new Set([M.glass, M.trim, M.door, M.coping, M.cushion, M.steel]);
  const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    // shadows only from the parts big enough to throw one (ui-ux-pro-max, Three.js: selective shadow casting)
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = !SMALL.has(m) && Math.max(w, h, d) > 0.6; mesh.receiveShadow = true;
    parent?.add(mesh); return mesh;
  };
  const part = () => { const g = new THREE.Group(); scene.add(g); return g; };


  // ---------- the house: W 9 (x), D 7 (z), front toward +z ----------
  const W = 9, D = 7, FH = 3.1, P = 0.25;
  const plinth = part(); box(W + 0.5, P, D + 0.5, M.concrete, 0, 0, 0, plinth);
  const floors = [0, 1].map((f) => {
    const g = part(), y0 = P + f * FH;
    box(W, FH, D, M.walls, 0, y0, 0, g);
    box(W + 0.12, 0.18, D + 0.12, M.concrete, 0, y0 + FH - 0.18, 0, g);   // the floor slab edge, a modern line
    // windows: three across the front (the door takes the middle one downstairs), three across the back, one each side
    const win = (x, z, rotY, w = 1.9, h = 2.1, sill = 0.5, isDoor = false) => {
      const frame = new THREE.Group(); frame.position.set(x, y0 + sill, z); frame.rotation.y = rotY; g.add(frame);
      box(w + 0.16, h + 0.16, 0.08, M.trim, 0, -0.08, 0.02, frame);
      box(w, h, 0.1, isDoor ? M.door : M.glass, 0, 0, 0.05, frame);
      if (!isDoor) box(0.05, h, 0.12, M.trim, 0, 0, 0.06, frame);   // a mullion
      return frame;
    };
    const span = W - 1.2, cols = [-span / 3, 0, span / 3];
    cols.forEach((x, i) => { if (f === 0 && i === 1) win(x, D / 2 + 0.01, 0, 1.0, 2.15, 0, true); else win(x, D / 2 + 0.01, 0); });
    cols.forEach((x) => win(x, -D / 2 - 0.01, Math.PI));
    win(W / 2 + 0.01, 0, Math.PI / 2); win(-W / 2 - 0.01, 0, -Math.PI / 2);
    return g;
  });
  const roof = part();
  box(W + 0.6, 0.3, D + 0.6, M.concrete, 0, P + 2 * FH, 0, roof);
  box(W + 0.6, 0.35, 0.12, M.concrete, 0, P + 2 * FH + 0.3, D / 2 + 0.24, roof);   // a low parapet at the front edge

  // ---------- the pool: L 8 (x) x 4 (z), 1.5 deep, deck 1.2, in front of the house ----------
  const L = 8, PW = 4, DP = 1.5, DW = 1.2, CO = 0.25, pz = D / 2 + 2.2 + PW / 2 + DW;
  const deck = part(), basin = part(), water = part();
  const outer = { w: L + 2 * (DW + CO), d: PW + 2 * (DW + CO) };
  // ---------- the plot: a model base with a lawn, open where the pool is sunk into it ----------
  const plot = part();
  const around = (m, y, h, o, hole) => {   // a slab over rectangle o with rectangle hole cut out, as four pieces
    const pieces = [[o.x0, o.x1, o.z0, hole.z0], [o.x0, o.x1, hole.z1, o.z1], [o.x0, hole.x0, hole.z0, hole.z1], [hole.x1, o.x1, hole.z0, hole.z1]];
    for (const [x0, x1, z0, z1] of pieces) if (x1 > x0 && z1 > z0) box(x1 - x0, h, z1 - z0, m, (x0 + x1) / 2, y, (z0 + z1) / 2, plot);
  };
  const hole = { x0: -outer.w / 2, x1: outer.w / 2, z0: pz - outer.d / 2, z1: pz + outer.d / 2 };
  around(M.base, -1.75, 1.69, { x0: -15, x1: 15, z0: -10.5, z1: 15.5 }, hole);
  around(M.lawn, -0.06, 0.06, { x0: -14.7, x1: 14.7, z0: -10.2, z1: 15.2 }, hole);
  box(outer.w, 0.2, outer.d, M.base, 0, -1.75, pz, plot);   // the base closes under the basin

  // the deck as four slabs round the opening (so you can look down into the basin)
  box(outer.w, 0.12, DW + CO, M.deck, 0, 0, pz - PW / 2 - (DW + CO) / 2, deck);
  box(outer.w, 0.12, DW + CO, M.deck, 0, 0, pz + PW / 2 + (DW + CO) / 2, deck);
  box(DW + CO, 0.12, PW, M.deck, -L / 2 - (DW + CO) / 2, 0, pz, deck);
  box(DW + CO, 0.12, PW, M.deck, L / 2 + (DW + CO) / 2, 0, pz, deck);
  for (const [w, d, x, z] of [[L + 0.5, 0.25, 0, pz - PW / 2 - 0.125], [L + 0.5, 0.25, 0, pz + PW / 2 + 0.125], [0.25, PW, -L / 2 - 0.125, pz], [0.25, PW, L / 2 + 0.125, pz]]) box(w, 0.06, d, M.coping, x, 0.12, z, deck);
  box(L, 0.1, PW, M.tiles, 0, -DP, pz, basin);                                    // the floor
  for (const [w, d, x, z] of [[L, 0.1, 0, pz - PW / 2], [L, 0.1, 0, pz + PW / 2], [0.1, PW, -L / 2, pz], [0.1, PW, L / 2, pz]]) box(w, DP, d, M.tiles, x, -DP, z, basin);
  const waterGeo = new THREE.PlaneGeometry(L - 0.12, PW - 0.12, lowPower ? 24 : 48, lowPower ? 12 : 24);
  const waterMesh = new THREE.Mesh(waterGeo, M.water);
  waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.set(0, -0.12, pz); waterMesh.receiveShadow = true;
  water.add(waterMesh);
  const ladder = new THREE.Group(); ladder.position.set(L / 2 - 0.9, 0, pz - PW / 2 + 0.15); basin.add(ladder);
  for (const x of [-0.25, 0.25]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 8, 24, Math.PI), M.steel);
    rail.rotation.y = Math.PI / 2; rail.position.set(x, 0.12, 0.2); rail.castShadow = true; ladder.add(rail);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3), M.steel); leg.position.set(x, -0.5, 0.55); ladder.add(leg);
  }

  // ---------- two sun loungers on the deck, facing the water ----------
  const loungers = [-1.6, 1.6].map((x) => {
    const g = part(); g.position.set(x, 0.12, pz + PW / 2 + 0.75); g.rotation.y = Math.PI;
    const bed = new THREE.Group(); g.add(bed);
    box(0.7, 0.06, 1.4, M.wood, 0, 0.3, 0.2, bed); box(0.62, 0.08, 1.35, M.cushion, 0, 0.36, 0.2, bed);
    const head = new THREE.Group(); head.position.set(0, 0.36, -0.5); head.rotation.x = -0.75; g.add(head);
    box(0.7, 0.06, 0.65, M.wood, 0, 0, -0.32, head); box(0.62, 0.08, 0.6, M.cushion, 0, 0.06, -0.32, head);
    for (const [lx, lz] of [[-0.3, 0.8], [0.3, 0.8], [-0.3, -0.5], [0.3, -0.5]]) box(0.05, 0.3, 0.05, M.wood, lx, 0, lz, g);
    return g;
  });

  // ---------- an oak on each side ----------
  const oak = (x, z, seed) => {
    const g = part(); g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 10), M.bark);
    trunk.position.y = 1.6; trunk.castShadow = true; g.add(trunk);
    const rand = (i) => { const v = Math.sin(seed * 91.7 + i * 12.9898) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 7; i++) {
      const r = 1.1 + rand(i) * 0.7;
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M.leaves);
      leaf.position.set((rand(i + 10) - 0.5) * 2.2, 3.6 + rand(i + 20) * 2.1, (rand(i + 30) - 0.5) * 2.2);
      leaf.castShadow = true; leaf.receiveShadow = true; g.add(leaf);
    }
    return g;
  };
  const trees = [oak(-W / 2 - 4.2, -0.5, 1), oak(W / 2 + 4.2, 1.2, 2)];
  // a paved path from the door to the pool deck
  const path = part();
  box(1.4, 0.05, 2.2, M.deck, 0, 0, D / 2 + 1.1, path);

  // ---------- the build, step by step ----------
  // each piece: when it appears (fractions of the scroll through the section) and how it arrives
  // rise from a base height: a point at height y sits at base + (y - base) * k
  const rise = (g, base = 0) => (k) => { const s = Math.max(0.001, k); g.scale.y = s; g.position.y = base * (1 - s); g.visible = k > 0.001; };
  const drop = (g, from = 3) => { const y0 = g.position.y; return (k) => { g.position.y = y0 + (1 - k) * from; g.visible = k > 0.001; }; };
  const grow = (g) => (k) => { g.scale.setScalar(Math.max(0.001, k)); g.visible = k > 0.001; };
  const sink = (g) => (k) => { g.position.y = -(1 - k) * 0.01; g.scale.y = Math.max(0.001, k); g.visible = k > 0.001; };
  const fill = (g) => (k) => { g.position.y = -(1 - k) * 1.35; g.visible = k > 0.02; };
  const PIECES = [
    { step: 0, at: [0.0, 0.07], set: grow(plot) },
    { step: 0, at: [0.06, 0.12], set: rise(plinth) },
    { step: 0, at: [0.1, 0.24], set: rise(floors[0], P) },
    { step: 0, at: [0.2, 0.34], set: rise(floors[1], P + FH) },
    { step: 0, at: [0.3, 0.4], set: drop(roof, 2.5) },
    { step: 0, at: [0.34, 0.42], set: rise(path) },
    { step: 1, at: [0.42, 0.5], set: sink(basin) },
    { step: 1, at: [0.46, 0.54], set: rise(deck) },
    { step: 1, at: [0.52, 0.62], set: fill(water) },
    { step: 2, at: [0.62, 0.69], set: drop(loungers[0], 1.6) },
    { step: 2, at: [0.66, 0.73], set: drop(loungers[1], 1.6) },
    { step: 3, at: [0.74, 0.84], set: grow(trees[0]) },
    { step: 3, at: [0.78, 0.88], set: grow(trees[1]) },
  ];
  const STEP_ENDS = [0.42, 0.62, 0.74, 0.88, 0.95];   // when each request is done (the last one is the check)
  let shown = still ? 1 : 0;
  const progressNow = () => {
    if (still) return 1;
    const r = root.getBoundingClientRect(), span = Math.max(1, r.height - window.innerHeight);
    return ease.clamp01(-r.top / span);
  };
  let lastStep = -2;
  const apply = (p) => {
    for (const piece of PIECES) piece.set(ease.out3(ease.clamp01((p - piece.at[0]) / (piece.at[1] - piece.at[0]))));
    const active = STEP_ENDS.findIndex((end) => p < end);
    const now = active === -1 ? STEP_ENDS.length : active;
    if (now !== lastStep) {
      lastStep = now;
      steps.forEach((s, i) => { s.classList.toggle('is-done', i < now); s.classList.toggle('is-active', i === now); });
    }
  };

  // ---------- looking around: the camera circles as the villa goes up, and a drag turns it further ----------
  const look = { drag: 0, dragV: 0, down: false, x: 0 };
  canvas.addEventListener('pointerdown', (e) => { look.down = true; look.x = e.clientX; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-grabbing'); });
  canvas.addEventListener('pointermove', (e) => { if (!look.down) return; look.dragV += (e.clientX - look.x) * -0.006; look.x = e.clientX; });
  const up = () => { look.down = false; canvas.classList.remove('is-grabbing'); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const target = new THREE.Vector3(0, 3.1, 3.2);
  const place = (p, dt) => {
    const step = look.dragV * (1 - Math.exp(-dt * 8)); look.dragV -= step; look.drag += step;
    const az = -0.75 + 0.95 * ease.inOut3(p) + look.drag, el = 0.52 - 0.1 * p;
    const dist = (camera.aspect < 1 ? 50 : 40) - 4 * p;
    camera.position.set(target.x + Math.sin(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(target);
  };

  const NOON = { color: new THREE.Color(0xfff0dc), pos: new THREE.Vector3(-14, 22, 12), sky: new THREE.Color(0xa9d0ff) };
  const DUSK = { color: new THREE.Color(0xff8a45), pos: new THREE.Vector3(-24, 6.5, 4), sky: new THREE.Color(0x5d5aa0) };
  const glow = new THREE.Color(0xffb35c), poolGlow = new THREE.Color(0x3fd6ff), poolDay = new THREE.Color(0x0b5a70);
  M.glass.emissive = glow.clone(); M.glass.emissiveIntensity = 0;
  const poolLight = new THREE.PointLight(0x5fdcff, 0, 9, 2);
  poolLight.position.set(0, -0.6, pz); scene.add(poolLight);
  const dusk = (p) => {
    const g = ease.inOut3(ease.clamp01((p - 0.86) / 0.12));
    sun.color.copy(NOON.color).lerp(DUSK.color, g);
    sun.position.copy(NOON.pos).lerp(DUSK.pos, g);
    sun.intensity = 3.1 - 1.4 * g;
    sky.color.copy(NOON.sky).lerp(DUSK.sky, g); sky.intensity = 0.9 - 0.6 * g;
    renderer.toneMappingExposure = 1 - 0.18 * g;
    scene.environmentIntensity = 1 - 0.7 * g;   // the day sky's light goes with the sun
    M.glass.emissiveIntensity = 2.2 * g;
    M.water.emissive.copy(poolDay).lerp(poolGlow, g); M.water.emissiveIntensity = 0.35 + 0.55 * g;
    poolLight.intensity = 14 * g;
  };

  function tick(dt, t) {
    const p = progressNow();
    shown += (p - shown) * (still ? 1 : 1 - Math.exp(-dt * 7));   // glides a touch behind the scroll
    apply(shown);
    dusk(shown);
    place(shown, dt);
    // the water breathes: a slow swell over the surface
    const pos = waterGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 1.7 + t * 1.3) * 0.018 + Math.cos(pos.getY(i) * 2.3 + t * 1.1) * 0.014);
    pos.needsUpdate = true; waterGeo.computeVertexNormals();
    renderer.render(scene, camera);
  }

  fit(renderer, camera, view, (w, h) => {
    // on a wide screen the panel sits on the left: shift the picture so the villa stands in the space to its right
    if (w > 900) camera.setViewOffset(w, h, -w * 0.16, 0, w, h); else camera.clearViewOffset();
  });
  apply(still ? 1 : 0);
  const ready = (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve()).catch(() => {});
  ready.then(() => loop(view, tick));
  return {};
}

// A daylight sky for the glass and the water to reflect: blue above, a bright haze at the horizon, the ground below.
function daySky(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const sky = new THREE.Scene();
  sky.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; void main() {
      float y = normalize(vP).y;
      vec3 top = vec3(0.32, 0.55, 0.95), haze = vec3(0.92, 0.95, 1.0), ground = vec3(0.16, 0.18, 0.15);
      vec3 c = y > 0.0 ? mix(haze, top, pow(y, 0.6)) : mix(haze, ground, pow(-y, 0.35));
      gl_FragColor = vec4(c * 1.4, 1.0); }`,
  })));
  const env = pm.fromScene(sky, 0.02).texture;
  pm.dispose();
  return env;
}
