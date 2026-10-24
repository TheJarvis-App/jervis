// The journey: one signal from the first frame to the last (see the transition map in .impeccable/surfaces/index-html.md).
//
// The comet that orbits Jarvis's core leaves its orbit when you scroll and becomes a signal on one line, the thread,
// that runs the whole page in the right margin. Every section is a place the signal arrives: the core flies into the
// first real app screen and becomes the core inside it; the steps of the showcase light as it passes; it splits into a
// network that reaches every capability; it becomes the How it works pipeline itself; it traces the download panel; and
// it ends in a small dial above the closing words, where a comet takes up orbit again. A light behind everything
// shifts through the app's own state colours as you go.
//
// One smoothed scroll value drives all of it (Anime.js onScroll, synced with a little glide), so every part moves as
// one system; arrivals play once, on timelines, when the signal reaches them, also after a jump. Geometry is measured
// from the real layout and rebuilt whenever it changes. With reduced motion everything is drawn in its final state.
import { animate, createTimeline, stagger, onScroll, createDrawable, createMotionPath, utils, eases } from './vendor/anime.esm.min.js';

const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const el = (tag, attrs = {}, parent = null) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.append(e);
  return e;
};
const box = (node) => {   // a node's box in page coordinates
  const r = node.getBoundingClientRect();
  return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY, width: r.width, height: r.height, cx: r.left + scrollX + r.width / 2, cy: r.top + scrollY + r.height / 2 };
};
const outQuad = eases.out(2), outCubic = eases.out(3);

// where the core sits inside the first real screenshot (jervis-chat-1600.webp), measured from the image
const SHOT_CORE = { x: 0.473, y: 0.264, d: 0.219 };
const ORB_SPHERE = 0.49;   // the hero orb's sphere is 0.49 of its canvas (orb.js: R = size * 0.245)
// the light behind the page, in the app's state colours
const WASH = { cyan: '79 216 255', blue: '90 169 255', violet: '165 139 255', mint: '61 242 192' };
const SECTION_LIGHT = { intro: 'cyan', showcase: 'blue', worlds: 'violet', features: 'violet', next: 'cyan', how: 'mint', download: 'cyan', closing: 'cyan' };

export function startJourney({ still = false, EASE, MS, SMOOTH }) {
  const doc = document.documentElement;
  const svg = el('svg', { class: 'journey', 'aria-hidden': 'true' });
  document.body.append(svg);
  const line = el('path', { class: 'journey-line' }, svg);
  const trail = el('path', { class: 'journey-trail' }, svg);
  const nodeLayer = el('g', {}, svg);
  const comet = el('g', { class: 'journey-comet' }, svg);
  el('circle', { class: 'glow', r: 11 }, comet);
  el('circle', { r: 4.5 }, comet);

  const sky = $('.sky');
  const washes = {};
  if (sky && !still) for (const name in WASH) {
    const w = document.createElement('div');
    w.className = 'wash'; w.style.setProperty('--wash', WASH[name]); w.dataset.light = name;
    sky.append(w); washes[name] = w;
  }

  const network = makeNetwork($('#features .ask-grid'), { still, EASE, MS });
  const trace = makeTrace($('.download-panel'), { still, EASE });
  const dial = makeEndDial($('.closing-inner'), { still, EASE, MS });

  let G = null;          // the measured geometry
  let current = 0;       // the smoothed scroll position everything is drawn at
  let pausedOrb = false;

  // ---------- measuring the page ----------
  function layout() {
    const vw = doc.clientWidth, vh = window.innerHeight;
    const desktop = window.matchMedia('(min-width: 1000px)').matches;
    const wide = window.matchMedia('(min-width: 961px)').matches;   // How it works sits in one row
    const container = $('.container');
    const contentRight = container.getBoundingClientRect().right - parseFloat(getComputedStyle(container).paddingRight);
    const xR = Math.round(contentRight + (vw - contentRight) / 2);
    const maxScroll = Math.max(1, doc.scrollHeight - vh);

    // clear what we move, so we measure the page as laid out
    const coreStage = $('.core-stage'), frame = $('.stage-frame');
    const moved = [coreStage, frame, $('.hero-copy'), $('.core-caption'), $('.core-dial'), ...$$('.next-card')].filter(Boolean);
    moved.forEach((n) => { n.style.transform = ''; n.style.opacity = ''; });
    $$('.step-shot img').forEach((img) => { img.style.maskImage = img.style.webkitMaskImage = ''; });

    const stations = [];   // each: { y, pts: [{ x, y, ds (extra scroll, in viewports), node, light, arrive, at }] }
    const at = 0.62;       // the signal rides at 62% of the window's height
    const node = (y, extra = {}) => stations.push({ y, pts: [{ x: xR, y, node: true, ...extra }] });
    for (const id of ['showcase', 'worlds', 'features', 'next', 'how', 'privacy', 'requirements', 'install', 'faq']) {
      const h = document.getElementById(id)?.querySelector('h2');
      if (h) node(box(h).top + 22);
    }
    for (const t of $$('.story-step .step-text')) node(box(t).top + 16);
    if (network) {
      const n = network.layout(xR);
      stations.push({ y: n.y, pts: [{ x: xR, y: n.y, at: 0.78, arrive: network.play }] });
    }
    const flowNodes = $$('.flow-node');
    if (flowNodes.length) {
      const nb = flowNodes.map(box);
      if (wide) {   // the thread becomes the pipeline: above the steps to Hear, along to Answer, back to the margin
        const above = box($('.flow')).top - 30, ny = nb[0].cy;
        stations.push({ y: above, pts: [
          { x: xR, y: above },
          { x: nb[0].cx, y: above, ds: 0.1 },
          { x: nb[0].cx, y: ny, ds: 0.05, light: flowNodes[0] },
          ...nb.slice(1).map((b, i) => ({ x: b.cx, y: ny, ds: 0.07, light: flowNodes[i + 1] })),
          { x: xR, y: ny, ds: 0.06 },
        ] });
      } else nb.forEach((b, i) => stations.push({ y: b.cy, pts: [{ x: xR, y: b.cy, light: flowNodes[i] }] }));
    }
    if (trace) { const y = trace.layout().top + 24; stations.push({ y, pts: [{ x: xR, y, node: true, at: 0.72, arrive: trace.play }] }); }
    if (dial) {
      const d = dial.layout();
      stations.push({ y: d.cy, pts: [{ x: xR, y: d.cy, at: 0.7 }, { x: d.cx + d.r, y: d.cy, ds: 0.12, arrive: dial.play, end: true }] });
    }
    stations.sort((a, b) => a.y - b.y);

    // the route: out of the core sideways to the margin, then down through every station
    const core = box(coreStage);
    const P = [{ x: core.cx, y: core.cy, s: 0 }, { x: xR, y: core.cy, s: vh * 0.16 }];
    for (const st of stations) {
      st.pts.forEach((p, i) => {
        const prev = P[P.length - 1];
        let s = i === 0 ? st.y - vh * (p.at ?? at) : prev.s + vh * (p.ds || 0.05);
        P.push({ ...p, s: Math.max(s, prev.s + 1) });
      });
    }
    // everything must be reachable before the page ends
    P[P.length - 1].s = Math.min(P[P.length - 1].s, maxScroll - 1);
    for (let i = P.length - 2; i >= 0; i--) P[i].s = Math.min(P[i].s, P[i + 1].s - 1);
    // lengths along the route (all straight runs, so exact)
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
    const total = cum[cum.length - 1];
    const d = 'M' + P.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L');
    line.setAttribute('d', d); trail.setAttribute('d', d);
    svg.setAttribute('width', vw); svg.setAttribute('height', doc.scrollHeight);
    svg.style.height = doc.scrollHeight + 'px';
    line.style.strokeDasharray = `${total} ${total}`;
    const T = 140;
    trail.style.strokeDasharray = `${T} ${total + T}`;

    // nodes on the thread
    nodeLayer.replaceChildren();
    P.forEach((p, i) => {
      if (p.node) p.dot = el('circle', { class: 'journey-node', cx: p.x, cy: p.y, r: 4.5 }, nodeLayer);
      p.len = cum[i];
      if (p.light) p.light.classList.remove('is-lit');
    });

    // the core's flight into the first screen (desktop)
    let dock = null;
    const shots = $('.stage-shots'), chat = $('.cam .step-shot img');
    if (desktop && shots && chat && frame) {
      // the window's natural place: the stage starts at the top of the story and sticks under the header when that
      // reaches it, so landing exactly then means the core and the real one stay together from there on
      const story = box($('[data-story]')), stage = box($('.story-stage')), s = box(shots);
      const headerH = $('.site-header')?.offsetHeight || 0;
      const top = story.top + (s.top - stage.top);
      const target = { x: s.left + SHOT_CORE.x * s.width, y: top + SHOT_CORE.y * s.height };
      dock = {
        dx: target.x - core.cx, dy: target.y - core.cy,
        scale: (SHOT_CORE.d * s.width) / (ORB_SPHERE * coreStage.offsetWidth),
        end: Math.max(vh * 0.5, story.top - headerH),
        hole: s.width * 0.23, chat,
      };
    }
    // the next-release windows, for their rise out of the plane
    const cards = $$('.next-card').map((c) => ({ c, top: box(c).top, img: c.querySelector('img'), opened: false }));
    // the light: which colour each stretch of the page has
    const lights = $$('main > section').map((s) => ({ name: SECTION_LIGHT[s.id || s.className.split(' ')[0]], top: box(s).top, bottom: box(s).bottom })).filter((s) => s.name);

    G = { P, cum, total, T, vh, maxScroll, desktop, dock, cards, lights, moved };
  }

  // ---------- drawing at one scroll position ----------
  function lengthAt(sc) {
    const { P, cum, total } = G;
    if (sc <= P[0].s) return 0;
    for (let i = 1; i < P.length; i++) if (sc < P[i].s) return cum[i - 1] + ((sc - P[i - 1].s) / (P[i].s - P[i - 1].s)) * (cum[i] - cum[i - 1]);
    return total;
  }
  function pointAt(L) {
    const { P, cum } = G;
    for (let i = 1; i < P.length; i++) if (L <= cum[i]) {
      const t = (L - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
      return { x: P[i - 1].x + (P[i].x - P[i - 1].x) * t, y: P[i - 1].y + (P[i].y - P[i - 1].y) * t };
    }
    return P[P.length - 1];
  }

  function render(sc) {
    current = sc;
    if (!G) return;
    const { P, total, T, vh } = G;
    const L = still ? total : lengthAt(sc);
    line.style.strokeDashoffset = total - L;
    trail.style.strokeDashoffset = T - L;
    trail.style.opacity = still ? 0 : 1;
    const head = pointAt(L);
    comet.setAttribute('transform', `translate(${head.x.toFixed(1)} ${head.y.toFixed(1)})`);
    comet.style.opacity = still ? 0 : clamp01(L / 40) * clamp01((total - L) / 80);
    for (const p of P) {
      const lit = L >= p.len - 0.5;
      if (p.dot) p.dot.classList.toggle('is-lit', lit);
      if (p.light) p.light.classList.toggle('is-lit', lit);
      if (lit && p.arrive && !p.fired) { p.fired = true; p.arrive(); }
    }
    if (still) return;
    // the core flies into the first screen (desktop), or steps back (phones)
    const coreStage = $('.core-stage');
    if (G.dock) {
      const d = G.dock, p = clamp01(sc / d.end);
      // it covers most of the way early and settles onto the real core, so the two never show apart
      const x = d.dx * outQuad(p), y = d.dy * outCubic(p), s = 1 + (d.scale - 1) * outCubic(p);
      coreStage.style.transform = p ? `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)})` : '';
      coreStage.style.opacity = 1 - clamp01((p - 0.9) / 0.1);
      $('.core-dial').style.opacity = 1 - clamp01(p / 0.35);
      $('.core-caption').style.opacity = 1 - clamp01(p / 0.3);
      const copy = $('.hero-copy');
      copy.style.opacity = 1 - clamp01(p / 0.5);   // fades out fully as the core leaves
      copy.style.transform = p ? `translateY(${(-40 * clamp01(p / 0.6)).toFixed(1)}px)` : '';
      // the window rises from a tilted plane to meet the landing core
      const q = outCubic(clamp01((p - 0.6) / 0.36));
      const frame = $('.stage-frame');
      frame.style.opacity = q;
      // the real core in the screenshot stays hidden under the flying one until the moment it lands
      const hole = d.hole * (1 - clamp01((p - 0.9) / 0.1));
      d.chat.style.maskImage = d.chat.style.webkitMaskImage = hole > 1
        ? `radial-gradient(circle ${hole.toFixed(1)}px at ${SHOT_CORE.x * 100}% ${SHOT_CORE.y * 100}%, transparent ${(hole * 0.8).toFixed(1)}px, #000 ${hole.toFixed(1)}px)` : '';
      frame.style.transform = q < 1 ? `perspective(1400px) translateY(${(40 * (1 - q)).toFixed(1)}px) rotateX(${(16 * (1 - q)).toFixed(2)}deg) scale(${(0.94 + 0.06 * q).toFixed(4)})` : '';
      // once the core has landed the real screen has taken over: the hero orb can stop drawing
      if (p >= 1 && !pausedOrb) { document.body.classList.add('scene-paused'); pausedOrb = true; }
      if (p < 1 && pausedOrb) { document.body.classList.remove('scene-paused'); pausedOrb = false; }
    } else {
      const p = clamp01(sc / (vh * 0.6));
      coreStage.style.transform = p ? `scale(${(1 - 0.1 * p).toFixed(4)})` : '';
      coreStage.style.opacity = 1 - 0.6 * p;
    }
    // the next-release windows rise out of a tilted plane as they come up the screen
    const tilt = G.desktop ? 16 : 8;
    for (const card of G.cards) {
      const t = outQuad(clamp01((sc + vh - card.top) / (vh * 0.5)));
      card.c.style.opacity = t < 0.02 ? 0 : 0.2 + 0.8 * t;   // never lingers below 0.2: hidden, or on its way in
      card.c.style.transform = t < 1 ? `perspective(1200px) translateY(${(60 * (1 - t)).toFixed(1)}px) rotateX(${(tilt * (1 - t)).toFixed(2)}deg)` : '';
      if (t > 0.35 && !card.opened && card.img) {
        card.opened = true;
        animate(card.img, { clipPath: ['inset(7% 7% 7% 7% round 14px)', 'inset(0% 0% 0% 0% round 14px)'], duration: 900, ease: EASE.inOut });
      }
    }
    // the light: the colours of the sections in the middle of the window, blended
    const from = sc + vh * 0.15, to = sc + vh * 0.85, weight = {};
    for (const s of G.lights) weight[s.name] = (weight[s.name] || 0) + Math.max(0, Math.min(to, s.bottom) - Math.max(from, s.top));
    for (const name in washes) {
      const o = Math.min(1, (weight[name] || 0) / (vh * 0.7));
      if (Math.abs(o - (washes[name]._o ?? -1)) > 0.01) { washes[name].style.opacity = o.toFixed(3); washes[name]._o = o; }
    }
  }

  // ---------- running it ----------
  layout();
  render(still ? 0 : window.scrollY);
  // the page's layout changes (fonts, images, a resize, the story stage switching on or off): measure again
  let timer = 0;
  new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => { layout(); render(current); }, 150); }).observe(document.body);
  if (still) return { layout };
  // one smoothed scroll value for everything: 0 at the top of the page, 1 at the bottom
  const proxy = { p: window.scrollY / G.maxScroll };
  animate(proxy, { p: [0, 1], ease: 'linear', duration: 1000,
    autoplay: onScroll({ target: document.body, enter: 'top top', leave: 'bottom bottom', sync: SMOOTH }),
    onUpdate: () => render(proxy.p * G.maxScroll) });
  return { layout };
}

// ---------- the capabilities: the signal splits and reaches each one ----------
function makeNetwork(grid, { still, EASE, MS }) {
  if (!grid) return null;
  const cards = $$('.ask', grid);
  for (const c of cards) { const f = document.createElement('span'); f.className = 'ask-flash'; f.setAttribute('aria-hidden', 'true'); c.append(f); }
  const svg = el('svg', { class: still ? 'net' : 'net is-waiting', 'aria-hidden': 'true' });
  svg.style.opacity = 1;   // the grid's children start hidden for their reveal; the network's lines have their own
  grid.prepend(svg);
  let routes = [], bus = null, busLen = 0, played = still;
  if (!still) utils.set(cards, { opacity: 0 });
  return {
    layout(xR) {
      svg.replaceChildren();
      const g = box(grid);
      const rows = [...new Set(cards.map((c) => Math.round(box(c).top)))].sort((a, b) => a - b);
      const startX = xR - g.left;
      routes = [];
      let y;
      if (rows.length > 1 && new Set(cards.map((c) => Math.round(box(c).left))).size > 1) {
        // a bus along the gap between the rows, a short drop into each card
        const r1 = cards.filter((c) => Math.round(box(c).top) === rows[0]).map(box), r2 = cards.filter((c) => Math.round(box(c).top) === rows[1]).map(box);
        y = (Math.max(...r1.map((b) => b.bottom)) + Math.min(...r2.map((b) => b.top))) / 2;
        const by = y - g.top, minX = Math.min(...cards.map((c) => box(c).cx)) - g.left;
        bus = el('path', { class: 'net-line', d: `M${startX} ${by} H${minX}` }, svg);
        busLen = startX - minX;
        for (const c of cards) {
          const b = box(c), cx = b.cx - g.left, edge = (b.top < y ? b.bottom : b.top) - g.top;
          routes.push({ c, d: `M${cx} ${by} V${edge}`, along: startX - cx });
        }
      } else {
        // one column: a short tap from the thread into each card
        bus = null; busLen = 0;
        y = box(cards[0]).top + 40;
        const first = box(cards[0]).top;
        for (const c of cards) {
          const b = box(c), cy = b.top + 40 - g.top;
          routes.push({ c, d: `M${startX} ${cy} H${b.right - g.left}`, along: b.top - first });
        }
      }
      routes.forEach((r) => { r.path = el('path', { class: 'net-line', d: r.d }, svg); });
      if (played) svg.querySelectorAll('.net-line').forEach((p) => p.classList.add('is-on'));
      return { y };
    },
    play() {
      if (played) return;
      played = true;
      if (bus) utils.set(createDrawable(bus), { draw: '0 0' });
      for (const r of routes) utils.set(createDrawable(r.path), { draw: '0 0' });
      svg.classList.remove('is-waiting');
      const tl = createTimeline({ defaults: { ease: EASE.out } });
      const span = Math.max(...routes.map((r) => r.along), 1);
      const travel = bus ? 650 : 120 * routes.length;
      if (bus) {
        tl.add(createDrawable(bus), { draw: ['0 0', '0 1'], duration: travel, ease: EASE.inOut }, 0);
        const pulse = el('circle', { class: 'net-pulse', r: 3 }, svg);
        const { translateX, translateY } = createMotionPath(bus);
        tl.add(pulse, { translateX, translateY, duration: travel, ease: EASE.inOut }, 0)
          .add(pulse, { opacity: [1, 0], duration: 200 }, travel - 120);
      }
      for (const r of routes) {
        const t = (r.along / span) * travel * (bus ? 0.9 : 1);
        tl.add(createDrawable(r.path), { draw: ['0 0', '0 1'], duration: 160 }, t)
          .add(r.c, { opacity: [0, 1], y: [18, 0], scale: [0.98, 1], duration: MS.slow }, t + 60)
          .add(r.c.querySelector('.ask-flash'), { opacity: [0, 1, 0], duration: 1100, ease: EASE.inOut }, t + 60);
      }
      tl.call(() => svg.querySelectorAll('.net-line').forEach((p) => p.classList.add('is-on')));
    },
  };
}

// ---------- the culmination: the signal traces the download panel, and the download button answers ----------
function makeTrace(panel, { still, EASE }) {
  if (!panel) return null;
  const svg = el('svg', { class: 'panel-trace', 'aria-hidden': 'true' });
  const path = el('path', {}, svg);
  panel.append(svg);
  let played = still;
  return {
    layout() {
      const b = box(panel), w = b.width, h = b.height, r = parseFloat(getComputedStyle(panel).borderTopRightRadius) || 22, i = 0.75;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      // clockwise from the top-right corner, where the thread arrives
      path.setAttribute('d', `M${w - r} ${i} A${r - i} ${r - i} 0 0 1 ${w - i} ${r} V${h - r} A${r - i} ${r - i} 0 0 1 ${w - r} ${h - i} H${r} A${r - i} ${r - i} 0 0 1 ${i} ${h - r} V${r} A${r - i} ${r - i} 0 0 1 ${r} ${i} Z`);
      path.style.opacity = played ? 1 : 0;
      return b;
    },
    play() {
      if (played) return;
      played = true;
      const button = panel.querySelector('.btn-primary');
      createTimeline({ defaults: { ease: EASE.inOut } })
        .add(createDrawable(path), { draw: ['0 0', '0 1'], opacity: [1, 1], duration: 1400 }, 0)
        .call(() => {
          if (!button) return;
          const ring = document.createElement('span');
          ring.className = 'btn-ring'; ring.setAttribute('aria-hidden', 'true');
          button.append(ring);
          animate(ring, { scale: [1, 1.22], opacity: [0.9, 0], duration: 900, ease: EASE.out, onComplete: () => ring.remove() });
          animate(button, { scale: [1, 1.04, 1], duration: 600, ease: EASE.out });
        }, 1250);
    },
  };
}

// ---------- the ending: a small dial, built with the opening's choreography; the signal becomes its comet ----------
function makeEndDial(host, { still, EASE, MS }) {
  if (!host) return null;
  const dial = el('svg', { class: 'end-dial', viewBox: '0 0 200 200', 'aria-hidden': 'true' });
  el('circle', { class: 'dial-ring', cx: 100, cy: 100, r: 92 }, dial);
  el('circle', { class: 'dial-ring dial-ring-2', cx: 100, cy: 100, r: 80 }, dial);
  el('path', { class: 'dial-arc', d: 'M 100 8 A 92 92 0 0 1 192 100' }, dial);
  el('path', { class: 'dial-arc dial-arc-2', d: 'M 100 192 A 92 92 0 0 1 8 100' }, dial);
  const ticks = el('g', { class: 'dial-ticks' }, dial);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 - Math.PI / 2, major = i % 6 === 0, r1 = major ? 82 : 85;
    el('line', { x1: 100 + Math.cos(a) * r1, y1: 100 + Math.sin(a) * r1, x2: 100 + Math.cos(a) * 88, y2: 100 + Math.sin(a) * 88, class: major ? 'major' : '' }, ticks);
  }
  // at its centre, a still echo of the core: dots on a sphere, the far side dimmer
  const sphere = el('g', { class: 'end-sphere' }, dial);
  for (let i = 0, n = 150; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, rr = Math.sqrt(1 - y * y), a = i * 2.39996;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const ty = y * Math.cos(0.45) - z * Math.sin(0.45), tz = y * Math.sin(0.45) + z * Math.cos(0.45);   // tilted towards you
    if (tz < -0.15) continue;
    el('circle', { cx: (100 + x * 46).toFixed(1), cy: (100 + ty * 46).toFixed(1), r: (0.8 + tz * 1.1).toFixed(2), opacity: (0.35 + tz * 0.65).toFixed(2) }, sphere);
  }
  el('path', { id: 'endOrbit', class: 'dial-orbit', d: 'M 22 117 C 40 66 157 50 179 83 C 200 113 53 157 22 117 Z' }, dial);
  const comet = el('g', { class: 'comet' }, dial);
  el('circle', { r: 3.5 }, comet);
  el('circle', { class: 'comet-glow', r: 8 }, comet);
  host.prepend(dial);
  let played = still;
  const parts = [...dial.querySelectorAll('.dial-ring, .dial-arc, .dial-ticks line, .dial-orbit, .end-sphere circle')];
  if (!still) utils.set([...parts, comet], { opacity: 0 });
  return {
    layout() { const b = box(dial); return { cx: b.cx, cy: b.cy, r: b.width * 0.46 }; },
    play() {
      if (played) return;
      played = true;
      createTimeline({ defaults: { ease: EASE.out } })
        .add(dial.querySelectorAll('.dial-ticks line'), { opacity: [0, 1], duration: MS.quick, delay: stagger(6) }, 0)
        .add(createDrawable(dial.querySelectorAll('.dial-ring')), { draw: ['0 0', '0 1'], opacity: [0, 1], duration: MS.slow, ease: EASE.inOut, delay: stagger(90) }, 60)
        .add(createDrawable(dial.querySelectorAll('.dial-arc')), { draw: ['0 0', '0 1'], opacity: [0, 1], duration: MS.slow, ease: EASE.inOut, delay: stagger(120) }, 220)
        .add(sphere.querySelectorAll('circle'), { opacity: [0, (el) => el.getAttribute('opacity')], scale: [0, 1], duration: MS.base, delay: stagger(3, { from: 'center' }) }, 120)
        .add(dial.querySelector('.dial-orbit'), { opacity: [0, 1], duration: MS.base }, 300)
        .add(comet, { opacity: [0, 1], duration: MS.base }, 500);
      const { translateX, translateY } = createMotionPath('#endOrbit');
      const orbit = animate(comet, { translateX, translateY, duration: 9000, ease: 'linear', loop: true });
      new IntersectionObserver(([e]) => (e.isIntersecting ? orbit.play() : orbit.pause()), { threshold: 0.02 }).observe(dial);
    },
  };
}
