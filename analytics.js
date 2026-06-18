/*
 * Google Analytics 4 (GA4) + first-party visitor-geo beacon — K9 Vision
 * ------------------------------------------------------------------
 * SETUP (one time, ~2 minutes):
 *   1. Go to https://analytics.google.com  ->  Admin (gear, bottom-left)
 *   2. Create Account -> "K9 Vision", then Create Property -> "k9visiontx.com"
 *   3. Set up a "Web" data stream for https://k9visiontx.com
 *   4. Copy the Measurement ID (it looks like  G-XXXXXXXXXX )
 *   5. Paste it below on the GA_MEASUREMENT_ID line, replacing G-XXXXXXXXXX
 *   6. Deploy.  This is the ONLY place you ever set the ID.
 *
 * PRIVACY: Nothing here runs until the visitor grants the "Analytics" category
 * in the cookie banner (consent.js). Strict opt-in — see window.K9Consent.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  // 👇 PASTE YOUR REAL MEASUREMENT ID HERE (replace G-XXXXXXXXXX)
  var GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

  // Safe no-op stubs so conversion calls elsewhere never throw before
  // consent/setup (they simply queue to dataLayer and go nowhere until GA starts).
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.trackEvent = function (name, params) {
    try { window.gtag('event', name, params || {}); } catch (e) { /* noop */ }
  };

  var started = false;

  function startGA() {
    // Skip cleanly until a real Measurement ID is configured above.
    if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID.indexOf('G-XXXXXXXXXX') === 0) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
      anonymize_ip: true,
      send_page_view: true
    });
  }

  function sendGeoBeacon() {
    // First-party page view -> /api/track (Cloudflare Function reads request.cf:
    // city / state / ZIP / country) -> D1 -> admin "Visitor Geography" view.
    try {
      var payload = JSON.stringify({
        page_url: location.pathname + location.search,
        referrer: document.referrer || null
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) { /* never break the page over analytics */ }
  }

  function startAnalytics() {
    if (started) return; // run once per page load
    started = true;
    startGA();
    sendGeoBeacon();
  }

  // Strict opt-in: only run when the visitor has granted Analytics consent.
  if (window.K9Consent && window.K9Consent.analyticsAllowed()) {
    startAnalytics();
  }
  // ...and start the instant they accept (captures the page they're on).
  window.addEventListener('k9:consent', function (e) {
    if (e && e.detail && e.detail.analytics) startAnalytics();
  });
})();
