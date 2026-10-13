# Jervis website

The official page for Jervis: what it is, what it can do, what stays on your computer, and a real download of the app.
It is a static site (HTML, CSS and a little JavaScript, no build step and no dependencies), kept separate from the app so
nothing here can affect how Jervis runs. Its look is a space-age roadside diner that never closes: a neon sign out front,
an "Order up" counter, a drive-in screen and a menu board of everything Jervis does.

```
website/
  index.html                the page
  assets/css/site.css       styles
  assets/js/site.js         menu, tabs, the sign's live core, the night sky, the "Order up" counter, the menu's
                            search and filters, the drive-in video, copy buttons, download buttons
  assets/js/orb.js          an unchanged copy of the app's orb.js (the core on the sign and at the counter)
  assets/img/               screenshots of the real Jervis window, favicon, social image
  assets/fonts/             Inter, JetBrains Mono, Yellowtail, Alfa Slab One and Big Shoulders Display, self-hosted
  assets/video/             the drive-in film (see below)
  features/features.json    every Jervis feature, checked against the app's source: the menu is made from this
  downloads/release.json    the current release's files, sizes and checksums (written by sync_release.py)
  tools/build_features.py   writes the menu into index.html from features.json
  tools/sync_release.py     points the page at the latest installers
  tools/screenshot_feed.py  drives the real Jervis window for new screenshots
```

## Preview it

```
python3 -m http.server 8000 --directory website
```

Then open <http://localhost:8000>. Open it through a server rather than as a file, so the download link behaves like it
will online.

## The menu (every feature)

`features/features.json` is the one list of what Jervis does. Each entry has a name, a short explanation, the benefit,
something to say, its category, which computers it works on, what it needs, and where you get it:

- `download`: in the installer people can download now (tagged **Now** on the page)
- `next`: built and in the app's source code, but not in an installer yet (**Next**)
- `source`: only when running Jervis from the source code (**Source**)

After editing it, run `python3 tools/build_features.py`. It writes the whole menu into `index.html` as plain HTML, so
it is complete without JavaScript and readable by search engines; `site.js` only adds the search and the filters.
When a new release ships, move the features it contains from `next` to `download` and rebuild.

## The drive-in video

The "Now showing" screen shows an "Intermission" card over a screenshot until there is a film. To show yours:

1. Put the file in `assets/video/`, for example `assets/video/jervis-demo.mp4` (H.264 MP4, ideally under 20 MB; a
   `.webm` works too).
2. In `index.html`, find `data-video=""` on the `screen-frame` and set it to the path:
   `data-video="assets/video/jervis-demo.mp4"`. Optionally point `data-video-poster` at a still from the film.

The player only loads the file when it is named there, and falls back to the intermission card if the file is missing.

## Point the page at a new version

The installers are built, install-tested and published by GitHub Actions in the app's repository
([ArielZaha/jervis-app](https://github.com/ArielZaha/jervis-app)): pushing a tag like `v1.0.1` there makes a release
with `Jervis Setup.exe`, the Mac `.dmg` and `SHA256SUMS.txt`. They are too big for GitHub Pages, so the page links to
the release. After a release, run:

```
python3 website/tools/sync_release.py
```

It reads the latest release with the GitHub CLI, downloads both installers to check them against the published
checksums, and writes the version, the download links, the sizes and the SHA-256 values into `index.html`, the
structured data for search engines, `downloads/release.json` and `sitemap.xml`. Then commit and push the website.

## Where it lives

The site is published with GitHub Pages from [ArielZaha/jervis](https://github.com/ArielZaha/jervis) at
<https://arielzaha.github.io/jervis/>: pushing to `main` updates it within a minute or two. The installers are served
by GitHub Releases from the app's repository, so nothing large lives here. `.impeccable/` (design working files, audit and QA
reports), `PRODUCT.md` and `DESIGN.md` stay local and are not committed, since GitHub Pages would publish them.

## New screenshots

The screenshots are the real Jervis window, not mock-ups. To take new ones after the window changes, run
`venv/bin/python website/tools/screenshot_feed.py` from the app folder. It sends the window real replies made by
Jervis's own math, graph, globe and planet code, without a microphone or AI. The steps are in the file.
