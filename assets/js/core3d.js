// The Jarvis core, in 3D: the app's own dotted sphere (see orb.js) built as a machined object. Three silver gimbal
// rings around a sphere of blue points, a segmented outer bezel that opens like an aperture, a tick dial, satellites,
// and stars behind it all. One canvas sits fixed under the page.
//
// The page places the core, not this file: every `.core-slot` element is a place it can dock. Each frame the slots
// near the middle of the screen are weighed by how close they are, giving a position, a size and a shape ("pose").
// A slot names its pose in data-core; scripts can override it with data-pose, or blend two with data-pose2 + data-mix.
import * as THREE from '../vendor/three.module.min.js';

//        open: bezel aperture 0..1   a,b,c: ring angles   whirl: ring spin   sway: body swing (radians)
//        sat: orbit size   rate: orbit speed   glow: centre light   tx,ty: body tilt   far: outer orbit line   pulse
const POSES = {
  hero:    { open: 0.10, a: 0.50, b: 0.90, c: -0.70, whirl: 0.22, sway: 0.42, sat: 0.78, rate: 0.35, glow: 1.0, tx: 0.36, ty: -0.30, far: 1, pulse: 0.03, dots: 1.00 },
  trailer: { open: 0.00, a: 0.25, b: 0.40, c: -0.30, whirl: 0.10, sway: 0.25, sat: 0.90, rate: 0.30, glow: 0.8, tx: 0.55, ty: 0.00, far: 0, pulse: 0.02, dots: 0.96 },
  idle:    { open: 0.05, a: 0.40, b: 0.70, c: -0.50, whirl: 0.12, sway: 0.30, sat: 0.95, rate: 0.30, glow: 0.8, tx: 0.40, ty: 0.15, far: 0, pulse: 0.02, dots: 1.00 },
  hear:    { open: 0.34, a: 0.00, b: 0.00, c: 0.00, whirl: 0.00, sway: 0.10, sat: 0.85, rate: 0.20, glow: 1.25, tx: 0.82, ty: 0.00, far: 0, pulse: 0.09, dots: 1.04 },
  decide:  { open: 1.00, a: 1.10, b: -0.90, c: 0.70, whirl: 1.00, sway: 0.30, sat: 1.15, rate: 0.60, glow: 1.35, tx: 0.24, ty: 0.30, far: 0, pulse: 0.04, dots: 1.22 },
  act:     { open: 0.55, a: 0.90, b: 0.25, c: 1.30, whirl: 0.38, sway: 0.34, sat: 1.42, rate: 2.20, glow: 1.1, tx: 0.30, ty: -0.25, far: 0, pulse: 0.03, dots: 1.00 },
  answer:  { open: 0.00, a: 0.35, b: 0.60, c: -0.50, whirl: 0.14, sway: 0.24, sat: 1.00, rate: 0.40, glow: 1.8, tx: 0.34, ty: 0.18, far: 0, pulse: 0.10, dots: 1.06 },
  control: { open: 0.22, a: 1.5708, b: 1.5708, c: 0.00, whirl: 0.00, sway: 0.00, sat: 0.80, rate: 0.12, glow: 1.0, tx: 0.00, ty: 0.00, far: 0, pulse: 0.02, dots: 0.92 },
  finale:  { open: 0.08, a: 0.50, b: 0.90, c: -0.70, whirl: 0.20, sway: 0.40, sat: 1.00, rate: 0.35, glow: 1.5, tx: 0.32, ty: 0.28, far: 1, pulse: 0.05, dots: 1.00 },
};
POSES.console = POSES.idle; POSES.story = POSES.hear; POSES.away = POSES.trailer;
const KEYS = Object.keys(POSES.hero);
const BODY = 4.6;         // the bezel's diameter in scene units: a slot's smaller side maps to this
const REACH = 1.15;       // a slot counts while its centre is within this many screens of the middle
const CAM_Z = 12, FOV = 30;

export function initCore({ canvas, reducedMotion = false }) {
  const small = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
  camera.position.z = CAM_Z;

  // What the metal reflects: a dark room with a white strip above, a blue wall, a silver rim light and a blue floor.
  {
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x0a1122);
    const panel = (color, power, w, h, x, y, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m);
    };
    panel(0xffffff, 10, 12, 3.4, 0, 9, 5);
    panel(0x78a6ff, 5, 6, 11, -10, 1, 3);
    panel(0xe6edfa, 4, 3.5, 9, 10, -1, -4);
    panel(0x315dcc, 3, 13, 3, 0, -9, 2);
    panel(0xe6edfa, 3.4, 10, 7, -5, 6, 10);   // a soft box behind the camera, so faces turned to you read as silver
    panel(0x78a6ff, 1.4, 5, 5, 7, -4, 9);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(room, 0.035).texture;
    pmrem.dispose();
  }

  const silver = new THREE.MeshStandardMaterial({ color: 0xe9eef8, metalness: 1, roughness: 0.27, envMapIntensity: 1.45 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb6c0d4, metalness: 1, roughness: 0.46, envMapIntensity: 1.2 });
  const lit = new THREE.MeshBasicMaterial({ color: 0x8fb4ff, toneMapped: false });
  const solid = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };

  const core = new THREE.Group();     // placed and sized by the slots
  const body = new THREE.Group();     // tilt, sway, pointer and drag
  core.add(body);
  scene.add(core);

  // --- Gimbal rings: flat machined annuli with chamfered edges, each on its own axis, with pivot pins ---
  const ringGeo = (R, w, d) => {
    const s = new THREE.Shape(); s.absarc(0, 0, R, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, R - w, 0, Math.PI * 2, true); s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: small ? 72 : 128 });
    g.translate(0, 0, -d / 2);
    return g;
  };
  const makeRing = (R, w, d, axis, reach) => {
    const g = new THREE.Group();
    g.add(solid(ringGeo(R, w, d), silver));
    const pinGeo = new THREE.CylinderGeometry(0.022, 0.022, reach, 12);
    [-1, 1].forEach((side) => {   // pins lie on the ring's own axis, so they hold still while it turns
      const pin = solid(pinGeo, steel);
      if (axis === 'x') { pin.rotation.z = Math.PI / 2; pin.position.x = side * (R + reach / 2 - 0.01); }
      else pin.position.y = side * (R + reach / 2 - 0.01);
      g.add(pin);
    });
    body.add(g);
    return g;
  };
  const ringA = makeRing(1.76, 0.085, 0.07, 'x', 0.26);
  const ringB = makeRing(1.54, 0.07, 0.06, 'y', 0.15);
  const ringC = makeRing(1.34, 0.055, 0.05, 'x', 0.15);
  {   // twelve small steel blocks around the outer ring: something for the light to catch as it turns
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.11, 0.095), steel, 12);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < 12; i++) {
      const t = (i + 0.5) / 12 * Math.PI * 2;
      m.compose(new THREE.Vector3(Math.cos(t) * 1.717, Math.sin(t) * 1.717, 0), q.setFromAxisAngle(z, t), new THREE.Vector3(1, 1, 1));
      blocks.setMatrixAt(i, m);
    }
    blocks.castShadow = true;
    ringA.add(blocks);
  }

  // --- The bezel: six plates that open like an aperture ---
  const PLATES = 6, R_IN = 2.02, R_OUT = 2.3, R_MID = (R_IN + R_OUT) / 2;
  const arcGeo = (rin, rout, half, d) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, rout, -half, half, false);
    s.absarc(0, 0, rin, half, -half, true);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.014, bevelSegments: 2, curveSegments: 28 });
    g.translate(-R_MID, 0, -d / 2);
    return g;
  };
  const half = Math.PI / PLATES - 0.06;
  const plateGeo = arcGeo(R_IN, R_OUT, half, 0.13);
  const inlayGeo = arcGeo(R_IN + 0.07, R_OUT - 0.07, half - 0.07, 0.17);
  const lampGeo = new THREE.BoxGeometry(0.05, 0.16, 0.19);
  const plates = [];
  const bezel = new THREE.Group();
  for (let i = 0; i < PLATES; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / PLATES) * Math.PI * 2;
    const plate = solid(plateGeo, silver);
    plate.add(solid(inlayGeo, steel));
    const lamp = new THREE.Mesh(lampGeo, lit);
    plate.add(lamp);
    pivot.add(plate);
    bezel.add(pivot);
    plates.push(plate);
  }
  body.add(bezel);

  // --- The dial: a ring of fine ticks just inside the bezel, turning slowly ---
  const dial = new THREE.Group();
  {
    const TICKS = small ? 72 : 120;
    const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.009, 0.012), new THREE.MeshBasicMaterial({ color: 0xa9c6ff, transparent: true, opacity: 0.75, toneMapped: false }), TICKS);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < TICKS; i++) {
      const t = (i / TICKS) * Math.PI * 2, long = i % 5 === 0;
      m.compose(new THREE.Vector3(Math.cos(t) * (long ? 1.915 : 1.93), Math.sin(t) * (long ? 1.915 : 1.93), 0), q.setFromAxisAngle(z, t), new THREE.Vector3(long ? 1.5 : 1, 1, 1));
      ticks.setMatrixAt(i, m);
    }
    dial.add(ticks);
    body.add(dial);
  }

  // --- The heart: a sphere of points around a small faceted nucleus, and the light it gives off ---
  const sprite = (inner, outer) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner); g.addColorStop(0.25, outer); g.addColorStop(1, 'rgba(120,166,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const dotTex = sprite('rgba(255,255,255,1)', 'rgba(170,200,255,0.55)');
  const DOTS = small ? 520 : 860;
  const dotPos = new Float32Array(DOTS * 3);
  for (let i = 0; i < DOTS; i++) {   // evenly spread on the sphere
    const y = 1 - (i / (DOTS - 1)) * 2, r = Math.sqrt(1 - y * y), t = i * 2.399963;
    dotPos.set([Math.cos(t) * r, y, Math.sin(t) * r], i * 3);
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
  const dotMat = new THREE.PointsMaterial({ size: 0.09, map: dotTex, color: 0xc4d8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const dots = new THREE.Points(dotGeo, dotMat);
  body.add(dots);
  const nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshStandardMaterial({ color: 0x0a1a40, emissive: 0x3f7bff, emissiveIntensity: 2.4, metalness: 0.2, roughness: 0.35, flatShading: true }));
  body.add(nucleus);
  const glowMat = new THREE.SpriteMaterial({ map: sprite('rgba(150,185,255,0.9)', 'rgba(120,166,255,0.3)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const glow = new THREE.Sprite(glowMat);
  body.add(glow);
  const heart = new THREE.PointLight(0x78a6ff, 30, 9, 2);
  body.add(heart);

  // --- Orbits and satellites ---
  const circle = (R, opacity) => {
    const pts = [];
    for (let i = 0; i <= 160; i++) { const t = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * R, Math.sin(t) * R, 0)); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xb9c5dc, transparent: true, opacity }));
  };
  const satGeo = new THREE.SphereGeometry(0.055, 16, 12);
  const orbits = [[2.9, 1.15, 0.3, 1], [3.45, -1.0, -0.5, -0.7], [4.05, 1.35, 0.9, 0.5]].map(([R, rx, ry, speed]) => {
    const tiltG = new THREE.Group(); tiltG.rotation.set(rx, ry, 0);
    const spinG = new THREE.Group();
    spinG.add(circle(R, 0.2));
    const sat = solid(satGeo, silver); sat.position.x = R;
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0x9fbfff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    spark.scale.setScalar(0.34); sat.add(spark);
    spinG.add(sat); tiltG.add(spinG); core.add(tiltG);
    return { tiltG, spinG, speed };
  });
  const far = circle(8.4, 1); far.rotation.set(1.25, 0.25, 0); core.add(far);

  // --- Light: one key from the upper left (it casts the shadows), a cool rim from behind ---
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.castShadow = !small;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x9fbcff, 1.3);
  rim.position.set(6, -2, -5);
  scene.add(rim);

  // --- Stars: two layers of points with depth; scrolling moves through them ---
  const starField = new THREE.Group();
  const starLayers = [[small ? 500 : 1100, 2.4], [small ? 70 : 150, 4.2]].map(([count, px]) => {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() - 0.5) * 150, (Math.random() - 0.5) * 120, -8 - Math.random() * 110], i * 3);
      c.set(Math.random() < 0.22 ? 0x78a6ff : 0xe6edfa).multiplyScalar(0.5 + Math.random() * 0.5);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: px * dpr, sizeAttenuation: false, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });
    starField.add(new THREE.Points(g, m));
    return { m, px };
  });
  scene.add(starField);

  // ---------- Where the core goes: blend the slots near the middle of the screen ----------
  const slots = Array.from(document.querySelectorAll('.core-slot'));
  const poseOf = (el, out) => {
    const p1 = POSES[el.dataset.pose] || POSES[el.dataset.core] || POSES.idle;
    const mix = Number(el.dataset.mix) || 0;
    const p2 = mix > 0 ? POSES[el.dataset.pose2] || p1 : p1;
    KEYS.forEach((k) => { out[k] = p1[k] + (p2[k] - p1[k]) * mix; });
    return out;
  };
  const target = { x: 0, y: 0, size: 0, seen: false, pose: { ...POSES.hero } };
  const scratch = {};
  function readSlots(W, H) {
    let sum = 0, x = 0, y = 0, size = 0;
    KEYS.forEach((k) => { target.pose[k] = 0; });
    for (const el of slots) {
      const r = el.getBoundingClientRect();
      if (r.width < 2) continue;   // a slot that is switched off in this layout
      const cy = r.top + r.height / 2;
      const d = Math.abs(cy - H / 2) / H;
      if (d >= REACH) continue;
      const w = Math.exp(-14 * d) * (1 - d / REACH);   // the nearest slot wins, handing over smoothly at the halfway point
      sum += w; x += w * (r.left + r.width / 2); y += w * cy; size += w * Math.min(r.width, r.height);
      const p = poseOf(el, scratch);
      KEYS.forEach((k) => { target.pose[k] += w * p[k]; });
    }
    target.seen = sum > 0;
    if (!target.seen) { target.size = 0; return; }
    target.x = x / sum; target.y = y / sum; target.size = size / sum;
    KEYS.forEach((k) => { target.pose[k] /= sum; });
  }

  // ---------- Pointer: the body leans toward it and the key light follows; a drag on the hero core turns it ----------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const drag = { on: false, x: 0, y: 0, yaw: 0, pitch: 0 };
  if (!reducedMotion) {
    window.addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (drag.on) {
        drag.yaw += (e.clientX - drag.x) * 0.009; drag.pitch += (e.clientY - drag.y) * 0.006;
        drag.pitch = Math.max(-0.9, Math.min(0.9, drag.pitch));
        drag.x = e.clientX; drag.y = e.clientY;
      }
    }, { passive: true });
    document.querySelectorAll('.core-slot[data-drag]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; });
    });
    ['pointerup', 'pointercancel', 'blur'].forEach((ev) => window.addEventListener(ev, () => { drag.on = false; }));
  }

  // ---------- The frame ----------
  const cur = { x: 0, y: 0, size: 0, pose: { ...POSES.hero } };
  const phase = { a: 0, b: 0, c: 0, dots: 0, dial: 0, sat: 0, sway: 0, pulse: 0 };
  let W = 0, H = 0, upp = 1, last = 0, wasSeen = false, lastKey = '', slow = 0, frames = 0;
  const settle = (ph) => Math.round(ph / Math.PI) * Math.PI;   // a ring looks the same every half turn

  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    upp = (2 * CAM_Z * Math.tan((FOV * Math.PI) / 360)) / H;
    lastKey = '';
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || document.body.classList.contains('lights-down')) { last = 0; return; }   // the trailer gets the whole machine
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    readSlots(W, H);

    if (reducedMotion) {   // nothing moves by itself: redraw only when the page or a pose changed
      const k = `${target.x | 0},${target.y | 0},${target.size | 0},${window.scrollY | 0},${KEYS.map((n) => target.pose[n].toFixed(2)).join()}`;
      if (k === lastKey) return;
      lastKey = k;
    } else if (!target.seen && cur.size < 1 && window.scrollY === frame.y) return;   // only stars, standing still
    frame.y = window.scrollY;

    const snap = reducedMotion || (target.seen && !wasSeen && cur.size < 1);   // arriving from nowhere: don't fly in
    const kPos = snap ? 1 : 1 - Math.exp(-dt * 10), kPose = reducedMotion ? 1 : 1 - Math.exp(-dt * 3.4);
    if (target.seen) { cur.x += (target.x - cur.x) * kPos; cur.y += (target.y - cur.y) * kPos; }
    cur.size += (target.size - cur.size) * (snap ? 1 : 1 - Math.exp(-dt * 7));
    if (target.seen) KEYS.forEach((k) => { cur.pose[k] += (target.pose[k] - cur.pose[k]) * kPose; });
    wasSeen = target.seen;
    const P = cur.pose;
    const scale = Math.max(0.0001, (cur.size * upp) / BODY);
    core.visible = cur.size > 1;
    core.position.set((cur.x - W / 2) * upp, -(cur.y - H / 2) * upp, 0);
    core.scale.setScalar(scale);

    const t = reducedMotion ? 0 : dt;
    pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3)); pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));
    if (!drag.on) { drag.yaw *= Math.exp(-dt * 1.1); drag.pitch *= Math.exp(-dt * 1.6); }
    const still = 1 - Math.min(1, P.whirl * 5);   // rings come to rest squarely when a pose stops them
    phase.a += t * P.whirl * 0.9; phase.b -= t * P.whirl * 1.3; phase.c += t * P.whirl * 1.9;
    ['a', 'b', 'c'].forEach((n) => { phase[n] += (settle(phase[n]) - phase[n]) * Math.min(1, dt * 4) * still; });
    phase.dots += t * 0.22; phase.dial += t * 0.07; phase.sat += t * P.rate; phase.sway += t * 0.33; phase.pulse += t * 2.3;

    body.rotation.x = P.tx + pointer.y * 0.16 + drag.pitch;
    body.rotation.y = P.ty + pointer.x * 0.26 + drag.yaw + Math.sin(phase.sway) * P.sway;
    ringA.rotation.x = P.a + phase.a; ringB.rotation.y = P.b + phase.b; ringC.rotation.x = P.c + phase.c;
    plates.forEach((plate, i) => {
      plate.position.x = R_MID + P.open * 0.62;
      plate.rotation.y = P.open * (i % 2 ? -0.95 : 0.95);
    });
    bezel.rotation.z = phase.dial * 0.6; dial.rotation.z = -phase.dial;
    const beat = 1 + Math.sin(phase.pulse) * P.pulse;
    dots.rotation.y = phase.dots; dots.rotation.x = phase.dots * 0.4;
    dots.scale.setScalar(P.dots * beat);
    dotMat.size = 0.095 * scale * (small ? 1.15 : 1);
    nucleus.rotation.set(phase.dots * 1.7, phase.dots * 2.3, 0);
    nucleus.material.emissiveIntensity = 2.2 * P.glow * beat;
    glow.scale.setScalar(2.3 * (0.75 + 0.25 * P.glow) * beat); glowMat.opacity = Math.min(0.8, 0.26 * P.glow);
    heart.intensity = 26 * P.glow * beat;
    orbits.forEach((o) => { o.tiltG.scale.setScalar(P.sat); o.spinG.rotation.z = phase.sat * o.speed; });
    far.material.opacity = 0.22 * P.far; far.visible = P.far > 0.02;

    key.target.position.copy(core.position);
    key.position.set(core.position.x + (-3.4 + pointer.x * 2.6) * scale * 2, core.position.y + (5 - pointer.y * 1.6) * scale * 2, 7 * scale * 2);
    if (key.castShadow) {
      const s = 3.4 * scale, cam = key.shadow.camera;
      cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s; cam.near = 0.1; cam.far = 40 * Math.max(1, scale * 2);
      cam.updateProjectionMatrix();
    }

    // Stars drift up more slowly than the page, and come closer the further down you are.
    const doc = Math.max(1, document.documentElement.scrollHeight - H);
    starField.position.y = window.scrollY * upp * 0.1;
    starField.position.z = (window.scrollY / doc) * 34;
    starField.rotation.set(pointer.y * 0.012, pointer.x * 0.016, 0);

    renderer.render(scene, camera);

    // A struggling machine gets a lighter picture: fewer pixels first, then no shadows.
    if (dt > 0.03) slow++;
    if (++frames >= 90) {
      if (slow > 40 && dpr > 1) { dpr = 1; renderer.setPixelRatio(1); starLayers.forEach((l) => { l.m.size = l.px; }); resize(); }
      else if (slow > 40 && renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; key.castShadow = false; }
      slow = 0; frames = 0;
    }
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
}
