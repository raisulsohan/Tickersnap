// ---------------------------------------------------------------------------
// TickerSnap — injected into the active page. Fully self-contained.
//
// 1. Find every real sentence block (prose) on the page.
// 2. Resolve each to its card, group cards by their parent.
// 3. The parent shared by the MOST cards is the commentary list -> keep ALL
//    of its cards (with or without a visible minute / event label).
// 4. Minute stamps: 45'  90+3'  (apostrophe-tolerant). Stampless cards
//    (summaries, notes) are kept with a "•" label.
// ---------------------------------------------------------------------------
async function extractCommentary(opts) {
  const customSelector = (opts && opts.customSelector) || "";
  const reverse = !(opts && opts.reverse === false);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const INVIS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
  const APOS = "['’‘`´′]";
  const MIN_RE = new RegExp("\\b\\d{1,3}(?:\\+\\d{1,2})?" + APOS); // 45'  90+3'
  const NUM_RE = /^[\d.,]+%?$/;

  const EVENT_TYPES = [
    "Goal!", "Goal", "Own goal", "Penalty goal", "Penalty missed", "Penalty saved",
    "Assist", "Yellow card", "Second yellow card", "Red card", "Substitution",
    "Substitute", "Highlight", "Summary", "VAR", "VAR Decision", "Var Decision",
    "Kick off", "Kick-off", "Half time", "Half-time", "Full time", "Full-time",
    "Big Chance", "Penalty", "Lineups"
  ];
  const EVENT_SET = new Set(EVENT_TYPES.map((s) => s.toLowerCase()));

  const BLOCK = new Set([
    "DIV", "P", "SECTION", "ARTICLE", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY",
    "TR", "TD", "TH", "FIGURE", "IMG", "SVG", "BUTTON", "CANVAS", "VIDEO", "INPUT",
    "HEADER", "FOOTER", "NAV", "FORM", "PICTURE"
  ]);
  const BLOCK_SELECTOR = Array.from(BLOCK).join(",");

  const clean = (s) => (s || "").replace(INVIS, "");

  function isProse(t) {
    t = clean(t).replace(/\s+/g, " ").trim();
    if (!t || t.length < 18) return false;
    if (NUM_RE.test(t)) return false;
    if (!/\s/.test(t)) return false;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length < 4) return false;
    const letters = (t.match(/[A-Za-z]/g) || []).length;
    if (letters < t.length * 0.5) return false;
    return true;
  }

  function collectProse(root) {
    const out = [];
    for (const el of (root || document).querySelectorAll("div,p,span")) {
      const tc = el.textContent || "";
      if (tc.length < 18 || tc.length > 6000) continue;
      if (el.childElementCount && el.querySelector(BLOCK_SELECTOR)) continue;
      const t = clean(el.innerText || tc).replace(/\s+/g, " ").trim();
      if (isProse(t)) out.push({ el, text: t });
    }
    return out;
  }

  function cardsInside(el) {
    let c = 0;
    for (const ch of el.children) {
      if (isProse(ch.textContent || "")) { c++; if (c > 1) return c; }
    }
    return c;
  }

  function findCard(el) {
    let card = el;
    while (
      card.parentElement &&
      card.parentElement !== document.body &&
      card.parentElement !== document.documentElement
    ) {
      if (cardsInside(card.parentElement) > 1) break;
      card = card.parentElement;
    }
    return card;
  }

  function detectMinute(card) {
    const m = clean(card.textContent || "").replace(/\s+/g, " ").trim().match(MIN_RE);
    return m ? m[0].replace(new RegExp(APOS), "'") : "";
  }

  function detectType(card) {
    const tw = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = tw.nextNode())) {
      const t = clean(n.nodeValue || "").trim();
      if (t && EVENT_SET.has(t.toLowerCase())) return t;
    }
    return "";
  }

  function harvestInto(map, order) {
    let root = document;
    if (customSelector) {
      try { const r = document.querySelector(customSelector); if (r) root = r; } catch (e) {}
    }

    const items = collectProse(root).map((p) => {
      const card = findCard(p.el);
      return { text: p.text, card, parent: card.parentElement };
    });

    // Commentary list = parent shared by the most prose cards.
    const freq = new Map();
    for (const it of items) if (it.parent) freq.set(it.parent, (freq.get(it.parent) || 0) + 1);
    let list = null, best = 0;
    for (const [p, c] of freq) if (c > best) { best = c; list = p; }

    for (const it of items) {
      const minute = detectMinute(it.card);
      const type = detectType(it.card);
      // Keep everything in the commentary list; elsewhere only minuted/labelled
      // cards. Header and sidebar prose falls away.
      if (list && it.parent !== list && !minute && !type) continue;
      const key = it.text.slice(0, 160);
      if (map.has(key)) continue;
      map.set(key, { minute, type, body: it.text });
      order.push(key);
    }
  }

  let probe = collectProse(document).length;
  for (let tries = 0; tries < 5 && probe === 0; tries++) {
    window.scrollBy(0, 500);
    await sleep(300);
    probe = collectProse(document).length;
  }
  if (probe === 0) return { error: "NO_CONTAINER" };

  const map = new Map();
  const order = [];

  window.scrollTo(0, 0);
  await sleep(250);
  harvestInto(map, order);

  let prev = map.size;
  let stable = 0;
  for (let i = 0; i < 400; i++) {
    window.scrollBy(0, window.innerHeight * 0.85);
    await sleep(280);
    harvestInto(map, order);

    if (map.size === prev) stable++;
    else { stable = 0; prev = map.size; }

    const atBottom =
      window.innerHeight + window.scrollY >= document.body.scrollHeight - 6;
    if (atBottom && stable >= 3) break;
    if (stable >= 8) break;
  }

  let entries = order.map((k) => map.get(k));
  if (reverse) entries = entries.slice().reverse();

  const title = (
    document.querySelector("h1")?.innerText || document.title || "Match"
  ).trim();

  return { title, count: entries.length, entries };
}

// ---------------------------------------------------------------------------
// Popup side.
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
let extractedText = "";
let extractedTitle = "Match";

function setStatus(msg, cls) {
  const el = $("status");
  el.textContent = msg;
  el.className = cls || "";
}

function sanitizeFilename(name) {
  return (
    (name || "commentary")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "commentary"
  );
}

function lineFor(e) {
  const label = e.minute ? e.minute : (e.type || "•");
  const tag =
    e.type && e.minute && e.type.toLowerCase() !== "summary" ? `[${e.type}] ` : "";
  return `${label}  ${tag}${e.body}`.trim();
}

$("extract").addEventListener("click", async () => {
  setStatus("Extracting… (auto-scrolling the commentary)", "");
  $("extract").disabled = true;
  $("copy").disabled = true;
  $("download").disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      setStatus("No active tab found.", "err");
      return;
    }
    if (!/^https?:\/\//.test(tab.url || "")) {
      setStatus("This tab can't be read (browser pages are off-limits). Open a match page and retry.", "err");
      return;
    }

    const customSelector = $("selector").value.trim();
    const reverse = $("newestFirst").checked;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractCommentary,
      args: [{ customSelector, reverse }],
    });

    const data = results && results[0] && results[0].result;
    if (!data) {
      setStatus("Couldn't read the page. Reload it and retry.", "err");
    } else if (data.error === "NO_CONTAINER") {
      setStatus("No commentary text detected. Open the Commentary tab and retry.", "err");
    } else if (!data.count) {
      setStatus("No commentary entries found. Reload the page and retry.", "err");
    } else {
      extractedTitle = data.title || "Match";
      const head = extractedTitle + "\n" + "=".repeat(Math.min(extractedTitle.length, 60));
      extractedText = head + "\n\n" + data.entries.map(lineFor).join("\n") + "\n";
      setStatus(`Done — ${data.count} entries captured.`, "ok");
      $("copy").disabled = false;
      $("download").disabled = false;
    }
  } catch (e) {
    setStatus("Error: " + (e && e.message ? e.message : String(e)), "err");
  } finally {
    $("extract").disabled = false;
  }
});

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(extractedText);
    setStatus("Copied to clipboard.", "ok");
  } catch (e) {
    setStatus("Copy failed: " + (e && e.message ? e.message : String(e)), "err");
  }
});

$("download").addEventListener("click", () => {
  const blob = new Blob([extractedText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeFilename(extractedTitle) + " - commentary.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  setStatus("Downloaded.", "ok");
});
