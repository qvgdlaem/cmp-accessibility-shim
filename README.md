# CMP A11Y Shim (Shadow-DOM friendly)

Shadow-DOM friendly accessibility shim for CMP modals (built for Cloudflare Zaraz using the IAB TCF compliant modal, adaptable to any injected CMP that is hosted first-party)

A tiny, vendor-agnostic JavaScript shim that improves **accessibility** of cookie/consent modals (CMPs) injected into Shadow DOM (even `mode:"closed"`). No edits to vendor code. Adds programmatic names/descriptions to checkboxes, better focus behavior, and a **brand-color “canary”** so you can visually confirm the shim attached.

- ✅ Works with **open or closed** shadow roots (hooks `attachShadow`)
- ✅ No network calls; runs locally, once per tab/session
- ✅ Skips itself after consent is stored
- ✅ CSP-friendly (uses `adoptedStyleSheets` when available; falls back to an inline `<style>` inside the shadow root)

---

## Why this exists

Many CMPs render inside a Shadow DOM subtree, which regular scripts and CSS can’t reach. That breaks simple accessibility fixes and even basic theming. This shim:

1. Hooks `Element.prototype.attachShadow` **early** to capture a reference to each shadow root.
2. Watches those roots for the CMP dialog to appear.
3. Injects minimal CSS and ARIA attributes **inside the shadow root**.
4. Leaves vendor markup untouched.

---

## Quick start

1. **Place the script**
   - Save `src/cmp-a11y-shim.js` somewhere you can include it on your pages.

2. **Include it early in `<head>`** (important: **no `defer`**)
   ```html
   <!-- Load BEFORE your CMP script so attachShadow is hooked in time -->
   <script src="/js/cmp-a11y-shim.js"></script>

If you must inline it, just paste the contents inside a `<script>` tag in `<head>`.

3. **Confirm it attached**

   * Open your site, trigger the CMP.

   * If you see the CMP title turn **bright pink** (default canary), the shim is active.

Open DevTools → Console: look for messages like:

`[CMP A11Y] attachShadow captured <div class="..."> open`  
`[CMP A11Y] ✅ A11Y applied inside shadow root`

*   
4. **Customize the canary color**

In the file, change:

 `const BRAND_CANARY_COLOR = 'hotpink';`

*  to your brand color (e.g., `'#833ab4'`).

---

## **Placement matrix**

| Stack | Where to include |
| ----- | ----- |
| Plain HTML / any framework | `<head>`, **before** CMP loads (no `defer`) |
| Next.js | Add in `_document.tsx` inside `<Head>` as a `<script src>` (no `defer`) |
| Vite / React | Add to `index.html` in `<head>` (no `defer`) |
| Cloudflare Zaraz | Prefer hosting this in **your app** rather than as a Zaraz tool (to avoid quota). If you must use Zaraz, run it **as early as possible** and ensure it executes before the CMP tool. The reality is that I'm not even sure it's possible to effectively make it work as custom HTML delivered by Zaraz because of the requirement that the script run very early on page |

The hook must run **before** the CMP creates its shadow root. If you load this too late, the CMP may already have attached and you’ll miss it (the shim still scans for existing *open* roots as a fallback).

---

## **Cloudflare / Proxied domains note**

If your site isn’t orange-cloud proxied and Zaraz injects from a special proxied subdomain (e.g., `cf-proxy.yourdomain.com`), **still include this shim directly on your pages** (not via Zaraz) so it runs early enough and doesn’t count against Zaraz’s monthly quota.

---

## **CSP (Content Security Policy)**

* The shim prefers **Constructable Stylesheets** (`adoptedStyleSheets`) inside the shadow root — usually allowed even with stricter CSP.

* If that’s not available, it falls back to appending a `<style>` tag **inside the shadow root**. If your CSP forbids inline styles, consider permitting a nonce inside the shadow root or stick with constructable stylesheets (most modern browsers support them).

---

## **What you can safely change**

* At the top of `cmp-a11y-shim.js`:

  * `BRAND_CANARY_COLOR`: make it your brand color.

  * `CONSENT_COOKIE_NAME`: if your CMP uses a different cookie than `zaraz-consent`.

  * `ACCEPT_BTN_ID` / `REJECT_BTN_ID` / `SAVE_BTN_ID`: IDs for CMP buttons (optional).

Inside the block:

 `>>> BEGIN CUSTOM CMP FIXES (TAILOR TO YOUR RENDERED MARKUP) >>>`  
   `…selectors and logic bound to your CMP’s DOM…`  
`<<< END CUSTOM CMP FIXES <<<`

*  That’s where you adjust selectors for:

  * the **checkbox inputs**

  * the visible **summary/label** text

  * where to pull a **concise description** (first `<p>`, etc.)

Everything else (the shadow-root plumbing, attachShadow hook, skipping logic) should be left as-is.

---

## **“Bring your markup \+ ask your AI” (prompt template)**

**Copy this into your AI assistant (Claude Code, Codex, Cursor etc) when adapting for your CMP:**

`I’m using the open-source “CMP A11Y Shim (Shadow-DOM friendly)” script.`   
`Here is my CMP’s rendered modal markup (from DevTools, full tree, including shadow host and its subtree):`

`[PASTE YOUR FULL RENDERED MODAL MARKUP HERE, including the shadow host,`   
 `the dialog element, labels, inputs, IDs, classes, and example list items]`

`Here is the current version of the shim file:`

`[PASTE THE FULL cmp-a11y-shim.js HERE]`

`Please modify ONLY the section between:`  
  `>>> BEGIN CUSTOM CMP FIXES (TAILOR TO YOUR RENDERED MARKUP) >>>`  
`and`  
  `<<< END CUSTOM CMP FIXES (TAILOR TO YOUR RENDERED MARKUP) <<<`

`Goals:`  
`1) For each checkbox, set a reliable programmatic name using the visible summary/label text`  
   `(e.g., input.setAttribute('aria-labelledby', summary.id)).`  
`2) Add a concise description (aria-describedby) from the first paragraph of the details block.`  
`3) Do NOT override native roles on <li> (no role="group").`  
`4) Keep the brand color canary so I can see the title change when the shim attaches.`

`Return only the updated code for that custom block (not the entire file), and explain any selector changes.`

---

## **What it fixes (WCAG hits)**

* **Accessible name** for each checkbox → announced by screen readers.

* **Accessible description** tied to each checkbox → short summary of the long details.

* **Focus management** when the modal opens → context is clear for keyboard users.

* **No ARIA role overrides** on semantic elements (no “incompatible roles” Lighthouse warning).

---

## **Troubleshooting**

* **I don’t see the canary color.**  
   Ensure the shim loads **before** the CMP code (no `defer`). Check console for `[CMP A11Y] attachShadow captured …`. If nothing, the shim loaded too late.

* **My CMP uses different classes/IDs.**  
   Update selectors inside the **custom block** only.

* **CSP errors about styles.**  
   Most modern browsers support `adoptedStyleSheets`. If your policy forbids inline styles and constructable stylesheets aren’t available, you’ll need to allow a style nonce inside the shadow root.

* **CMP renders in an iframe (cross-origin).**  
   This shim cannot pierce a cross-origin iframe. It must run **inside** the iframe’s origin or via the CMP vendor’s custom JS hook.

---

## **Contributing**

PRs welcome\! Please:

* Keep the generic plumbing minimal and vendor-agnostic.

* Confine vendor-specific changes to the **custom block**.

* Add notes if you discover reliable selectors for popular CMPs.

---

## **License**

MIT © QVGDLAEM LLC for Salaryconfidential.com
