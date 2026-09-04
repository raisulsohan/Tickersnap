// ===========================================================================
// TickerSnap
//   Mode 1: football commentary from FotMob / Sofascore (prose-cluster method)
//   Mode 2: article text from any news page (Mozilla Readability.js, bundled)
// ===========================================================================

// ---------------------------------------------------------------------------
// Injected: commentary extraction. Fully self-contained.
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

    const freq = new Map();
    for (const it of items) if (it.parent) freq.set(it.parent, (freq.get(it.parent) || 0) + 1);
    let list = null, best = 0;
    for (const [p, c] of freq) if (c > best) { best = c; list = p; }

    for (const it of items) {
      const minute = detectMinute(it.card);
      const type = detectType(it.card);
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
// Injected: article extraction. Universal content heuristic + Readability fallback.
// ---------------------------------------------------------------------------
async function extractArticleFromPage(opts) {
  try {
    const customSelector = (opts && opts.customSelector) || "";
    const cleanSpaces = (s) =>
      (s || "")
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    function stripBbcode(str) {
      if (!str) return "";
      str = str.replace(/\[img\b[^\]]*\][\s\S]*?\[\/img\]/gi, "");
      str = str.replace(/\[\/?[a-z*]+(?:=[^\]]*)?\]/gi, "");
      return str;
    }

    // 1. Google Docs Specialized Native Extractor (Canvas-safe)
    if (location.hostname.includes("docs.google.com")) {
      const docTitle = cleanSpaces(
        document.querySelector("input.docs-title-input")?.value ||
        document.querySelector(".docs-title-input")?.innerText ||
        document.title.replace(/\s*-\s*Google Docs\s*$/i, "").trim() ||
        "Google Doc"
      );

      // Method A: In-memory Model Chunks from page scripts (Instant & bypasses Canvas/CORS)
      try {
        const textPieces = [];
        const scripts = document.querySelectorAll("script");
        for (const s of scripts) {
          const code = s.textContent || "";
          if (code.includes("DOCS_modelChunk") || code.includes('"ty":"is"')) {
            // Attempt 1: Parse DOCS_modelChunk array
            const pos = code.indexOf("DOCS_modelChunk = ");
            if (pos !== -1) {
              const start = pos + "DOCS_modelChunk = ".length;
              const end = code.indexOf(";", start);
              if (end !== -1) {
                const jsonStr = code.slice(start, end).trim();
                try {
                  const arr = JSON.parse(jsonStr);
                  if (Array.isArray(arr)) {
                    for (const item of arr) {
                      if (item && item.ty === "is" && typeof item.s === "string") {
                        textPieces.push(item.s);
                      }
                    }
                  }
                } catch (e) {}
              }
            }

            // Attempt 2: Regex search for all insert-string ("ty":"is") chunks
            if (textPieces.length === 0) {
              const isRegex = /\{[^{}]*?"ty"\s*:\s*"is"[^{}]*?\}/g;
              let m;
              while ((m = isRegex.exec(code)) !== null) {
                const sMatch = m[0].match(/"s"\s*:\s*("(?:[^"\\]|\\.)*")/);
                if (sMatch) {
                  try {
                    const textVal = JSON.parse(sMatch[1]);
                    if (textVal && typeof textVal === "string") {
                      textPieces.push(textVal);
                    }
                  } catch (e) {}
                }
              }
            }
          }
        }

        if (textPieces.length > 0) {
          let fullDoc = textPieces.join("");
          fullDoc = fullDoc
            .replace(/[\u000b\u000c]/g, "\n") // Replace soft line/page breaks
            .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
            .replace(/\r\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

          if (fullDoc.length > 10) {
            return {
              title: docTitle,
              byline: "Google Docs",
              site: "docs.google.com",
              text: fullDoc,
            };
          }
        }
      } catch (err) {
        console.warn("DOCS_modelChunk extraction error:", err);
      }

      // Method B: Direct Google Docs plain text export
      const docIdMatch = location.pathname.match(
        /\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_\-\.]+)/
      );
      if (docIdMatch && docIdMatch[1] && docIdMatch[1] !== "e") {
        const docId = docIdMatch[1];
        try {
          const exportUrl = `${location.origin}/document/d/${docId}/export?format=txt`;
          const res = await fetch(exportUrl, { credentials: "include" });
          if (res.ok) {
            const rawTxt = await res.text();
            const cleanTxt = (rawTxt || "")
              .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
              .replace(/\r\n/g, "\n")
              .replace(/\n{3,}/g, "\n\n")
              .trim();

            if (cleanTxt.length > 0) {
              return {
                title: docTitle,
                byline: "Google Docs",
                site: "docs.google.com",
                text: cleanTxt,
              };
            }
          }
        } catch (err) {
          console.warn("Docs export fetch error:", err);
        }
      }

      // Method C: Published / Preview Web Doc (#contents / .doc-content)
      const pubContent = document.querySelector("#contents, .doc-content");
      if (pubContent && pubContent.innerText.trim().length > 30) {
        const paras = Array.from(
          pubContent.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li")
        )
          .map((p) => cleanSpaces(p.innerText || p.textContent || ""))
          .filter(Boolean);
        if (paras.length > 0) {
          return {
            title: docTitle,
            byline: "Google Docs",
            site: "docs.google.com",
            text: paras.join("\n\n"),
          };
        }
      }

      // Method D: DOM / SVG / Canvas accessibility elements
      const kixNodes = document.querySelectorAll(
        ".kix-paragraphrenderer, .kix-lineview-text-block, svg text, .kix-canvas-tile-content"
      );
      if (kixNodes.length > 0) {
        const lines = [];
        kixNodes.forEach((node) => {
          const t = cleanSpaces(node.innerText || node.textContent || "");
          if (t && t.length > 1) lines.push(t);
        });
        if (lines.length > 0) {
          return {
            title: docTitle,
            byline: "Google Docs",
            site: "docs.google.com",
            text: lines.join("\n\n"),
          };
        }
      }

      // Method E: Highlighted selection in Docs
      const docSelection = window.getSelection();
      if (docSelection && docSelection.toString().trim().length > 10) {
        return {
          title: docTitle,
          byline: "Google Docs",
          site: "docs.google.com",
          text: cleanSpaces(docSelection.toString().trim()),
          isSelection: true,
        };
      }

      return {
        error:
          "Could not read this Google Doc automatically (Canvas mode active). Please select the text (Ctrl+A) and try again.",
      };
    }

    // 2. Priority: User explicitly highlighted / selected text on other sites
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 30) {
      const selectedText = selection.toString().trim();
      const cleaned = stripBbcode(cleanSpaces(selectedText))
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
      return {
        title: cleanSpaces(
          document.querySelector("h1")?.innerText || document.title || "Selected Text"
        ),
        byline: "",
        site: location.hostname,
        text: cleaned,
        isSelection: true,
      };
    }

    // 3. Focused PDF / Paginated Viewer Page Extractor (e.g. PDF.js, Google Drive PDF, Web Readers)
    function getFocusedPaginatedPage() {
      const pageSelectors = [
        ".pdfViewer .page",
        ".page[data-page-number]",
        "[data-page-number]",
        ".pdf-page",
        ".page-container",
        ".document-page",
      ];
      const foundPages = document.querySelectorAll(pageSelectors.join(","));
      if (foundPages.length === 0) return null;

      let bestPage = null;
      let maxVisibleArea = 0;
      const vTop = 0;
      const vBottom = window.innerHeight;

      for (const p of foundPages) {
        const rect = p.getBoundingClientRect();
        const top = Math.max(rect.top, vTop);
        const bottom = Math.min(rect.bottom, vBottom);
        const visibleHeight = Math.max(0, bottom - top);
        const area = visibleHeight * Math.min(rect.width, window.innerWidth);

        if (area > maxVisibleArea) {
          maxVisibleArea = area;
          bestPage = p;
        }
      }

      if (bestPage && maxVisibleArea > 150) {
        const pageNum =
          bestPage.getAttribute("data-page-number") ||
          bestPage.querySelector("[data-page-number]")?.getAttribute("data-page-number") ||
          "";
        return { el: bestPage, pageNum };
      }
      return null;
    }

    const focusedPage = !customSelector ? getFocusedPaginatedPage() : null;
    if (focusedPage) {
      const textLayer = focusedPage.el.querySelector(".textLayer") || focusedPage.el;
      const spans = textLayer.querySelectorAll("span, p, div");
      let pageText = "";

      if (spans.length > 0) {
        const lines = [];
        let currentLine = "";
        let lastTop = null;

        spans.forEach((span) => {
          const t = cleanSpaces(span.textContent || "");
          if (!t) return;
          const rect = span.getBoundingClientRect();
          if (lastTop === null || Math.abs(rect.top - lastTop) < 6) {
            currentLine += (currentLine ? " " : "") + t;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = t;
          }
          lastTop = rect.top;
        });
        if (currentLine) lines.push(currentLine);
        pageText = lines.join("\n").trim();
      }

      if (!pageText) {
        pageText = cleanSpaces(
          focusedPage.el.innerText || focusedPage.el.textContent || ""
        );
      }

      if (pageText && pageText.length > 20) {
        const pageLabel = focusedPage.pageNum ? `Page ${focusedPage.pageNum}` : "Focused Page";
        return {
          title: cleanSpaces(document.title || "PDF Document"),
          byline: pageLabel,
          site: location.hostname,
          text: pageText,
          isPdfPage: true,
          pageNum: focusedPage.pageNum,
        };
      }
    }

    // Helper: Is an element visible on screen?
    function isElementVisible(el) {
      if (!el || !(el instanceof HTMLElement)) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 20 || rect.height <= 20) return false;
      const style = window.getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      ) {
        return false;
      }
      return true;
    }

    // Helper: Is element an active modal, popup, or overlay?
    //
    // Deliberately narrow: it must *look* like a dialog. CSS position is not
    // evidence of one — sticky headers, sticky sidebars and absolutely
    // positioned cards are ordinary furniture on news sites, and treating them
    // as modals hands the score bonus below to half the page.
    function isModalOrOverlay(el) {
      if (!el || el === document.body || el === document.documentElement) return false;
      let cur = el;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        if (
          cur.tagName === "DIALOG" ||
          cur.getAttribute("role") === "dialog" ||
          cur.getAttribute("aria-modal") === "true"
        ) {
          return true;
        }
        const cls = (cur.className || "").toString().toLowerCase();
        if (
          cls.match(
            /\b(modal|popup|overlay|dialog|lightbox|drawer|quickview|mfp-|fancybox|featherlight|swal|offcanvas|flyout|reader)\b/i
          )
        ) {
          if (isElementVisible(cur)) return true;
        }
        cur = cur.parentElement;
      }
      return false;
    }

    // Universal noise & clutter selectors
    const UNWANTED_SELECTORS = [
      "figure", "figcaption", "aside", "nav", "header", "footer",
      "button", "input", "select", "textarea", ".close", ".modal-close", ".popup-close", ".btn-close",
      "[aria-label='Close' i]", "[aria-label='বন্ধ করুন' i]",
      ".breadcrumb", ".breadcrumbs", ".entry-crumbs", ".learndash-breadcrumbs", "[class*='breadcrumb' i]",
      ".badge", ".status-badge", ".in-progress", "[class*='progress' i]",
      ".pagination", ".nav-links", ".post-navigation", ".chapter-nav", ".prev-next", "[class*='pagination' i]",
      ".entry-meta", ".post-meta", ".article-meta", ".lesson-meta", ".byline",
      ".share-buttons", ".social-share", ".sharedaddy", ".addtoany", ".heateor_sss_sharing_container",
      ".post-ratings", ".rating", ".comment", ".comments", "#comments", ".comments-area",
      ".author-bio", ".author-box", ".related-posts", ".yarpp-related-posts", ".widget",
      "[class*='pullquote' i]", "[class*='pull-quote' i]", "[class*='callout' i]",
      "[class*='caption' i]", "[class*='credit' i]", "[class*='promo' i]",
      "[class*='advert' i]", "[class*='ad-' i]", "[id*='advert' i]",
      "[data-component*='quote' i]", "[data-component*='pull' i]",
      "[data-testid*='caption' i]", "[data-testid*='credit' i]"
    ].join(",");

    function purgeUnwanted(root) {
      if (!root) return;

      // A <div> whose only child is a <script> reads as a leaf block later on,
      // and its textContent is the script source — that's where stray
      // `googletag.cmd.push(...)` lines come from. Drop these unconditionally:
      // the length guard below would let a long ad script through.
      root
        .querySelectorAll("script,style,noscript,template,iframe,object,embed,svg,canvas")
        .forEach((el) => el.remove());

      root.querySelectorAll(UNWANTED_SELECTORS).forEach((el) => {
        const textLen = (el.textContent || "").trim().length;
        if (
          textLen < 600 ||
          ["FIGURE", "FIGCAPTION", "ASIDE", "NAV", "HEADER", "FOOTER", "BUTTON"].includes(el.tagName)
        ) {
          el.remove();
        }
      });
    }

    // Helper: Score a candidate element by its actual prose content (reject card grids!)
    function scoreContainer(el) {
      if (!el || !isElementVisible(el)) return -1;
      const blocks = Array.from(
        el.querySelectorAll("p, blockquote, div, span, li, pre, section, article")
      ).filter((node) => {
        if (node.children.length > 2) return false; // Leaf or near-leaf node only
        const t = (node.textContent || "").trim();
        return t.length >= 30 && !node.closest(UNWANTED_SELECTORS);
      });

      const headings = el.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const totalProseChars = blocks.reduce(
        (sum, p) => sum + (p.textContent || "").trim().length,
        0
      );

      if (blocks.length === 0 || totalProseChars < 80) return -1;

      // Heavy penalty for card grids (lots of headings, few paragraphs)
      if (headings.length > blocks.length && blocks.length < 3) return -1;

      let score = totalProseChars + blocks.length * 80;

      // A genuine popup should outrank the page behind it — but only once it
      // holds an article's worth of prose, so a stray widget sitting inside an
      // overlay can never outscore the story itself.
      if (totalProseChars >= 200 && isModalOrOverlay(el)) {
        score += 100000;
      }

      return score;
    }

    // 2. Identify Target Container
    let targetRoot = null;
    let isModalDetected = false;

    if (customSelector) {
      try { targetRoot = document.querySelector(customSelector); } catch (e) {}
    }

    if (!targetRoot) {
      const CANDIDATE_SELECTORS = [
        "dialog[open]", "[role='dialog']", "[role='document']", "[aria-modal='true']",
        ".modal.show", ".modal.active", ".modal.open", ".popup.show", ".popup.active",
        ".elementor-popup-modal", ".mfp-content", ".fancybox-content",
        "article", ".entry-content", ".post-content", ".post_content", ".article-content",
        ".story-content", ".lesson-content", ".chapter-content", ".text-content",
        ".reading-content", ".article-body", ".story-body", "#story-text",
        "[class*='modal' i]", "[class*='popup' i]", "[class*='overlay' i]",
        "main", ".content-area", "section", "div"
      ];

      const scoredCandidates = [];
      const seen = new Set();

      for (const sel of CANDIDATE_SELECTORS) {
        try {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            if (seen.has(el)) continue;
            seen.add(el);
            const score = scoreContainer(el);
            if (score > 0) {
              scoredCandidates.push({ el, score, isModal: isModalOrOverlay(el) });
            }
          }
        } catch (e) {}
      }

      if (scoredCandidates.length > 0) {
        scoredCandidates.sort((a, b) => b.score - a.score);
        targetRoot = scoredCandidates[0].el;
        isModalDetected = scoredCandidates[0].isModal;
      }
    }

    // 3. Work out the title / byline / site for the header line.
    let extractedTitle = "";
    let extractedByline = "";
    let extractedSite = location.hostname;

    if (targetRoot) {
      const modalTitleEl = targetRoot.querySelector(
        "h1, h2, .entry-title, .modal-title, .title, [class*='title']"
      );
      if (modalTitleEl && modalTitleEl.innerText.trim().length > 3) {
        extractedTitle = modalTitleEl.innerText.trim();
      }
    }

    if (!extractedTitle) {
      extractedTitle = document.querySelector("h1")?.innerText || document.title || "Article";
    }

    const NOISE_PREFIX_RE =
      /^(?:photo|image|credit|courtesy|caption|source|file photo|getty images|afp|reuters|ap|epa|shutterstock|uncredited|ছবি:|সৌজন্যে:|সূত্র:|বিজ্ঞাপন:)\b/i;
    const PROMO_PREFIX_RE =
      /^(?:read more|also read|see also|related articles?|related stories|more on this|recommended|follow us|subscribe|sign up|join our|share this|advertisement|sponsored|click here|listen to this|watch:|story continues below|পূর্ববর্তী|পরবর্তী|আগের অধ্যায়|পরের অধ্যায়|সূচিপত্র|আরও পড়ুন:|সম্পর্কিত খবর:)\b/i;
    const TIME_META_RE =
      /^(?:published|updated|last modified|written by|author:)\s*[:\-–—]?/i;
    const SEPARATOR_RE = /^[\s\-_•*#~=|–—]+$/;

    function isNoiseLine(text, el) {
      const t = text.trim();
      if (!t || SEPARATOR_RE.test(t)) return true;

      // Close buttons / dismissed symbols
      if (/^(?:close|dismiss|back|exit|বন্ধ করুন|×|✕|✖)$/i.test(t)) return true;

      // Single-link promotional/navigation paragraphs
      if (
        el &&
        el.tagName === "P" &&
        el.firstElementChild &&
        el.firstElementChild.tagName === "A" &&
        el.children.length === 1
      ) {
        if (PROMO_PREFIX_RE.test(t) || t.length < 60) return true;
      }

      if (
        NOISE_PREFIX_RE.test(t) ||
        PROMO_PREFIX_RE.test(t) ||
        TIME_META_RE.test(t)
      ) {
        if (t.length < 160) return true;
      }

      // Very short standalone breadcrumb/status badge leftovers
      if (t.length < 35 && !/[.!?।]$/.test(t)) {
        if (
          NOISE_PREFIX_RE.test(t) ||
          PROMO_PREFIX_RE.test(t) ||
          /^(in progress|completed|not started|by\s+[a-z\s]+|\d{1,2}\s+[a-z]{3,}\s+\d{4})$/i.test(t)
        ) {
          return true;
        }
      }

      return false;
    }

    // 4. Turn one already-cleaned container into text: prose blocks and
    //    genuine subheadings, pull-quotes de-duplicated. Returns "" if the
    //    container holds nothing readable, so the caller can try another one.
    const SEL = "p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,div";

    function textFromNode(tmp) {
    const rawBlocks = [];

    for (const b of tmp.querySelectorAll(SEL)) {
      if (b.tagName === "DIV" && b.querySelector("p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,div")) {
        continue; // Skip non-leaf wrapper divs
      }
      if (b.tagName !== "DIV" && b.querySelector(SEL)) continue; // keep leaf blocks only
      if (b.closest("figure,figcaption,aside,nav,header,footer,button")) continue;

      let t = cleanSpaces(b.textContent || "");
      t = stripBbcode(t);
      t = cleanSpaces(t);

      if (!t || t.length < 15) continue;
      if (isNoiseLine(t, b)) continue;

      // Filter out standalone card link headings (e.g. <h3><a href="...">Title</a></h3>)
      const isHeading = /^H[1-6]$/.test(b.tagName);
      if (isHeading) {
        const link = b.querySelector("a");
        if (link && link.textContent.trim() === t) {
          continue;
        }
        if (extractedTitle && t.toLowerCase() === extractedTitle.toLowerCase()) {
          continue;
        }
      }

      const isBlockquote =
        b.tagName === "BLOCKQUOTE" || Boolean(b.closest("blockquote"));
      rawBlocks.push({ text: t, isBlockquote, el: b });
    }

    if (rawBlocks.length === 0) return "";

    // Deduplicate pull-quotes & redundant sentences
    const longParagraphs = rawBlocks
      .filter((b) => !b.isBlockquote && b.text.length > 50)
      .map((b) => b.text.toLowerCase());

    const finalParts = [];
    for (const block of rawBlocks) {
      const lower = block.text.toLowerCase();

      // If it's a pullquote and its text is inside a regular paragraph, skip it
      if (block.isBlockquote || block.text.length < 120) {
        const isDuplicate = longParagraphs.some(
          (p) => p !== lower && p.includes(lower)
        );
        if (isDuplicate) continue;
      }

      // Skip exact consecutive duplicate lines
      if (
        finalParts.length > 0 &&
        finalParts[finalParts.length - 1] === block.text
      ) {
        continue;
      }

      finalParts.push(block.text);
    }

    let out = finalParts.join("\n\n").trim();
    if (!out) {
      out = stripBbcode(cleanSpaces(tmp.textContent || ""))
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    return out;
    }

    // Clone-and-clean helper, so no candidate is ever read off the live page.
    function readContainer(node) {
      if (!node) return "";
      const clone = node.cloneNode(true);
      purgeUnwanted(clone);
      return textFromNode(clone);
    }

    // 5. Choose between the scored container and Readability.
    //
    // scoreContainer sums prose length, so a parent always outscores its own
    // child and the winner drifts outward until it hits a page-wide wrapper.
    // That is what you want for lifting a dialog out of a page, and poor at
    // isolating an article — a whole-page wrapper drags in the cookie banner
    // and the related-story rail. So a detected popup keeps its container,
    // since Readability can't see into one, and every ordinary page prefers
    // Readability, falling back to the container when it returns nothing
    // usable. Readability used to be reachable only when *no* container was
    // found at all, which, with "div" ending the candidate list, was never.
    const SUBSTANTIAL = 600;
    let text = readContainer(targetRoot);

    if (!isModalDetected && typeof Readability === "function") {
      try {
        const fullClone = document.cloneNode(true);
        purgeUnwanted(fullClone);
        const parsed = new Readability(fullClone, { keepClasses: false }).parse();
        if (parsed && parsed.content) {
          const holder = document.createElement("div");
          holder.innerHTML = parsed.content;
          purgeUnwanted(holder);
          const rText = textFromNode(holder);
          if (rText.length >= SUBSTANTIAL || rText.length > text.length) {
            text = rText;
            if (parsed.title) extractedTitle = parsed.title;
            if (parsed.byline) extractedByline = parsed.byline;
            if (parsed.siteName) extractedSite = parsed.siteName;
          }
        }
      } catch (e) {}
    }

    if (text.length < 50 && document.body) {
      text = readContainer(document.body);
    }

    if (text.length < 50) return { error: "NO_ARTICLE" };

    return {
      title: cleanSpaces(stripBbcode(extractedTitle)),
      byline: cleanSpaces(stripBbcode(extractedByline)),
      site: cleanSpaces(extractedSite),
      text,
      isModal: isModalDetected,
    };
  } catch (e) {
    return { error: e && e.message ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Popup side.
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
let extractedText = "";
let extractedFilename = "commentary.txt";
let previewMeta = "";

// Checkbox / selector state, remembered across popup opens.
const PREF_DEFAULTS = {
  includeHeader: false,
  newestFirst: true,
  selector: "",
  previewOpen: true,
};
let prefs = Object.assign({}, PREF_DEFAULTS);

// The last capture, kept for the browser session so that closing the popup by
// accident doesn't throw away a long scroll-and-harvest.
const SESSION_KEY = "lastExtraction";
const PREVIEW_CHARS = 20000;

function setStatus(msg, cls) {
  const el = $("status");
  el.textContent = msg;
  el.className = cls || "";
}

function setError(msg) {
  setStatus(
    extractedText ? msg + " (Previous capture is still below.)" : msg,
    "err"
  );
}

function setBusy(busy) {
  $("extract").disabled = busy;
  $("extractArticle").disabled = busy;
  const enabled = !busy && Boolean(extractedText);
  $("copy").disabled = !enabled;
  $("download").disabled = !enabled;
}

function sanitizeFilename(name) {
  return (
    (name || "text")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "text"
  );
}

function lineFor(e) {
  const label = e.minute ? e.minute : (e.type || "•");
  const tag =
    e.type && e.minute && e.type.toLowerCase() !== "summary" ? `[${e.type}] ` : "";
  return `${label}  ${tag}${e.body}`.trim();
}

// ---- Preferences -----------------------------------------------------------

async function loadPrefs() {
  try {
    const got = await chrome.storage.sync.get(PREF_DEFAULTS);
    prefs = Object.assign({}, PREF_DEFAULTS, got);
  } catch (e) {
    prefs = Object.assign({}, PREF_DEFAULTS);
  }
  $("includeHeader").checked = Boolean(prefs.includeHeader);
  $("newestFirst").checked = Boolean(prefs.newestFirst);
  $("selector").value = prefs.selector || "";
  // A saved selector is easy to forget about, so open the panel that holds it.
  if (prefs.selector) {
    const d = $("selector").closest("details");
    if (d) d.open = true;
  }
}

function savePrefs() {
  prefs = {
    includeHeader: $("includeHeader").checked,
    newestFirst: $("newestFirst").checked,
    selector: $("selector").value.trim(),
    previewOpen: prefs.previewOpen,
  };
  try {
    const p = chrome.storage.sync.set(prefs);
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

let prefTimer = null;
function savePrefsSoon() {
  clearTimeout(prefTimer);
  prefTimer = setTimeout(savePrefs, 400); // sync storage rate-limits writes
}

// ---- Preview ---------------------------------------------------------------

function metaFor(text, lead) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return [
    lead,
    words.toLocaleString() + " words",
    text.length.toLocaleString() + " chars",
  ].filter(Boolean).join(" · ");
}

function renderPreview() {
  const wrap = $("previewWrap");
  if (!extractedText) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  $("pvmeta").textContent = previewMeta;
  $("pvtoggle").textContent = prefs.previewOpen ? "Hide" : "Show";
  $("preview").hidden = !prefs.previewOpen;
  if (!prefs.previewOpen) return;

  const shown = extractedText.slice(0, PREVIEW_CHARS);
  $("preview").textContent =
    extractedText.length > PREVIEW_CHARS
      ? shown + "\n\n… preview truncated — Copy / Download gives the full text."
      : shown;
}

// ---- Session-persisted result ----------------------------------------------

async function saveSession(summary) {
  if (!chrome.storage || !chrome.storage.session) return;
  try {
    await chrome.storage.session.set({
      [SESSION_KEY]: {
        text: extractedText,
        filename: extractedFilename,
        meta: previewMeta,
        summary: summary || "",
      },
    });
  } catch (e) {
    // Over quota on a very large capture: drop the key rather than leave a
    // half-written one that would restore as something else next time.
    try {
      const r = chrome.storage.session.remove(SESSION_KEY);
      if (r && r.catch) r.catch(() => {});
    } catch (e2) {}
  }
}

async function restoreSession() {
  if (!chrome.storage || !chrome.storage.session) return;
  let saved;
  try {
    const got = await chrome.storage.session.get(SESSION_KEY);
    saved = got && got[SESSION_KEY];
  } catch (e) {
    return;
  }
  if (!saved || !saved.text) return;

  extractedText = saved.text;
  extractedFilename = saved.filename || "text.txt";
  previewMeta = saved.meta || "";
  renderPreview();
  $("copy").disabled = false;
  $("download").disabled = false;
  setStatus(
    saved.summary ? "Restored — " + saved.summary + "." : "Restored last capture.",
    ""
  );
}

function setResult(text, filename, meta, summary) {
  extractedText = text;
  extractedFilename = filename;
  previewMeta = meta;
  renderPreview();
  $("copy").disabled = false;
  $("download").disabled = false;
  setStatus("Done — " + summary + ".", "ok");
  saveSession(summary);
}

// ---- Actions ---------------------------------------------------------------

async function getActiveHttpTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) { setError("No active tab found."); return null; }
  if (!/^https?:\/\//.test(tab.url || "") && !/^file:\/\//.test(tab.url || "")) {
    setError("This tab can't be read (browser internal pages are off-limits). Open a web page and retry.");
    return null;
  }
  return tab;
}

$("extract").addEventListener("click", async () => {
  setStatus("Extracting… (auto-scrolling the commentary)", "");
  setBusy(true);
  try {
    const tab = await getActiveHttpTab();
    if (!tab) return;

    const customSelector = $("selector").value.trim();
    const reverse = $("newestFirst").checked;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractCommentary,
      args: [{ customSelector, reverse }],
    });

    const data = results && results[0] && results[0].result;
    if (!data) {
      setError("Couldn't read the page. Reload it and retry.");
    } else if (data.error === "NO_CONTAINER") {
      setError("No commentary text detected. Open the Commentary tab and retry.");
    } else if (!data.count) {
      setError("No commentary entries found. Reload the page and retry.");
    } else {
      const title = data.title || "Match";
      const head = title + "\n" + "=".repeat(Math.min(title.length, 60));
      const text = head + "\n\n" + data.entries.map(lineFor).join("\n") + "\n";
      setResult(
        text,
        sanitizeFilename(title) + " - commentary.txt",
        metaFor(text, data.count.toLocaleString() + " entries"),
        `${data.count} entries captured`
      );
    }
  } catch (e) {
    setError("Error: " + (e && e.message ? e.message : String(e)));
  } finally {
    setBusy(false);
  }
});

$("extractArticle").addEventListener("click", async () => {
  setStatus("Extracting article…", "");
  setBusy(true);
  try {
    const tab = await getActiveHttpTab();
    if (!tab) return;

    // 1) Load the bundled Readability library into the page's isolated world.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["Readability.js"],
    });

    const customSelector = $("selector").value.trim();

    // 2) Run the extractor (same world, so it sees the Readability global).
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractArticleFromPage,
      args: [{ customSelector }],
    });

    const data = results && results[0] && results[0].result;
    if (!data) {
      setError("Couldn't read the page. Reload it and retry.");
    } else if (data.error === "NO_ARTICLE") {
      setError("Couldn't find an article body here. If it's behind a paywall/login, the hidden text can't be extracted.");
    } else if (data.error) {
      setError("Error: " + data.error);
    } else {
      const title = data.title || "Article";
      const includeHeader = $("includeHeader") && $("includeHeader").checked;

      let text;
      if (includeHeader) {
        const metaBits = [data.site, data.byline].filter(Boolean).join(" — ");
        const head =
          title +
          "\n" +
          "=".repeat(Math.min(title.length, 60)) +
          (metaBits ? "\n" + metaBits : "");
        text = head + "\n\n" + data.text + "\n";
      } else {
        // Pure clean article/story text only
        text = data.text + "\n";
      }

      // Count what actually gets copied, header included, so the status line
      // and the preview meta line never disagree.
      const words = text.split(/\s+/).filter(Boolean).length;
      let source = "";
      if (data.isSelection) source = "from selection";
      else if (data.isPdfPage) source = data.byline || "from focused page";
      else if (data.isModal) source = "from open popup";

      setResult(
        text,
        sanitizeFilename(title) + ".txt",
        metaFor(text, source),
        `article captured (~${words} words)` + (source ? ` (${source})` : "")
      );
    }
  } catch (e) {
    setError("Error: " + (e && e.message ? e.message : String(e)));
  } finally {
    setBusy(false);
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
  a.download = extractedFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  setStatus("Downloaded.", "ok");
});

$("pvtoggle").addEventListener("click", () => {
  prefs.previewOpen = !prefs.previewOpen;
  renderPreview();
  savePrefs();
});

$("includeHeader").addEventListener("change", savePrefs);
$("newestFirst").addEventListener("change", savePrefs);
$("selector").addEventListener("input", savePrefsSoon);
$("selector").addEventListener("change", savePrefs);

(async function init() {
  await loadPrefs();
  renderPreview();
  await restoreSession();
})();
