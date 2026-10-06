#!/usr/bin/env python3
"""Download the course photographs from Wikimedia Commons and record their licences.

Run this once, on any computer with internet access, from inside this folder:

    python3 fetch_images.py

It reads images.json, finds each image on Wikimedia Commons (first by the listed
file titles, then by a Commons search), accepts it ONLY if its licence is public
domain, CC0, CC BY or CC BY-SA, downloads a 1200-px-wide version (SVGs as
originals), and writes credits.json with author, licence and source page.
The website reads credits.json to print the attribution under every photograph
and on the Credits page. Images that are missing are simply hidden on the site.

Please check credits.json afterwards: attribution is a licence condition.
Only the Python standard library is used.
"""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "EmbeddedML-course-image-fetcher/1.0 (teaching use; contact: course lecturer)"
OK = re.compile(r"^(cc0|public domain|pd\b.*|cc[ -]by(-sa)?[ -]\d\.\d.*|cc[ -]by(-sa)?$)", re.I)
HERE = os.path.dirname(os.path.abspath(__file__))


def api(params):
    params = dict(params, format="json", formatversion="2")
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as ex:
            if ex.code != 429 or attempt == 3:
                raise
            delay = int(ex.headers.get("Retry-After", 2 ** attempt))
            print("  ! rate limited; waiting %ss" % delay)
            time.sleep(delay)


def info(title, width):
    d = api({"action": "query", "titles": title, "prop": "imageinfo",
             "iiprop": "url|extmetadata|mime", "iiurlwidth": str(width)})
    pages = d.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing") or "imageinfo" not in pages[0]:
        return None
    ii = pages[0]["imageinfo"][0]
    md = ii.get("extmetadata", {})
    get = lambda k: re.sub(r"<[^>]+>", "", md.get(k, {}).get("value", "")).strip()
    return {"title": pages[0]["title"], "url": ii.get("url"), "thumb": ii.get("thumburl"),
            "page": ii.get("descriptionurl"), "license": get("LicenseShortName"),
            "license_url": get("LicenseUrl"), "author": get("Artist") or get("Credit"),
            "mime": ii.get("mime")}


def search(q):
    d = api({"action": "query", "list": "search", "srsearch": q, "srnamespace": "6", "srlimit": "10"})
    return [h["title"] for h in d.get("query", {}).get("search", [])]


def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
                f.write(r.read())
            return
        except urllib.error.HTTPError as ex:
            if ex.code != 429 or attempt == 3:
                raise
            delay = int(ex.headers.get("Retry-After", 2 ** attempt))
            print("  ! rate limited; waiting %ss" % delay)
            time.sleep(delay)


def main():
    spec = json.load(open(os.path.join(HERE, "images.json")))
    credits = []
    for e in spec:
        out = os.path.join(HERE, e["file"])
        cands = list(e.get("titles", []))
        chosen = None
        tried = set()
        for attempt in (0, 1):
            for t in cands:
                if t in tried:
                    continue
                tried.add(t)
                try:
                    i = info(t, 1200)
                except Exception as ex:
                    print("  ! %s: %s" % (t, ex)); continue
                time.sleep(0.5)
                if not i:
                    continue
                if not OK.match(i["license"] or ""):
                    print("  - skip %s (licence: %s)" % (t, i["license"] or "unknown")); continue
                if e["file"].endswith(".svg") != (i["mime"] == "image/svg+xml"):
                    continue
                chosen = i; break
            if chosen or attempt == 1:
                break
            cands = search(e["search"])
        if not chosen:
            print("x %-26s no suitably licensed image found — add a title to images.json" % e["file"]); continue
        url = chosen["url"] if e.get("original") or e["file"].endswith(".svg") else (chosen["thumb"] or chosen["url"])
        try:
            download(url, out)
        except Exception as ex:
            print("x %-26s download failed: %s" % (e["file"], ex)); continue
        credits.append({"file": e["file"], "subject": e["subject"], "title": chosen["title"], "page": chosen["page"],
                        "author": chosen["author"][:200], "license": chosen["license"], "license_url": chosen["license_url"]})
        print("✓ %-26s %s  [%s]" % (e["file"], chosen["title"], chosen["license"]))
        time.sleep(0.5)
    json.dump(credits, open(os.path.join(HERE, "credits.json"), "w"), indent=1, ensure_ascii=False)
    print("\n%d of %d images downloaded; credits written to credits.json" % (len(credits), len(spec)))


if __name__ == "__main__":
    sys.exit(main())
