# Privacy Policy for TickerSnap

Last Updated: September 4, 2026

TickerSnap ("the extension") is committed to protecting your privacy. This Privacy Policy explains our practices regarding user information and data processing.

## 1. No Data Collection or Transmission
TickerSnap does not collect, record, track, or transmit any personal data, identifiable information, or web browsing history. All operations, text parsing, and formatting occur entirely locally on your device within your browser.

## 2. Local Storage and Preferences
The extension uses Chrome's local storage API (`chrome.storage.sync` and `chrome.storage.session`) solely to store:
- User interface preferences (e.g., sort order, preview panel visibility, header toggle).
- Optional user-defined CSS selectors.
- Temporary preview text of the most recent extraction for the current browser session.

This information never leaves your browser and is not shared with any external servers or third parties.

## 3. Permissions Used
- **`activeTab`**: Allows the extension to interact with the currently focused tab only when you deliberately open the popup. The extension cannot monitor or access background tabs or unvisited websites.
- **`scripting`**: Used strictly to inject the local extraction logic and the bundled Mozilla Readability parser into the active webpage upon clicking the extract button.
- **`storage`**: Used exclusively to remember your local settings and preferences between sessions.

## 4. Third-Party Services
TickerSnap does not integrate with any third-party analytics services, tracking scripts, advertising networks, or external APIs.

## 5. Changes to This Policy
If changes are made to this policy, the updated version will be posted at this URL with a revised "Last Updated" date.

## 6. Contact
If you have questions or feedback regarding this Privacy Policy, please contact us via the project repository or developer contact email.
