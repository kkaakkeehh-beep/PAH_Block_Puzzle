# -*- coding: utf-8 -*-
"""Generates one indexable page per language from index.html + i18n.js.

The game switches language in the browser, which gives search engines a single
English URL no matter how many translations exist. This writes a real
directory per language -- /ja/, /fr/, ... -- each with its own <title>,
description, pre-translated body text and the full hreflang set, so every
translation can be indexed and found in its own language.

Nothing here is a second copy of the translations: every string is read back
out of i18n.js, so a page cannot drift from what the game actually shows.

    py -X utf8 tools/build_langs.py

Re-run it after editing i18n.js or the markup of index.html.
"""

import datetime
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://kkaakkeehh-beep.github.io/PAH_Block_Puzzle/"

# The language served at "/". It gets no subdirectory of its own, so English
# has exactly one URL rather than two competing ones.
DEFAULT_LANG = "en"

# BCP-47 tags for hreflang. The two Chinese translations differ by script, not
# region, so they are advertised as Hans/Hant rather than by country.
HREFLANG = {
    "en": "en", "ja": "ja", "zh": "zh-Hans", "zh-TW": "zh-Hant", "ko": "ko",
    "bg": "bg", "de": "de", "et": "et", "el": "el", "es": "es", "fr": "fr",
    "it": "it", "pl": "pl", "ru": "ru", "uk": "uk", "fi": "fi",
}

OG_LOCALE = {
    "en": "en_US", "ja": "ja_JP", "zh": "zh_CN", "zh-TW": "zh_TW", "ko": "ko_KR",
    "bg": "bg_BG", "de": "de_DE", "et": "et_EE", "el": "el_GR", "es": "es_ES",
    "fr": "fr_FR", "it": "it_IT", "pl": "pl_PL", "ru": "ru_RU", "uk": "uk_UA",
    "fi": "fi_FI",
}


# Hand-written descriptions win over the composed one. Only for languages
# where the text has actually been reviewed -- inventing marketing copy in
# fourteen languages nobody here reads would be worse than reusing the UI
# strings, which at least are translations someone checked.
DESCRIPTION_OVERRIDES = {
    "en": ("A block puzzle built from real polycyclic aromatic hydrocarbons. "
           "Benzene to coronene on a hex grid, drawn as proper Kekule "
           "structures. Two modes, sixteen languages, plays in the browser."),
    "ja": ("実在の多環芳香族炭化水"
           "素でできたブロックパズ"
           "ル。ベンゼンからコロネ"
           "ンまでを、六角格子の上"
           "に本物のケクレ構造で描"
           "きます。2つのモード、16"
           "言語、ブラウザですぐ遊"
           "べます。"),
}


def strip_generated(html):
    """Removes whatever a previous run added, so re-running is safe.

    index.html is both the template and one of the outputs, so without this a
    second run would stack up duplicate hreflang blocks and boot scripts.
    """
    html = re.sub(r'^[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?',
                  "", html, flags=re.M)
    html = re.sub(r'^[ \t]*<meta property="og:locale" content="[^"]*">\n?',
                  "", html, flags=re.M)
    html = re.sub(r"^[ \t]*<script>window\.(PAGE_LANG|SITE_ROOT)=.*?</script>\n?",
                  "", html, flags=re.M)
    return html


def js_object_to_json(src):
    """Converts a JS object literal to JSON.

    Only two things separate the literal in i18n.js from JSON: bare identifier
    keys and trailing commas. Both are handled with a scan that knows where
    string literals start and end, so a colon or a brace inside a translated
    string is never mistaken for syntax.
    """
    out = []
    i = 0
    n = len(src)
    while i < n:
        ch = src[i]
        if ch == '"':
            j = i + 1
            while j < n:
                if src[j] == "\\":
                    j += 2
                    continue
                if src[j] == '"':
                    break
                j += 1
            out.append(src[i:j + 1])
            i = j + 1
            continue
        m = re.match(r"[A-Za-z_$][A-Za-z0-9_$]*(?=\s*:)", src[i:])
        if m:
            out.append('"' + m.group(0) + '"')
            i += m.end()
            continue
        out.append(ch)
        i += 1
    text = "".join(out)
    return re.sub(r",(\s*[}\]])", r"\1", text)


def load_translations():
    with open(os.path.join(ROOT, "i18n.js"), encoding="utf-8") as f:
        js = f.read()
    marker = "const TRANSLATIONS = "
    start = js.index(marker) + len(marker)
    depth = 0
    end = None
    for k in range(start, len(js)):
        if js[k] == "{":
            depth += 1
        elif js[k] == "}":
            depth -= 1
            if depth == 0:
                end = k + 1
                break
    if end is None:
        raise SystemExit("could not find the end of TRANSLATIONS in i18n.js")
    return json.loads(js_object_to_json(js[start:end]))


def tr(trans, lang, key):
    return trans.get(lang, {}).get(key) or trans["en"].get(key) or key


def page_title(trans, lang):
    return "PAH Block Puzzle — " + tr(trans, lang, "subtitle")


def page_description(trans, lang):
    """Built only from strings already translated in i18n.js.

    Writing a marketing sentence per language would mean sixteen unreviewed
    translations; these are the ones the home screen already shows.
    """
    if lang in DESCRIPTION_OVERRIDES:
        return DESCRIPTION_OVERRIDES[lang]
    parts = [
        tr(trans, lang, "subtitle"),
        tr(trans, lang, "home.tagline"),
        tr(trans, lang, "home.fallingDesc"),
        tr(trans, lang, "home.placingDesc"),
    ]
    text = " ".join(p.strip() for p in parts if p)
    return re.sub(r"\s+", " ", text).strip()


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def url_for(lang):
    return SITE if lang == DEFAULT_LANG else SITE + lang + "/"


def hreflang_block(langs):
    lines = ['<link rel="alternate" hreflang="' + HREFLANG[l] + '" href="'
             + url_for(l) + '">' for l in langs]
    lines.append('<link rel="alternate" hreflang="x-default" href="' + SITE + '">')
    return "\n".join(lines)


def translate_body(html, trans, lang):
    """Writes the translated text straight into the markup.

    applyTranslations() in i18n.js sets exactly the same strings at runtime, so
    this changes nothing for a visitor -- it is purely so a crawler that never
    runs the script still reads the page in the right language.
    """
    count = [0]

    def text_sub(m):
        open_tag, tag, attrs, inner, close = m.groups()
        key = re.search(r'data-i18n="([^"]+)"', attrs).group(1)
        count[0] += 1
        return open_tag + esc(tr(trans, lang, key)) + close

    html = re.sub(r'(<(\w+)([^>]*\bdata-i18n="[^"]+"[^>]*)>)([^<]*)(</\2>)',
                  text_sub, html)

    def aria_sub(m):
        attrs = m.group(1)
        key = re.search(r'data-i18n-aria="([^"]+)"', attrs).group(1)
        new = re.sub(r'aria-label="[^"]*"',
                     'aria-label="' + esc(tr(trans, lang, key)) + '"', attrs)
        count[0] += 1
        return "<" + new + ">"

    html = re.sub(r'<([^<>]*\bdata-i18n-aria="[^"]+"[^<>]*)>', aria_sub, html)
    return html, count[0]


def build_page(template, trans, lang, langs):
    html = template
    title = page_title(trans, lang)
    desc = page_description(trans, lang)
    url = url_for(lang)
    sub = lang != DEFAULT_LANG

    html = html.replace('<html lang="en">', '<html lang="' + lang + '">', 1)
    html = re.sub(r"<title>.*?</title>", "<title>" + esc(title) + "</title>",
                  html, count=1)
    html = re.sub(r'<meta name="description" content="[^"]*">',
                  '<meta name="description" content="' + esc(desc) + '">',
                  html, count=1)
    html = re.sub(r'<link rel="canonical" href="[^"]*">',
                  '<link rel="canonical" href="' + url + '">\n'
                  + hreflang_block(langs), html, count=1)

    for prop, value in (("og:title", title), ("og:description", desc),
                        ("og:url", url)):
        html = re.sub(r'<meta property="' + prop + r'" content="[^"]*">',
                      '<meta property="' + prop + '" content="' + esc(value) + '">',
                      html, count=1)
    html = re.sub(r'<meta property="og:type" content="website">',
                  '<meta property="og:type" content="website">\n'
                  '<meta property="og:locale" content="' + OG_LOCALE[lang] + '">',
                  html, count=1)
    for name, value in (("twitter:title", title), ("twitter:description", desc)):
        html = re.sub(r'<meta name="' + name + r'" content="[^"]*">',
                      '<meta name="' + name + '" content="' + esc(value) + '">',
                      html, count=1)

    # Structured data is rebuilt rather than patched, so name, description, url
    # and inLanguage cannot disagree with the meta tags above.
    ld = re.search(r'<script type="application/ld\+json">\s*(\{.*?\})\s*</script>',
                   html, re.S)
    data = json.loads(ld.group(1))
    data["description"] = desc
    data["url"] = url
    data["inLanguage"] = [HREFLANG[l] for l in langs]
    html = (html[:ld.start(1)]
            + json.dumps(data, ensure_ascii=False, indent=2)
            + html[ld.end(1):])

    # PAGE_LANG beats the stored preference: someone landing on /fr/ has to see
    # French, or the page disagrees with its own canonical and hreflang.
    #
    # "/" deliberately does not get one. It keeps detecting the browser's
    # language as it always has, so a Japanese visitor who types the bare URL
    # still lands in Japanese. A crawler, which sends no stored preference,
    # still sees the English this URL is declared to be.
    #
    # SITE_ROOT lets the picker navigate, which keeps URL and content in step.
    boot = "<script>"
    if sub:
        boot += 'window.PAGE_LANG="' + lang + '";'
    boot += 'window.SITE_ROOT="' + ("../" if sub else "./") + '";</script>\n'
    html = html.replace('<script src="i18n.js', boot + '<script src="i18n.js', 1)

    if sub:
        for asset in ("style.css", "favicon.svg", "i18n.js", "hexmath.js",
                      "pieces.js", "board.js", "game.js"):
            html = html.replace('"' + asset, '"../' + asset)

    return translate_body(html, trans, lang)


def build_sitemap(langs):
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           "<!-- Generated by tools/build_langs.py. Every language is listed as",
           "     its own URL with the full set of alternates, so a translation",
           "     can rank in its own language instead of hiding behind the",
           "     English page. Submit this file in Search Console. -->",
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
           '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for lang in langs:
        out.append("  <url>")
        out.append("    <loc>" + url_for(lang) + "</loc>")
        # Stamped at build time: these pages change exactly when this script is
        # re-run, so that is the honest answer to "when did it last change".
        out.append("    <lastmod>" + datetime.date.today().isoformat() + "</lastmod>")
        out.append("    <changefreq>monthly</changefreq>")
        out.append("    <priority>" + ("1.0" if lang == DEFAULT_LANG else "0.8") + "</priority>")
        for other in langs:
            out.append('    <xhtml:link rel="alternate" hreflang="' + HREFLANG[other]
                       + '" href="' + url_for(other) + '"/>')
        out.append('    <xhtml:link rel="alternate" hreflang="x-default" href="' + SITE + '"/>')
        out.append("  </url>")
    out.append("</urlset>")
    return "\n".join(out) + "\n"


def main():
    trans = load_translations()
    langs = list(trans.keys())
    missing = [l for l in langs if l not in HREFLANG or l not in OG_LOCALE]
    if missing:
        raise SystemExit("add " + repr(missing) + " to HREFLANG and OG_LOCALE")

    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
        template = strip_generated(f.read())

    for lang in langs:
        html, n = build_page(template, trans, lang, langs)
        if lang == DEFAULT_LANG:
            path = os.path.join(ROOT, "index.html")
        else:
            os.makedirs(os.path.join(ROOT, lang), exist_ok=True)
            path = os.path.join(ROOT, lang, "index.html")
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(html)
        print("%-6s %-24s %3d strings  %s" % (lang, url_for(lang), n,
                                              page_title(trans, lang)))

    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8", newline="\n") as f:
        f.write(build_sitemap(langs))
    print("\nsitemap.xml: %d URLs" % len(langs))


if __name__ == "__main__":
    main()
