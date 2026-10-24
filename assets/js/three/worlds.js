// "Hold the planets": real, lit 3D worlds the visitor can turn, with the imagery Jarvis bundles (NASA Blue Marble and
// Black Marble for the Earth; Solar System Scope planet maps, CC BY 4.0). The Earth is lit by the Sun where it is right
// now, with the night side showing city lights, as in Jarvis's own globe; the others are lit from the upper left.
//
// Drag (or use the arrow keys) to turn a world; choosing another sends the current one away and brings the new one in
// from the side it lies on in the list. Textures load when needed; nothing draws while the section is off screen.
import { THREE, makeRenderer, fit, loop, texture, glowTexture, lowPower, ease } from './kit.js';

const BASE = 'assets/3d/';
// Every body Jarvis can show, in order out from the Sun, with his own numbers (planets.py). tilt is the view's lean of
// the axis (real for Uranus, which spins on its side); reach is how much room the body needs in the frame.
const BODIES = {
  sun: { name: 'The Sun', map: 'sun.webp', star: true, tilt: 0.13, reach: 1.45, facts: 'The Sun · radius 696,000 km · it turns once in about 25 days · it holds 99.8% of all the mass in the solar system' },
  mercury: { name: 'Mercury', map: 'mercury.webp', tilt: 0.02, reach: 1.05, facts: 'Mercury · radius 2,440 km · it spins once every 59 Earth days but circles the Sun in 88' },
  venus: { name: 'Venus', map: 'venus.webp', tilt: 0.05, reach: 1.05, facts: 'Venus · radius 6,052 km · it spins backward, once every 243 days · its surface, mapped by radar beneath the clouds' },
  earth: { name: 'Earth', earth: true, tilt: 0.41, reach: 1.1 },
  moon: { name: 'The Moon', map: 'moon.webp', tilt: 0.03, reach: 1.05, facts: 'The Moon · radius 1,737 km · it drifts away from Earth by about 3.8 cm a year' },
  mars: { name: 'Mars', map: 'mars.webp', tilt: 0.44, reach: 1.05, facts: 'Mars · radius 3,390 km · a day of 24.7 hours · home to Olympus Mons, the largest volcano in the solar system' },
  jupiter: { name: 'Jupiter', map: 'jupiter.webp', tilt: 0.05, reach: 1.05, facts: 'Jupiter · radius 69,911 km · a day of under 10 hours · its Great Red Spot is a storm bigger than Earth' },
  saturn: { name: 'Saturn', map: 'saturn.webp', ring: 'saturn-ring.webp', tilt: 0.3, reach: 2.0, facts: 'Saturn · radius 58,232 km · a day of about 10.7 hours · rings of ice and rock' },
  uranus: { name: 'Uranus', map: 'uranus.webp', tilt: 1.71, reach: 1.05, facts: 'Uranus · radius 25,362 km · a day of 17.2 hours · it spins almost completely on its side' },
  neptune: { name: 'Neptune', map: 'neptune.webp', tilt: 0.49, reach: 1.05, facts: 'Neptune · radius 24,622 km · a day of 16.1 hours · the fastest winds in the solar system, over 2,000 km/h' },
  pluto: { name: 'Pluto', map: 'pluto.webp', tilt: 0.3, reach: 1.05, facts: 'Pluto · radius 1,188 km · a day of 6.4 Earth days · a dwarf planet since 2006 · mapped by New Horizons in 2015 (the south it never saw is left plain)' },
};

const EARTH_VERT = /* glsl */ `
  varying vec2 vUv; varying vec3 vObj; varying vec3 vN; varying vec3 vV;
  void main() { vUv = uv; vObj = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const EARTH_FRAG = /* glsl */ `
  uniform sampler2D uDay, uNight; uniform vec3 uSun, uSunView; uniform float uFade;
  varying vec2 vUv; varying vec3 vObj; varying vec3 vN; varying vec3 vV;
  void main() {
    float d = dot(vObj, uSun);
    float day = smoothstep(-0.08, 0.2, d);
    vec3 tex = texture2D(uDay, vUv).rgb;
    vec3 dayCol = tex * (0.3 + 0.95 * sqrt(max(d, 0.0)));
    // the Sun's glint on the oceans (water found by its colour: the imagery has no mask), where it really is now
    float water = smoothstep(0.02, 0.09, tex.b - max(tex.r, tex.g * 0.92));
    vec3 h = normalize(uSunView + vV);
    float glint = pow(max(dot(normalize(vN), h), 0.0), 55.0) * water * smoothstep(0.0, 0.15, d);
    dayCol += vec3(1.0, 0.93, 0.8) * glint * 0.85;
    vec3 nightCol = texture2D(uNight, vUv).rgb * vec3(1.25, 1.0, 0.75) * 1.4;
    vec3 col = mix(nightCol, dayCol, day);
    // a sliver of sunset along the terminator, and the edge of the atmosphere
    col += vec3(1.0, 0.5, 0.25) * 0.05 * smoothstep(0.07, 0.0, abs(d)) * day * (1.0 - day);
    float rim = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
    col += vec3(0.35, 0.65, 1.0) * rim * 0.55 * smoothstep(-0.2, 0.4, d);
    gl_FragColor = vec4(col, uFade);
    #include <colorspace_fragment>
  }`;
const CLOUD_FRAG = /* glsl */ `
  uniform sampler2D uClouds; uniform vec3 uSun; uniform float uFade;
  varying vec2 vUv; varying vec3 vObj;
  void main() {
    float c = texture2D(uClouds, vUv).r;
    float light = smoothstep(-0.05, 0.3, dot(vObj, uSun));
    gl_FragColor = vec4(vec3(0.95) * (0.08 + 0.92 * light), c * 0.85 * (0.15 + 0.85 * light) * uFade);
  }`;
const ATMO_FRAG = /* glsl */ `
  uniform vec3 uSun; uniform float uFade; varying vec3 vObj; varying vec3 vN; varying vec3 vV;
  void main() {
    float rim = pow(1.0 - abs(dot(vN, vV)), 2.2);
    float lit = smoothstep(-0.3, 0.5, dot(vObj, uSun));
    gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * rim * (0.25 + lit) * uFade, rim * (0.15 + 0.6 * lit) * uFade);
  }`;

// Where the Sun is overhead right now (an approximation good to a fraction of a degree), as a direction in the Earth's
// own frame, in the layout Three.js's sphere uses for an equirectangular map.
function sunNow(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const n = (date - start) / 864e5;
  const decl = (-23.44 * Math.cos(((2 * Math.PI) / 365) * (n + 10)) * Math.PI) / 180;
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const lon = (12 - hours) * 15;
  return { lat: (decl * 180) / Math.PI, lon, dir: dirOf((decl * 180) / Math.PI, lon) };
}
function dirOf(latDeg, lonDeg) {
  const a = ((lonDeg + 180) / 360) * Math.PI * 2, f = (latDeg * Math.PI) / 180;
  return new THREE.Vector3(-Math.cos(a) * Math.cos(f), Math.sin(f), Math.sin(a) * Math.cos(f));
}
const deg = (v, pos, neg) => `${Math.abs(v).toFixed(0)}° ${v >= 0 ? pos : neg}`;

export function startWorlds(root, { still = false } = {}) {
  const view = root.querySelector('.worlds-view');
  const facts = root.querySelector('.worlds-facts');
  const buttons = [...root.querySelectorAll('[data-world]')];
  const canvas = document.createElement('canvas');
  canvas.className = 'worlds-canvas';
  view.append(canvas);
  let renderer;
  try { renderer = makeRenderer(canvas); } catch { canvas.remove(); return null; }
  root.classList.add('is-3d');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
  sunLight.position.set(-5, 2.2, 3.5);
  scene.add(sunLight, new THREE.AmbientLight(0x8fa8ff, 0.06));
  const segs = lowPower ? 72 : 128;
  const sphere = new THREE.SphereGeometry(1, segs, segs * 0.75);

  const made = {};      // name -> { group, spinner, materials, k, x, kT, xT }
  const building = {};  // name -> the one promise that builds it
  const build = (key) => (building[key] ||= create(key));
  async function create(key) {
    const b = BODIES[key];
    const group = new THREE.Group(), spinner = new THREE.Group();
    group.rotation.z = b.tilt; group.add(spinner);
    const materials = [];
    if (b.earth) {
      const [day, night, clouds] = await Promise.all([texture(BASE + 'earth-day.webp'), texture(BASE + 'earth-night.webp'), texture(BASE + 'earth-clouds.webp', { color: false })]);
      const sun = sunNow();
      const uSun = { value: sun.dir }, uFade = { value: 1 }, uSunView = { value: new THREE.Vector3() };
      const earthMat = new THREE.ShaderMaterial({ vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG, uniforms: { uDay: { value: day }, uNight: { value: night }, uSun, uSunView, uFade } });
      const cloudMat = new THREE.ShaderMaterial({ vertexShader: EARTH_VERT, fragmentShader: CLOUD_FRAG, uniforms: { uClouds: { value: clouds }, uSun, uFade }, transparent: true, depthWrite: false });
      const atmoMat = new THREE.ShaderMaterial({ vertexShader: EARTH_VERT, fragmentShader: ATMO_FRAG, uniforms: { uSun, uFade }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide });
      const cloudLayer = new THREE.Mesh(sphere, cloudMat); cloudLayer.scale.setScalar(1.012);
      spinner.add(new THREE.Mesh(sphere, earthMat), cloudLayer);
      const atmo = new THREE.Mesh(sphere, atmoMat); atmo.scale.setScalar(1.09); spinner.add(atmo);
      materials.push(earthMat, cloudMat, atmoMat);
      // start with the day/night line facing you: day on one side, the lights of the night side on the other
      // face whichever continent is in daylight not far from the day/night line: land, daylight and city lights at once
      const gap = (lon) => Math.abs(((lon - sun.lon + 540) % 360) - 180);
      const face = [-75, 15, 105].reduce((best, lon) => (Math.abs(gap(lon) - 50) < Math.abs(gap(best) - 50) ? lon : best));
      const a = ((face + 180) / 360) * Math.PI * 2;
      spinner.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      made[key] = { group, spinner, materials, clouds: cloudLayer, sun: sun.dir, sunView: uSunView.value,
        facts: `Earth, lit the way it is right now: the Sun is overhead at ${deg(sun.lat, 'N', 'S')}, ${deg(sun.lon, 'E', 'W')} (${new Date().toUTCString().slice(17, 22)} UTC). City lights show on the night side.` };
    } else if (b.star) {
      // the Sun shines by itself: unlit, a little brighter than white, with a soft corona around it
      const map = await texture(BASE + b.map);
      const mat = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1.35, 1.2, 1.05), toneMapped: false });
      spinner.add(new THREE.Mesh(sphere, mat)); materials.push(mat);
      const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([255, 170, 80]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
      corona.scale.setScalar(3.6); group.add(corona); materials.push(corona.material);
      made[key] = { group, spinner, materials, facts: b.facts };
    } else {
      const map = await texture(BASE + b.map);
      const mat = new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 });
      spinner.add(new THREE.Mesh(sphere, mat)); materials.push(mat);
      if (b.ring) {
        const ringTex = await texture(BASE + b.ring);
        const ringGeo = new THREE.RingGeometry(1.24, 2.27, lowPower ? 96 : 160, 1);
        const pos = ringGeo.attributes.position, uv = ringGeo.attributes.uv, v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - 1.24) / (2.27 - 1.24), 0.5); }   // the ring map runs from the inner edge out
        const ringMat = new THREE.MeshStandardMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, roughness: 1, metalness: 0, depthWrite: false });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2 + 0.42;
        spinner.rotation.x = 0.42;   // the planet tilts with its rings
        group.add(ring); materials.push(ringMat);
      }
      made[key] = { group, spinner, materials, facts: b.facts };
    }
    const body = made[key];
    body.materials.forEach((m) => { m.transparent = true; });
    Object.assign(body, { k: 0, x: 0, kT: 0, xT: 0, key });
    // compile its shaders off stage (not in the scene yet, so nothing shows early), then add it, hidden
    group.visible = true;
    await (renderer.compileAsync ? renderer.compileAsync(group, camera, scene) : Promise.resolve()).catch(() => {});
    place(body, 0, 0);
    scene.add(group);
    return body;
  }

  // ---------- turning ----------
  const turn = { spin: 0, dragging: false, lastX: 0, lastY: 0, tilt: 0 };
  let current = null, active = null;
  canvas.addEventListener('pointerdown', (e) => {
    turn.dragging = true; turn.lastX = e.clientX; turn.lastY = e.clientY; turn.touch = e.pointerType === 'touch';
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-grabbing');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!turn.dragging) return;
    const dx = e.clientX - turn.lastX, dy = e.clientY - turn.lastY;
    turn.lastX = e.clientX; turn.lastY = e.clientY;
    turn.spin += dx * 0.006;
    if (!turn.touch) turn.tilt = Math.max(-0.5, Math.min(0.5, turn.tilt + dy * 0.004));
  });
  const release = () => { turn.dragging = false; canvas.classList.remove('is-grabbing'); };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  view.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
    if (!k) return;
    e.preventDefault(); turn.spin += k[0]; turn.tilt = Math.max(-0.5, Math.min(0.5, turn.tilt + k[1]));
  });

  // ---------- choosing a world ----------
  // Every world eases toward a target of its own: the chosen one to the centre, every other one away to the side it
  // lies on. A new choice just changes the targets, so clicking through quickly never leaves one stranded half way.
  const order = buttons.map((b) => b.dataset.world);
  let camZT = 6;
  async function show(key) {
    if (key === active) return;
    const from = active;
    active = key;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.world === key)));
    // a world not fetched yet says so while its maps arrive (ui-ux-pro-max: loading-states)
    const waiting = !made[key];
    if (waiting) { root.classList.add('is-loading'); root.setAttribute('aria-busy', 'true'); facts.textContent = `Loading ${BODIES[key].name}…`; }
    const next = await build(key);
    if (waiting) { root.classList.remove('is-loading'); root.removeAttribute('aria-busy'); }
    if (active !== key) return;   // another world was chosen while this one loaded
    facts.textContent = next.facts;
    view.setAttribute('aria-label', `${BODIES[key].name}, in 3D. Drag or use the arrow keys to turn it.`);
    const at = order.indexOf(key);
    for (const body of Object.values(made)) {
      if (body === next) {
        if (body.k < 0.02) body.x = from ? 3.2 * Math.sign(at - order.indexOf(from) || 1) : 0;   // arrives from its side of the list
        body.kT = 1; body.xT = 0;
      } else { body.kT = 0; body.xT = 3.2 * (Math.sign(order.indexOf(body.key) - at) || 1); }   // leaves toward its own side of the list
    }
    current = next;
    camZT = fitFor(key);
    if (!from || still) { for (const body of Object.values(made)) { body.k = body.kT; body.x = body.xT; place(body, body.x, body.k); } camera.position.z = camZT; }
  }
  const fitFor = (key) => (BODIES[key].reach * 1.3) / (Math.tan((15 * Math.PI) / 180) * Math.min(1, camera.aspect));
  const place = (body, x, k) => {
    body.group.position.x = x; body.group.scale.setScalar(0.55 + 0.45 * k);
    body.materials.forEach((m) => { if (m.uniforms?.uFade) m.uniforms.uFade.value = k; else m.opacity = k; });
    body.group.visible = k > 0.004;
  };
  buttons.forEach((b) => {
    b.addEventListener('click', () => show(b.dataset.world));
    b.addEventListener('pointerenter', () => build(b.dataset.world), { once: true });   // fetch its map before the click
  });

  function tick(dt) {
    // each world toward its target; leaving is quicker than arriving (ui-ux-pro-max: exit-faster-than-enter)
    for (const body of Object.values(made)) {
      if (body.k === body.kT && body.x === body.xT) continue;
      const rate = body.kT > body.k ? 4.2 : 6.5, f = 1 - Math.exp(-dt * rate);
      body.k += (body.kT - body.k) * f; body.x += (body.xT - body.x) * f;
      if (Math.abs(body.kT - body.k) < 0.002 && Math.abs(body.xT - body.x) < 0.002) { body.k = body.kT; body.x = body.xT; }
      place(body, body.x, body.k);
    }
    camera.position.z += (camZT - camera.position.z) * (1 - Math.exp(-dt * 4));
    if (current) {
      // the drag is spent over a few frames, so the world glides to a stop; left alone it turns slowly
      const step = turn.spin * (1 - Math.exp(-dt * 8));
      turn.spin -= step;
      current.spinner.rotation.y += step + (turn.dragging || still ? 0 : dt * 0.09);
      current.group.rotation.x += (turn.tilt - current.group.rotation.x) * (1 - Math.exp(-dt * 5));
      if (!turn.dragging) turn.tilt *= Math.exp(-dt * 0.8);           // settles back level
      if (current.clouds) current.clouds.rotation.y += dt * 0.008;
      if (current.sunView) {   // the Sun's direction as the camera sees it, for the ocean glint
        current.spinner.updateWorldMatrix(true, false);
        current.sunView.copy(current.sun).transformDirection(current.spinner.matrixWorld).transformDirection(camera.matrixWorldInverse);
      }
    }
    renderer.render(scene, camera);
  }

  fit(renderer, camera, view, () => { if (active) camera.position.z = fitFor(active); });
  const first = root.dataset.start || 'saturn';
  show(first).then(() => {
    loop(view, tick);
    const warm = async () => {
      for (const key of order) {
        const body = await build(key);
        for (const m of body.materials) for (const t of [m.map, ...Object.values(m.uniforms || {}).map((u) => u.value)]) {
          if (t?.isTexture) { renderer.initTexture(t); await new Promise((r) => requestAnimationFrame(r)); }
        }
      }
    };
    (window.requestIdleCallback || setTimeout)(() => warm().catch(() => {}), { timeout: 2500 });
  });
  return { show };
}
