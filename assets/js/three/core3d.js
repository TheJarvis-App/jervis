// Jarvis's core, in real 3D: the dotted sphere from his window (a Fibonacci sphere of points, shaded on the GPU),
// held in three metal gimbal rings that catch a studio light, a dial of ticks and arcs around it, an energy shell,
// a light at the centre, a slow drift of motes, and the one comet on its orbit.
//
// It builds itself on arrival (the camera dollies in from the dark, the dots appear in a sweep from the top, the dial's
// ticks go round, the rings close in), leans toward the pointer, and ripples where the pointer touches it. It speaks the
// same states as the 2D core it replaces (site.js plays the conversation): listening is mint and quick, thinking is
// violet with a scan line, speaking is blue and rippling. Without WebGL 2 the 2D core simply stays.
//
// Sizes are set so the sphere is 0.49 of the canvas across, exactly like the 2D core: the page's flight into the
// first app screen (journey.js) relies on it.
import { THREE, makeRenderer, fit, loop, glowTexture, lowPower, ease } from './kit.js';

const STATES = {
  idle:      { speed: 0.14, amp: 0.022, energy: 0.55, pulse: 0.8, scan: 0, color: [79, 216, 255] },
  sleeping:  { speed: 0.05, amp: 0.01,  energy: 0.2,  pulse: 0.3, scan: 0, color: [120, 135, 172] },
  listening: { speed: 0.3,  amp: 0.05,  energy: 0.9,  pulse: 1.8, scan: 0, color: [61, 242, 192] },
  thinking:  { speed: 0.9,  amp: 0.03,  energy: 0.75, pulse: 2.2, scan: 1, color: [165, 139, 255] },
  speaking:  { speed: 0.26, amp: 0.075, energy: 1.0,  pulse: 3.0, scan: 0, color: [90, 169, 255] },
  muted:     { speed: 0.02, amp: 0,     energy: 0.15, pulse: 0.3, scan: 0, color: [255, 107, 129] },
  generating:{ speed: 0.8,  amp: 0.04,  energy: 0.7,  pulse: 1.8, scan: 1, color: [165, 139, 255] },
};
const toColor = (rgb) => new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);

const DOT_VERT = /* glsl */ `
  uniform float uTime, uReveal, uAmp, uPhase, uSize, uPR, uTouch, uScan, uScanY;
  uniform vec3 uPointer;
  attribute float aRand;
  varying float vAlpha, vGlow;
  void main() {
    vec3 p = position;
    float wave = sin(uPhase + aRand * 6.2831 + p.y * 5.0) * uAmp;
    float d = distance(p, uPointer);
    float touch = uTouch * exp(-d * d * 10.0);
    p *= 1.0 + wave + touch * 0.16;
    float rev = smoothstep(0.0, 0.22, uReveal * 2.3 - (1.0 - position.y));   // the dots appear in a sweep from the top
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float facing = normalize(normalMatrix * position).z;
    float scan = uScan * smoothstep(0.09, 0.0, abs(uScanY - position.y));
    vAlpha = rev * (0.16 + 0.84 * smoothstep(-0.5, 0.8, facing)) * (0.75 + 0.25 * aRand);
    vGlow = touch + scan + rev * (1.0 - rev) * 2.5;
    gl_PointSize = uSize * uPR * (1.0 + touch * 1.6 + scan * 0.8) * (8.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const DOT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha, vGlow;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.12, r);
    vec3 col = mix(uColor, vec3(1.0), 0.18 + min(vGlow, 1.0) * 0.55);
    gl_FragColor = vec4(col, a * vAlpha * (0.9 + vGlow));
  }`;
const SHELL_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`;
const SHELL_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uEnergy, uTime;
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    float facing = max(dot(vN, vV), 0.0);
    float rim = pow(1.0 - facing, 3.0);
    // thin bands of energy drifting over the surface, brightest toward the edge, fading where the sphere faces you
    float lat = vP.y * 9.0 + uTime * 0.35;
    float band = smoothstep(0.92, 1.0, sin(lat * 3.14159)) * (0.25 + 0.75 * smoothstep(0.2, 0.9, 1.0 - facing));
    float sweep = smoothstep(0.96, 1.0, sin(atan(vP.z, vP.x) * 2.0 - uTime * 0.6)) * 0.35;
    float a = rim * (0.35 + 0.5 * uEnergy) + (band * 0.18 + sweep * band) * (0.4 + uEnergy);
    gl_FragColor = vec4(uColor * (0.7 + uEnergy), a);
  }`;

export function startCore3D(stage, { still = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'core3d';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'The Jarvis voice core, in 3D: a sphere of points held in metal rings.');
  stage.append(canvas);
  let renderer;
  try { renderer = makeRenderer(canvas); } catch { canvas.remove(); return null; }

  const scene = new THREE.Scene();
  // the rings' metal catches three lights: a cool key from the upper left, a violet fill from the right, and the core
  const key = new THREE.DirectionalLight(0xbfe6ff, 2.4); key.position.set(-4, 3.5, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xa58bff, 1.6); fill.position.set(5, -1, 2); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const HOME_Z = 7.68;   // sphere of radius 1 = 0.49 of the canvas across at this distance (fov 30)
  camera.position.set(0, 0, still ? HOME_Z : HOME_Z * 1.6);

  const rig = new THREE.Group();     // leans toward the pointer
  const spin = new THREE.Group();    // turns on its own
  scene.add(rig); rig.add(spin);

  // the dots
  const N = lowPower ? 1300 : 2400;
  const pos = new Float32Array(N * 3), rnd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653;
    pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); rnd[i] = Math.random();
  }
  const dotsGeo = new THREE.BufferGeometry();
  dotsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dotsGeo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  const color = toColor(STATES.idle.color);
  const U = {
    uTime: { value: 0 }, uReveal: { value: still ? 1 : 0 }, uAmp: { value: 0.02 }, uPhase: { value: 0 }, uSize: { value: lowPower ? 2.9 : 3.4 },
    uPR: { value: renderer.getPixelRatio() }, uTouch: { value: 0 }, uScan: { value: 0 }, uScanY: { value: 0 }, uPointer: { value: new THREE.Vector3(9, 9, 9) },
    uColor: { value: color },
  };
  const dots = new THREE.Points(dotsGeo, new THREE.ShaderMaterial({ vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  spin.add(dots);

  // the energy shell and the light at the centre
  const shellU = { uColor: { value: color }, uEnergy: { value: 0.5 }, uTime: U.uTime };
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.04, 64, 48), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, uniforms: shellU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  rig.add(shell);
  const lattice = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.56, 1)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  rig.add(lattice);
  const inner = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.3, 0)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  rig.add(inner);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.16 }));
  halo.scale.setScalar(5.2); halo.renderOrder = -1;
  scene.add(halo);
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  heart.scale.setScalar(1.25);
  rig.add(heart);
  const light = new THREE.PointLight(color, 0, 0, 0);
  rig.add(light);
  // an invisible sphere that hides the comet when it passes behind the core
  const occluder = new THREE.Mesh(new THREE.SphereGeometry(0.97, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
  occluder.renderOrder = 1;
  rig.add(occluder);

  // three metal gimbal rings
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x8796ab, metalness: 0.85, roughness: 0.26, emissive: color, emissiveIntensity: 0.1 });
  const rings = [1.34, 1.5, 1.66].map((r, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, [0.016, 0.011, 0.013][i], 14, 240), ringMat);
    const g = new THREE.Group(); g.add(m); rig.add(g);
    g.rotation.set([1.2, 0.4, -0.9][i], [0.3, -0.8, 0.5][i], 0);
    return { g, m, axis: new THREE.Vector3(...[[0, 1, 0.2], [1, 0.1, 0], [0.3, 0.2, 1]][i]).normalize(), speed: [0.21, -0.15, 0.11][i], base: 1 };
  });

  // the dial: ticks round a circle facing you, and two bright arcs
  const dial = new THREE.Group();
  rig.add(dial);
  const TICKS = 96;
  const tickMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 1, 0.006), tickMat, TICKS);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < TICKS; i++) {
    const a = Math.PI / 2 - (i / TICKS) * Math.PI * 2, major = i % 8 === 0, len = major ? 0.11 : 0.055, r = 1.92;
    p.set(Math.cos(a) * r, Math.sin(a) * r, 0); q.setFromAxisAngle(zAxis, a - Math.PI / 2); s.set(major ? 1.6 : 1, len, 1);
    ticks.setMatrixAt(i, m4.compose(p, q, s));
  }
  ticks.count = still ? TICKS : 0;
  dial.add(ticks);
  const arcMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
  const arcs = [0, Math.PI].map((start) => {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(2.02, 0.007, 6, 160, Math.PI * 0.55), arcMat);
    arc.rotation.z = start + Math.PI * 0.15; dial.add(arc); return arc;
  });

  // a slow drift of motes around it
  const M = lowPower ? 120 : 260, mpos = new Float32Array(M * 3);
  for (let i = 0; i < M; i++) {
    const r = 2.3 + Math.random() * 1.9, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    mpos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const motesGeo = new THREE.BufferGeometry();
  motesGeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
  const motes = new THREE.Points(motesGeo, new THREE.PointsMaterial({ color: 0xbfe9ff, size: 0.022, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(motes);

  // the comet, with a fading trail, on a tilted orbit
  const orbit = new THREE.Group();
  orbit.rotation.set(1.18, 0.15, 0.42);
  rig.add(orbit);
  const comet = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([255, 92, 214]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  comet.scale.setScalar(0.32); comet.renderOrder = 2;
  orbit.add(comet);
  const TRAIL = 26, tpos = new Float32Array(TRAIL * 3), tcol = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  trail.renderOrder = 2;
  orbit.add(trail);
  const orbitAt = (t, out) => out.set(Math.cos(t) * 2.3, Math.sin(t) * 0.95, 0);

  const tinted = [heart.material, halo.material, lattice.material, tickMat, arcMat];   // the parts that wear the state colour

  // ---------- state, pointer, build ----------
  const cur = { ...STATES.idle }, target = { ...STATES.idle };
  const curColor = color, targetColor = color.clone();   // one colour object, shared by every coloured part
  const setState = (name) => { const st = STATES[name] || STATES.idle; Object.assign(target, st); targetColor.copy(toColor(st.color)); };
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitSphere = new THREE.Sphere(new THREE.Vector3(), 1), hit = new THREE.Vector3();
  let touchTarget = 0, pointerIn = false;
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    lean.ty = Math.max(-1, Math.min(1, nx)) * 0.38; lean.tx = -Math.max(-1, Math.min(1, ny)) * 0.26;
    ndc.set(nx, ny); pointerIn = true;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  const phase = { rot: 0, pulse: 0, dial: 0, orbit: 0, motes: 0 };
  let built = still ? 99 : -1, voice = 0;   // -1: not drawn yet; the build starts with the first frame
  const trailPts = Array.from({ length: TRAIL }, () => new THREE.Vector3());

  function tick(dt, t) {
    built = built < 0 ? 0 : built + dt;
    // the build: dolly in, sweep of dots, ticks going round, rings closing in, light coming up
    const b = ease.clamp01;
    camera.position.z = HOME_Z * (1 + 0.6 * (1 - ease.out3(b(built / 1.9))));
    U.uReveal.value = ease.out3(b((built - 0.1) / 1.4));
    ticks.count = Math.round(TICKS * ease.out3(b((built - 0.25) / 0.9)));
    rings.forEach((r, i) => { const k = ease.out3(b((built - 0.35 - i * 0.12) / 0.9)); r.g.scale.setScalar(0.62 + 0.38 * k); r.m.visible = k > 0.01; });
    arcs.forEach((a, i) => { a.scale.setScalar(0.9 + 0.1 * ease.out3(b((built - 0.7 - i * 0.1) / 0.6))); a.visible = built > 0.7 + i * 0.1; });
    const lit = ease.out3(b((built - 0.2) / 1.2));

    // the state, eased
    const k = 1 - Math.exp(-dt * 3.2);
    for (const key of ['speed', 'amp', 'energy', 'pulse', 'scan']) cur[key] += (target[key] - cur[key]) * k;
    curColor.lerp(targetColor, k);
    for (const m of tinted) m.color.copy(curColor);
    ringMat.emissive.copy(curColor); light.color.copy(curColor);
    voice = target === STATES.speaking || cur.amp > 0.06 ? 0.5 + 0.5 * Math.sin(t * 9.3) * Math.sin(t * 3.1 + 1.3) : 0;
    phase.rot += dt * cur.speed; phase.pulse += dt * cur.pulse * 2.2; phase.dial += dt * (0.05 + cur.speed * 0.12);
    phase.orbit += dt * (0.32 + cur.speed * 0.3); phase.motes += dt * 0.02;

    // the pointer: lean toward it, and a ripple where it touches the sphere
    lean.x += (lean.tx - lean.x) * (1 - Math.exp(-dt * 4)); lean.y += (lean.ty - lean.y) * (1 - Math.exp(-dt * 4));
    rig.rotation.set(lean.x, lean.y, 0);
    spin.rotation.set(0.35, phase.rot, 0);
    if (pointerIn) {
      ray.setFromCamera(ndc, camera);
      const inv = spin.matrixWorld.clone().invert();
      const localRay = ray.ray.clone().applyMatrix4(inv);
      touchTarget = localRay.intersectSphere(hitSphere, hit) ? 1 : 0;
      if (touchTarget) U.uPointer.value.copy(hit);
    }
    U.uTouch.value += (touchTarget - U.uTouch.value) * (1 - Math.exp(-dt * 6));
    U.uTime.value = t; U.uPhase.value = phase.pulse; U.uAmp.value = cur.amp * (1 + voice * 0.8);
    U.uScan.value = cur.scan; U.uScanY.value = Math.sin(t * 1.6) * 0.95;
    shellU.uEnergy.value = cur.energy * lit;
    heart.material.opacity = (0.25 + 0.45 * cur.energy) * lit;
    halo.material.opacity = (0.08 + 0.12 * cur.energy) * lit;
    lattice.rotation.set(phase.rot * -0.7, phase.rot * 1.3, 0.3); inner.rotation.set(phase.rot * 1.1, phase.rot * -1.8, 0);
    lattice.material.opacity = (0.25 + 0.35 * cur.energy) * U.uReveal.value; inner.material.opacity = (0.3 + 0.4 * cur.energy) * lit;
    lattice.scale.setScalar(1 + voice * 0.06);
    heart.scale.setScalar(1.05 + 0.25 * cur.energy + voice * 0.12);
    light.intensity = (2 + 6 * cur.energy) * lit;
    ringMat.emissiveIntensity = 0.06 + 0.16 * cur.energy;
    tickMat.opacity = 0.35 + 0.35 * cur.energy;
    rings.forEach((r) => r.m.rotateOnAxis(r.axis, dt * r.speed * (1 + cur.speed * 1.5)));
    dial.rotation.z = -phase.dial;
    motes.rotation.y = phase.motes; motes.rotation.x = lean.x * 0.4;
    // the comet and its trail (the trail is where it has just been)
    orbitAt(phase.orbit, comet.position);
    for (let i = 0; i < TRAIL; i++) {
      orbitAt(phase.orbit - i * 0.016, trailPts[i]);
      tpos.set([trailPts[i].x, trailPts[i].y, trailPts[i].z], i * 3);
      const f = (1 - i / TRAIL) ** 2 * 0.9 * lit;
      tcol.set([f, f * 0.36, f * 0.84], i * 3);
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
    comet.material.opacity = ease.out3(b((built - 1.0) / 0.8));
    trail.visible = built > 1.0;
    renderer.render(scene, camera);
  }

  const stopFit = fit(renderer, camera, stage);
  let running = null;
  // compile every shader off the main thread where the browser can, then start drawing (no frozen first frame)
  const ready = (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve()).catch(() => {});
  ready.then(() => {
    if (still) { tick(0, 0); new ResizeObserver(() => tick(0, 0)).observe(stage); }
    else running = loop(stage, tick, { paused: () => document.body.classList.contains('scene-paused'), watch: [document.body] });
  });

  return {
    canvas,
    setState,
    dispose() {
      running?.stop(); stopFit(); window.removeEventListener('pointermove', onMove);
      scene.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
      renderer.dispose(); canvas.remove();
    },
  };
}
