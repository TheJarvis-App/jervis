// What every 3D scene on the page shares: one Three.js (0.170, MIT, vendored), the renderer settings, a render loop
// that runs only while its scene is on screen, a soft studio light for reflections, and texture loading.
// The scenes are loaded on demand (dynamic import) and each one falls back to the page without 3D if WebGL 2 isn't there.
import * as THREE from '../vendor/three.module.min.js';
export { THREE };

export const lowPower = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;

export function canWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export function makeRenderer(canvas, { alpha = true, shadows = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  if (shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  return renderer;
}

// Keeps a canvas the size of its box (CSS pixels), and tells the scene.
export function fit(renderer, camera, box, onSize) {
  const apply = () => {
    const w = Math.max(1, box.clientWidth), h = Math.max(1, box.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    onSize?.(w, h);
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(box);
  return () => ro.disconnect();
}

// A render loop that runs only while `el` is on screen, the tab is visible and `paused()` is false; it restarts by
// itself when any of those change. tick(dt, t) gets seconds since the last frame (capped) and since the start.
export function loop(el, tick, { paused = () => false, watch = [] } = {}) {
  let visible = false, raf = 0, last = 0;
  const t0 = performance.now();
  const frame = (now) => {
    raf = 0;
    if (!visible || document.hidden || paused()) return;
    tick(Math.min(0.05, (now - last) / 1000), (now - t0) / 1000);
    last = now;
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && visible && !document.hidden && !paused()) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }, { rootMargin: '160px' });
  io.observe(el);
  document.addEventListener('visibilitychange', start);
  const mo = new MutationObserver(start);
  for (const node of watch) mo.observe(node, { attributes: true, attributeFilter: ['class'] });
  return { start, stop() { cancelAnimationFrame(raf); raf = 0; io.disconnect(); mo.disconnect(); document.removeEventListener('visibilitychange', start); } };
}

// A soft studio for reflections: a dark room with a cool key light, a violet fill and a warm rim, baked once.
export function studio(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x070a12, side: THREE.BackSide })));
  const panel = (rgb, pos, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb) }));
    m.position.set(...pos); m.lookAt(0, 0, 0); room.add(m);
  };
  panel([2.2, 3.4, 4.0], [-4.5, 3.5, 3.5], 3.5, 2.5);   // cool key, upper left
  panel([1.6, 1.2, 3.2], [5, 0.5, -2], 2.5, 5);        // violet fill, right
  panel([3.0, 2.6, 2.2], [0, -5, -3], 6, 1.2);         // warm rim from below
  panel([0.5, 0.6, 0.8], [0, 6, 0], 8, 8);             // soft sky
  const env = pm.fromScene(room, 0.03).texture;
  pm.dispose();
  room.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return env;
}

// Images are decoded off the main thread where the browser can (createImageBitmap), so a big map never freezes a frame.
const bitmaps = typeof createImageBitmap === 'function' ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' }) : null;
const images = new THREE.TextureLoader();
export function texture(url, { color = true, anisotropy = 8 } = {}) {
  return new Promise((resolve, reject) => {
    const done = (t) => { if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy; resolve(t); };
    if (!bitmaps) return images.load(url, done, undefined, reject);
    bitmaps.load(url, (bmp) => { const t = new THREE.Texture(bmp); t.flipY = false; t.needsUpdate = true; done(t); }, undefined, () => images.load(url, done, undefined, reject));
  });
}

// A soft round glow, for sprites.
export function glowTexture(rgb = [255, 255, 255]) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, `rgba(${rgb},1)`); grd.addColorStop(0.25, `rgba(${rgb},.55)`); grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const ease = {
  out3: (t) => 1 - Math.pow(1 - t, 3),
  inOut3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  clamp01: (t) => Math.min(1, Math.max(0, t)),
};
