// Coding Mode, replayed: a real session from the development version (the racing website in the screenshot) played
// back in a recreation of the Coding window, then handed over to the real screenshot of the same moment. The request,
// the stages, the five files and their line counts, the checks and the How to run panel are the session's own; the
// recreation is laid out from the screenshot (1600 x 608) so the hand-over is a match cut. Plays once when it comes
// into view; "Replay session" plays it again. Without motion (or JavaScript) the screenshot is simply there.
import { createTimeline, utils } from './vendor/anime.esm.min.js';

const W = 1600, H = 608;
const PROMPT = 'Build me a modern website about racing: a hero section, the teams, a race calendar and a contact form. Dark, responsive, with subtle animations.';
const FILES = [['index.html', 113], ['styles/style.css', 234], ['scripts/contact.js', 63], ['README.md', 46], ['.env.example', 2]];
const STAGES = [['Plan', 344, 519], ['Write', 530, 710], ['Check', 716, 896], ['Save', 903, 1082]];

export function codingReplay(figure, { EASE }) {
  const img = figure.querySelector('img');
  if (!img || figure.clientWidth < 720) return;   // on a narrow screen its text would be too small to read: the screenshot stays
  const screen = document.createElement('div');
  screen.className = 'cr-screen';
  img.replaceWith(screen);
  screen.append(img);
  const rp = document.createElement('div');
  rp.className = 'cr';
  rp.setAttribute('aria-hidden', 'true');   // the screenshot's description stays what readers get
  screen.append(rp);
  const replayBtn = document.createElement('button');
  replayBtn.type = 'button'; replayBtn.className = 'cr-again'; replayBtn.textContent = 'Replay session';
  screen.after(replayBtn);

  // place things in screenshot coordinates
  const at = (el, x, y, w) => { el.style.left = `${(x / W) * 100}%`; el.style.top = `${(y / H) * 100}%`; if (w) el.style.width = `${(w / W) * 100}%`; return el; };
  const box = (cls, x0, y0, x1, y1, parent = rp) => { const e = document.createElement('div'); e.className = cls; at(e, x0, y0, x1 - x0); e.style.height = `${((y1 - y0) / H) * 100}%`; parent.append(e); return e; };
  const text = (cls, s, x, y, parent = rp) => { const e = document.createElement('span'); e.className = `cr-t ${cls}`; e.textContent = s; at(e, x, y); parent.append(e); return e; };

  // the frame: sidebar, header, the right-hand panel's edge
  box('cr-side', 0, 0, 292, H);
  box('cr-rule-v', 1133, 0, 1134, H);
  box('cr-rule-h', 292, 66, 1133, 67);
  box('cr-logo', 102, 18, 133, 48);
  text('cr-h b', 'Coding', 145, 33); text('cr-m', 'Jarvis', 218, 33);
  box('cr-btn-line', 14, 71, 278, 113); text('cr-s', '+  New project', 30, 92); text('cr-k', '⌘ N', 237, 92);
  text('cr-m', 'Search name or folder', 52, 143); text('cr-m sm b', 'Projects', 22, 189);
  const item = box('cr-item', 9, 208, 283, 264); text('cr-s', 'Build me a modern website…', 42, 225); text('cr-m sm', 'HTML · just now', 42, 245);
  box('cr-dot', 20, 232, 27, 239);
  text('cr-h b', 'racing-website', 318, 20);
  text('cr-m', 'Website (HTML, CSS, JavaScript)', 318, 44);
  const status = text('cr-status', 'Waiting', 566, 44);
  const run = box('cr-run', 703, 14, 785, 51); text('cr-run-t', '▶  Run', 720, 33);
  box('cr-btn-line', 793, 14, 967, 51); text('cr-s', '‹/›  Open in VS Code', 808, 33);

  // the request
  const bubble = box('cr-bubble', 433, 98, 1101, 170);
  const typed = document.createElement('p'); typed.className = 'cr-typed'; bubble.append(typed);
  const time = text('cr-m sm', '11:45 PM', 1046, 183);

  // the build card
  const card = box('cr-card', 325, 218, 1101, 640);
  const cardIn = document.createElement('div'); cardIn.className = 'cr-card-in'; rp.append(cardIn);
  const tick = box('cr-tick', 345, 237, 369, 261, cardIn);
  const title = text('cr-h b', 'Building racing-website', 380, 248, cardIn);
  box('cr-tag', 1027, 236, 1081, 260, cardIn); text('cr-m sm', 'HTML', 1037, 248, cardIn);
  const bars = STAGES.map(([name, x0, x1]) => { box('cr-bar-bg', x0, 274, x1, 278, cardIn); const b = box('cr-bar', x0, 274, x1, 278, cardIn); text('cr-m sm', name, x0, 293, cardIn); return b; });
  const rows = FILES.map(([name, lines], i) => {
    const y = 333 + i * 34.5, row = document.createElement('div'); row.className = 'cr-row'; cardIn.append(row);
    box('cr-dot', 348, y - 3.5, 355, y + 3.5, row); text('cr-mono', name, 369, y, row);
    const count = text('cr-m sm cr-right', `new · ${lines} lines`, 1082, y, row);
    return { row, count, lines };
  });
  const checks = text('cr-s', '3 checks passed', 344, 513, cardIn);
  const summary = document.createElement('p'); summary.className = 'cr-summary';
  summary.textContent = 'A modern, dark-themed responsive racing website built with semantic HTML5, CSS animations, and a small vanilla JavaScript contact form.';
  at(summary, 344, 537, 740); cardIn.append(summary);

  // the right-hand panel: How to run
  const panel = document.createElement('div'); panel.className = 'cr-panel'; rp.append(panel);
  text('cr-m', 'Files', 1163, 41, panel); box('cr-badge', 1199, 30, 1225, 52, panel); text('cr-m sm', '5', 1208, 41, panel);
  text('cr-s', 'How to run', 1255, 41, panel); box('cr-under', 1253, 64, 1336, 67, panel); text('cr-m', 'Checks', 1362, 41, panel);
  text('cr-h b', 'Website (HTML, CSS, JavaScript)', 1154, 105, panel);
  box('cr-open', 1475, 87, 1579, 124, panel); text('cr-open-t', '▶  Open it', 1492, 105, panel);
  text('cr-m', 'Opens it in your browser, after you confirm in the chat.', 1154, 143, panel);
  text('cr-s b', 'What you need', 1154, 192, panel);
  box('cr-need', 1154, 216, 1579, 285, panel); text('cr-s', 'A web browser', 1201, 239, panel); text('cr-m', 'Safari, Chrome, Edge or Firefox; nothing else to install.', 1201, 262, panel);
  text('cr-s b', 'Steps', 1154, 324, panel);
  box('cr-num', 1155, 346, 1180, 371, panel); text('cr-m sm', '1', 1164, 359, panel);
  const step1 = document.createElement('p'); step1.className = 'cr-p'; step1.innerHTML = 'Open the project folder and double-click <b>index.html</b>. It opens in your web browser.'; at(step1, 1194, 347, 400); panel.append(step1);
  box('cr-num', 1155, 410, 1180, 435, panel); text('cr-m sm', '2', 1164, 423, panel);
  const step2 = document.createElement('p'); step2.className = 'cr-p'; step2.innerHTML = 'Or press <b>Run</b> here, and Jarvis opens it for you.'; at(step2, 1194, 411, 400); panel.append(step2);
  text('cr-s b', 'What you should see', 1154, 473, panel);
  const see = document.createElement('p'); see.className = 'cr-p cr-muted'; see.textContent = 'The site appears in your browser. Every page works from the files in the folder, with no internet needed except for anything it loads from the web.'; at(see, 1154, 491, 425); panel.append(see);

  // ---------- the replay ----------
  let tl = null;
  const reset = () => {
    utils.set(rp, { opacity: 1 }); utils.set(img, { opacity: 0 });
    typed.textContent = ''; status.textContent = 'Waiting'; status.classList.remove('is-ready'); title.textContent = 'Building racing-website';
    utils.set([card, cardIn, panel, time, checks, summary, tick], { opacity: 0 });
    utils.set(rows.map((r) => r.row), { opacity: 0, x: -8 });
    utils.set(bars, { scaleX: 0 });
    run.classList.remove('is-ready'); replayBtn.hidden = true;
  };
  const play = () => {
    tl?.pause(); reset();
    const n = { c: 0 };
    tl = createTimeline({ defaults: { ease: EASE.out } })
      .add(n, { c: PROMPT.length, duration: PROMPT.length * 13, ease: 'linear', onUpdate: () => { typed.textContent = PROMPT.slice(0, Math.round(n.c)); } }, 200)
      .add(time, { opacity: [0, 1], duration: 300 }, '<')
      .add([card, cardIn], { opacity: [0, 1], y: [10, 0], duration: 500 }, '<+=150')
      .call(() => { status.textContent = 'Planning'; }, '<')
      .add(bars[0], { scaleX: [0, 1], duration: 600, ease: EASE.inOut }, '<')
      .call(() => { status.textContent = 'Writing'; }, '<')
      .add(bars[1], { scaleX: [0, 1], duration: 2100, ease: 'linear' }, '<');
    rows.forEach((r, i) => {
      const c = { v: 0 };
      tl.add(r.row, { opacity: [0, 1], x: [-8, 0], duration: 360 }, i === 0 ? '<<' : '<<+=420')   // a file every 0.42 s while Write fills
        .add(c, { v: r.lines, duration: 380, ease: EASE.out, onUpdate: () => { r.count.textContent = `new · ${Math.round(c.v)} lines`; } }, '<<');
    });
    tl.call(() => { status.textContent = 'Checking'; }, '<+=500')
      .add(bars[2], { scaleX: [0, 1], duration: 700, ease: EASE.inOut }, '<')
      .add(checks, { opacity: [0, 1], duration: 400 }, '<+=500')
      .call(() => { status.textContent = 'Saving'; }, '<+=200')
      .add(bars[3], { scaleX: [0, 1], duration: 450, ease: EASE.inOut }, '<')
      .call(() => { status.textContent = 'Ready'; status.classList.add('is-ready'); title.textContent = 'Built racing-website'; run.classList.add('is-ready'); }, '<+=450')
      .add(tick, { opacity: [0, 1], scale: [0.4, 1], duration: 450, ease: 'outBack(2)' }, '<')
      .add(summary, { opacity: [0, 1], duration: 500 }, '<+=100')
      .add(panel, { opacity: [0, 1], x: [24, 0], duration: 700 }, '<+=150')
      // the hand-over: the recreation gives way to the real screenshot of the same moment
      .add(img, { opacity: [0, 1], duration: 900, ease: EASE.inOut }, '<+=1500')
      .add(rp, { opacity: [1, 0], duration: 900, ease: EASE.inOut }, '<')
      .call(() => { replayBtn.hidden = false; });
  };
  reset();
  replayBtn.addEventListener('click', play);
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); play(); } }, { threshold: 0.45 });
  io.observe(screen);
}
