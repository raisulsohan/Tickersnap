# Chrome Web Store Listing — TickerSnap

> Last Updated: 2026-09-04

## Store Listing

**Extension Name** [REQUIRED]
TickerSnap


**Short Description** [REQUIRED]
Extract match commentary and clean article text into readable format with one click. For personal research and offline reading.


**Detailed Description** [REQUIRED]
TickerSnap is a lightweight, one-click text extractor designed for football match commentary and distraction-free article reading. Whether you are analyzing a sports match or archiving news articles and documents for offline reference, TickerSnap extracts clean, formatted text instantly without cluttered ads or navigation sidebars.

KEY FEATURES

1. Football Match Commentary Extraction
Extract complete chronological match commentary feeds with minute stamps (e.g., 45', 90+3') and key match event markers. TickerSnap automatically navigates through live-loaded timeline feeds to capture the entire match story.

2. Clean Article and Story Extraction
Powered by the proven Mozilla Readability engine, TickerSnap extracts clean body text from news articles, blogs, online stories, and web documents. Cluttered banners, ads, and sidebars are automatically stripped away.

3. Live Preview and Instant Export
Review your captured text directly in the scrollable popup preview with real-time word and character counts. Copy to your clipboard with one click or download as an organized plain text (.txt) file.

4. Session Memory and Custom Preferences
Your extracted preview remains saved during your active browser session even if you close the popup. TickerSnap remembers your preferred sort order (newest first vs oldest first), metadata headers, and optional custom CSS selectors.


HOW TO USE

For Match Commentary:
1. Open any football match page and switch to its Commentary tab.
2. Click the TickerSnap extension icon in your toolbar.
3. Click "Extract commentary".
4. Copy the result or download as a .txt file.

For Articles and Web Documents:
1. Open any news article, blog, story, or web document.
2. Click the TickerSnap extension icon.
3. Click "Extract article text".
4. Copy or download your clean text.


PRIVACY AND PERMISSIONS
TickerSnap is 100% privacy-respecting and offline-first:
- Zero data collection: No personal information, browsing history, or keystrokes are recorded or transmitted.
- 100% local processing: Text extraction and parsing run entirely within your local browser.
- activeTab & scripting: Used strictly when you click the extension to extract text from the current page.
- storage: Used solely to save your local UI preferences.


DISCLAIMER
TickerSnap is intended for personal research, study, and offline reference. All extracted editorial content and match commentaries remain the intellectual property of their respective publishers.


**Category** [REQUIRED]
Productivity


**Single Purpose** [REQUIRED]
Extracts sports match commentary and clean article body text from the active webpage into plain text for offline reading and research.


**Primary Language** [REQUIRED]
English


## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Needs capture | Screenshot showing commentary extraction on a match page |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Needs capture | Screenshot showing clean article extraction with preview panel |
| Small Promo Tile [RECOMMENDED] | 440×280 PNG | ⬜ Optional | Promo banner with logo and tagline |
| Marquee Promo Tile | 1400×560 PNG | ⬜ Optional | Marquee showcase banner |

### Screenshot Notes
- Screenshot 1: Open a match commentary tab on a football site (e.g. FotMob or Sofascore), open TickerSnap, extract commentary, and show the preview panel with word count and copy/download buttons.
- Screenshot 2: Open a news article or blog post, open TickerSnap, extract article text, and highlight the distraction-free extracted output.


## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `activeTab` | permissions | Required to access the active tab only when the user deliberately opens the popup to trigger text extraction. It does not monitor background browsing. |
| `scripting` | permissions | Required to inject the local commentary extractor function and the bundled Readability.js library into the active webpage upon clicking the extract button. |
| `storage` | permissions | Required to store user preferences (sort order, custom selector, preview visibility) and keep the extracted text available across popup reopens during the active session. |


## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

All processing is performed client-side. No user data, website content, or browsing history is transmitted off the device.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes


## Privacy Policy

**Privacy Policy URL** [REQUIRED]
`https://<your-username>.github.io/Tickersnap/PRIVACY` or public link to `PRIVACY.md`


## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free


## Developer Info

**Publisher Name** [REQUIRED]
[Your Name / Organization]

**Contact Email** [REQUIRED]
[Your Email Address]

**Support URL / Email** [RECOMMENDED]
https://github.com/raisulsohan/Tickersnap/issues


## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.2 | 2026-09-04 | Initial Chrome Web Store release preparation with commentary and article extraction | Draft |


## Review Notes

### Known Issues / Limitations
- Content behind hard paywalls or private login portals cannot and will not be bypassed.
- Chrome internal pages (e.g. `chrome://` URLs) cannot be scripted per browser security policy.
