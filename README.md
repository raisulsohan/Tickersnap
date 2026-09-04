# TickerSnap

A Chrome (Manifest V3) extension with two one-click extractors:

1. **Match commentary** — the full commentary text from a football match page, built for
   **FotMob** and **Sofascore**.
2. **Article text** — the clean body text of any news article page, powered by Mozilla's
   **Readability.js** (Apache-2.0), the same engine behind Firefox Reader View.

Output can be copied or saved as `.txt`.

Every capture shows up in a preview panel first, so you can check you got the right section before
copying. The result survives closing the popup — it's kept for the rest of the browser session —
and the checkboxes and custom selector are remembered between uses.

## How it works

TickerSnap doesn't use site-specific selectors. It finds every real sentence block on the page,
groups them into cards, treats the densest cluster of cards as the commentary list, then keeps
every card in that cluster and attaches its minute stamp:

- Minutes: `45'`, `90+3'` (tolerant of hidden characters and apostrophe variants).
- Entries with no minute (summaries, half-time notes) are kept with a `•` label.

Commentary feeds are lazy-loaded, so it auto-scrolls the page and accumulates entries.

**Limits, honestly:** FotMob and Sofascore structure pages differently, so on one of them a little
noise (preview text, stat sentences) may slip in, or auto-detect may miss. For those cases use
**Advanced → custom container selector** (right-click a commentary line → Inspect to find one).

## Install

1. Unzip this folder somewhere permanent.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this folder.

Thanks to the `activeTab` model, the extension can't read any site until you click it on a tab —
no broad "read all websites" warning.

## Use

**Commentary:**
1. Open the match page and switch to its **Commentary** tab.
2. Click the TickerSnap icon → **Extract commentary**.
3. If the site lists oldest entries first, untick "newest first" before extracting.
4. **Copy** or **Download .txt**.

**Article / Story / Book / PDF / Google Docs:**
1. Open any news article, blog, story, e-library, Google Doc, or web PDF viewer (e.g. PDF.js, Google Drive PDF viewer).
2. *(For PDFs / Paginated Readers)* Scroll to the page you want — TickerSnap automatically extracts text from the currently focused/visible page.
3. *(Optional)* Select text on the page first if you only want a specific highlighted passage.
4. Click the TickerSnap icon → **Extract article text**.
5. *(Optional)* Tick "include Title & Source header" if you want the header metadata included.
6. **Copy** or **Download .txt**.

**Preview and persistence:**

- After either extraction the text appears in a scrollable preview below the buttons, with a word
  and character count. **Hide** / **Show** collapses it, and that choice sticks.
- Closing the popup doesn't lose the capture: reopen it and the last result is restored, still
  ready to copy or download. It's cleared when the browser restarts.
- "include Title & Source header", "newest first" and the Advanced selector are saved too, so a
  site that needs a custom selector only needs it typed once. These settings ride along with
  Chrome profile sync; the captured text itself never leaves the machine.
- A failed extraction leaves the previous capture in place rather than wiping it.

Article-mode limits: text behind a **paywall or login won't be extracted** (and the tool won't try
to bypass it), and native Chrome internal plugin pages (`chrome-extension://` PDFium) restrict script injection by browser policy. For web PDF readers, Google Docs, and news sites, extraction is supported out of the box.

## A note on usage rights

FotMob and Sofascore both prohibit scraping in their Terms of Use, and commentary — like news
articles — is copyrighted editorial text. Treat all output as **personal research / reference** —
don't republish it verbatim or use it commercially. Write your own scripts from it.

Article extraction is powered by [Mozilla Readability](https://github.com/mozilla/readability)
(Apache License 2.0); the license header is preserved in `Readability.js`.
