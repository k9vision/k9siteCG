/*
 * K9 Vision — Cookie / Privacy consent banner (strict opt-in).
 * ------------------------------------------------------------------
 * Self-contained: injects its own CSS + DOM, no Tailwind dependency, so it
 * renders identically on every page. It GATES analytics.js — nothing is
 * tracked (no visitor-geo beacon, no Google Analytics) until the visitor
 * clicks Accept (or enables Analytics and Saves).
 *
 * Public API (window.K9Consent):
 *   analyticsAllowed()  -> boolean   (a decision was made AND analytics allowed)
 *   decided()           -> boolean   (the visitor has chosen)
 *   openPreferences()   -> re-show the banner (wired to the footer link)
 *
 * On a choice it stores localStorage['k9_consent'] and dispatches a
 * window 'k9:consent' CustomEvent({detail:{analytics}}) that analytics.js hears.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'k9_consent';
  var PRIVACY_URL = '/privacy-policy.html';
  var BANNER_ID = 'k9c-banner';
  var STYLE_ID = 'k9c-styles';

  // Session-only keys. Both are cleared when the browser session ends and neither
  // identifies the visitor; they exist purely to operate the consent tool itself.
  var DISMISS_KEY = 'k9_dismissed';     // "×" was clicked — ask again next visit
  var GEO_KEY = 'k9_geo';               // cached 2-letter country for this session
  var GEO_URL = '/api/geo';
  var GEO_TIMEOUT_MS = 1200;

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && typeof s.analytics === 'boolean') ? s : null;
    } catch (e) { return null; }
  }

  function writeState(analytics) {
    var s = { analytics: !!analytics, decided: true, ts: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }

  function readDismissed() {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }

  var state = readState();
  var dismissed = readDismissed();

  // Show the banner only to visitors who have neither decided nor dismissed it.
  function needBanner() { return !(state && state.decided) && !dismissed; }

  function gpcEnabled() { return navigator.globalPrivacyControl === true; }

  // ---- Public API (defined synchronously so analytics.js can read it) ----
  window.K9Consent = {
    analyticsAllowed: function () { return !!(state && state.decided && state.analytics); },
    decided: function () { return !!(state && state.decided); },
    openPreferences: function () {
      // A stored choice makes country irrelevant — render immediately, no request.
      if (state && state.decided) { renderBanner(true); return; }
      whenGeoReady(function () { renderBanner(true); });
    }
  };

  function emit(analytics) {
    try {
      window.dispatchEvent(new CustomEvent('k9:consent', { detail: { analytics: !!analytics } }));
    } catch (e) { /* older browsers: analytics.js also checks state on next load */ }
  }

  function save(analytics) {
    state = writeState(analytics);
    removeBanner();
    emit(analytics);
  }

  // "×" = "not now", NOT a decision. Deliberately does not call writeState (so
  // nothing is persisted and the banner returns next visit) and does not emit a
  // 'k9:consent' event (no choice was made). analyticsAllowed() keeps returning
  // false for the whole session because `state` is untouched.
  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    dismissed = true;
    removeBanner();
  }

  /* ---- Country resolver ---------------------------------------------------
   * INVARIANT: country affects ONLY the initial `checked` attribute of the
   * analytics checkbox. It never touches `state`, never affects
   * analyticsAllowed(), and never starts analytics. Analytics still begins only
   * via save() -> emit() -> the 'k9:consent' listener in analytics.js, i.e. only
   * after the visitor clicks. Do not make analyticsAllowed() consult geoCountry.
   * ------------------------------------------------------------------------ */
  var geoCountry = null;   // 'US' | 'DE' | ... | null (unknown -> fails closed)
  var geoResolved = false;
  var geoStarted = false;
  var geoQueue = [];

  function geoDone(c) {
    if (geoResolved) return;   // first resolution wins (response vs timeout)
    geoResolved = true;
    geoCountry = c;
    while (geoQueue.length) geoQueue.shift()();
  }

  function startGeo() {
    if (geoStarted) return;
    geoStarted = true;

    // GPC forces unchecked regardless of country, so don't even ask.
    if (gpcEnabled()) { geoDone(null); return; }

    try {
      var cached = sessionStorage.getItem(GEO_KEY);
      if (cached) { geoDone(cached === '??' ? null : cached); return; }
    } catch (e) { /* sessionStorage blocked — fall through to the network */ }

    if (typeof fetch !== 'function') { geoDone(null); return; }

    var timer = setTimeout(function () { geoDone(null); }, GEO_TIMEOUT_MS);

    fetch(GEO_URL, { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var c = (d && typeof d.country === 'string') ? d.country : null;
        // Cache even if the timeout already fired — self-heals the next page view.
        try { sessionStorage.setItem(GEO_KEY, c || '??'); } catch (e) {}
        clearTimeout(timer);
        geoDone(c);
      })
      .catch(function () { clearTimeout(timer); geoDone(null); });
  }

  function whenGeoReady(cb) {
    if (geoResolved) { cb(); return; }
    geoQueue.push(cb);
    startGeo();
  }

  // Default state of the analytics checkbox, in priority order.
  function defaultAnalyticsChecked() {
    // A stored choice always wins — reopening preferences must mirror what the
    // visitor actually chose, not their geography.
    if (state && state.decided) return !!state.analytics;
    // Global Privacy Control beats the US default (California CPRA).
    if (gpcEnabled()) return false;
    // Fails closed: unknown/failed/timed-out lookups are not 'US'.
    return geoCountry === 'US';
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '#k9c-banner{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#1F2937;color:#F9FAFB;' +
      'border-top:1px solid #374151;box-shadow:0 -8px 30px rgba(0,0,0,.35);' +
      "font-family:'Poppins',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:18px 18px 16px;" +
      'animation:k9c-up .3s ease-out}' +
      '@keyframes k9c-up{from{transform:translateY(100%)}to{transform:translateY(0)}}' +
      '#k9c-banner .k9c-inner{max-width:1100px;margin:0 auto;display:flex;gap:18px;align-items:center;' +
      'justify-content:space-between;flex-wrap:wrap}' +
      '#k9c-banner .k9c-text{flex:1 1 420px;min-width:240px;padding-right:8px}' +
      '#k9c-banner .k9c-title{display:block;font-size:15px;margin-bottom:4px}' +
      '#k9c-banner .k9c-desc{margin:0 0 10px;font-size:13px;line-height:1.5;color:#D1D5DB}' +
      '#k9c-banner .k9c-link{color:#60A5FA;text-decoration:underline}' +
      '#k9c-banner .k9c-cats{display:flex;flex-direction:column;gap:6px}' +
      '#k9c-banner .k9c-cat{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:#D1D5DB;cursor:pointer}' +
      '#k9c-banner .k9c-cat input{margin-top:2px;accent-color:#3B82F6}' +
      '#k9c-banner .k9c-cat input[disabled]{opacity:.7;cursor:not-allowed}' +
      '#k9c-banner .k9c-actions{display:flex;gap:10px;flex:0 0 auto;flex-wrap:wrap;align-items:center}' +
      '#k9c-banner .k9c-btn{border:0;border-radius:9999px;padding:10px 18px;font-size:13px;font-weight:600;' +
      'cursor:pointer;white-space:nowrap;transition:background .15s,opacity .15s}' +
      '#k9c-banner .k9c-primary{background:#3B82F6;color:#fff}' +
      '#k9c-banner .k9c-primary:hover{background:#1D4ED8}' +
      '#k9c-banner .k9c-solid{background:#374151;color:#fff}' +
      '#k9c-banner .k9c-solid:hover{background:#4B5563}' +
      '#k9c-banner .k9c-ghost{background:transparent;color:#E5E7EB;border:1px solid #4B5563}' +
      '#k9c-banner .k9c-ghost:hover{background:rgba(255,255,255,.08)}' +
      '#k9c-banner .k9c-x{position:absolute;top:8px;right:10px;background:transparent;border:0;color:#9CA3AF;' +
      'font-size:24px;line-height:1;cursor:pointer;padding:2px 8px}' +
      '#k9c-banner .k9c-x:hover{color:#fff}' +
      '@media(max-width:760px){#k9c-banner .k9c-inner{flex-direction:column;align-items:stretch}' +
      '#k9c-banner .k9c-actions{justify-content:stretch}' +
      '#k9c-banner .k9c-actions .k9c-btn{flex:1 1 auto;text-align:center}}';
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function removeBanner() {
    var b = document.getElementById(BANNER_ID);
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  function renderBanner(force) {
    if (!force && state && state.decided) return; // already chose — stay quiet
    if (!document.body) { // head still parsing; defer
      document.addEventListener('DOMContentLoaded', function () { renderBanner(force); });
      return;
    }
    injectStyles();
    removeBanner();

    var preAnalytics = defaultAnalyticsChecked();
    var wrap = document.createElement('div');
    wrap.id = BANNER_ID;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Cookie consent');
    wrap.innerHTML = [
      '<button type="button" class="k9c-x" aria-label="Close — we&#39;ll ask again later">&times;</button>',
      '<div class="k9c-inner">',
        '<div class="k9c-text">',
          '<strong class="k9c-title">🍪 Your privacy, your choice</strong>',
          '<p class="k9c-desc">We use cookies and approximate location (city / region) to understand site ' +
            'traffic and improve K9 Vision. <strong>Nothing is tracked until you choose.</strong> ' +
            'Read our <a href="' + PRIVACY_URL + '" class="k9c-link">Privacy Policy</a>.</p>',
          '<div class="k9c-cats">',
            '<label class="k9c-cat"><input type="checkbox" checked disabled> ' +
              '<span><strong>Strictly Necessary</strong> — required for the site to work. Always on.</span></label>',
            '<label class="k9c-cat"><input type="checkbox" id="k9c-analytics"' + (preAnalytics ? ' checked' : '') + '> ' +
              '<span><strong>Analytics &amp; Location</strong> — visitor geography, Google Analytics &amp; Microsoft Clarity.</span></label>',
          '</div>',
        '</div>',
        '<div class="k9c-actions">',
          '<button type="button" class="k9c-btn k9c-solid" id="k9c-reject">Reject All</button>',
          '<button type="button" class="k9c-btn k9c-ghost" id="k9c-save">Save Preferences</button>',
          '<button type="button" class="k9c-btn k9c-primary" id="k9c-accept">Accept All</button>',
        '</div>',
      '</div>'
    ].join('');

    wrap.querySelector('.k9c-x').addEventListener('click', function () { dismiss(); });
    wrap.querySelector('#k9c-reject').addEventListener('click', function () { save(false); });
    wrap.querySelector('#k9c-accept').addEventListener('click', function () { save(true); });
    wrap.querySelector('#k9c-save').addEventListener('click', function () {
      var cb = wrap.querySelector('#k9c-analytics');
      save(!!(cb && cb.checked));
    });

    document.body.appendChild(wrap);
  }

  // First visit (no decision yet) → resolve country, then show the banner once.
  // needBanner() is checked BEFORE whenGeoReady, so visitors who already decided
  // (the large majority of page views) never trigger the /api/geo request at all.
  // We wait for the lookup rather than rendering unchecked and flipping later:
  // save() reads the live checkbox, so a box that ticks itself between the
  // visitor reading it and clicking Save would record the opposite of what they
  // consented to.
  function boot() { if (needBanner()) whenGeoReady(function () { renderBanner(false); }); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
