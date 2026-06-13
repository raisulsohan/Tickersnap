# TickerSnap

A Chrome (Manifest V3) extension that extracts the **full match commentary text** from a football
match page in one click — built for **FotMob** and **Sofascore**. Output can be copied or saved
as `.txt`.

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

1. Open the match page and switch to its **Commentary** tab.
2. Click the TickerSnap icon → **Extract commentary**.
3. If the site lists oldest entries first, untick "newest first" before extracting.
4. **Copy** or **Download .txt**.

## A note on usage rights

FotMob and Sofascore both prohibit scraping in their Terms of Use, and commentary is their
copyrighted editorial text. Treat the output as **personal research / reference** — don't
republish it verbatim or use it commercially. Write your own scripts from it.
