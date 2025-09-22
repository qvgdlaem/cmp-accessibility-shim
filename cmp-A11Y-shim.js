/*!
 * CMP A11Y Shim — Shadow DOM friendly
 * Purpose: Improve accessibility of CMP modals injected into (open/closed) shadow roots,
 *          without modifying vendor code.
 * License: MIT
 * Repo:    https://github.com/qvgdlaem/cmp-accessibility-shim

(function CMP_A11Y_SHIM(){
  /** ===========================
   *  CONFIG YOU MAY TWEAK
   *  =========================== */

  // Visible canary to confirm the shim attached.
  // Pick an unmistakable color; users should replace this with their brand tone.
  const BRAND_CANARY_COLOR = 'hotpink'; // <-- swap for your brand color. Canary that the shim locked into the CMP UI.

  // Console logging for debugging.
  const DEBUG = true;

  // Local flags so we don’t run on every page forever
  const SESSION_FLAG = 'sc_cmp_a11y_patched';  // per-tab
  const CONSENT_FLAG = 'sc_cmp_consented';     // persistent (our own fallback)

  // The CMP’s consent cookie. Adjust if your CMP uses a different name.
  const CONSENT_COOKIE_NAME = 'zaraz-consent';

  // IDs for action buttons *inside the CMP shadow root* (adjust to your CMP, or leave as-is if you don’t need them)
  const ACCEPT_BTN_ID = 'cf_consent-buttons__accept-all';
  const REJECT_BTN_ID = 'cf_consent-buttons__reject-all';
  const SAVE_BTN_ID   = 'cf_consent-buttons__save';

  // A unique style tag id used when we can’t use constructable stylesheets.
  const STYLE_ID = 'cmp-a11y-style';

  /** ============================================================
   *  NOTE TO ADOPTERS:
   *  The section marked  >>> BEGIN CUSTOM CMP FIXES <<<  is where
   *  you tailor the selectors to your vendor’s rendered markup.
   *  Everything outside that block is generic/safe and rarely needs edits.
   *  ============================================================ */

  /* ===========================
   * internals
   * =========================== */
  function log(...a){ if (DEBUG) console.info('[CMP A11Y]', ...a); }
  function warn(...a){ if (DEBUG) console.warn('[CMP A11Y]', ...a); }

  // Read cookie by name
  function readCookie(name){
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.*+?^${}()|[\]\\])/g,'\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  // Decide if we should skip entirely based on CMP’s own consent cookie or our local flag
  function alreadyConsented(){
    try {
      const raw = readCookie(CONSENT_COOKIE_NAME);
      if (raw) {
        // Treat any non-empty value as "decision exists"; tighten if you know your CMP’s schema.
        try {
          const obj = JSON.parse(raw);
          if (obj === true) return true;
          if (obj && (obj.consent === true || obj.accepted === true || obj.preferences === 'granted')) return true;
          return true;
        } catch {
          if (raw === '1' || raw === 'true' || raw.length > 0) return true;
        }
      }
      if (localStorage.getItem(CONSENT_FLAG) === '1') return true;
    } catch {}
    return false;
  }

  // Inject styles inside *a specific shadow root*
  function injectStylesIntoShadow(sr){
    // Prefer constructable stylesheet (works with strict CSP if allowed)
    try {
      if ('adoptedStyleSheets' in sr) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(`
          .sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
          .cf_modal :focus-visible{outline:2px solid #0ea5e9;outline-offset:2px;border-radius:4px}
          .cf_consent-element label{cursor:pointer}
          .cf-checkbox{transform:scale(1.15);transform-origin:center}
          /* Canary for adopters: swap color below to your brand to confirm the shim attached */
          #cf_modal_title{color:${BRAND_CANARY_COLOR} !important;}
        `);
        sr.adoptedStyleSheets = [...sr.adoptedStyleSheets, sheet];
        return;
      }
    } catch(e){ /* fall back to <style> below */ }

    // Fallback <style> inside the shadow root
    if (sr.getElementById && sr.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
      .cf_modal :focus-visible{outline:2px solid #0ea5e9;outline-offset:2px;border-radius:4px}
      .cf_consent-element label{cursor:pointer}
      .cf-checkbox{transform:scale(1.15);transform-origin:center}
      /* Canary for adopters: swap color below to your brand to confirm the shim attached */
      #cf_modal_title{color:${BRAND_CANARY_COLOR} !important;}
    `;
    sr.appendChild(style);
  }

  /* ============================================================
   * >>> BEGIN CUSTOM CMP FIXES (TAILOR TO YOUR RENDERED MARKUP) >>>
   * This block binds programmatic names/descriptions to checkboxes,
   * and (optionally) tightens buttons. Adapt selectors to your CMP.
   * ============================================================ */
  function enhanceModalInShadow(sr){
    // Most CMPs mount a <dialog class="cf_modal"> inside the shadow root. Adjust if yours differs.
    const hostDialog = sr.querySelector && sr.querySelector('dialog.cf_modal');
    if (!hostDialog) return false;

    injectStylesIntoShadow(sr);

    // Focus the title on open for good keyboard/screen-reader context
    const title = sr.querySelector('#cf_modal_title');
    if (title && !title.hasAttribute('tabindex')) title.setAttribute('tabindex','-1');
    if (hostDialog.hasAttribute('open') && title?.focus) title.focus();

    // For each consent item (li.cf_consent-element), map visible <summary> to the checkbox’s accessible name,
    // and add a concise description from the first <p> inside details.
    sr.querySelectorAll('li.cf_consent-element').forEach((li, idx) => {
      const input   = li.querySelector('input.cf-checkbox[type="checkbox"]');  // <-- adjust class if needed
      const label   = li.querySelector('label');
      const summary = label?.querySelector('summary');
      if (!input) return;

      // If you ran a prior version, remove any role overrides on <li> to satisfy audits
      if (li.hasAttribute('role')) li.removeAttribute('role');
      if (li.hasAttribute('aria-labelledby')) li.removeAttribute('aria-labelledby');

      // Ensure stable id + label association
      if (!input.id) input.id = `cf_checkbox_${idx}`;
      if (label && label.getAttribute('for') !== input.id) label.setAttribute('for', input.id);

      // Programmatic name for the checkbox from <summary> (preferred) or <label>
      if (summary) {
        if (!summary.id) summary.id = `cf_summary_${input.id}`;
        input.setAttribute('aria-labelledby', summary.id);
      } else if (label) {
        if (!label.id) label.id = `cf_label_${input.id}`;
        input.setAttribute('aria-labelledby', label.id);
      }

      // Concise description from first <p> in details
      const detailsBlock = label?.querySelector('summary + div') || li.querySelector('details > div');
      if (detailsBlock) {
        let desc = li.querySelector(`#cf_desc_${input.id}`);
        if (!desc) {
          desc = document.createElement('span');
          desc.id = `cf_desc_${input.id}`;
          desc.className = 'sr-only';
          input.insertAdjacentElement('afterend', desc);
        }
        const firstP = detailsBlock.querySelector('p');
        const text = firstP ? firstP.textContent.trim() : '';
        desc.textContent = text || 'Additional details available in this section.';
        input.setAttribute('aria-describedby', desc.id);
      }
    });

    // Harden buttons (optional)
    sr.querySelectorAll('button:not([type])').forEach(b => b.setAttribute('type','button'));
    const mark = () => { try { localStorage.setItem(CONSENT_FLAG,'1'); } catch{} };
    [ACCEPT_BTN_ID, REJECT_BTN_ID, SAVE_BTN_ID]
      .map(id => sr.getElementById ? sr.getElementById(id) : null)
      .filter(Boolean)
      .forEach(btn => btn.addEventListener('click', mark, { once:true }));

    log('✅ A11Y applied inside shadow root');
    return true;
  }
  /* ============================================================
   * <<< END CUSTOM CMP FIXES (TAILOR TO YOUR RENDERED MARKUP) <<<
   * Everything below is the generic shadow-root plumbing.
   * ============================================================ */

  // Watch a shadow root until the dialog appears, then enhance and stop
  function watchShadowRoot(sr){
    if (enhanceModalInShadow(sr)) return true;
    const mo = new MutationObserver(() => {
      if (enhanceModalInShadow(sr)) mo.disconnect();
    });
    mo.observe(sr, { childList:true, subtree:true });
    return false;
  }

  // Hook attachShadow so we see *open or closed* roots as they’re created
  (function hookAttachShadowEarly(){
    const orig = Element.prototype.attachShadow;
    if (!orig) return;
    Element.prototype.attachShadow = function(init){
      const root = orig.call(this, init);
      log('attachShadow captured', this, init && init.mode);
      watchShadowRoot(root);
      return root;
    };
  })();

  // Guards: skip if consent already recorded or if we’ve already patched this tab
  if (alreadyConsented()) { log('Skip: consent already recorded'); return; }
  if (sessionStorage.getItem(SESSION_FLAG) === '1') { log('Skip: session already patched'); return; }

  // Also scan any already-open shadow roots (in case CMP attached before our hook)
  (function scanOpenShadowRoots(){
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (el.shadowRoot) watchShadowRoot(el.shadowRoot);
    }
  })();

  // Mark session patched after a grace period if a dialog is present (best-effort)
  setTimeout(() => {
    if (document.querySelector('dialog.cf_modal')) {
      try { sessionStorage.setItem(SESSION_FLAG,'1'); } catch {}
    }
  }, 15000);
})();
