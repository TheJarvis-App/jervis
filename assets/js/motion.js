// Jarvis website motion, with Anime.js 4.5 (vendor/anime.esm.min.js, MIT).
//
// One idea, carried through: the page is Jarvis's window waking up. His core builds itself (ticks round the dial, then
// the rings, then the arcs) while the headline rises word by word; while you read, the core holds a real conversation
// (site.js runs the script, this file animates the words); further down, each heading rises out of its own lines,
// groups arrive together, the showcase swaps real screens in step with the scroll, and the sky drifts behind it all.
//
// The motion system is tuned against animejs.com's own homepage, whose code mostly uses out(3) and inOut(3) curves,
// 250–750ms and 10–40ms staggers: quick, decisive entrances that settle softly, one easing family, nothing that makes
// you wait. Rules this file keeps: transforms, opacity and clip only (the FAQ's height is the one layout animation,
// and only on a click); every entrance plays once; no endless loops except the comet on the core, paused off screen;
// every start state is set before the first frame, so the finished page never flashes; the desktop-only parts live in
// a Scope and are undone cleanly when the window narrows. With prefers-reduced-motion nothing here moves, and if this
// file never runs the page simply shows as it is (see the guard in index.html).
import {
  animate, createTimeline, stagger, onScroll, splitText, createScope, createDrawable, createMotionPath, spring, utils,
} from './vendor/anime.esm.min.js';
import { startJourney } from './journey.js';

const doc = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// the motion tokens: one family of curves, three speeds
const EASE = { out: 'out(3)', inOut: 'inOut(3)', exit: 'in(2)' };
const MS = { quick: 250, base: 500, slow: 750 };
// springs for anything a hand moves (ui-ux-pro-max: spring-physics): a press that settles, a line that glides, a lean that returns
const SPRING = { press: spring({ stiffness: 420, damping: 16 }), glide: spring({ stiffness: 240, damping: 24 }), settle: spring({ stiffness: 170, damping: 12 }) };
const STAGGER = 45;   // per item, inside the 30–50 ms band that reads as one sequence (ui-ux-pro-max: stagger-sequence)
const SMOOTH = 0.85;   // scroll-linked parts glide a touch behind the scroll instead of snapping to it (1 = no glide)
// Where each real screenshot belongs in one Jarvis window (fractions of the window), and what the camera looks at.
// The worksheet image is the conversation column of the chat screenshot, found by matching the two images (0.97);
// the Saturn view opens in the same panel the globe uses. The camera pushes in and out between them.
const FULL = { x: 0, y: 0, w: 1, h: 1 };
const SCENES = {
  'step-chat': { rect: FULL, focus: FULL },
  'step-math': { rect: { x: 0.7294, y: 0.158, w: 0.2469, h: 0.352 }, focus: { x: 0.7144, y: 0.13, w: 0.2769, h: 0.408 }, base: 'step-chat' },
  'step-graph': { rect: FULL, focus: FULL },
  'step-globe': { rect: FULL, focus: FULL },
  'step-planet': { rect: { x: 0.21, y: 0.2282, w: 0.58, h: 0.5506 }, focus: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }, base: 'step-globe' },
};
const pct = (v) => `${(v * 100).toFixed(3)}%`;

// "play once when its top passes this line of the window". sync 'play': start on the way in and never pause on the
// way out (the default, 'play pause', would freeze a half-played entrance if you scroll past it quickly)
const whenSeen = (target, at = '86%') => onScroll({ target, enter: { container: at, target: 'top' }, repeat: false, sync: 'play' });

drawStars();
core3D();
worlds();
villa();
if (!reduce && doc.classList.contains('motion-ready')) {
  doc.classList.add('motion-live');   // from here on, every hidden start is ours to reveal
  opening();
  coreConversation();
  createScope({ mediaQueries: { desktop: '(min-width: 1000px)' } }).add((scope) => {
    if (scope.matches.desktop) return storyStage();
    storyRevealsNarrow();
  });
  // the journey (journey.js) carries the page from here: the core's flight, the thread, the network, the pipeline,
  // the 3D windows, the light. If it can't start, every section falls back to its own reveal, so nothing stays hidden.
  let journey = false;
  try { startJourney({ EASE, MS, SMOOTH }); journey = true; doc.classList.add('journey-on'); }
  catch (error) { console.error('Jarvis: the page journey could not start', error); utils.set('.stage-frame', { opacity: 1 }); }
  sectionReveals(journey);
  skyDrift();
  flowLine(journey);
  microInteractions();
  import('./coding-replay.js').then(({ codingReplay }) => { const f = $('.next-coding'); if (f) codingReplay(f, { EASE }); }).catch(() => {});   // the screenshot stays
} else if (reduce) {
  try { startJourney({ still: true, EASE, MS, SMOOTH }); } catch { /* decoration only */ }
}

// ---------- the sky: stars drawn once (again only when the window size changes) ----------
function drawStars() {
  const canvas = $('#starfield');
  if (!canvas) return;
  const paint = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = canvas.clientHeight || window.innerHeight;   // the canvas is a little taller than the window: room to drift
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const rand = mulberry(7);
    const count = Math.round((w * h) / 5200);
    for (let i = 0; i < count; i++) {
      const r = rand() < 0.92 ? 0.6 + rand() * 0.6 : 1.2 + rand() * 0.8;
      ctx.globalAlpha = 0.15 + rand() * 0.55;
      ctx.fillStyle = rand() < 0.12 ? '#a8e9ff' : '#ffffff';
      ctx.beginPath(); ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2); ctx.fill();
    }
  };
  // the near layer: a few soft motes, larger and fainter, with a little of the core's colours
  const dust = document.createElement('canvas');
  dust.id = 'dust'; dust.setAttribute('aria-hidden', 'true');
  canvas.after(dust);
  const paintDust = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = window.innerWidth, h = dust.clientHeight || window.innerHeight * 1.3;
    dust.width = Math.round(w * dpr); dust.height = Math.round(h * dpr);
    const ctx = dust.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const rand = mulberry(31), tints = ['168,233,255', '165,139,255', '255,255,255'];
    for (let i = 0, n = Math.round((w * h) / 42000); i < n; i++) {
      const x = rand() * w, y = rand() * h, r = 1.6 + rand() * 3.2, a = 0.06 + rand() * 0.16, c = tints[Math.floor(rand() * 3)];
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
      g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill();
    }
  };
  let timer = 0;
  paint(); paintDust();
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { paint(); paintDust(); }, 200); });
}
function mulberry(seed) {   // the same sky every visit
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// the sky moves a tenth as fast as the page: depth, and the sections read as one continuous place
// four depths (ui-ux-pro-max, parallax storytelling): the light wash stays, the far stars drift a tenth as fast as the
// page, the near dust a quarter as fast, and the content scrolls; together they read as one deep space
function skyDrift() {
  const main = $('#main');
  if (!$('#starfield') || !main) return;
  const scrolled = () => onScroll({ target: main, enter: 'top top', leave: 'bottom bottom', sync: 1 });
  animate('#starfield', { y: ['0vh', '-10vh'], ease: 'linear', autoplay: scrolled() });
  if ($('#dust')) animate('#dust', { y: ['0vh', '-26vh'], ease: 'linear', autoplay: scrolled() });
}

// ---------- the opening: header, core and headline together; readable in about a second ----------
function opening() {
  const ticks = $('.dial-ticks');
  if (ticks) {   // the dial's ticks are drawn here so the markup stays small; the first is at twelve o'clock
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2 - Math.PI / 2, major = i % 6 === 0, r1 = major ? 252 : 256, r2 = 264;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', 300 + Math.cos(a) * r1); line.setAttribute('y1', 300 + Math.sin(a) * r1);
      line.setAttribute('x2', 300 + Math.cos(a) * r2); line.setAttribute('y2', 300 + Math.sin(a) * r2);
      if (major) line.setAttribute('class', 'major');
      ticks.append(line);
    }
  }
  const title = $('[data-hero="title"]');
  // the name resolves letter by letter, then the one sentence of what he does rises under it (readers get plain text)
  const letters = splitText($('.hero-name', title), { chars: { wrap: 'clip' }, accessible: true }).chars;
  const words = splitText($('.hero-line', title), { words: { wrap: 'clip' }, accessible: true }).words;
  const header = $$('.site-header .brand, .site-nav li, .header-cta, .menu-toggle');
  // every start state now, before the first frame, so the finished page never flashes
  utils.set(words, { perspective: 700, y: '125%', rotateX: -75 });
  utils.set(letters, { perspective: 900, y: '120%', rotateX: -80 });
  utils.set('.dial-ticks line', { opacity: 0 });
  utils.set([title, '[data-hero="cta"]'], { opacity: 1 });   // the row is shown; its buttons carry their own entrance
  utils.set('.cta-row .btn', { opacity: 0 });

  createTimeline({ defaults: { ease: EASE.out, duration: MS.base } })
    .add(header, { opacity: [0, 1], y: [-10, 0], delay: stagger(30) }, 0)
    .add('[data-hero="core"]', { opacity: [0, 1], scale: [0.9, 1], duration: 900 }, 0)
    .add(letters, { y: ['120%', '0%'], rotateX: [-80, 0], color: ['#4fd8ff', '#ffffff'], duration: 900, delay: stagger(50) }, 60)
    .add(words, { y: ['125%', '0%'], rotateX: [-75, 0], duration: MS.slow, delay: stagger(45) }, 420)
    .add('.dial-ticks line', { opacity: [0, 1], duration: MS.quick, delay: stagger(5) }, 100)   // the ticks go round like a clock hand
    .add(createDrawable('.core-dial .dial-ring'), { draw: ['0 0', '0 1'], opacity: [0, 1], duration: MS.slow, ease: EASE.inOut, delay: stagger(90) }, 160)
    .add(createDrawable('.core-dial .dial-arc'), { draw: ['0 0', '0 1'], opacity: [0, 1], duration: MS.slow, ease: EASE.inOut, delay: stagger(140) }, 360)
    .add('[data-hero="lede"]', { opacity: [0, 1], y: [18, 0] }, 560)
    .add('.cta-row .btn', { opacity: [0, 1], y: [14, 0], scale: [0.97, 1], delay: stagger(60) }, 660)
    .add('[data-hero="meta"]', { opacity: [0, 1], y: [10, 0] }, 780);

  // the one living loop: a comet on its orbit, faded in once the core is built, paused while the hero is off screen
  const { translateX, translateY } = createMotionPath('#orbitPath');
  const comet = animate('.comet', { translateX, translateY, duration: 11000, ease: 'linear', loop: true });
  animate('.comet', { opacity: [0, 1], duration: MS.slow, delay: 900, ease: EASE.out });
  // the scroll cue nudges twice, then rests
  animate('.scroll-cue span', { y: [0, 12], opacity: [1, 0], duration: 1200, ease: EASE.inOut, loop: 2, delay: 1600 });
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? comet.play() : comet.pause()), { threshold: 0.02 }).observe($('.hero'));
}

// ---------- the core's conversation: site.js plays the script, this animates the words ----------
function coreConversation() {
  const state = $('#coreState'), sub = $('#coreSub'), core = $('.hero-core');
  if (!state || !sub) return;
  let current = null;
  window.jarvisCoreAnimate = (step, title, rgb) => {
    core.style.setProperty('--core-rgb', rgb);
    if (current) current.revert();
    const swap = () => {
      state.textContent = title;
      sub.textContent = '';
      const said = document.createElement('span');
      said.className = 'sr-only'; said.textContent = step.text;   // what a reader hears: the whole sentence
      const shown = document.createElement('span');
      shown.setAttribute('aria-hidden', 'true');
      for (const part of step.text.split(/(\s+)/)) {   // letters grouped in words, so a line never breaks inside one
        if (!part) continue;
        if (/^\s/.test(part)) { shown.append(part); continue; }
        const w = document.createElement('span'); w.className = 'w';
        for (const ch of part) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; w.append(s); }
        shown.append(w);
      }
      sub.append(said, shown);
      const letters = shown.querySelectorAll('.ch');
      utils.set(letters, { opacity: 0 });
      // what you said types out letter by letter; his answer rises in a quick wave
      current = step.state === 'listening'
        ? animate(letters, { opacity: [0, 1], duration: 60, delay: stagger(24), ease: 'linear' })
        : animate(letters, { opacity: [0, 1], y: ['0.4em', '0em'], duration: 420, delay: stagger(7), ease: EASE.out });
      animate(state, { opacity: [0, 1], y: [8, 0], duration: 420, ease: EASE.out });
    };
    if (sub.childNodes.length) {
      animate([state, sub], { opacity: 0, y: -4, duration: 180, ease: EASE.exit, onComplete: () => { utils.set([state, sub], { opacity: 1, y: 0 }); swap(); } });
    } else swap();
  };
}

// ---------- each section arrives once, as it comes into view ----------
function sectionReveals(journey) {
  for (const head of $$('.section-head[data-reveal]')) {
    // the heading rises out of its own lines; the line under it follows
    const h2 = head.querySelector('h2'), rest = Array.from(head.children).filter((el) => el !== h2);
    const words = splitText(h2, { words: { wrap: 'clip' }, accessible: true }).words;
    utils.set(words, { y: '125%' });
    utils.set(rest, { opacity: 0 });
    utils.set(head, { opacity: 1 });
    createTimeline({ defaults: { ease: EASE.out }, autoplay: whenSeen(head) })
      .add(words, { y: ['125%', '0%'], duration: MS.slow, delay: stagger(30) }, 0)
      .add(rest, { opacity: [0, 1], y: [16, 0], duration: MS.base }, 220);
  }
  for (const el of $$('[data-reveal]').filter((el) => !el.matches('.section-head'))) {
    animate(el, { opacity: [0, 1], y: [28, 0], duration: MS.slow, ease: EASE.out, autoplay: whenSeen(el) });
  }
  for (const group of $$('[data-stagger]').filter((g) => !(journey && g.matches('.ask-grid, .next-grid')))) {
    const tl = createTimeline({ defaults: { ease: EASE.out }, autoplay: whenSeen(group) })
      .add(group.children, { opacity: [0, 1], y: [32, 0], scale: [0.985, 1], duration: MS.slow, delay: stagger(STAGGER) }, 0);
    const shots = group.querySelectorAll('.next-card > img');   // the next-release screens open out from their centre
    if (shots.length) tl.add(shots, { clipPath: ['inset(7% 7% 7% 7% round 14px)', 'inset(0% 0% 0% 0% round 14px)'], duration: 900, ease: EASE.inOut, delay: stagger(STAGGER) }, 60);
  }
}

// ---------- the showcase, desktop: real screens on one stage, the text scrolling beside it ----------
function storyStage() {
  const story = $('[data-story]');
  if (!story) return;
  const steps = $$('.story-step', story);
  const stage = $('.stage-shots', story);
  const cam = document.createElement('div');
  cam.className = 'cam';
  stage.append(cam);
  const layers = steps.map((step) => ({ step, shot: $('.step-shot', step), scene: SCENES[step.id] || { rect: FULL, focus: FULL } }));
  for (const { shot, scene } of layers) {   // the same figures, laid out in the window (put back below)
    Object.assign(shot.style, { left: pct(scene.rect.x), top: pct(scene.rect.y), width: pct(scene.rect.w), height: pct(scene.rect.h) });
    cam.append(shot);
  }
  const view = { x: 0, y: 0, s: 1 };   // the camera, in window fractions
  const place = () => {
    const W = stage.clientWidth, H = stage.clientHeight;
    cam.style.transform = `translate(${(-view.x * view.s * W).toFixed(2)}px, ${(-view.y * view.s * H).toFixed(2)}px) scale(${view.s.toFixed(4)})`;
  };
  const aim = (f) => {   // the view that fits a focus rectangle, centred
    const s = 1 / Math.max(f.w, f.h), edge = 1 - 1 / s;   // never looking past the edge of the window
    return { x: Math.min(edge, Math.max(0, f.x + f.w / 2 - 0.5 / s)), y: Math.min(edge, Math.max(0, f.y + f.h / 2 - 0.5 / s)), s };
  };
  let active = -1, move = null;
  const show = (i, first = false) => {
    if (i === active) return;
    active = i;
    steps.forEach((s, n) => s.classList.toggle('is-active', n === i));
    const scene = layers[i].scene;
    const keep = new Set([i, layers.findIndex((l) => l.step.id === scene.base)]);
    const target = aim(scene.focus);
    if (first) {
      layers.forEach((l, n) => { utils.set(l.shot, { opacity: keep.has(n) ? 1 : 0 }); l.shot.classList.toggle('is-active', n === i); });
      Object.assign(view, target); place();
      return;
    }
    // the camera travels to the new view while the screens it needs fade in, and the ones it no longer needs go
    if (move) move.pause();
    move = animate(view, { ...target, duration: 900, ease: EASE.inOut, onRender: place });
    const top = Math.max(...keep);
    layers.forEach((l, n) => {
      l.shot.classList.toggle('is-active', n === i);
      if (keep.has(n)) animate(l.shot, { opacity: 1, duration: 520, ease: EASE.out, delay: n === i && scene.base ? 260 : 0 });
      else animate(l.shot, { opacity: 0, duration: 380, ease: EASE.exit, delay: n > top ? 0 : 420 });   // a screen above the new one leaves at once; one below waits until it's covered
    });
  };
  show(0, true);
  window.addEventListener('resize', place);
  const pick = { p: 0 };   // which step is being read: the one whose block is in the middle of the window
  animate(pick, { p: [0, 1], ease: 'linear',
    autoplay: onScroll({ target: $('.story-steps', story), enter: { container: 'center', target: 'top' }, leave: { container: 'center', target: 'bottom' }, sync: true,
      onUpdate: (self) => show(Math.min(layers.length - 1, Math.max(0, Math.floor(self.progress * layers.length)))) }) });
  return () => {   // narrower window: the figures go back into their steps, as the page is without motion
    window.removeEventListener('resize', place);
    layers.forEach(({ step, shot }) => { shot.classList.remove('is-active'); shot.removeAttribute('style'); step.append(shot); step.classList.remove('is-active'); });
    cam.remove();
  };
}

// the showcase, narrow screens: each step's words, then its screen
function storyRevealsNarrow() {
  for (const step of $$('.story-step')) {
    const text = step.querySelector('.step-text'), shot = step.querySelector('.step-shot');
    utils.set([text, shot], { opacity: 0 });
    createTimeline({ defaults: { ease: EASE.out }, autoplay: whenSeen(step, '88%') })
      .add(text, { opacity: [0, 1], y: [24, 0], duration: MS.slow }, 0)
      .add(shot, { opacity: [0, 1], y: [32, 0], scale: [0.98, 1], duration: MS.slow }, 140);
  }
}

// ---------- how it works: the line draws as you scroll, and each step lights as the line reaches it ----------
function flowLine(journey) {
  const wrap = $('.flow-wrap'), path = $('.flow-line path');
  if (!wrap || !path) return;
  animate('.flow-step', { opacity: [0, 1], y: [24, 0], duration: MS.slow, ease: EASE.out, delay: stagger(110), autoplay: whenSeen(wrap, '84%') });
  if (journey || getComputedStyle(path.closest('svg')).display === 'none') return;   // the thread is the line, or the steps are stacked
  const nodes = $$('.flow-node', wrap);
  const tl = createTimeline({ defaults: { ease: 'linear' }, autoplay: onScroll({ target: wrap, enter: { container: '82%', target: 'top' }, leave: { container: '45%', target: 'top' }, sync: SMOOTH }) })
    .add(createDrawable(path), { draw: ['0 0', '0 1'], duration: 1000 }, 0);
  nodes.forEach((node, i) => tl.add(node, { scale: [0.86, 1], opacity: [0.5, 1], duration: 90, ease: EASE.out }, Math.max(0, (i / (nodes.length - 1)) * 1000 - 60)));
}

// ---------- small things that answer you ----------
function microInteractions() {
  // the FAQ and the checksum box open and close smoothly instead of snapping
  for (const d of $$('details')) {
    const summary = d.querySelector('summary'), body = d.querySelector('.details-body, .verify-body');
    if (!summary || !body) continue;
    let running = null;
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (running) running.revert();
      const opening = !d.open;
      if (opening) d.open = true;
      // border-box: the padding goes with the height, or the last few pixels would snap
      const h = body.scrollHeight, cs = getComputedStyle(body), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
      utils.set(body, { overflow: 'hidden' });
      running = animate(body, opening
        ? { height: [0, h], paddingTop: [0, pt], paddingBottom: [0, pb], opacity: [0, 1], duration: 380, ease: EASE.out }
        : { height: [h, 0], paddingTop: [pt, 0], paddingBottom: [pb, 0], opacity: [1, 0], duration: 260, ease: EASE.exit });
      running.then(() => { if (!opening) d.open = false; running = null; body.removeAttribute('style'); });
    });
  }
  // a tab's panel slides in from the side of the tab you chose
  let lastTab = $('[role="tab"][aria-selected="true"]');
  for (const tab of $$('[role="tab"]')) {
    tab.addEventListener('click', () => {
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      const tabs = $$('[role="tab"]', tab.closest('[role="tablist"]'));
      const dir = lastTab && tabs.indexOf(tab) < tabs.indexOf(lastTab) ? -1 : 1;
      if (tab !== lastTab && panel && !panel.hidden) animate(panel, { opacity: [0, 1], x: [18 * dir, 0], duration: 420, ease: EASE.out });
      lastTab = tab;
    });
  }
  // a copy that worked says so with a small lift of the button
  for (const btn of $$('.copy-btn')) {
    btn.addEventListener('click', () => setTimeout(() => {
      if (btn.classList.contains('is-copied')) animate(btn, { scale: [1, 1.06, 1], duration: 380, ease: EASE.out });
    }, 30));
  }
  // every button gives under a press (mouse, touch or pen) and springs back
  for (const btn of $$('.btn, .tab, .copy-btn, .menu-toggle')) {
    btn.addEventListener('pointerdown', () => animate(btn, { scale: 0.96, duration: 120, ease: EASE.out }));
    for (const end of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(end, () => animate(btn, { scale: 1, ease: SPRING.press }));
  }
  // the big buttons lean toward a mouse pointer (never on touch), and settle when it leaves
  if (finePointer) {
    for (const btn of $$('.btn-lg')) {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        animate(btn, { x: ((e.clientX - r.left) / r.width - 0.5) * 6, y: ((e.clientY - r.top) / r.height - 0.5) * 4, duration: MS.quick, ease: EASE.out });
      });
      btn.addEventListener('pointerleave', () => animate(btn, { x: 0, y: 0, ease: SPRING.settle }));
    }
  }
  navBar();
  menuItems();
}

// one underline that glides between the header links: to the one you point at, back to the section you're in
function navBar() {
  const list = $('.site-nav ul');
  if (!list || !finePointer) return;
  const links = $$('a', list);
  const bar = document.createElement('span');
  bar.className = 'nav-bar'; bar.setAttribute('aria-hidden', 'true');
  list.append(bar);
  list.classList.add('has-bar');
  let shown = false;
  const moveTo = (a, jump = false) => {
    if (!a || getComputedStyle(list).flexDirection === 'column') {   // nothing to mark, or the phone menu
      if (shown) animate(bar, { opacity: 0, duration: 200, ease: EASE.out });
      shown = false; return;
    }
    const lr = list.getBoundingClientRect(), r = a.getBoundingClientRect(), pad = parseFloat(getComputedStyle(a).paddingLeft);
    const to = { x: r.left - lr.left + pad, width: Math.max(0, r.width - 2 * pad) };
    if (!shown || jump) { utils.set(bar, to); animate(bar, { opacity: 1, duration: MS.quick, ease: EASE.out }); shown = true; return; }
    animate(bar, { ...to, opacity: 1, ease: SPRING.glide });
  };
  const current = () => links.find((a) => a.getAttribute('aria-current') === 'true');
  links.forEach((a) => a.addEventListener('pointerenter', () => moveTo(a)));
  list.addEventListener('pointerleave', () => moveTo(current()));
  new MutationObserver(() => moveTo(current())).observe(list, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  window.addEventListener('resize', () => moveTo(current(), true));
  moveTo(current(), true);
}

// the phone menu's links arrive one after another when it opens
function menuItems() {
  const nav = $('#siteNav');
  if (!nav) return;
  let open = nav.classList.contains('is-open');
  new MutationObserver(() => {
    const now = nav.classList.contains('is-open');
    if (now && !open) animate($$('li', nav), { opacity: [0, 1], y: [-8, 0], duration: 320, ease: EASE.out, delay: stagger(35, { start: 60 }) });
    open = now;
  }).observe(nav, { attributes: true, attributeFilter: ['class'] });
}

// ---------- the 3D core (three/core3d.js): replaces the 2D one when WebGL 2 is there; the 2D one stays otherwise ----------
async function core3D() {
  const stage = $('.core-stage'), flat = $('#heroOrb');
  const giveUp = () => doc.classList.remove('gl');   // the 2D core shows again
  if (!stage || !doc.classList.contains('gl')) return;
  const late = setTimeout(giveUp, 2500);   // never leave the hero without a core
  try {
    const { canWebGL2 } = await import('./three/kit.js');
    if (!canWebGL2()) return giveUp();
    const { startCore3D } = await import('./three/core3d.js');
    const core = startCore3D(stage, { still: reduce });
    if (!core) return giveUp();
    clearTimeout(late);
    doc.classList.add('gl');
    flat.hidden = true;   // orb.js stops drawing a hidden canvas
    stage.classList.add('has-3d');
    const flatState = window.setOrbState;
    window.setOrbState = (state) => { flatState?.(state); core.setState(state); };
    const said = ($('#coreState')?.textContent || '').toLowerCase();   // join the conversation where it is
    core.setState(said.includes('listen') ? 'listening' : said.includes('think') ? 'thinking' : said.includes('speak') ? 'speaking' : 'idle');
  } catch (error) { console.error('Jarvis: the 3D core could not start', error); giveUp(); }
}

// ---------- the worlds (three/worlds.js): loaded as the section comes near, never before ----------
function worlds() {
  const root = $('[data-worlds]');
  if (!root || !doc.classList.contains('gl')) return;
  const io = new IntersectionObserver(async ([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    try {
      const { canWebGL2 } = await import('./three/kit.js');
      if (!canWebGL2()) return;
      const { startWorlds } = await import('./three/worlds.js');
      startWorlds(root, { still: reduce });
    } catch (error) { console.error('Jarvis: the 3D worlds could not start', error); }   // the still picture stays
  }, { rootMargin: '900px 0px' });
  io.observe(root);
}

// ---------- building in Blender (three/villa.js): loaded as the section comes near ----------
function villa() {
  const root = $('[data-build]');
  if (!root || !doc.classList.contains('gl')) return;
  if (reduce) root.classList.add('is-still');
  const io = new IntersectionObserver(async ([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    try {
      const { canWebGL2 } = await import('./three/kit.js');
      if (!canWebGL2()) return root.classList.add('is-failed');
      const { startVilla } = await import('./three/villa.js');
      if (!startVilla(root, { still: reduce })) root.classList.add('is-failed');
    } catch (error) { console.error('Jarvis: the Blender scene could not start', error); root.classList.add('is-failed'); }   // the list of requests shows instead
  }, { rootMargin: '900px 0px' });
  io.observe(root);
}
