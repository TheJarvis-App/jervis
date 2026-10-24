"""Write the feature explorer into index.html from features/features.json.

    python3 tools/build_features.py

features.json is the one list of everything Jarvis does, each entry checked against the app's source. This turns it
into plain HTML between the `features:start` and `features:end` markers in index.html, so the whole list is in the page
itself: readable without JavaScript and by search engines. site.js only adds the search and the filters on top.
Run it after editing features.json, then commit both files.
"""
import html
import json
import os
import re
import sys

WEBSITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(WEBSITE, "features", "features.json")
PAGE = os.path.join(WEBSITE, "index.html")

STATUS = {   # full label (read out), short badge (shown), key
    "download": ("In the download", "Now", "now"),
    "next": ("Next release", "Next", "next"),
    "source": ("From source", "Source", "source"),
}
OS = {"both": "Windows and Mac", "mac": "Mac only", "win": "Windows only"}


def esc(text: str) -> str:
    return html.escape(text or "", quote=True)


def feature_html(f: dict, cat_name: str) -> str:
    label, short, key = STATUS[f["status"]]
    say = f'<p class="fx-say"><svg class="icon" aria-hidden="true"><use href="#i-microphone"/></svg><q>{esc(f["say"])}</q></p>' if f.get("say") else ""
    needs = f'<p class="fx-needs"><strong>Needs</strong> {esc(f["needs"])}</p>' if f.get("needs") else ""
    demo = '<a class="fx-demo" href="#showcase" data-scene-link="{}">Play it in the demo</a>'.format(esc(f["id"])) if f.get("demo") else ""
    words = " ".join([f["name"], f["summary"], f.get("benefit", ""), f.get("say", ""), cat_name]).lower()
    return (
        f'<li class="fx{" fx-major" if f.get("major") else ""}" id="f-{esc(f["id"])}" data-cat="{esc(f["cat"])}" '
        f'data-status="{key}" data-os="{esc(f["os"])}" data-words="{esc(words)}">\n'
        f'  <details>\n'
        f'    <summary><span class="fx-name">{esc(f["name"])}</span>'
        f'<span class="fx-line">{esc(f.get("benefit", ""))}</span>'
        f'<span class="fx-tag fx-tag-{key}"><span aria-hidden="true">{short}</span><span class="sr-only">{label}</span></span>'
        f'<svg class="icon fx-caret" aria-hidden="true"><use href="#i-caret-down"/></svg></summary>\n'
        f'    <div class="fx-body"><p>{esc(f["summary"])}</p>{say}{needs}'
        f'<p class="fx-meta"><span>{OS[f["os"]]}</span><span>{esc(cat_name)}</span></p>'
        f'<p class="fx-actions">{demo}<a class="fx-link" href="#f-{esc(f["id"])}" data-copy-link>Copy link to this</a></p></div>\n'
        f'  </details>\n'
        f'</li>'
    )


def counts() -> dict:
    with open(DATA, encoding="utf-8") as fh:
        features = json.load(fh)["features"]
    out = {k: sum(1 for f in features if f["status"] == k) for k in STATUS}
    out["total"] = len(features)
    return out


def build() -> str:
    with open(DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    cats = {c["id"]: c["name"] for c in data["categories"]}
    features = data["features"]
    unknown = sorted({f["cat"] for f in features} - cats.keys())
    if unknown:
        sys.exit(f"Unknown categories in features.json: {unknown}")
    ids = [f["id"] for f in features]
    if len(ids) != len(set(ids)):
        sys.exit("Duplicate feature ids in features.json.")
    groups = []
    for cid, cname in cats.items():
        items = [f for f in features if f["cat"] == cid]
        if not items:
            continue
        rows = "\n".join(feature_html(f, cname) for f in items)
        groups.append(
            f'<section class="fx-group" data-cat="{cid}" aria-labelledby="fxg-{cid}">\n'
            f'<h3 class="fx-group-title" id="fxg-{cid}">{esc(cname)} <span class="fx-count">{len(items)}</span></h3>\n'
            f'<ul class="fx-list">\n{rows}\n</ul>\n</section>'
        )
    counts = {k: sum(1 for f in features if f["status"] == k) for k in STATUS}
    chips = [f'<button class="chip" type="button" data-filter-cat="all" aria-pressed="true">Everything <span>{len(features)}</span></button>']
    # The page opens on the highlights (the features marked "major"); the rest are one press away.
    chips.append(f'<button class="chip" type="button" data-filter-cat="top" aria-pressed="false">Highlights <span>{sum(1 for f in features if f.get("major"))}</span></button>')
    for cid, cname in cats.items():
        n = sum(1 for f in features if f["cat"] == cid)
        chips.append(f'<button class="chip" type="button" data-filter-cat="{cid}" aria-pressed="false">{esc(cname)} <span>{n}</span></button>')
    summary = (
        f'<p class="fx-total" data-total="{len(features)}"><strong>{len(features)}</strong> things Jarvis can do: '
        f'<span class="tally tally-now">{counts["download"]} in the download</span>, '
        f'<span class="tally tally-next">{counts["next"]} in the next release</span>, '
        f'<span class="tally tally-source">{counts["source"]} from the source code</span>.</p>'
    )
    return (
        "<!-- features:start (generated by tools/build_features.py from features/features.json; edit those, not this) -->\n"
        f'{summary}\n<div class="fx-chips" role="group" aria-label="Show a kind of feature" hidden data-js-only>\n'
        + "\n".join(chips)
        + "\n</div>\n"
        + '<div class="tools-bar" hidden data-js-only>'
        f'<p class="fx-status" id="fxStatus" role="status" aria-live="polite">Showing all {len(features)}.</p>'
        '<button class="text-btn reset-btn" type="button" id="fxClear" disabled>Clear search and filters</button></div>\n'
        + "<div class=\"fx-groups\" id=\"fxGroups\">\n"
        + "\n".join(groups)
        + "\n</div>\n<!-- features:end -->"
    )


def main() -> None:
    with open(PAGE, encoding="utf-8") as fh:
        page = fh.read()
    block = build()
    pattern = re.compile(r"<!-- features:start.*?<!-- features:end -->", re.S)
    if not pattern.search(page):
        sys.exit("index.html has no features:start / features:end markers.")
    page = pattern.sub(lambda _m: block, page, count=1)
    # Counts quoted elsewhere on the page (the download panel, the live result count) follow the same data.
    n = counts()
    page = re.sub(r'(<span data-fx-count="(\w+)">)\d*(</span>)', lambda m: f"{m.group(1)}{n[m.group(2)]}{m.group(3)}", page)
    page = re.sub(r'(<p class="fx-status" id="fxStatus"[^>]*>)[^<]*(</p>)',
                  lambda m: f"{m.group(1)}Showing all {n['total']}.{m.group(2)}", page)
    with open(PAGE, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(page)
    print("Feature explorer written into index.html.")


if __name__ == "__main__":
    main()
