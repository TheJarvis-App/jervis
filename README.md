# Jarvis website

The official page for Jarvis: what he is, what he can do, what stays on your computer, and a real download of the app.
It is a static site (HTML, CSS and JavaScript, no build step), kept separate from the app so nothing here can affect how
Jarvis runs. Its look is deep space: one machined 3D core travels the whole page and changes shape as you scroll.

The product was called "Jervis" up to version 1.0.5. The page says Jarvis; the installer file, the app's own name in
menus and its folders still say Jervis for that version, and the install help says so. The address and the repository
keep the old spelling.

```
index.html                the page
assets/css/site.css       styles
assets/js/site.js         menu, tabs, the scroll story, the trailer, the request explorer, the feature search and
                          filters, the screenshot viewer, copy buttons, download buttons
assets/js/core3d.js       the 3D core and the stars (loaded after the page is up)
assets/js/orb.js          an unchanged copy of the app's orb.js: stands in for the 3D core where WebGL can't run
assets/vendor/            three.module.min.js (Three.js r169, MIT), the only library
assets/img/               screenshots of the real window, the trailer's opening frame, favicon, social image
assets/fonts/             Mona Sans and JetBrains Mono, self-hosted
assets/video/             the trailer (see below)
features/features.json    every feature, checked against the app's source: the feature list is made from this
downloads/release.json    the current release's files, sizes and checksums (written by sync_release.py)
tools/build_features.py   writes the feature list into index.html from features.json
tools/sync_release.py     points the page at the latest installers
tools/screenshot_feed.py  drives the real window for new screenshots
```

## Preview it

```
python -m http.server 8000
```

Run it in this folder, then open <http://localhost:8000>. Open it through a server rather than as a file: the 3D core
is a JavaScript module, which browsers only load over http.

## How the core moves

Every element with the class `core-slot` is a place the core can dock; `data-core` names the shape it takes there (the
shapes are the `POSES` table at the top of `core3d.js`). Each frame the slot nearest the middle of the screen wins, and
the core glides and morphs between slots as you scroll. To put the core somewhere new, add an empty
`<div class="core-slot" data-core="hero"></div>` and size it with CSS. Scripts change a slot's shape by setting
`data-pose` on it (the explorer does, per stage; the scroll story does, per chapter).

People who ask for less motion get the same page with nothing pinned and nothing moving by itself. Without WebGL the
app's own 2D core is drawn in the hero. Without JavaScript the page is complete and the trailer uses the browser's
controls.

## The trailer

The page plays `assets/video/jarvis-trailer-final.mp4` (1920x1080, H.264 and AAC, fast start, 1:40, 56 MB). To swap in
a different cut:

1. Export it as MP4 (H.264 video, AAC audio, 1920x1080, about 4 to 8 Mbps, "fast start" / "web optimised" on) and save
   it in `assets/video/`. Keep it under about 60 MB; GitHub refuses files over 100 MB.
2. In `index.html`, change the three video paths in the trailer section, and the `width` and `height` on the `<video>`
   if the size changed.
3. Replace `assets/img/trailer-poster.webp` with a still from the new file, and fix the length shown on the play button
   (`cinema-len`) and in the line under the heading if it changed.

It never plays by itself. The file is only fetched when someone presses play.

## The feature list

`features/features.json` is the one list of what Jarvis does. Each entry has a name, a short explanation, the benefit,
something to say, its category, which computers it works on, what it needs, and where you get it:

- `download`: in the installer people can download now (tagged **Now** on the page)
- `next`: built and in the app's source code, but not in an installer yet (**Next**)
- `source`: only when running Jarvis from the source code (**Source**)

After editing it, run `python tools/build_features.py`. It writes the whole list into `index.html` as plain HTML, so it
is complete without JavaScript and readable by search engines; `site.js` adds the search and the filters, and opens the
list on the entries marked `"major": true`. When a new release ships, move the features it contains from `next` to
`download` and rebuild.

## Point the page at a new version

The installers are built, install-tested and published by GitHub Actions in the app's repository
([ArielZaha/jervis-app](https://github.com/ArielZaha/jervis-app)): pushing a tag like `v1.0.1` there makes a release
with the Windows installer, the Mac `.dmg` and `SHA256SUMS.txt`. They are too big for GitHub Pages, so the page links to
the release. After a release, run:

```
python tools/sync_release.py
```

It reads the latest release with the GitHub CLI, downloads both installers to check them against the published
checksums, and writes the version, the download links, the sizes and the SHA-256 values into `index.html`, the
structured data for search engines, `downloads/release.json` and `sitemap.xml`. Then commit and push the website.

When the first release named Jarvis ships, also remove the "released as Jervis" notes from `index.html` (search for
`Jervis`) and take new screenshots.

## Where it lives

The site is published with GitHub Pages from [ArielZaha/jervis](https://github.com/ArielZaha/jervis) at
<https://arielzaha.github.io/jervis/>: pushing to `main` updates it within a minute or two. The installers are served
by GitHub Releases from the app's repository, so nothing large lives here. `.impeccable/` (design working files),
`PRODUCT.md` and `DESIGN.md` stay local and are not committed, since GitHub Pages would publish them.

## New screenshots

The screenshots are the real window, not mock-ups. To take new ones after the window changes, run
`venv/bin/python website/tools/screenshot_feed.py` from the app folder. It sends the window real replies made by
Jarvis's own math, graph, globe and planet code, without a microphone or AI. The steps are in the file.
