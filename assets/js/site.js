// Jarvis website: navigation, the scroll story, the trailer, the request explorer, the feature search and filters,
// the screenshot viewer, copy buttons and download help. The 3D core is loaded from core3d.js once the page is up.
// Everything is progressive: without JavaScript the page is complete, every feature and every demo step is listed,
// the trailer plays with the browser's own controls, and every link still works.
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const root = document.documentElement;
  const scriptUrl = document.currentScript && document.currentScript.src;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(key) { try { return window.sessionStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { window.sessionStorage.setItem(key, value); } catch (_) { /* private mode: fine */ } },
  };
  const later = (fn, ms) => window.setTimeout(fn, ms);
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

  // Controls that only work with JavaScript are in the page but hidden until now.
  $$('[data-js-only]').forEach((el) => { el.hidden = false; });

  // ---------- Which computer is this? (picks the install tab, the copy shortcut and the download behaviour) ----------
  const ua = navigator.userAgent || '';
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || Boolean(navigator.userAgentData && navigator.userAgentData.mobile)
    || (/Mac/i.test(platform) && navigator.maxTouchPoints > 1);   // iPadOS reports itself as a Mac
  const os = /Win/i.test(platform) || /Windows/i.test(ua) ? 'win' : 'mac';

  // ---------- Header: a backing once the page has scrolled; the scroll cue leaves ----------
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

  // ---------- The scroll story: five chapters on one pinned screen, the core changing shape between them ----------
  // The core reads data-pose / data-pose2 / data-mix off its slot (see core3d.js), so this only writes attributes.
  const story = $('[data-story]');
  let updateStory = () => {};
  if (story) {
    const chapters = $$('.chapter', story);
    const names = chapters.map((c) => c.dataset.chapter);
    const slot = $('.story-slot', story);
    const rail = $$('.story-rail button', story);
    const pinMQ = window.matchMedia('(min-width: 900px) and (min-height: 640px)');
    let pinned = false;
    let shown = -1;
    const show = (i) => {
      if (i === shown) return;
      shown = i;
      chapters.forEach((c, n) => c.classList.toggle('is-active', n === i));
      rail.forEach((b, n) => { if (n === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    };
    const span = () => story.offsetHeight - window.innerHeight;
    updateStory = () => {
      if (!pinned) return;
      const f = clamp(-story.getBoundingClientRect().top / span()) * chapters.length;
      const i = Math.min(chapters.length - 1, Math.floor(f));
      const frac = f - i;
      show(i);
      // The last third of a chapter already leans into the next one's shape.
      const lean = i < chapters.length - 1 ? clamp((frac - 0.66) / 0.34) : 0;
      slot.dataset.pose = names[i];
      slot.dataset.pose2 = names[Math.min(chapters.length - 1, i + 1)];
      slot.dataset.mix = lean.toFixed(3);
    };
    const setPinned = () => {
      pinned = pinMQ.matches && !reducedMotion;
      story.classList.toggle('is-pinned', pinned);
      shown = -1;
      if (pinned) updateStory(); else chapters.forEach((c) => c.classList.remove('is-active'));
    };
    pinMQ.addEventListener('change', setPinned);
    setPinned();
    rail.forEach((b, i) => b.addEventListener('click', () => {
      const top = story.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + ((i + 0.4) / chapters.length) * span(), behavior: 'smooth' });
    }));
  }

  // ---------- Things that follow the scroll: the hero copy leaves, frames rise into place ----------
  const heroCopy = $('[data-scroll-out]');
  const rising = $$('[data-scroll]');
  let ticking = false;
  function onScrollFrame() {
    ticking = false;
    const vh = window.innerHeight;
    if (!reducedMotion) {
      if (heroCopy) {
        const y = window.scrollY;
        heroCopy.style.opacity = clamp(1 - y / (vh * 0.5)).toFixed(3);
        heroCopy.style.transform = `translate3d(0, ${(-y * 0.22).toFixed(1)}px, 0)`;
        heroCopy.style.pointerEvents = y > vh * 0.45 ? 'none' : '';
      }
      rising.forEach((el) => {
        const p = clamp((vh - el.getBoundingClientRect().top) / (vh * 0.8));
        el.style.setProperty('--sp', (1 - Math.pow(1 - p, 3)).toFixed(3));
      });
    }
    updateStory();
  }
  const requestScrollFrame = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); } };
  window.addEventListener('scroll', requestScrollFrame, { passive: true });
  window.addEventListener('resize', requestScrollFrame);
  onScrollFrame();

  // ---------- The trailer: one play button; lights go down while it plays ----------
  const cinema = $('[data-cinema]');
  const trailer = $('#trailer');
  if (cinema && trailer) {
    const playBtn = $('.cinema-play', cinema);
    const errorEl = $('.cinema-error', cinema);
    const lights = (down) => document.body.classList.toggle('lights-down', down);
    const failed = () => {
      cinema.classList.remove('is-loading');
      lights(false);
      playBtn.hidden = true;
      errorEl.hidden = false;
    };
    trailer.controls = false;   // the browser's controls take over once it is playing
    playBtn.addEventListener('click', () => {
      cinema.classList.add('is-loading');
      trailer.controls = true;
      const started = trailer.play();
      if (started && started.catch) started.catch((err) => { if (err && err.name !== 'AbortError') failed(); });
      trailer.focus({ preventScroll: true });
    });
    trailer.addEventListener('playing', () => {
      cinema.classList.remove('is-loading');
      cinema.classList.add('is-started');
      lights(true);
    });
    trailer.addEventListener('pause', () => lights(false));
    trailer.addEventListener('ended', () => {
      lights(false);
      trailer.controls = false;
      cinema.classList.remove('is-started');
      $('.cinema-label', playBtn).textContent = 'Play it again';
    });
    $('source', trailer).addEventListener('error', failed);
    // Scrolling away brings the lights back up; the trailer keeps playing until it is paused.
    new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) lights(false); else if (!trailer.paused) lights(true); }, { threshold: 0.2 }).observe(cinema);
  }

  // ---------- The explorer: a request goes through Understand, Plan and Act, then its result appears ----------
  const consoleEl = $('[data-console]');
  const demo = { play: () => {}, pick: () => {} };
  if (consoleEl) {
    const askList = $('.asks', consoleEl);
    const tabs = $$('.ask', consoleEl);
    const runsEl = $('.runs', consoleEl);
    const coreSlot = $('.console-slot', consoleEl);
    const STAGES = ['understand', 'plan', 'act'];
    const AT = [   // what the bar says, and the shape the core takes (core3d.js)
      { label: 'Listening', pose: 'hear' },
      { label: 'Planning', pose: 'decide' },
      { label: 'Working', pose: 'act' },
      { label: 'Done', pose: 'answer' },
    ];
    const DURATION = [2300, 2300, 2900];
    const steps = $$('.step', consoleEl);
    const playBtn = $('#demoPlay');
    const nextBtn = $('#demoNext');
    const stateEl = $('#conState');
    const live = $('#demoLive');
    let run = null;
    let timers = [];
    let played = false;

    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const runOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
    const kindOf = (tab) => $('.ask-kind', tab).textContent;
    const current = () => $('.ask[aria-selected="true"]', consoleEl);

    function typeOut(el, animate) {
      const full = el.dataset.full || el.textContent;
      el.dataset.full = full;
      if (!animate) { el.textContent = full; el.classList.remove('is-typing'); return; }
      // The untyped rest stays in place, transparent, so the line never reflows while it types.
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
    function tickChecks(animate) {
      const items = $$('.checks li', run);
      items.forEach((li) => li.classList.toggle('is-done', !animate));
      if (animate) items.forEach((li, i) => timers.push(later(() => li.classList.add('is-done'), 400 + i * 750)));
    }
    // Shows the current run at stage `index` (3 = done, with the result). `animate` plays the stage's own motion.
    function showStage(index, animate) {
      const done = index >= STAGES.length;
      const active = Math.min(index, STAGES.length - 1);
      $$('.stage', run).forEach((el) => {
        const n = STAGES.indexOf(el.dataset.stage);
        el.classList.toggle('is-active', n === active);
        el.classList.toggle('is-past', n < active);
      });
      const at = done ? 'done' : STAGES[index];
      run.dataset.at = at;
      runsEl.dataset.at = at;
      stateEl.textContent = AT[index].label;
      if (coreSlot) coreSlot.dataset.pose = AT[index].pose;
      steps.forEach((btn, i) => {
        btn.classList.toggle('is-done', i < active || done);
        if (i === active) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
        const dur = animate && !done && i === index ? DURATION[i] : 0;
        btn.style.setProperty('--dur', `${dur}ms`);
        btn.style.setProperty('--p', i < index || (i === index && !dur) ? 1 : 0);
        if (dur) requestAnimationFrame(() => requestAnimationFrame(() => btn.style.setProperty('--p', 1)));
      });
      live.textContent = done ? `${kindOf(current())}: done. The result is shown.`
        : `${kindOf(current())}, stage ${index + 1} of 3: ${STAGES[index]}.`;
      typeOut($('[data-type]', run), animate && index === 0);
      if (index >= 2) tickChecks(animate && !done);
    }
    function finish() {
      showStage(3, true);
      nextBtn.classList.add('is-nudge');
      timers.push(later(() => nextBtn.classList.remove('is-nudge'), 3400));
    }
    function play() {
      clearTimers();
      played = true;
      nextBtn.classList.remove('is-nudge');
      $('span', playBtn).textContent = 'Replay';
      if (reducedMotion) { showStage(3, false); return; }
      showStage(0, true);
      timers.push(later(() => showStage(1, true), DURATION[0]));
      timers.push(later(() => showStage(2, true), DURATION[0] + DURATION[1]));
      timers.push(later(finish, DURATION[0] + DURATION[1] + DURATION[2]));
    }
    function pick(tab, { focus = false, autoplay = true } = {}) {
      clearTimers();
      selectTab(tab, focus);
      run = runOf(tab);
      store.set('jarvis-ask', tab.dataset.ask);
      if (window.matchMedia('(max-width: 980px)').matches && tab.scrollIntoView && played) {
        tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      }
      if (autoplay) play(); else { showStage(reducedMotion ? 3 : 0, false); $('span', playBtn).textContent = 'Play'; }
    }
    demo.play = () => { if (!played) play(); };   // it also starts by itself on arrival; don't restart it
    demo.pick = (id) => { const tab = $(`.ask[data-ask="${id}"]`, consoleEl); if (tab) pick(tab); };

    // Without JavaScript every run and every stage is shown in full; with it, one run and one stage at a time.
    const remembered = store.get('jarvis-ask');
    const first = (remembered && $(`.ask[data-ask="${remembered}"]`, consoleEl)) || tabs[0];
    tabs.forEach((t) => { runOf(t).hidden = t !== first; });
    pick(first, { autoplay: false });
    if (coreSlot && !reducedMotion) coreSlot.dataset.pose = 'idle';
    stateEl.textContent = reducedMotion ? 'Done' : 'Ready';

    askList.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) pick(t); });
    tabKeys(askList, (t) => pick(t, { focus: true }));
    playBtn.addEventListener('click', () => play());
    nextBtn.addEventListener('click', () => pick(tabs[(tabs.indexOf(current()) + 1) % tabs.length]));
    steps.forEach((btn, i) => btn.addEventListener('click', () => {   // jump to a stage: the run stops there
      clearTimers();
      showStage(i === 2 ? 3 : i, false);
      $('span', playBtn).textContent = played ? 'Replay' : 'Play';
    }));
    // The first request plays by itself once, when the console first comes into view.
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !played && !reducedMotion) { play(); io.disconnect(); }
    }, { threshold: 0.45 });
    io.observe(runsEl);

    // A typed request runs the closest of the eight; the page says so instead of pretending to understand anything.
    const WORDS = {
      saturn: /saturn|planet|jupiter|mars|venus/, solve: /solve|equation|squared|x²|quadratic/,
      graph: /graph|plot|sine|sin\b|function|curve/, globe: /how far|distance|new york|tel aviv|globe|miles|\bkm\b/,
      spotify: /spotify|playlist|music|song|workout/, netflix: /netflix|episode|season|breaking bad|show\b|series/,
      docs: /poem|write|word\b|document|essay/, computer: /dark mode|chrome|mouse|my computer|click|keyboard/,
    };
    const form = $('.ask-own', consoleEl);
    const input = $('#askOwn');
    const msg = $('#askOwnMsg');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim().toLowerCase();
      if (!text) return;
      const id = Object.keys(WORDS).find((k) => WORDS[k].test(text));
      if (!id) { msg.textContent = 'This page can only replay the eight requests above. The real Jarvis takes anything you say.'; return; }
      const tab = $(`.ask[data-ask="${id}"]`, consoleEl);
      msg.textContent = `Closest request on this page: “${$('q', tab).textContent}”.`;
      pick(tab);
    });
  }

  // ---------- The feature list: search, kinds, where you get it, which computer; reset; copy a link ----------
  const groupsEl = $('#fxGroups');
  const features = { show: () => {} };
  if (groupsEl) {
    const items = $$('.fx', groupsEl);
    const groups = $$('.fx-group', groupsEl);
    const search = $('#fxSearch');
    const statusEl = $('#fxStatus');
    const emptyEl = $('#fxEmpty');
    const clearBtn = $('#fxClear');
    const moreRow = $('#fxMoreRow');
    // With JavaScript the list opens on the highlights; searching or filtering looks through everything.
    const DEFAULT = { q: '', cat: $('[data-filter-cat="top"]') ? 'top' : 'all', status: 'all', os: 'all' };
    const filter = { ...DEFAULT };
    const total = items.length;
    let statusTimer = null;
    const press = (attr, value) => $$(`[${attr}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
    function apply(announce) {
      const words = filter.q.toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      items.forEach((li) => {
        const ok = (filter.cat === 'all' || (filter.cat === 'top' ? li.classList.contains('fx-major') : li.dataset.cat === filter.cat))
          && (filter.status === 'all' || li.dataset.status === filter.status)
          && (filter.os === 'all' || li.dataset.os === 'both' || li.dataset.os === filter.os)
          && words.every((w) => li.dataset.words.includes(w));
        if (ok && li.hidden && !reducedMotion) { li.classList.remove('is-in'); void li.offsetWidth; li.classList.add('is-in'); }
        li.hidden = !ok;
        if (ok) shown++;
      });
      groups.forEach((g) => { g.hidden = !$$('.fx', g).some((li) => !li.hidden); });
      emptyEl.hidden = shown > 0;
      moreRow.hidden = filter.cat !== 'top';
      const dirty = Object.keys(DEFAULT).some((k) => filter[k] !== DEFAULT[k]);
      clearBtn.disabled = !dirty;
      const text = filter.cat === 'top' && shown ? `Showing ${shown} highlights of ${total}.` : shown === total ? `Showing all ${total}.` : shown === 0 ? `Nothing matches. 0 of ${total}.` : `Showing ${shown} of ${total}.`;
      clearTimeout(statusTimer);
      if (announce) statusTimer = later(() => { statusEl.textContent = text; }, 300);
      else statusEl.textContent = text;
    }
    function set(key, value, announce = true) {
      filter[key] = value;
      if (key !== 'cat' && value !== DEFAULT[key] && filter.cat === 'top') { filter.cat = 'all'; press('data-filter-cat', 'all'); }
      if (key === 'cat') press('data-filter-cat', value);
      if (key === 'status') press('data-filter-status', value);
      if (key === 'os') press('data-filter-os', value);
      if (key === 'q') { if (search.value !== value) search.value = value; filter.q = value.trim(); }
      apply(announce);
    }
    function reset() { Object.entries(DEFAULT).forEach(([k, v]) => set(k, v, false)); apply(true); }
    search.addEventListener('input', () => set('q', search.value.trim() ? search.value : ''));
    search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.preventDefault(); set('q', ''); } });
    $$('[data-filter-cat]').forEach((b) => b.addEventListener('click', () => set('cat', b.dataset.filterCat)));
    $$('[data-filter-status]').forEach((b) => b.addEventListener('click', () => set('status', b.dataset.filterStatus)));
    $$('[data-filter-os]').forEach((b) => b.addEventListener('click', () => set('os', b.dataset.filterOs)));
    clearBtn.addEventListener('click', () => { reset(); search.focus(); });
    $('#fxReset').addEventListener('click', () => { reset(); search.focus(); });
    press('data-filter-cat', filter.cat);
    apply(false);
    $('#fxMore').addEventListener('click', () => set('cat', 'all'));
    features.show = (status) => { reset(); set('status', status); };

    // "Play it in the demo": pick that request in the explorer and run it.
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
      if (li.hidden) set('cat', 'all');
      $('details', li).open = true;
      li.classList.remove('is-flash'); void li.offsetWidth; li.classList.add('is-flash');
      li.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    };
    window.addEventListener('hashchange', openFromHash);
    if (location.hash.startsWith('#f-')) later(openFromHash, 60);
  }
  // "See what's next" opens the feature list on the next-release items.
  $$('[data-show-status]').forEach((a) => a.addEventListener('click', () => features.show(a.dataset.showStatus)));

  // ---------- The screenshot viewer leans a little toward the pointer ----------
  const shots = $('[data-tilt]');
  if (shots && !reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    shots.addEventListener('pointermove', (e) => {
      const r = shots.getBoundingClientRect();
      shots.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 3).toFixed(2)}deg`);
      shots.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 2.4).toFixed(2)}deg`);
    });
    shots.addEventListener('pointerleave', () => { shots.style.setProperty('--ry', '0deg'); shots.style.setProperty('--rx', '0deg'); });
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
  // out. The buttons in the hero and header lead to that section and point at the right installer, so the warnings
  // and the other system are always in view. On a phone, where Jarvis can't run, they send the page on.
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
    mine.classList.remove('btn-ghost'); mine.classList.add('btn-primary');
    other.classList.remove('btn-primary'); other.classList.add('btn-ghost');
    const option = mine.closest('.dl-option');
    option.parentElement.prepend(option);
    $$('[data-os-link]').forEach((link) => {
      const label = $('.btn-label', link);
      if (label && label.textContent === 'Download Jarvis') label.textContent = `Download for ${os === 'win' ? 'Windows' : 'Mac'}`;
    });
  }
  if (isMobile) {
    $$('[data-os-link]').forEach((link) => {
      link.setAttribute('aria-label', 'Send Jarvis to my computer');
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
      try { await navigator.share({ title: 'Jarvis', text: 'Jarvis, a voice assistant for Windows and macOS', url }); shared = true; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    const copied = shared ? false : await copyText(url);
    showToast(shared ? 'Open the link on your PC or Mac to download Jarvis.'
      : copied ? 'Link copied. Open it on your PC or Mac to download Jarvis.'
        : 'Open this page on your PC or Mac to download Jarvis.', 'See the downloads', '#download');
  }
  $$('[data-to-download]').forEach((link) => link.addEventListener('click', (e) => {
    if (isMobile && link.hasAttribute('data-os-link')) { e.preventDefault(); sendToComputer(); return; }
    // Lands on the download section; the installer for this computer is pointed out and focused.
    const option = mine && mine.closest('.dl-option');
    if (!option) return;
    later(() => {
      option.classList.remove('is-picked'); void option.offsetWidth; option.classList.add('is-picked');
      mine.focus({ preventScroll: true });
    }, reducedMotion ? 50 : 900);
  }));
  $$('[data-download]').forEach((link) => link.addEventListener('click', () => {
    const where = (link.closest('[data-platform]') || {}).dataset?.platform || os;
    // The page can't see the download itself, so it says what should happen and where to go next.
    showToast(where === 'win' ? 'Your browser should now download the Windows installer. Next, run it.'
      : 'Your browser should now download the Mac installer. Next, open it and drag the app to Applications.', 'See the install steps', '#install');
    const tab = $(`.os-tabs [data-os="${where}"]`);
    if (tab) selectTab(tab, false);
  }));
  $('.toast-close').addEventListener('click', hideToast);
  toastLink.addEventListener('click', hideToast);

  // "Explore the demo" lands on the explorer and plays the request that is up.
  $$('[data-play-demo]').forEach((a) => a.addEventListener('click', () => later(() => demo.play(), reducedMotion ? 0 : 900)));

  // ---------- Blocks that start below the fold settle in once, as they arrive ----------
  if (!reducedMotion && 'IntersectionObserver' in window) {
    // Only what starts below the fold is held back, so nothing on screen ever waits; it all shows if this fails.
    const revealIO = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); revealIO.unobserve(entry.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    $$('.section-head, .console, .specs, .board, .ledger, .controls, .req-grid, .install-panels, .install-extra, .faq-list, .download-head, .download-actions, .download-more')
      .filter((el) => el.getBoundingClientRect().top > window.innerHeight)
      .forEach((el) => { el.classList.add('reveal'); revealIO.observe(el); });
  }

  // ---------- The 3D core: loaded after the page is up; the app's own 2D core stands in where WebGL can't run ----------
  const sceneCanvas = $('#scene');
  function standIn() {
    root.classList.add('no-webgl');
    const s = document.createElement('script');
    s.src = new URL('orb.js', scriptUrl).href;
    s.onload = () => { if (window.initOrb) { window.initOrb('heroOrb'); window.setOrbState('speaking'); } };   // 'speaking' is its blue state
    document.head.append(s);
  }
  function hasWebGL() {
    try {
      const c = document.createElement('canvas');
      return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (_) { return false; }
  }
  if (sceneCanvas && scriptUrl) {
    if (!hasWebGL()) standIn();
    else {
      const start = () => import(new URL('core3d.js', scriptUrl).href)
        .then((m) => { m.initCore({ canvas: sceneCanvas, reducedMotion }); root.classList.add('core-on'); })
        .catch(standIn);
      if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 900 }); else later(start, 120);
    }
  }
})();
