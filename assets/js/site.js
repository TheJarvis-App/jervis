// Jervis website: navigation, the live voice core on the sign, the night sky, the "Order up" counter, the menu's search
// and filters, the drive-in video, copy buttons and download help. No libraries. Everything is progressive: without
// JavaScript the page is complete, every feature and every demo step is listed, and every link still works.
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(key) { try { return window.sessionStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { window.sessionStorage.setItem(key, value); } catch (_) { /* private mode: fine */ } },
  };
  const later = (fn, ms) => window.setTimeout(fn, ms);

  // Controls that only work with JavaScript are in the page but hidden until now.
  $$('[data-js-only]').forEach((el) => { el.hidden = false; });

  // ---------- Which computer is this? (picks the install tab, the copy shortcut and the download behaviour) ----------
  const ua = navigator.userAgent || '';
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || Boolean(navigator.userAgentData && navigator.userAgentData.mobile)
    || (/Mac/i.test(platform) && navigator.maxTouchPoints > 1);   // iPadOS reports itself as a Mac
  const os = /Win/i.test(platform) || /Windows/i.test(ua) ? 'win' : 'mac';

  // ---------- Header: a shadow once the page has scrolled; the scroll cue leaves ----------
  const header = $('.site-header');
  const scrollCue = $('.scroll-cue');
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:80px;pointer-events:none;';
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => {
    header.classList.toggle('is-scrolled', !entry.isIntersecting);
    if (scrollCue) scrollCue.classList.toggle('is-gone', !entry.isIntersecting);
  }).observe(sentinel);

  // ---------- Mobile menu ----------
  const nav = $('#siteNav');
  const toggle = $('.menu-toggle');
  const menuOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }
  toggle.addEventListener('click', () => setMenu(!menuOpen()));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', (e) => {   // a tap outside the open menu closes it
    if (menuOpen() && !nav.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen()) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  // ---------- Current section in the nav ----------
  const navLinks = $$('.site-nav a');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => {
        if (a.getAttribute('href') === `#${entry.target.id}`) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach((s) => spy.observe(s));

  // ---------- Tabs (WAI-ARIA pattern: arrows, Home and End move between tabs) ----------
  function selectTab(tab, focus) {
    const list = tab.closest('[role="tablist"]');
    $$('[role="tab"]', list).forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }
  function tabKeys(list, onPick) {
    const tabs = $$('[role="tab"]', list);
    list.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      onPick(tabs[(next + tabs.length) % tabs.length]);
    });
  }
  $$('[data-tabs]').forEach((list) => {
    list.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) selectTab(t, false); });
    tabKeys(list, (t) => selectTab(t, true));
  });
  const osTab = $(`.os-tabs [data-os="${os}"]`);
  if (osTab) selectTab(osTab, false);

  // ---------- The two orbs share orb.js's state; draw only while one of them is on screen ----------
  let heroVisible = true;
  let counterVisible = false;
  let counterBusy = false;   // the sign waits while an order runs at the counter
  const updatePaused = () => document.body.classList.toggle('scene-paused', !(heroVisible || counterVisible));
  const orbReady = typeof window.initOrb === 'function';
  if (orbReady) {
    if ($('#heroOrb')) window.initOrb('heroOrb');
    if ($('#counterOrb')) window.initOrb('counterOrb');
  }

  // ---------- The sign: the app's own core, replaying real exchanges; tap it for the next one ----------
  // State titles and colours are the app's (renderer.js and orb.js). Each reply is the opening sentence of what
  // Jervis's own code answers to that request (equations.py, planets.py, earth.py); see tools/screenshot_feed.py.
  const COLORS = { idle: '79 216 255', listening: '61 242 192', thinking: '165 139 255', speaking: '90 169 255' };
  const TITLES = { idle: 'Ready', listening: 'Listening', thinking: 'Thinking', speaking: 'Served' };
  const EXCHANGES = [
    ['Solve x squared minus 5x plus 6 equals 0', 'The solutions are x equals 2 and x equals 3.'],
    ['Tell me about Saturn', 'Saturn is a planet, about 1,434 million kilometers from the Sun.'],
    ['How far is New York from Tel Aviv?', 'About 9,115 kilometers, or 5,664 miles, in a straight line.'],
  ];
  const SCRIPT = EXCHANGES.flatMap(([ask, reply]) => [
    { state: 'idle', text: 'Say “Hey Jervis”.', ms: 2000 },
    { state: 'listening', text: `“${ask}”`, ms: 2800 },
    { state: 'thinking', text: 'Working on it…', ms: 1300 },
    { state: 'speaking', text: `“${reply}”`, ms: 2600 + reply.length * 28 },
  ]);
  const sign = $('.sign');
  const coreButton = $('#coreButton');
  const coreState = $('#coreState');
  const coreSub = $('#coreSub');
  const orbits = $('.sign-orbits');
  let heroIndex = 0;
  let heroTimer = null;
  function showCoreStep(step) {
    if (window.setOrbState && !counterBusy) window.setOrbState(step.state);
    coreState.textContent = TITLES[step.state];
    sign.style.setProperty('--core-rgb', COLORS[step.state]);
    coreSub.classList.add('is-swapping');
    later(() => { coreSub.textContent = step.text; coreSub.classList.remove('is-swapping'); }, reducedMotion ? 0 : 180);
  }
  const heroStop = () => { clearTimeout(heroTimer); heroTimer = null; };
  const heroSchedule = () => {
    if (reducedMotion || heroTimer || !heroVisible || document.hidden) return;
    heroTimer = later(() => {
      heroTimer = null;
      heroIndex = (heroIndex + 1) % SCRIPT.length;
      showCoreStep(SCRIPT[heroIndex]);
      heroSchedule();
    }, SCRIPT[heroIndex].ms);
  };
  if (sign && coreButton) {
    if (reducedMotion) {
      // One still frame with one real exchange written out; nothing plays by itself.
      if (window.setOrbState) window.setOrbState('speaking');
      coreState.textContent = TITLES.speaking;
      sign.style.setProperty('--core-rgb', COLORS.speaking);
      coreSub.textContent = `“${EXCHANGES[0][0]}” … “${EXCHANGES[0][1]}”`;
      if (orbits && orbits.pauseAnimations) orbits.pauseAnimations();
    } else {
      showCoreStep(SCRIPT[0]);
      document.addEventListener('visibilitychange', () => (document.hidden ? heroStop() : heroSchedule()));
    }
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      if (!reducedMotion) updatePaused();
      if (orbits && orbits.pauseAnimations && !reducedMotion) (heroVisible ? orbits.unpauseAnimations() : orbits.pauseAnimations());
      if (heroVisible) heroSchedule(); else heroStop();
    }, { threshold: 0.05 }).observe(coreButton);
    if (reducedMotion) later(() => document.body.classList.add('scene-paused'), 400);
    // Tapping the core jumps to the next example: he starts listening to the next request.
    coreButton.addEventListener('click', () => {
      heroStop();
      const nextAsk = SCRIPT.findIndex((s, i) => i > heroIndex && s.state === 'listening');
      heroIndex = nextAsk >= 0 ? nextAsk : SCRIPT.findIndex((s) => s.state === 'listening');
      showCoreStep(SCRIPT[heroIndex]);
      if (reducedMotion) {
        const pair = EXCHANGES[Math.floor(heroIndex / 4)];
        coreState.textContent = TITLES.speaking;
        coreSub.textContent = `“${pair[0]}” … “${pair[1]}”`;
      } else heroSchedule();
    });
  }

  // ---------- The night sky: twinkling stars and the odd shooting star (like the app's own window) ----------
  const sky = $('#sky');
  if (sky && sky.getContext) {
    const ctx = sky.getContext('2d');
    let w = 0, h = 0, dpr = 1, stars = [], meteors = [], raf = 0, running = false, last = 0, nextMeteor = 900;
    const resize = () => {
      const nw = sky.clientWidth, nh = sky.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      sky.width = Math.round(nw * dpr); sky.height = Math.round(nh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nw !== w || !stars.length) {   // a phone's toolbar changing the height keeps the same stars
        const count = Math.round(Math.min(220, (nw * nh) / 5200));
        stars = Array.from({ length: count }, () => ({
          x: Math.random() * nw, y: Math.random() * nh * 0.92, r: Math.random() * 1.3 + 0.3,
          p: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 1.6,
          c: Math.random() < 0.12 ? '255,145,135' : Math.random() < 0.2 ? '79,216,211' : '255,246,226',
        }));
      }
      w = nw; h = nh;
    };
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = reducedMotion ? 0.7 : 0.45 + 0.4 * Math.sin(s.p + t * 0.001 * s.s);
        ctx.fillStyle = `rgba(${s.c},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      for (const m of meteors) {
        const tail = 140;
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * tail, m.y - m.vy * tail);
        g.addColorStop(0, `rgba(255,255,255,${m.life.toFixed(3)})`);
        g.addColorStop(1, 'rgba(79,216,211,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * tail, m.y - m.vy * tail); ctx.stroke();
      }
    };
    const tick = (t) => {
      const dt = Math.min(50, t - (last || t)); last = t;
      nextMeteor -= dt;
      if (nextMeteor <= 0) {
        // A shooting star crosses the whole sky, from the upper left or right edge.
        const fromLeft = Math.random() < 0.5;
        const speed = 0.9 + Math.random() * 0.5;
        const angle = (18 + Math.random() * 16) * Math.PI / 180;
        meteors.push({ x: fromLeft ? -40 : w + 40, y: Math.random() * h * 0.45, vx: (fromLeft ? 1 : -1) * Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1 });
        nextMeteor = 2200 + Math.random() * 3600;
      }
      meteors = meteors.filter((m) => { m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt / 2600; return m.life > 0 && m.x > -300 && m.x < w + 300 && m.y < h + 100; });
      draw(t);
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!running && !reducedMotion && !document.hidden) { running = true; last = 0; raf = requestAnimationFrame(tick); } };
    const stopSky = () => { running = false; cancelAnimationFrame(raf); };
    resize();
    draw(0);
    let resizeTimer = null;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = later(() => { resize(); draw(performance.now()); }, 150); });
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stopSky())).observe(sky);
    document.addEventListener('visibilitychange', () => (document.hidden ? stopSky() : start()));
  }

  // ---------- Order up: Heard → Decided → Did → Served, with Play, Replay, Next and a stepper ----------
  const counter = $('[data-counter]');
  const demo = { play: () => {}, pick: () => {} };
  if (counter) {
    const orderList = $('.orders', counter);
    const tabs = $$('.order', counter);
    const STAGES = ['hear', 'decide', 'act', 'serve'];
    const LABELS = { hear: 'Heard', decide: 'Decided', act: 'Did', serve: 'Served' };
    const PASS = {
      hear: ['listening', 'Listening', '61 242 192'],
      decide: ['thinking', 'Thinking', '165 139 255'],
      act: ['generating', 'Working', '165 139 255'],
      serve: ['speaking', 'Served', '90 169 255'],
    };
    const DURATION = { hear: 2100, decide: 2300, act: 2700 };   // Served stays until the visitor moves on
    const steps = $$('.step', counter);
    const playBtn = $('#demoPlay');
    const nextBtn = $('#demoNext');
    const passState = $('#passState');
    const passBox = $('.plates', counter);
    const live = $('#demoLive');
    let plate = null;
    let timers = [];
    let played = false;

    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const plateOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
    const kindOf = (tab) => $('.order-kind', tab).textContent;

    function setPass(stage) {
      const [state, label, rgb] = PASS[stage];
      if (window.setOrbState) window.setOrbState(state);
      passState.textContent = label;
      passBox.style.setProperty('--pass-rgb', rgb);
    }
    function typeOut(el, animate) {
      const full = el.dataset.full || el.textContent;
      el.dataset.full = full;
      if (!animate) { el.textContent = full; el.classList.remove('is-typing'); return; }
      // The untyped rest stays in place, transparent, so the line never reflows the page while it types.
      const typed = document.createElement('span');
      const rest = document.createElement('span');
      typed.className = 'bubble-typed';
      rest.className = 'bubble-rest';
      rest.textContent = full;
      el.replaceChildren(typed, rest);
      el.classList.add('is-typing');
      const per = Math.max(16, Math.min(40, 1300 / full.length));
      for (let i = 1; i <= full.length; i++) {
        timers.push(later(() => { typed.textContent = full.slice(0, i); rest.textContent = full.slice(i); }, i * per));
      }
      timers.push(later(() => { el.textContent = full; el.classList.remove('is-typing'); }, full.length * per + 400));
    }
    function tickChecks(stageEl, animate) {
      const items = $$('.checks li', stageEl);
      items.forEach((li) => li.classList.toggle('is-done', !animate));
      if (animate) items.forEach((li, i) => timers.push(later(() => li.classList.add('is-done'), 350 + i * 700)));
    }
    // Shows stage `index` of the current plate. `animate` plays its inner motion and fills its progress segment.
    function showStage(index, animate) {
      const stage = STAGES[index];
      // The ticket writes itself: earlier stages stay on the slip until the plate is served over it.
      $$('.stage', plate).forEach((el) => {
        el.classList.toggle('is-active', el.dataset.stage === stage);
        el.classList.toggle('is-past', STAGES.indexOf(el.dataset.stage) < index);
      });
      plate.dataset.at = stage;
      if (index > 0) typeOut($('.stage-hear [data-type]', plate), false);
      steps.forEach((btn, i) => {
        btn.classList.toggle('is-done', i < index);
        if (i === index) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
        const dur = animate && i === index && DURATION[stage] ? DURATION[stage] : 0;
        btn.style.setProperty('--dur', `${dur}ms`);
        btn.style.setProperty('--p', i < index || (i === index && !dur) ? 1 : 0);
        if (dur) requestAnimationFrame(() => requestAnimationFrame(() => btn.style.setProperty('--p', 1)));
      });
      setPass(stage);
      live.textContent = `${kindOf($('.order[aria-selected="true"]', counter))}, step ${index + 1} of 4: ${LABELS[stage]}.`;
      const stageEl = $(`.stage[data-stage="${stage}"]`, plate);
      if (stage === 'hear') typeOut($('[data-type]', stageEl), animate && !reducedMotion);
      if (stage === 'act') tickChecks(stageEl, animate && !reducedMotion);
    }
    function finish() {
      playBtn.querySelector('span').textContent = 'Replay';
      nextBtn.classList.add('is-nudge');
      timers.push(later(() => { counterBusy = false; nextBtn.classList.remove('is-nudge'); }, 3400));
    }
    function play() {
      clearTimers();
      played = true;
      counterBusy = true;
      nextBtn.classList.remove('is-nudge');
      playBtn.querySelector('span').textContent = 'Replay';
      showStage(0, true);   // the first stage shows at once, so a switched plate is never blank
      let at = DURATION.hear;
      STAGES.slice(1).forEach((stage, i) => {
        timers.push(later(() => { showStage(i + 1, true); if (stage === 'serve') finish(); }, at));
        at += DURATION[stage] || 0;
      });
    }
    function pick(tab, { focus = false, autoplay = true } = {}) {
      clearTimers();
      selectTab(tab, focus);
      plate = plateOf(tab);
      store.set('jervis-order', tab.dataset.order);
      if (window.matchMedia('(max-width: 980px)').matches && tab.scrollIntoView) {
        tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      }
      if (autoplay) play(); else { showStage(0, false); playBtn.querySelector('span').textContent = 'Play'; }
    }
    demo.play = () => play();
    demo.pick = (id) => { const tab = $(`.order[data-order="${id}"]`, counter); if (tab) pick(tab); };

    // Without JavaScript every plate and every stage is shown in full; with it, one plate and one stage at a time.
    const remembered = store.get('jervis-order');
    const first = (remembered && $(`.order[data-order="${remembered}"]`, counter)) || tabs[0];
    tabs.forEach((t) => { plateOf(t).hidden = t !== first; });
    pick(first, { autoplay: false });
    if (reducedMotion) showStage(3, false);

    orderList.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) pick(t); });
    tabKeys(orderList, (t) => pick(t, { focus: true }));
    playBtn.addEventListener('click', () => play());
    nextBtn.addEventListener('click', () => {
      const i = tabs.indexOf($('.order[aria-selected="true"]', counter));
      pick(tabs[(i + 1) % tabs.length]);
    });
    steps.forEach((btn, i) => btn.addEventListener('click', () => {   // jump to a step: the run stops there
      clearTimers();
      counterBusy = true;
      showStage(i, false);
      playBtn.querySelector('span').textContent = played ? 'Replay' : 'Play';
      timers.push(later(() => { counterBusy = false; }, 4000));
    }));
    // The first order plays by itself once, when the counter first comes into view.
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !played && !reducedMotion) { play(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(passBox);
    new IntersectionObserver(([entry]) => { counterVisible = entry.isIntersecting; if (!reducedMotion) updatePaused(); }, { threshold: 0.05 }).observe($('.pass', counter));
  }

  // ---------- The menu: search, kinds, where you get it, which computer; reset; copy a link ----------
  const groupsEl = $('#fxGroups');
  const explorer = { show: () => {} };
  if (groupsEl) {
    const items = $$('.fx', groupsEl);
    const groups = $$('.fx-group', groupsEl);
    const search = $('#fxSearch');
    const statusEl = $('#fxStatus');
    const emptyEl = $('#fxEmpty');
    const clearBtn = $('#fxClear');
    const DEFAULT = { q: '', cat: 'all', status: 'all', os: 'all' };
    const filter = { ...DEFAULT };
    const total = items.length;
    let statusTimer = null;
    const press = (attr, value) => $$(`[${attr}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
    function apply(announce) {
      const words = filter.q.toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      items.forEach((li) => {
        const ok = (filter.cat === 'all' || li.dataset.cat === filter.cat)
          && (filter.status === 'all' || li.dataset.status === filter.status)
          && (filter.os === 'all' || li.dataset.os === 'both' || li.dataset.os === filter.os)
          && words.every((w) => li.dataset.words.includes(w));
        if (ok && li.hidden && !reducedMotion) { li.classList.remove('is-in'); void li.offsetWidth; li.classList.add('is-in'); }
        li.hidden = !ok;
        if (ok) shown++;
      });
      groups.forEach((g) => { g.hidden = !$$('.fx', g).some((li) => !li.hidden); });
      emptyEl.hidden = shown > 0;
      const dirty = Object.keys(DEFAULT).some((k) => filter[k] !== DEFAULT[k]);
      clearBtn.disabled = !dirty;
      const text = shown === total ? `Showing all ${total}.` : shown === 0 ? `Nothing matches. 0 of ${total}.` : `Showing ${shown} of ${total}.`;
      clearTimeout(statusTimer);
      if (announce) statusTimer = later(() => { statusEl.textContent = text; }, 300);
      else statusEl.textContent = text;
    }
    function set(key, value, announce = true) {
      filter[key] = value;
      if (key === 'cat') press('data-filter-cat', value);
      if (key === 'status') press('data-filter-status', value);
      if (key === 'os') press('data-filter-os', value);
      if (key === 'q') search.value = value;
      apply(announce);
    }
    function reset() { Object.entries(DEFAULT).forEach(([k, v]) => set(k, v, false)); apply(true); }
    search.addEventListener('input', () => { filter.q = search.value.trim(); apply(true); });
    search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.preventDefault(); set('q', ''); } });
    $$('[data-filter-cat]').forEach((b) => b.addEventListener('click', () => set('cat', b.dataset.filterCat)));
    $$('[data-filter-status]').forEach((b) => b.addEventListener('click', () => set('status', b.dataset.filterStatus)));
    $$('[data-filter-os]').forEach((b) => b.addEventListener('click', () => set('os', b.dataset.filterOs)));
    clearBtn.addEventListener('click', () => { reset(); search.focus(); });
    $('#fxReset').addEventListener('click', () => { reset(); search.focus(); });
    apply(false);
    explorer.show = (status) => { reset(); set('status', status); };

    // "Play it in the demo": pick that order on the counter and run it.
    const SCENES = { spotify: 'spotify', netflix: 'netflix', solve: 'solve', graph: 'graph', globe: 'globe', planets: 'saturn', docs: 'docs', computer: 'computer' };
    groupsEl.addEventListener('click', async (e) => {
      const scene = e.target.closest('[data-scene-link]');
      if (scene) { later(() => demo.pick(SCENES[scene.dataset.sceneLink]), reducedMotion ? 0 : 450); return; }
      const link = e.target.closest('[data-copy-link]');
      if (link) {
        e.preventDefault();
        const url = new URL(link.getAttribute('href'), location.href).href;
        const ok = await copyText(url);
        link.textContent = ok ? 'Link copied' : 'Copy failed: use the address bar';
        link.classList.toggle('is-copied', ok);
        history.replaceState(null, '', link.getAttribute('href'));
        clearTimeout(link._t);
        link._t = later(() => { link.textContent = 'Copy link to this'; link.classList.remove('is-copied'); }, 2400);
      }
    });

    // A link to #f-<feature> opens that item, clears filters that would hide it, and points at it.
    const openFromHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id.startsWith('f-')) return;
      const li = document.getElementById(id);
      if (!li || !li.classList.contains('fx')) return;
      if (li.hidden) reset();
      $('details', li).open = true;
      li.classList.remove('is-flash'); void li.offsetWidth; li.classList.add('is-flash');
      li.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    };
    window.addEventListener('hashchange', openFromHash);
    if (location.hash.startsWith('#f-')) later(openFromHash, 60);
  }
  // "See what's next" in the download panel opens the menu on the next-release items.
  $$('[data-show-status]').forEach((a) => a.addEventListener('click', () => explorer.show(a.dataset.showStatus)));

  // ---------- The drive-in: plays the video once its file is named in data-video ----------
  const frame = $('[data-video]');
  if (frame && frame.dataset.video) {
    const slot = $('.video-slot', frame);
    const placeholder = slot.innerHTML;
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.poster = frame.dataset.videoPoster || '';
    video.setAttribute('aria-label', 'Jervis at work, a short film');
    const source = document.createElement('source');
    source.src = frame.dataset.video;
    source.type = /\.webm$/i.test(frame.dataset.video) ? 'video/webm' : 'video/mp4';
    source.addEventListener('error', () => { slot.innerHTML = placeholder; });   // missing or unplayable file: keep the card
    video.append(source);
    slot.replaceChildren(video);
  }

  // ---------- Copy buttons ----------
  function selectText(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0;';
      document.body.append(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (__) { ok = false; }
      area.remove();
      return ok;
    }
  }
  $$('.copy-btn').forEach((btn) => {
    const label = $('.copy-text', btn);
    btn.addEventListener('click', async () => {
      const source = (btn.dataset.copyTarget && document.getElementById(btn.dataset.copyTarget)) || btn.parentElement.querySelector('code');
      const text = btn.dataset.copy || (source && source.textContent.trim()) || '';
      const ok = await copyText(text);
      if (!ok && source) selectText(source);   // leave it selected so the keyboard shortcut works
      label.textContent = ok ? 'Copied' : (os === 'mac' ? 'Press ⌘C' : 'Press Ctrl+C');
      btn.classList.toggle('is-copied', ok);
      clearTimeout(btn._t);
      btn._t = later(() => { label.textContent = 'Copy'; btn.classList.remove('is-copied'); }, 2400);
    });
  });

  // ---------- Download ----------
  // The download section has a button per installer; on a computer, the one for that computer comes first and stands
  // out. The buttons in the hero, header and closing lead to that section and point at the right installer, so the
  // warnings and the other system are always in view. On a phone, where Jervis can't run, they send the page on.
  const toast = $('#toast');
  const toastText = $('#toastText');
  const toastLink = $('#toastLink');
  const installers = {
    win: $('.dl-option[data-platform="win"] .btn'),
    mac: $('.dl-option[data-platform="mac"] .btn'),
  };
  let toastTimer = null;
  function hideToast() { toast.hidden = true; }
  function showToast(text, linkText, linkHref) {
    toastText.textContent = text;
    toastLink.textContent = linkText;
    toastLink.setAttribute('href', linkHref);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = later(hideToast, 12000);
  }
  const mine = installers[os];
  if (!isMobile && mine) {
    const other = installers[os === 'win' ? 'mac' : 'win'];
    mine.classList.remove('btn-outline'); mine.classList.add('btn-teal');
    other.classList.remove('btn-teal'); other.classList.add('btn-outline');
    const option = mine.closest('.dl-option');
    option.parentElement.prepend(option);
    $$('[data-os-link]').forEach((link) => {
      const label = $('.btn-label', link);
      if (label && label.textContent === 'Download Jervis') label.textContent = `Download for ${os === 'win' ? 'Windows' : 'Mac'}`;
    });
  }
  if (isMobile) {
    $$('[data-os-link]').forEach((link) => {
      link.setAttribute('aria-label', 'Send Jervis to my computer');
      const label = $('.btn-label', link);
      if (label) label.textContent = 'Send to my computer';
      const use = $('use', link);
      if (use) use.setAttribute('href', '#i-paper-plane-tilt');
    });
    const meta = $('#heroMeta');
    if (meta) meta.innerHTML = '<span>Runs on a Windows PC or a Mac</span><span>Send yourself the link</span>';
    $$('.mobile-note').forEach((n) => { n.hidden = false; });
  }
  async function sendToComputer() {
    const url = new URL('#download', location.href).href;
    let shared = false;
    if (navigator.share) {
      try { await navigator.share({ title: 'Jervis', text: 'Jervis, a voice assistant for Windows and macOS', url }); shared = true; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    const copied = shared ? false : await copyText(url);
    showToast(shared ? 'Open the link on your PC or Mac to download Jervis.'
      : copied ? 'Link copied. Open it on your PC or Mac to download Jervis.'
        : 'Open this page on your PC or Mac to download Jervis.', 'See the downloads', '#download');
  }
  $$('[data-to-download]').forEach((link) => link.addEventListener('click', (e) => {
    if (isMobile && link.hasAttribute('data-os-link')) { e.preventDefault(); sendToComputer(); return; }
    // Lands on the download section; the installer for this computer is pointed out and focused.
    const option = mine && mine.closest('.dl-option');
    if (!option) return;
    later(() => {
      option.classList.remove('is-picked'); void option.offsetWidth; option.classList.add('is-picked');
      mine.focus({ preventScroll: true });
    }, reducedMotion ? 50 : 650);
  }));
  $$('[data-download]').forEach((link) => link.addEventListener('click', () => {
    const where = (link.closest('[data-platform]') || {}).dataset?.platform || os;
    // The page can't see the download itself, so it says what should happen and where to go next.
    showToast(where === 'win' ? 'Your browser should now download the Windows installer. Next, run it.'
      : 'Your browser should now download Jervis for Mac. Next, open it and drag Jervis to Applications.', 'See the install steps', '#install');
    const tab = $(`.os-tabs [data-os="${where}"]`);
    if (tab) selectTab(tab, false);
  }));
  $('.toast-close').addEventListener('click', hideToast);
  toastLink.addEventListener('click', hideToast);

  // "Try the demo" lands on the counter and plays the order that is up.
  $$('[data-play-demo]').forEach((a) => a.addEventListener('click', () => later(() => demo.play(), reducedMotion ? 0 : 600)));

  // ---------- Lights that come on once, and sections that settle in as they arrive ----------
  const lightOnce = (el, threshold) => {
    if (!el) return;
    if (reducedMotion) { el.classList.add('is-lit'); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('is-lit'); io.disconnect(); }
    }, { threshold });
    io.observe(el);
  };
  lightOnce($('[data-flow]'), 0.4);
  lightOnce($('.closing'), 0.5);
  if (!reducedMotion && 'IntersectionObserver' in window) {
    // Only what starts below the fold is held back, so nothing on screen ever waits; it all shows if this fails.
    const revealIO = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); revealIO.unobserve(entry.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    $$('.section-head, .marquee, .screen-frame, .board, .rail, .ledger, .controls, .req-grid, .download-panel, .install-panels, .install-extra, .faq-list')
      .filter((el) => el.getBoundingClientRect().top > window.innerHeight)
      .forEach((el) => { el.classList.add('reveal'); revealIO.observe(el); });
  }
})();
