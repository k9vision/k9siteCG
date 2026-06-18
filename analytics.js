/*
 * Google Analytics 4 (GA4) — K9 Vision
 * ------------------------------------------------------------------
 * SETUP (one time, ~2 minutes):
 *   1. Go to https://analytics.google.com  ->  Admin (gear, bottom-left)
 *   2. Create Account -> "K9 Vision", then Create Property -> "k9visiontx.com"
 *   3. Set up a "Web" data stream for https://k9visiontx.com
 *   4. Copy the Measurement ID (it looks like  G-XXXXXXXXXX )
 *   5. Paste it below on the GA_MEASUREMENT_ID line, replacing G-XXXXXXXXXX
 *   6. Deploy.  Tracking is now live on EVERY page automatically.
 *
 * This is the ONLY place you ever need to set the ID. Every page loads
 * this file, so you never touch the HTML again.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  // 👇 PASTE YOUR REAL MEASUREMENT ID HERE (replace G-XXXXXXXXXX)
  var GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

  // Safe no-op so analytics calls elsewhere never throw before setup is done.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  // Convenience helper used across the site for conversion events.
  window.trackEvent = function (name, params) {
    try { window.gtag('event', name, params || {}); } catch (e) { /* noop */ }
  };

  // Until a real ID is set, stay silent — no network calls, no console noise.
  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID.indexOf('G-XXXXXXXXXX') === 0) {
    return;
  }

  // Load the official gtag.js library asynchronously.
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
  document.head.appendChild(s);

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    anonymize_ip: true,           // privacy-friendly
    send_page_view: true          // GA4 enhanced measurement handles scroll/outbound clicks
  });
})();
